window.onerror = function (msg, url, line, column, err) {
    var msgError = msg + " in " + url + " (line: " + line + ")";
    console.error(msgError);

    if (!Settings.get("isDebug")) {
        CPA.sendEvent("Errors", chrome.runtime.getManifest().version, {
            msg: msg,
            url: url,
            line: line,
            trace: err && err.stack || ""
        });
    }
};

var app = app || {};

parallel({
    dom: function (callback) {
        document.addEventListener("DOMContentLoaded", callback, false);
    },
    settings: function (callback) {
        Settings.load(callback);
    }
}, function (res) {
    'use strict';

    new app.appView;
});
