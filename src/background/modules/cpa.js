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
        switch (alarmInfo.name) {
            case "appUsage":
                chrome.storage.local.set({
                    "settings.appUsedToday": false
                });

                break;

            case "dayuse":
                chrome.storage.local.get({
                    "settings.songsPlayed": Config.default_settings_local.songsPlayed,
                    "settings.headerOverlayActions": Config.default_settings_local.headerOverlayActions,
                    "settings.lastfmToken": Config.default_settings_local.lastfmToken,
                    "settings.vkToken": Config.default_settings_local.vkToken,
                    "settings.appUsedToday": Config.default_settings_local.appUsedToday
                }, function (records) {
                    CPA.sendEvent("Lyfecycle", "Dayuse.New", "Total", 1); // total app users
                    CPA.sendEvent("Lyfecycle", "Dayuse.New", "Active users", records["settings.appUsedToday"]); // total users, who opened app today

                    var isAuthorized = (records["settings.vkToken"].length > 0);
                    CPA.sendEvent("Lyfecycle", "Dayuse.New", "Is authorized", isAuthorized); // authorized users

                    if (isAuthorized) {
                        CPA.sendEvent("Lyfecycle", "Dayuse.New", "Played songs", records["settings.songsPlayed"]); // total played songs
                        CPA.sendEvent("Lyfecycle", "Dayuse.New", "Is scrobbling", (records["settings.lastfmToken"].length > 0)); // LFM users

                        CPA.sendEvent("Lyfecycle", "Dayuse.New", "Header CWS clicks", records["settings.headerOverlayActions"].ratecws); // header CWS clicks
                        CPA.sendEvent("Lyfecycle", "Dayuse.New", "Header YaMoney clicks", records["settings.headerOverlayActions"].yamoney); // header Yamoney clicks
                        CPA.sendEvent("Lyfecycle", "Dayuse.New", "Header Close clicks", records["settings.headerOverlayActions"].close); // header Close clicks
                    }
                });

                break;
        }
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

        sendEvent: function CPA_sendEvent(category, action, label, valueCount) {
            var args = [];

            for (var i = 0, len = Math.min(arguments.length, 4); i < len; i++) {
                if (i === 3) {
                    if (typeof valueCount === "boolean") {
                        valueCount = Number(valueCount);
                    } else if (typeof valueCount !== "number") {
                        valueCount = parseInt(valueCount, 10) || 0;
                    }

                    args.push(valueCount);
                } else {
                    if (typeof arguments[i] !== "string") {
                        args.push(JSON.stringify(arguments[i]));
                    } else {
                        args.push(arguments[i]);
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
