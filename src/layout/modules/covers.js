Covers = (function () {
    "use strict";


    return {
        load: function Covers_load(url) {
            var figure = $("figure[data-src='" + url + "']");
            if (!figure) {
                return;
            }

            figure.removeData("src");
            var coverImage = $(figure, "img");
            var coverNothing = $(figure, ".nothing");

            if (!url) {
                coverNothing.removeClass("hidden");
                $(figure, ".cover-loading").addClass("hidden");

                return;
            }

            chrome.runtime.sendMessage({action: "coverDownload", url: url}, function (coverURL) {
                if (coverURL) {
                    coverImage.attr("src", coverURL).removeClass("hidden");
                } else {
                    coverNothing.removeClass("hidden");
                }

                $(figure, ".cover-loading").addClass("hidden");
            });
        }
    };
})();
