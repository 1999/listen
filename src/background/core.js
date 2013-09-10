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
        switch (details) {
            case "install":
                // ...
                break;

            case "update":
                if (chrome.runtime.getManifest().version === details.previousVersion)
                    return;

                // ...
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

    // messages listener
    chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
        var isAsyncResponse = false;

        switch (req.action) {
            case "renderTemplate":
                Templates.render(req.tplName, req.placeholders, sendResponse);
                isAsyncResponse = true;
                break;

            case "coverDownload":
                Covers.request(req.url, sendResponse);
                isAsyncResponse = true;
                break;

            case "saveGoogleDrive":
                saveGoogleDrive(req.artist, req.title, req.url);
                break;
        }

        return isAsyncResponse;
    });
})();
