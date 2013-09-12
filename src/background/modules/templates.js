Templates = (function () {
    "use strict";

    // list of callbacks waiting for rendering templates
    var pendingCallbacks = {};

    // sandbox messages listener (rendering templates)
    window.addEventListener("message", function (evt) {
        if (!pendingCallbacks[evt.data.id])
            return;

        pendingCallbacks[evt.data.id](evt.data.content);
        delete pendingCallbacks[evt.data.id];
    });

    chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
        if (req.action === "renderTemplate") {
            Templates.render(req.tplName, req.placeholders, sendResponse);
            return true;
        }
    });


    return {
        /**
         * Отрисовка mustache-шаблонов
         *
         * @param {String} tplName
         * @param {Object} placeholders
         * @param {Function} callback
         */
        render: function Templates_render(tplName, placeholders, callback) {
            if (typeof placeholders === "function") {
                callback = placeholders;
                placeholders = {};
            }

            var iframe = document.getElementById("sandbox");
            if (!iframe)
                return callback("");

            var requestId = Math.random() + "";
            pendingCallbacks[requestId] = callback;

            iframe.contentWindow.postMessage({
                id: requestId,
                tplName: tplName,
                placeholders: placeholders
            }, "*");
        }
    };
})();
