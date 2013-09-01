document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    function notifyBackground(action, data, callback) {
        data = data || {};
        data.action = action;
        data.id = window.id;

        var args = [data];
        if (callback)
            args.push(callback);

        chrome.runtime.sendMessage.apply(chrome.runtime, args);
    }

    chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
        if (req.id !== window.id)
            return;

        switch (req.action) {
            case "initialDOM":
                document.body.innerHTML = req.html;

                if (req.type === "user") {

                } else {
                    $("button.auth").bind("click", function () {
                        notifyBackground("authVK");
                    });
                }

                break;
        }
    });

    notifyBackground("getCurrentStatus");



    // 1. отрисовать гостевой вариант, биндинги на кнопку ВК
    // 2. отрисовать пользовательский вариант, биндинги на поиск (?), кнопу поиска, локальную кнопку
    // песни, кнопки rate/блабла вверху, кнопки закрытия BD, кнопку rate cws
    // биндинг на любые ссылки вида artist:, album:, tag:
    // бинди


}, false);
