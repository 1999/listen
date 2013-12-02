window.onerror = function(msg, url, line) {
    var msgError = msg + " in " + url + " (line: " + line + ")";
    console.error(msgError);

    chrome.storage.local.get({
        "settings.isDebug": Config.default_settings_local.isDebug
    }, function (records) {
        if (!records["settings.isDebug"]) {
            CPA.sendEvent("Errors", chrome.runtime.getManifest().version, {
                msg: msg,
                url: url,
                line: line
            });
        }
    });
};

(function () {
    "use strict";

    // добавляем sandbox при загрузке DOM
    document.addEventListener("DOMContentLoaded", function () {
        var iframe = document.createElement("iframe");
        iframe.setAttribute("src", "/sandbox/page.html");
        iframe.setAttribute("id", "sandbox");
        document.body.appendChild(iframe);
    }, false);

    chrome.notifications && chrome.notifications.onClicked.addListener(function (notificationId) {
        switch (notificationId) {
            case "update2to3":
            case "updateTo4":
                chrome.notifications.clear(notificationId, function () {});
                var currentAppWindow = chrome.app.window.current();

                if (currentAppWindow) {
                    currentAppWindow.show();
                } else {
                    openAppWindow();
                }

                break;

            case "contest":
                var records = {};
                records.showContestInfo = true;

                chrome.storage.local.set(records, function () {
                    chrome.storage.local.get({
                        "settings.vkToken": Config.default_settings_local.vkToken
                    }, function (records) {
                        var isAuthorized = (records["settings.vkToken"].length > 0);

                        if (isAuthorized) {
                            openAppWindow();
                        } else {
                            window.open(Config.constants.vk_contest_url);
                        }
                    });
                });

                break;
        }
    });

    chrome.notifications && chrome.notifications.onButtonClicked.addListener(function (notificationId, buttonIndex) {
        chrome.notifications.clear(notificationId, function () {});

        switch (notificationId) {
            case "update2to3":
            case "update":
                if (buttonIndex === 0) {
                    var currentAppWindow = chrome.app.window.current();

                    if (currentAppWindow) {
                        currentAppWindow.show();
                    } else {
                        openAppWindow();
                    }
                }

                break;

            case "contest":
                if (buttonIndex === 1) {
                    var records = {};
                    records.showContestInfo = true;

                    chrome.storage.local.set(records, function () {
                        chrome.storage.local.get({
                            "settings.vkToken": Config.default_settings_local.vkToken
                        }, function (records) {
                            var isAuthorized = (records["settings.vkToken"].length > 0);

                            if (isAuthorized) {
                                openAppWindow();
                            } else {
                                window.open(Config.constants.vk_contest_url);
                            }
                        });
                    });
                }

                break;
        }
    });


    // install & update handling
    chrome.runtime.onInstalled.addListener(function (details) {
        var appName = chrome.runtime.getManifest().name;
        var currentVersion = chrome.runtime.getManifest().version;

        switch (details.reason) {
            case "install":
                CPA.changePermittedState(true);
                CPA.sendEvent("Lyfecycle", "Dayuse.New", "Install", 1);

                // prevent new icon from blinking on fresh install
                var seenChangelog;
                var records = {};

                try {
                    seenChangelog = Object.keys(chrome.runtime.getManifest().changelog);
                } catch (ex) {
                    seenChangelog = [];
                }

                records["settings.changelog"] = seenChangelog;
                chrome.storage.local.set(records);
                break;

            case "update":
                if (currentVersion !== details.previousVersion) {
                    // starting from 3.0 there must be no MP3 download buttons in the app
                    // but users of 2.x should continue using it
                    if (/^2\./.test(details.previousVersion)) {
                        chrome.storage.local.set({
                            "settings.showDownloadButtons": true,
                            "settings.showNotifications": false
                        });

                        chrome.notifications && chrome.notifications.create("update2to3", {
                            type: "basic",
                            iconUrl: chrome.runtime.getURL("pics/icons/128.png"),
                            title: chrome.i18n.getMessage("notificationUpdateTitle", appName),
                            message: chrome.i18n.getMessage("notificationUpdate2to3Body", appName),
                            buttons: [
                                {
                                    title: chrome.i18n.getMessage("yesGogogo")
                                },
                                {
                                    title: chrome.i18n.getMessage("no")
                                }
                            ]
                        }, function () {});
                    }

                    if (currentVersion === "4.0") {
                        // for upgrading to 4.0 users show notification about the new icon
                        chrome.notifications && chrome.notifications.create("updateTo4", {
                            type: "basic",
                            iconUrl: chrome.runtime.getURL("pics/icons/128.png"),
                            title: chrome.i18n.getMessage("notificationUpdateTitle", appName),
                            message: chrome.i18n.getMessage("notificationUpdate40", appName)
                        }, function () {});
                    } else {
                        // show "call-to-action" notification
                        chrome.storage.local.get({
                            "settings.songsPlayed": Config.default_settings_local.songsPlayed,
                            "settings.vkToken": Config.default_settings_local.vkToken
                        }, function (records) {
                            var needNotify = false;
                            var notificationBody;

                            if (!records["settings.vkToken"].length) { // show notification to guests
                                needNotify = true;
                                notificationBody = chrome.i18n.getMessage("notificationUpdateCallToActionGuests", appName);
                            } else if (records["settings.songsPlayed"] < 20) { // show notification to users who don't use the app often
                                needNotify = true;
                                notificationBody = chrome.i18n.getMessage("notificationUpdateCallToActionUsers", appName);
                            }

                            if (needNotify && chrome.notifications) {
                                chrome.notifications.create("update", {
                                    type: "basic",
                                    iconUrl: chrome.runtime.getURL("pics/icons/128.png"),
                                    title: chrome.i18n.getMessage("notificationUpdateTitle", appName),
                                    message: notificationBody,
                                    buttons: [
                                        {
                                            title: chrome.i18n.getMessage("yesGogogo")
                                        },
                                        {
                                            title: chrome.i18n.getMessage("no")
                                        }
                                    ]
                                }, function () {});
                            }
                        });
                    }

                    // run vkPeopleUsePlaylists test
                    // if (currentVersion === "3.1") {
                    //     chrome.storage.local.set({"settings.tests": ["vkPeopleUsePlaylists"]});
                    // }
                }

                break;
        }

        chrome.alarms.get("dayuse", function (alarmInfo) {
            if (!alarmInfo) {
                chrome.alarms.create("dayuse", {
                    delayInMinutes: 24 * 60,
                    periodInMinutes: 24 * 60
                });
            }
        });

        chrome.alarms.get("appUsage", function (alarmInfo) {
            if (!alarmInfo) {
                chrome.alarms.create("appUsage", {
                    when: Date.now() + 3 * 60 * 60 * 1000,
                    periodInMinutes: 24 * 60
                });
            }
        });

        chrome.alarms.get("contestNotifier", function (alarmInfo) {
            if (!alarmInfo) {
                chrome.alarms.create("contestNotifier", {
                    when: Date.now(),
                    periodInMinutes: 5
                });
            }
        });

        var uninstallUrl = Config.constants.goodbye_page_link + "?ver=" + currentVersion;
        if (typeof chrome.runtime.setUninstallUrl === "function") {
            chrome.runtime.setUninstallUrl(uninstallUrl);
        }

        chrome.storage.local.get("appInstallDate", function (records) {
            records.appInstallDate = records.appInstallDate || Date.now();
            chrome.storage.local.set(records);
        })
    });

    function openAppWindow() {
        chrome.app.window.create("main.html", {
            id: uuid(),
            minWidth: 800,
            minHeight: 540
        });
    }

    // app lifecycle
    chrome.app.runtime.onLaunched.addListener(openAppWindow);
    chrome.app.runtime.onRestarted.addListener(openAppWindow);
})();
