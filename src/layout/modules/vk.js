VK = (function () {
    "ust strict";

    var BASE_URL = "https://api.vk.com/method/";

    function makeAPIRequest(method, options, onload, onerror) {
        if (typeof options === "function") {
            onerror = onload;
            onload = options;
            options = {};
        }

        options.access_token = Settings.get("vkToken");
        options.v = "5.0";
        options.count = 300;
        options.offset = options.offset || 0;

        loadResource(BASE_URL + method + ".xml", {
            responseType: "xml",
            data: options,
            onload: function (xml) {
                onload(xml);
                // http://d.pr/i/SubI - error node
            },
            onerror: onerror
        }, this);
    }

    function strpad(str) {
        str = str + "";
        return (str.length === 1) ? "0" + str : str;
    }

    function xmlToArray(xml) {
        var output = [];
        var cloudTitle = chrome.i18n.getMessage("cloudTitle");
        var downloadTitle = chrome.i18n.getMessage("downloadTitle");
        var count = parseInt(xml.querySelector("count").textContent, 10);

        [].forEach.call(xml.querySelectorAll("audio"), function (audio) {
            var duration = audio.querySelector("duration").textContent;

            output.push({
                id: audio.querySelector("id").textContent,
                source: audio.querySelector("url").textContent,
                artist: audio.querySelector("artist").textContent,
                song: audio.querySelector("title").textContent,
                originalDuration: duration,
                duration: Math.floor(duration / 60) + ":" + strpad(duration % 60),
                cloudTitle: cloudTitle,
                downloadTitle: downloadTitle
            });
        });

        return {
            count: output.length ? count : 0,
            songs: output
        };
    }


    return {
        searchMusic: function VK_searchMusic(query, params, callback) {
            params = copyOwnProperties(params, {
                q: query,
                auto_complete: 1,
                lyrics: 0,
                performer_only: 0,
                sort: 2
            });

            makeAPIRequest("audio.search", params, function (xml) {
                callback(xmlToArray(xml));
            });
        },

        searchMusicByArtist: function VK_searchMusic(query, params, callback) {
            params = copyOwnProperties(params, {
                q: query,
                auto_complete: 1,
                lyrics: 0,
                performer_only: 1,
                sort: 2
            });

            makeAPIRequest("audio.search", params, function (xml) {
                callback(xmlToArray(xml));
            });
        },

        getCurrent: function VK_getCurrent(offset, callback) {
            makeAPIRequest("audio.get", {offset: offset}, function (xml) {
                callback(xmlToArray(xml));
            });
        }
    };
})();
