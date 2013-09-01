window.onerror = function(msg, url, line) {
    var msgError = msg + " in " + url + " (line: " + line + ")";
    if (Settings.get("isDebug")) {
        alert(msgError);
    }
};

(function () {
    "use strict";

    // install & update handling
    chrome.runtime.onInstalled.addListener(function (details) {
        switch (details) {
            case "install":
                Logger.writeInitMessage();
                break;

            case "update":
                if (chrome.runtime.getManifest().version === details.previousVersion)
                    return;

                Logger.writeInitMessage();
                break;
        }
    });

    // alarms
    chrome.alarms.onAlarm.addListener(function (alarmInfo) {
        switch (alarmInfo.name) {

        }
    });

    function openAppWindow() {
        chrome.app.window.create("main.html", {
            minWidth: 800,
            minHeight: 540
        }, function (appWindow) {
            appWindow.contentWindow.id = uuid();
        });
    }

    // app lifecycle
    chrome.app.runtime.onLaunched.addListener(openAppWindow);
    chrome.app.runtime.onRestarted.addListener(openAppWindow);
})();
