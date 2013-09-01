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

    var loadStateThunk = parallel({
        settings: function (callback) {

        }
    });

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

    Settings.load(function () {
        // message exchange
        chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
            var isAsyncResponse = false;

            switch (req.action) {
                case "getCurrentStatus":
                    var vkToken = Settings.get("vkToken");

                    var response = {
                        action: "initialDOM",
                        id: req.id,
                        type: (vkToken.length > 0) ? "user" : "guest",
                        html: ""
                    };

                    if (vkToken) {
                        Templates.render("user", {
                            placeholder: chrome.i18n.getMessage("searchPlaceholder"),
                            localTitle: chrome.i18n.getMessage("localTitle")
                        }, function (html) {
                            response.html = html;
                            chrome.runtime.sendMessage(response);
                        });
                    } else {
                        Templates.render("guest", {
                            welcomeHeader: chrome.i18n.getMessage("welcomeHeader"),
                            welcomeText: chrome.i18n.getMessage("welcomeText"),
                            faqHeader: chrome.i18n.getMessage("faqHeader"),
                            faqItems: chrome.i18n.getMessage("faqText").split("|").map(function (text) {
                                return {text: text};
                            }),
                            sendStat: chrome.i18n.getMessage("faqSendStatCheckbox"),
                            authVK: chrome.i18n.getMessage("authorizeVK")
                        }, function (html) {
                            response.html = html;
                            chrome.runtime.sendMessage(response);
                        });
                    }

                    break;

                case "authVK":
                    var baseURL = "https://" + chrome.runtime.id + ".chromiumapp.org/cb";

                    chrome.identity.launchWebAuthFlow({
                        url: "https://oauth.vk.com/authorize?" + createRequestParams({
                            client_id: Config.constants.vk_app_id,
                            scope: Config.constants.vk_app_scope.join(","),
                            redirect_uri: baseURL,
                            display: "page",
                            v: "5.0",
                            response_type: "token"
                        }),
                        interactive: true
                    }, function (responseURL) {
                        var response = parseQuery(responseURL.replace(baseURL + "#", ""));
                        Settings.set("vkToken", response.access_token);

                        console.log("WOW!");

                        var response = {
                            action: "initialDOM",
                            id: req.id,
                            type: "user",
                            html: ""
                        };

                        Templates.render("user", {
                            placeholder: chrome.i18n.getMessage("searchPlaceholder"),
                            localTitle: chrome.i18n.getMessage("localTitle")
                        }, function (html) {
                            response.html = html;
                            chrome.runtime.sendMessage(response);
                        });
                    });

                    break;
            }

            return isAsyncResponse;
        });

        function openAppWindow() {
            chrome.app.window.create("layout/main.html", {
                minWidth: 800,
                minHeight: 540
            }, function (appWindow) {
                appWindow.contentWindow.id = uuid();
            });
        }

        // app lifecycle
        chrome.app.runtime.onLaunched.addListener(openAppWindow);
        chrome.app.runtime.onRestarted.addListener(openAppWindow);
    });
})();
