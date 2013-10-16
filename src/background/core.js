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


    // install & update handling
    chrome.runtime.onInstalled.addListener(function (details) {
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
                        "settings.showDownloadButtons": true
                    });
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
