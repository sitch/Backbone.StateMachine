define(function (require) {
  'use strict';

  var $ = require('jquery');
  var _ = require('underscore');
  var Backbone = require('backbone');
  var ErrorInstance = require('error');

  var result = {
    WILDCARD: '*',
    RESULT: {
      SUCCEEDED: 1,
      NOTRANSITION: 2,
      CANCELLED: 3,
      ASYNC: 4,
      NOT_STARTED: 5
    },
    ERROR: {
      INVALID_TRANSITION: 100,
      PENDING_TRANSITION: 200,
      INVALID_CALLBACK: 300,
      NO_ERROR: 400
    }
  };

  var StateModel = Backbone.Model.extend({
    defaults: {
      // transition: this.RESULT.NOT_STARTED,
      // error: this.ERROR.NO_ERROR,
      state: 'initial'
    },
    update: function (type, status, prev, current, transition) {
      this.state.set({
        type: type,
        status: status,
        current: current,
        prev: prev,
        transition: transition
      });
    }
  });

  function BackboneStateMachine(config) {

    var initial = config.initial || 'initial';

    this.state = new StateModel({
      status: 'SUCCEEDED',
      type: '',
      prev: '',
      current: initial,
      transition: ''
    });

    this.transitionTable = this._buildTransitionTable(config.transitions);
    this._extendPublicTransitions(config.transitions);
    return this;
  }
  BackboneStateMachine.prototype = {
    _buildTransitionTable: function (transitions) {
      var matrix = {};
      var to, from;

      _.each(transitions, function (transition, name) {
        from = transition.fromTo[0];
        to = transition.fromTo[1];

        if(!matrix.hasOwnProperty(from)) {
          matrix[from] = {};
        }
        if(_.isObject(to)) {
          _.each(to, function (toInstance) {
            if(matrix[from].hasOwnProperty(toInstance)) {
              throw new Error('Collision on StateTransitionTable[' + from + '][' + toInstance + ']');
            }
            matrix[from][toInstance] = transition;
          });
        } else {
          matrix[from][to] = transition;
        }
      });
      return matrix;
    },
    _resolveTransitionState: function (transition, args) {
      var from = transition.transitionState ? this.state.get('prev') : this.state.get('current');
      var to = transition.fromTo[1];

      if(_.isObject(to)){
        to = to[transition.onResolve.apply(this, args || [])];
      }

      if(!this.isValidTransition(from, to)) {
        throw new Error('Invalid Transition: ' + to);
      }
      return to;
    },
    _beginAsyncTransition: function (name, transition) {
      this.state.set({
        type: 'ASYNC',
        status: 'STARTED',
        current: transition.transitionState ? transition.transitionState : this.state.get('current'),
        prev: this.state.get('current'),
        transition: name
      });
    },
    _completeAsyncTransition: function (name, transition, args) {
      var status = this.state.get('status');
      var wasCancelled = status === 'CANCELLED';

      this.state.set({
        type: 'ASYNC',
        status: wasCancelled ? 'FAILED' : 'SUCCEEDED',
        prev: this.state.get(wasCancelled ? 'prev' : 'current'),
        current: wasCancelled ? this.state.get('current') : this._resolveTransitionState(transition, args),
        transition: name
      });
    },
    _completeTransition: function (name, transition, args) {
      this.state.set({
        type: 'SYNC',
        status: 'SUCCEEDED',
        prev: this.state.get('current'),
        current: this._resolveTransitionState(transition, args),
        transition: name
      });
    },
    _buildTransitionFn: function (name, transition, self) {
      return function () {
        var args = arguments;

        // If function is invoked from an improper state, ignore call
        if(self.state.get('current') !== transition.fromTo[0] && transition.fromTo[0] !== result.WILDCARD) {
          return;
        }

        // Before
        if(_.isFunction(transition.before)) {
          transition.before.apply(self, arguments || []);
        }

        // Async 
        if(_.isFunction(transition.async)) {
          var deferred = transition.async.apply(self, arguments || []);

          self._beginAsyncTransition(name, transition, deferred);

          $.when(deferred).then(function () {
            self._completeAsyncTransition(name, transition, args);

            // After 
            if(_.isFunction(transition.after)) {
              transition.after.apply(self, args || []);
            }
          });
        } else {
          // Transition
          if(_.isFunction(transition.transition)) {
            transition.transition.apply(self, arguments || []);
            self._completeTransition(name, transition, arguments);

          }
          // After 
          if(_.isFunction(transition.after)) {
            transition.after.apply(self, arguments || []);
          }
        }

      };
    },
    _extendPublicTransitions: function (transitions) {
      var self = this;
      _.each(transitions, function (transition, name) {
        if(self.hasOwnProperty(name)) {
          throw new Error('Property: ' + name + ' already exists.');
        }
        // if(!_.isFunction(transition.async) && !_.isFunction(transition.transition)) {
        //   throw new Error('Must supply either an Async or Transition property for: ' + name);
        // }
        self[name] = self._buildTransitionFn(name, transition, self);
      });
    },

    // PUBLIC METHODS
    getState: function () {
      return this.state.get('state');
    },
    isValidTransition: function (from, to) {
      var isValid = this.transitionTable.hasOwnProperty(from) && this.transitionTable[from].hasOwnProperty(to);
      var isWildCard = this.transitionTable.hasOwnProperty(result.WILDCARD) && this.transitionTable[result.WILDCARD].hasOwnProperty(to);

      return isValid || isWildCard;
    },
    cancel: function () {
      if(this.state.get('transition') === this.RESULT.ASYNC) {
        // if(_.isFunction(transition.onCancel)) {
        //   transition.onCancel.apply(self, arguments || []);
        //   self.state.set('action', '');
        // }
        this.state.deferred.abort();
        this.state.set('action', this.RESULT.CANCELLED);
      }
    }
    // ,
    // goBack: function() {
    //   var prevState = this.state.get('prevState');
    //   var currentState = this.state.get('current');
    //   var transition = this.transitionTable[prevState][currentState];
    //   if(transition.onReverse) {
    //     transition.onReverse.apply(this, arguments || []);
    //     this.state.set({
    //       state: this.state.get('prevState')
    //     });
    //   }
    // }
  };
  return BackboneStateMachine;
});