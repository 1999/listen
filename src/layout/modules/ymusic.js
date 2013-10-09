YMusic = (function () {
    "use strict";

    var BASE_URL = "https://api.music.yandex.net/api/";
    var BASE_REGION = 225;

    function makeAPIRequest(url, options, onload, onerror) {
        if (typeof options === "function") {
            onerror = onload;
            onload = options;
            options = {};
        }

        console.log(BASE_URL + url + "?" + createRequestParams(options));

        loadResource(BASE_URL + url + "?" + createRequestParams(options), {
            responseType: "xml",
            onload: onload,
            onerror: onerror
        });
    }


    return {
        suggest: function YMusic_suggest(searchQuery, callback) {
            var output = [];

            makeAPIRequest("suggest", {
                part: searchQuery,
                region: BASE_REGION
            }, function (xml) {
                [].forEach.call(xml.querySelectorAll("Item > Text"), function (elem) {
                    var text = elem.textNode.replace(/\s\-\s/, " ");
                    output.push(text);
                });

                callback(output);
            }, function () {
                callback(output);
            });
        }
    };
})();
