window.onerror = function(msg, url, line) {
	var msgError = msg + " in " + url + " (line: " + line + ")";
	if (Settings.get("isDebug")) {
		alert(msgError);
	}
};

(function () {
	"use strict";

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

	// message exchange
	chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
		var isAsyncResponse = false;
		console.log(req);

		switch (req.action) {
			case "getCurrentStatus":
				sendResponse(Date.now());
				break;
		}

		return isAsyncResponse;
	});

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
