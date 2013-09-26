CPA = (function () {
    "use strict";

    var service = analytics.getService(Config.constants.ga_app_id);
    var tracker = service.getTracker(Config.constants.ga_app_counter);

    chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
        if (req.action === "stat") {
            CPA[req.method] && CPA[req.method].apply(CPA, req.args);
        }
    });

    chrome.alarms.onAlarm.addListener(function (alarmInfo) {
        if (alarmInfo.name !== "dayuse")
            return;

        chrome.storage.local.get("installId", function (records) {
            CPA.sendEvent("Lyfecycle", "Dayuse", {
                id: records.installId,
                ver: chrome.runtime.getManifest().version,
                played: Settings.get("songsPlayed"),
                songsPlayingMode: Settings.get("songsPlayingMode"),
                header: Settings.get("headerPay")
            });
        });
    });


    return {
        changePermittedState: function CPA_changePermittedState(permitted) {
            service.getConfig().addCallback(function (config) {
                config.setTrackingPermitted(permitted);
            });
        },

        sendEvent: function CPA_sendEvent() {
            var args = [];

            for (var i = 0, len = Math.min(arguments.length, 4); i < len; i++) {
                if (i === 3) {
                    args.push(parseInt(arguments[3], 10));
                } else {
                    if (typeof arguments[i] === "object") {
                        args.push(JSON.stringify(arguments[i]));
                    } else {
                        args.push(arguments[i] + "");
                    }
                }
            }

            tracker.sendEvent.apply(tracker, args);
        },

        sendAppView: function CPA_sendAppView(viewName) {
            tracker.sendAppView(viewName);
        }
    };
})();
