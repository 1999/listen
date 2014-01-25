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
            this.increaseCustomStat("views", viewName);

            chrome.runtime.sendMessage({
                action: "stat",
                method: "sendAppView",
                args: [viewName]
            });
        },

        increaseCustomStat: function CPA_increaseCustomStat(param, subParam) {
            var key = (arguments.length === 1) ? "global." + param : param + "." + subParam;

            var currentStat = Settings.get("stat");
            currentStat[key] = currentStat[key] || 0;
            currentStat[key] += 1;

            Settings.set("stat", currentStat);
        }
    };
})();
