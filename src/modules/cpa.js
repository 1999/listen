CPA = (function () {
    "use strict";

    var service = analytics.getService(Config.constants.ga_app_id);
    var tracker = service.getTracker(Config.constants.ga_app_counter);


    return {
        changePermittedState: function CPA_changePermittedState(permitted) {
            service.getConfig().addCallback(function (config) {
                config.setTrackingPermitted(permitted);
            });
        },

        sendEvent: function CPA_sendEvent() {
            var args = [].slice.call(arguments, 0, 4);
            if (args.length === 4)
                args[3] = parseInt(args[3], 10);

            tracker.sendEvent.apply(tracker, args);
        },

        sendAppView: function CPA_sendAppView(viewName) {
            tracker.sendAppView(viewName);
        }
    };
})();
