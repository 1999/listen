window.onerror = function(msg, url, line, column, err) {
    var msgError = msg + " in " + url + " (line: " + line + ")";
    console.error(msgError);

    chrome.storage.local.get({
        "settings.isDebug": Config.default_settings_local.isDebug
    }, function (records) {
        if (!records["settings.isDebug"]) {
            CPA.sendEvent("Errors", chrome.runtime.getManifest().version, {
                msg: msg,
                url: url,
                line: line,
                trace: err && err.stack || ""
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
            case "update":
                chrome.notifications.clear(notificationId, function () {});
                var currentAppWindow = chrome.app.window.current();

                if (currentAppWindow) {
                    currentAppWindow.show();
                } else {
                    openAppWindow();
                }

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
        }
    });


    // listen to messages from VK Offline legacy app (https://chrome.google.com/webstore/detail/vkontakte-offline/jinklgkideaicpdgmomlckebafjfibjk)
    chrome.runtime.onMessageExternal.addListener(function (msg, sender, sendResponse) {
        if (["mmppkefmgokcbhknfjcdbfckchbcipll", "jinklgkideaicpdgmomlckebafjfibjk"].indexOf(sender.id) === -1)
            return sendResponse(false);

        switch (msg.action) {
            case "isAlive":
                sendResponse(true);
                break;

            case "getCurrent":
                openAppWindow();
                break;

            case "searchArtist":
                openAppWindow({
                    view: "searchArtist",
                    args: {
                        artist: msg.q
                    }
                });

                break;

            case "searchSongs":
                openAppWindow({
                    view: "search",
                    args: {
                        searchQuery: msg.q
                    }
                });

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

                try {
                    seenChangelog = Object.keys(chrome.runtime.getManifest().changelog);
                } catch (ex) {
                    seenChangelog = [];
                }

                chrome.storage.local.set({"settings.changelog": seenChangelog});
                chrome.storage.sync.set({"settings.studyCloud": true});
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

                        // chrome.notifications && chrome.notifications.create("update2to3", {
                        //     type: "basic",
                        //     iconUrl: chrome.runtime.getURL("pics/icons/128.png"),
                        //     title: chrome.i18n.getMessage("notificationUpdateTitle", appName),
                        //     message: chrome.i18n.getMessage("notificationUpdate2to3Body", appName),
                        //     buttons: [
                        //         {
                        //             title: chrome.i18n.getMessage("yesGogogo")
                        //         },
                        //         {
                        //             title: chrome.i18n.getMessage("no")
                        //         }
                        //     ]
                        // }, function () {});
                    }

                    // starting from 5.0 there's a special cloud study "view"
                    // it's shown to the new users, but upgrading users shouldn't see it
                    // except those who didn't use cloud upload feature before this moment & didn't see this study view
                    parallel({
                        study: function (callback) {
                            var settingsKey = "settings.studyCloud";

                            chrome.storage.sync.get(settingsKey, function (records) {
                                callback(records[settingsKey] !== undefined);
                            });
                        },
                        syncfs: function (callback) {
                            chrome.syncFileSystem.requestFileSystem(function (fs) {
                                if (!fs || !fs.root) {
                                    callback(1); // probably not authorized
                                    return;
                                }

                                var dirReader = fs.root.createReader();
                                dirReader.readEntries(function (results) {
                                    var totalFiles = [].filter.call(results, function (fileEntry) {
                                        return (/\.mp3$/.test(fileEntry.name));
                                    });

                                    callback(totalFiles.length);
                                }, function (err) {
                                    callback(1); // chrome issue, no info about files
                                    throw new Error(err.message + " (code " + err.code + ")");
                                });
                            });
                        }
                    }, function (res) {
                        if (!res.syncfs && !res.study) {
                            chrome.storage.sync.set({"settings.studyCloud": true});
                        }
                    });

                    // show "call-to-action" notification
                    // chrome.storage.local.get({
                    //     "settings.songsPlayed": Config.default_settings_local.songsPlayed,
                    //     "settings.vkToken": Config.default_settings_local.vkToken
                    // }, function (records) {
                    //     var needNotify = false;
                    //     var notificationBody;

                    //     if (!records["settings.vkToken"].length) { // show notification to guests
                    //         needNotify = true;
                    //         notificationBody = chrome.i18n.getMessage("notificationUpdateCallToActionGuests", appName);
                    //     } else if (records["settings.songsPlayed"] < 20) { // show notification to users who don't use the app often
                    //         needNotify = true;
                    //         notificationBody = chrome.i18n.getMessage("notificationUpdateCallToActionUsers", appName);
                    //     }

                    //     if (needNotify && chrome.notifications) {
                    //         chrome.notifications.create("update", {
                    //             type: "basic",
                    //             iconUrl: chrome.runtime.getURL("pics/icons/128.png"),
                    //             title: chrome.i18n.getMessage("notificationUpdateTitle", appName),
                    //             message: notificationBody,
                    //             buttons: [
                    //                 {
                    //                     title: chrome.i18n.getMessage("yesGogogo")
                    //                 },
                    //                 {
                    //                     title: chrome.i18n.getMessage("no")
                    //                 }
                    //             ]
                    //         }, function () {});
                    //     }
                    // });

                    // run vkPeopleUsePlaylists test
                    // if (currentVersion === "3.1") {
                    //     chrome.storage.local.set({"settings.tests": ["vkPeopleUsePlaylists"]});
                    // }
                }

                // prevent contest alarm from previous versions
                chrome.alarms.clear("contestNotifier");

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

        // prior to 5.2 there was also an "appUsage" alarm, which was designed to reset "appUsedToday" setting
        // due to chrome.alarms "oversleeping" ability, it was an error-designed alarm
        chrome.alarms.clear("appUsage");

        var uninstallUrl = Config.constants.goodbye_page_link + "?ver=" + currentVersion;
        if (typeof chrome.runtime.setUninstallUrl === "function") {
            chrome.runtime.setUninstallUrl(uninstallUrl);
        }

        chrome.storage.local.get("appInstallDate", function (records) {
            records.appInstallDate = records.appInstallDate || Date.now();
            chrome.storage.local.set(records);
        })
    });

    function openAppWindow(navigateState) {
        chrome.app.window.create("main.html", {
            id: uuid(),
            minWidth: 800,
            minHeight: 540
        }, function (createdWindow) {
            if (navigateState && navigateState.view) {
                createdWindow.contentWindow.appNavig = navigateState;
            }
        });
    }

    // app lifecycle
    chrome.app.runtime.onLaunched.addListener(openAppWindow);
    chrome.app.runtime.onRestarted.addListener(openAppWindow);
})();
