Backbone.StateMachine
=====================

State Machine for Backbone.  Useful for async transitions (via jQuery deferreds), and responding to state change events based on a configuration grammar.

```js
var fsm = new BackboneStateMachine({
	initial: 'initial',
	transitions: {
		initial: {
			transition: ['*', 'initialPending', 'initial'],

			before: function(){
				console.log('do something')
			},
			during: function (id) {

				return $.ajax();
			},
			after: function (id) {
				this.goToInitial();
			},
			cancel: function(){
				
			}
		}
	}
}

fsm.getState()
fsm.isValidTransition();
fsm.cancel();
fsm.initial();
fsm.next();
```
