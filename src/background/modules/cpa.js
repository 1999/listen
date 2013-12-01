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
                    "settings.headerPay": Config.default_settings_local.headerPay,
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

                        CPA.sendEvent("Lyfecycle", "Dayuse.New", "Header CWS clicks", records["settings.headerPay"].ratecws); // header CWS clicks
                        CPA.sendEvent("Lyfecycle", "Dayuse.New", "Header YaMoney clicks", records["settings.headerPay"].yamoney); // header Yamoney clicks
                        CPA.sendEvent("Lyfecycle", "Dayuse.New", "Header Close clicks", records["settings.headerPay"].close); // header Close clicks
                    }
                });

                break;

            case "contestNotifier":
                chrome.storage.local.get({
                    "settings.vkToken": Config.default_settings_local.vkToken,
                    "appInstallDate": Date.now()
                }, function (records) {
                    var isAuthorized = (records["settings.vkToken"].length > 0);
                    var dayPassedAfterInstall = ((Date.now() - records.appInstallDate) > 86400000);
                    var appName = chrome.runtime.getManifest().name;

                    var now = new Date;
                    var hours = now.getHours();
                    var rightTime = false;

                    if ([0, 6].indexOf(now.getDay()) !== -1) { // weekend
                        rightTime = (hours >= 12 && hours < 21);
                    } else {
                        rightTime = (hours >= 15 && hours < 23);
                    }

                    if (!rightTime || !dayPassedAfterInstall)
                        return;

                    chrome.alarms.clear("contestNotifier");

                    chrome.notifications && chrome.notifications.create("contest", {
                        type: "basic",
                        iconUrl: chrome.runtime.getURL("/pic/icon48.png"),
                        title: chrome.i18n.getMessage("notificationUpdateTitle"),
                        message: chrome.i18n.getMessage("contestNotificationBody", appName),
                        buttons: [
                            {title: chrome.i18n.getMessage("contestButtonFirst")},
                            {title: chrome.i18n.getMessage("contestButtonSecond")}
                        ]
                    }, function () {});
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
