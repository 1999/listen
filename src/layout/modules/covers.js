Covers = (function () {
    "use strict";

    return {
        loadFigure: function Covers_loadFigure(url) {
            var figure = $("figure[data-src='" + url + "']");
            if (!figure) {
                return;
            }

            var coverImage = $(figure, "img");
            var coverNothing = $(figure, ".nothing");

            if (!url) {
                coverNothing.removeClass("hidden");
                $(figure, ".cover-loading").addClass("hidden");

                return;
            }

            chrome.runtime.sendMessage({action: "coverDownload", url: url}, function (coverURL) {
                figure.removeData("src");

                if (coverURL) {
                    coverImage.attr("src", coverURL).removeClass("hidden");
                } else {
                    coverNothing.removeClass("hidden");
                }

                $(figure, ".cover-loading").addClass("hidden");
            });
        },

        loadImage: function Covers_loadImage(url) {
            chrome.runtime.sendMessage({action: "coverDownload", url: url}, function (coverURL) {
                if (coverURL) {
                    $("[data-src='" + url + "']").attr("src", coverURL);
                }
            });
        }
    };
})();
