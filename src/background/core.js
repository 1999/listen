window.onerror = function(msg, url, line) {
    var msgError = msg + " in " + url + " (line: " + line + ")";
    console.error(msgError);
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
        if (notificationId === "update2to3") {
            chrome.notifications.clear("update2to3", function () {});
            chrome.app.window.current().show();
        }
    });

    chrome.notifications && chrome.notifications.onButtonClicked.addListener(function (notificationId, buttonIndex) {
        if (notificationId === "update2to3") {
            chrome.notifications.clear("update2to3", function () {});

            if (buttonIndex === 0) {
                chrome.app.window.current().show();
            }
        }
    });


    // install & update handling
    chrome.runtime.onInstalled.addListener(function (details) {
        var appName = chrome.runtime.getManifest().name;
        var currentVersion = chrome.runtime.getManifest().version;

        switch (details.reason) {
            case "install":
                CPA.changePermittedState(true);

                var installId = "{" + uuid() + "}";
                chrome.storage.local.set({installId: installId});

                var lyfecycleParams = {
                    id: installId,
                    ver: currentVersion
                };

                CPA.sendEvent("Lyfecycle", "Install", lyfecycleParams);

                var uninstallUrl = Config.constants.goodbye_page_link + "?" + createRequestParams(lyfecycleParams);
                if (typeof chrome.runtime.setUninstallUrl === "function") {
                    chrome.runtime.setUninstallUrl(uninstallUrl);
                }

                break;

            case "update":
                if (currentVersion === details.previousVersion)
                    return;

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
                        title: chrome.i18n.getMessage("notificationUpdate2to3Title", appName),
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

                chrome.storage.local.get("installId", function (records) {
                    CPA.sendEvent("Lyfecycle", "Update", {
                        prev: details.previousVersion,
                        curr: currentVersion,
                        id: records.installId
                    });

                    var lyfecycleParams = {
                        id: records.installId,
                        ver: currentVersion
                    };

                    var uninstallUrl = Config.constants.goodbye_page_link + "?" + createRequestParams(lyfecycleParams);
                    if (typeof chrome.runtime.setUninstallUrl === "function") {
                        chrome.runtime.setUninstallUrl(uninstallUrl);
                    }
                });

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
