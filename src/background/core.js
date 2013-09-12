window.onerror = function(msg, url, line) {
    var msgError = msg + " in " + url + " (line: " + line + ")";
    console.error(msgError);

    // @todo y.mail way?
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
        switch (details.reason) {
            case "install":
                CPA.changePermittedState(true);

                var installId = "{" + uuid() + "}";
                chrome.storage.local.set({installId: installId});

                CPA.sendEvent("Lyfecycle", "Install", {
                    id: installId,
                    ver: chrome.runtime.getManifest().version
                });

                break;

            case "update":
                if (chrome.runtime.getManifest().version === details.previousVersion)
                    return;

                chrome.storage.local.get("installId", function (records) {
                    CPA.sendEvent("Lyfecycle", "Update", {
                        prev: details.previousVersion,
                        curr: chrome.runtime.getManifest().version,
                        id: records.installId
                    });
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

    // app lifecycle
    chrome.app.runtime.onLaunched.addListener(openAppWindow);
    chrome.app.runtime.onRestarted.addListener(openAppWindow);
})();
