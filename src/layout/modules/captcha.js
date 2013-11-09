Captcha = (function () {
    "use strict";

    var pendingCallbacks = {}; // captcha source -> callback

    return {
        show: function Captcha_show(src, callback) {
            Templates.render("captcha", {
                src: src,
                insertCodePlaceholder: chrome.i18n.getMessage("captchaInputPlaceholder"),
                codeSubmit: chrome.i18n.getMessage("captchaSubmitTitle")
            }, function (html) {
                document.documentElement.addClass("captcha-required");
                document.body.addClass("captcha-required");
                document.body.prepend(html);

                document.body.scrollTop = 0;
            });

            pendingCallbacks[src] = callback;
            Covers.loadImage(src);
        },

        checkCode: function Captcha_checkCode(src, code) {
            if (!pendingCallbacks[src]) {
                throw new Error("No pending callback found");
            }

            document.documentElement.removeClass("captcha-required");
            document.body.removeClass("captcha-required");
            $(".captcha").remove();

            pendingCallbacks[src](code);
            delete pendingCallbacks[src];
        }
    };
})();
