window.onerror = function(msg, url, line) {
    var msgError = msg + " in " + url + " (line: " + line + ")";
    console.error(msgError);

    // @todo y.mail way?
};

(function () {
    "use strict";

    // list of callbacks waiting for rendering templates
    var templatesRenderingCallbacks = {};

    // sandbox messages listener (rendering templates)
    window.addEventListener("message", function (evt) {
        if (!templatesRenderingCallbacks[evt.data.id])
            return;

        templatesRenderingCallbacks[evt.data.id](evt.data.content);
        delete templatesRenderingCallbacks[evt.data.id];
    });

    /**
     * Render mustache templates
     *
     * @param {String} tplName
     * @param {Object} placeholders
     * @param {Function} callback
     */
    function renderTemplate(tplName, placeholders, callback) {
        if (typeof placeholders === "function") {
            callback = placeholders;
            placeholders = {};
        }

        var iframe = document.getElementById("sandbox");
        if (!iframe)
            return callback("");

        var requestId = Math.random() + "";
        templatesRenderingCallbacks[requestId] = callback;

        iframe.contentWindow.postMessage({id: requestId, tplName: tplName, placeholders: placeholders}, "*");
    }


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
    // chrome.alarms.onAlarm.addListener(function (alarmInfo) {
    //     switch (alarmInfo.name) {

    //     }
    // });

    function openAppWindow() {
        chrome.app.window.create("main.html", {
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
                renderTemplate(req.tplName, req.placeholders, sendResponse);
                isAsyncResponse = true;
                break;

            case "coverDownload":
                console.log(req.url);

                loadResource(req.url, {
                    responseType: "blob",
                    onload: function (blob) {
                        console.log(blob);
                    },
                    onerror: function (error) {
                        console.error(error);
                    }
                }, this);

                break;
        }

        return isAsyncResponse;
    });
})();
