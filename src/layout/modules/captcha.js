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
                document.documentElement.addClass("overlay-required");
                document.body.addClass("overlay-required");
                document.body.prepend(html);

                document.body.scrollTop = 0;
            });

            pendingCallbacks[src] = callback;
            Covers.loadImage(src);

            CPA.increaseCustomStat("captcha-show");
        },

        checkCode: function Captcha_checkCode(src, code) {
            if (!pendingCallbacks[src]) {
                throw new Error("No pending callback found");
            }

            document.documentElement.removeClass("overlay-required");
            document.body.removeClass("overlay-required");
            $(".captcha").remove();

            pendingCallbacks[src](code);
            delete pendingCallbacks[src];
        },

        clear: function Captcha_clear() {
            document.documentElement.removeClass("overlay-required");
            document.body.removeClass("overlay-required");

            var captchaOverlay = $(".captcha");
            if (captchaOverlay) {
                captchaOverlay.remove();
            }
        },

        get isActive() {
            return (Object.keys(pendingCallbacks).length > 0);
        }
    };
})();
