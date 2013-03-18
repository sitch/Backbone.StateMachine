Backbone.StateMachine
=====================

State Machine for Backbone.  Useful for async transitions (via jQuery deferreds), and responding to state change events based on a configuration grammar.


var fsm = new BackboneStateMachine({
	initial: 'initial',
	transitions: {
		initial: {
			fromTo: ['*', 'start'],
			async: function (id) {

				return 'start'
			},
			after: function (id) {
				this.goToInitial();
			}
		}
	}
}

