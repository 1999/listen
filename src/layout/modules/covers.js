Covers = (function () {
    "use strict";


    return {
        load: function Covers_load(url) {
            chrome.runtime.sendMessage({action: "coverDownload", url: url}, function (coverURL) {
                var cover = $("img[data-src='" + url + "']");
                if (!cover)
                    return;

                if (coverURL) {
                    cover.attr("src", coverURL);
                } else {
                    cover.addClass("hidden");
                    $(cover.closestParent("figure"), ".nothing").removeClass("hidden");
                }
            });
        }
    };
})();
