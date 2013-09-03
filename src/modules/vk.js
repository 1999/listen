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

    return createModule("VK", {
        searchMusic: function VK_searchMusic(query, callback) {
            makeAPIRequest("audio.search", {
                q: query,
                auto_complete: 1,
                lyrics: 0,
                performer_only: 0,
                sort: 2
            }, function (xml) {
                var output = [];
                var cloudTitle = chrome.i18n.getMessage("cloudTitle");
                var downloadTitle = chrome.i18n.getMessage("downloadTitle");

                [].forEach.call(xml.querySelectorAll("audio"), function (audio) {
                    var duration = audio.querySelector("duration").textContent;

                    output.push({
                        id: audio.querySelector("id").textContent,
                        source: audio.querySelector("url").textContent,
                        artist: audio.querySelector("artist").textContent,
                        song: audio.querySelector("title").textContent,
                        duration: Math.floor(duration / 60) + ":" + (duration % 60),
                        cloudTitle: cloudTitle,
                        downloadTitle: downloadTitle
                    });
                });

                callback(output);
            });
        },

        getCurrent: function VK_getCurrent(callback) {
            makeAPIRequest("audio.get", function (xml) {
                var output = [];
                var cloudTitle = chrome.i18n.getMessage("cloudTitle");
                var downloadTitle = chrome.i18n.getMessage("downloadTitle");

                [].forEach.call(xml.querySelectorAll("audio"), function (audio) {
                    var duration = audio.querySelector("duration").textContent;

                    output.push({
                        id: audio.querySelector("id").textContent,
                        source: audio.querySelector("url").textContent,
                        artist: audio.querySelector("artist").textContent,
                        song: audio.querySelector("title").textContent,
                        duration: Math.floor(duration / 60) + ":" + (duration % 60),
                        cloudTitle: cloudTitle,
                        downloadTitle: downloadTitle
                    });
                });

                callback(output);
            });
        },

        repost: function VK_repost() {

        },

        getProfileData: function VK_getProfileData() {

        }
    });
})();
