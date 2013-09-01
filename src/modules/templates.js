Templates = (function () {
    "use strict";

    var pendingCallbacks = {};

    window.addEventListener("message", function (evt) {
        if (!pendingCallbacks[evt.data.id])
            return;

        pendingCallbacks[evt.data.id](evt.data.content);
        delete pendingCallbacks[evt.data.id];
    });

    return createModule("Templates", {
        render: function (tplName, placeholders, callback) {
            if (typeof placeholders === "function") {
                callback = placeholders;
                placeholders = {};
            }

            var iframe = document.getElementById("sandbox");
            if (!iframe)
                return callback("");

            var requestId = uuid();
            pendingCallbacks[requestId] = callback;

            console.log(iframe.contentWindow);
            iframe.contentWindow.postMessage({id: requestId, tplName: tplName, placeholders: placeholders}, "*");
        }
    });
})();
