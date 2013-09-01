window.onerror = function(msg, url, line) {
    var msgError = msg + " in " + url + " (line: " + line + ")";
    if (Settings.get("isDebug")) {
        alert(msgError);
    }
};

(function () {
    "use strict";

    // при загрузке фоновой страницы также загружаем sandbox iframe
    document.addEventListener("DOMContentLoaded", function () {
        var iframe = document.createElement("iframe");
        iframe.setAttribute("src", "sandbox/page.html");
        iframe.setAttribute("id", "sandbox");
        document.body.appendChild(iframe);
    }, false);

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

    // message exchange
    chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
        var isAsyncResponse = false;

        switch (req.action) {
            case "getCurrentStatus":
                Templates.render("guest", {user: "Dmitry"}, sendResponse);
                isAsyncResponse = true;
                break;
        }

        return isAsyncResponse;
    });

    // app lifecycle
    chrome.app.runtime.onLaunched.addListener(function () {
        chrome.app.window.create("layout/main.html", {
            minWidth: 800,
            minHeight: 480
        }, function (appWindow) {
            // ...
        });
    });

    // chrome.app.runtime.onRestarted.addListener - same
})();
