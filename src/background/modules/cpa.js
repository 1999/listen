CPA = (function () {
    "use strict";

    var service = analytics.getService(Config.constants.ga_app_id);
    var tracker = service.getTracker(Config.constants.ga_app_counter);

    chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
        if (req.action !== "stat")
            return;

        var returnValue = false;
        var args = req.args || [];

        if (req.method === "isTrackingPermitted") {
            args.push(sendResponse);
            returnValue = true;
        }

        CPA[req.method] && CPA[req.method].apply(CPA, args);
        return returnValue;
    });

    chrome.alarms.onAlarm.addListener(function (alarmInfo) {
        if (alarmInfo.name !== "dayuse")
            return;

        chrome.storage.local.get({
            installId: null,
            "settings.songsPlayed": Config.default_settings_local.songsPlayed,
            "settings.songsPlayingMode": Config.default_settings_local.songsPlayingMode,
            "settings.headerPay": Config.default_settings_local.headerPay,
            "settings.lastfmToken": Config.default_settings_local.lastfmToken,
            "settings.study": Config.default_settings_local.study
        }, function (records) {
            CPA.sendEvent("Lyfecycle", "Dayuse", {
                id: records.installId,
                ver: chrome.runtime.getManifest().version,
                played: records["settings.songsPlayed"],
                songsPlayingMode: records["settings.songsPlayingMode"],
                header: records["settings.headerPay"],
                cloudStudy: (records["settings.study"].indexOf("cloud") !== -1),
                lfmStudy: (records["settings.study"].indexOf("lastfm") !== -1),
                lfmAuth: (records["settings.lastfmToken"].length > 0)
            });
        });
    });


    return {
        changePermittedState: function CPA_changePermittedState(permitted) {
            service.getConfig().addCallback(function (config) {
                config.setTrackingPermitted(permitted);
            });
        },

        isTrackingPermitted: function CPA_isTrackingPermitted(callback) {
            service.getConfig().addCallback(function (config) {
                callback(config.isTrackingPermitted());
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
