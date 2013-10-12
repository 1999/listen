CPA = (function() {
    "use strict";

    return {
        sendEvent: function CPA_sendEvent() {
            var args = [].slice.call(arguments, 0, 4);

            chrome.runtime.sendMessage({
                action: "stat",
                method: "sendEvent",
                args: args
            });
        },

        isTrackingPermitted: function CPA_isTrackingPermitted(callback) {
            chrome.runtime.sendMessage({
                action: "stat",
                method: "isTrackingPermitted"
            }, callback);
        },

        changePermittedState: function CPA_changePermittedState(permitted) {
            chrome.runtime.sendMessage({
                action: "stat",
                method: "changePermittedState",
                args: [permitted]
            });
        },

        sendAppView: function CPA_sendAppView(viewName) {
            chrome.runtime.sendMessage({
                action: "stat",
                method: "sendAppView",
                args: [viewName]
            });
        }
    };
})();
