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

                setDayUseAlarm();
                break;

            case "update":
                if (currentVersion === details.previousVersion)
                    return;

                if (/^1\./.test(details.previousVersion))
                    setDayUseAlarm();

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
    });

    function openAppWindow() {
        chrome.app.window.create("main.html", {
            id: uuid(),
            minWidth: 800,
            minHeight: 540
        });
    }

    function setDayUseAlarm() {
        chrome.alarms.create("dayuse", {
            delayInMinutes: 24 * 60,
            periodInMinutes: 24 * 60
        });
    }

    // app lifecycle
    chrome.app.runtime.onLaunched.addListener(openAppWindow);
    chrome.app.runtime.onRestarted.addListener(openAppWindow);
})();
