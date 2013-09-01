Templates = (function () {
    "use strict";

    return createModule("Templates", {
        render: function (tplName, placeholders, callback) {
            if (typeof placeholders === "function") {
                callback = placeholders;
                placeholders = {};
            }

            chrome.runtime.sendMessage({
                action: "renderTemplate",
                tplName: tplName,
                placeholders: placeholders
            }, callback);
        }
    });
})();
