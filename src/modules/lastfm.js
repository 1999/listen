Lastfm = (function () {
    "use strict";

    var BASE_URL = "http://ws.audioscrobbler.com/2.0/";

    function makeAPIRequest(method, options, onload, onerror) {
        if (typeof options === "function") {
            onerror = onload;
            onload = options;
            options = {};
        }

        options.api_key = Config.constants.lastfm_api_key;
        options.method = method;

        loadResource(BASE_URL, {
            responseType: "xml",
            data: options,
            onload: function (xml) {
                if (!xml || xml.documentElement.getAttribute("status") === "failed")
                    return onerror();

                onload(xml);
            },
            onerror: onerror
        }, this);
    }

    return createModule("Lastfm", {
        getArtistInfo: function Lastfm_getInfo(searchQuery, callback) {
            parallel({
                info: function (callback) {
                    makeAPIRequest("artist.getinfo", {artist: searchQuery}, function (xml) {
                        callback(xml.querySelector("bio > summary").textContent);
                    }, function () {
                        callback(null);
                    });
                },
                tracks: function (callback) {
                    makeAPIRequest("artist.gettoptracks", {artist: searchQuery}, function (xml) {
                        var tracks = [];

                        [].forEach.call(xml.querySelectorAll("toptracks > track"), function (track) {
                            tracks.push(track.querySelector("name").textContent);
                        });

                        callback(tracks);
                    }, function () {
                        callback([]);
                    });
                },
                albums: function (callback) {
                    makeAPIRequest("artist.gettopalbums", {artist: searchQuery}, function (xml) {
                        var albums = [];

                        [].forEach.call(xml.querySelectorAll("topalbums > album"), function (album) {
                            var image = (album.querySelector("image[size='large']") || album.querySelector("image[size='medium']") || album.querySelector("image[size='small']"));

                            albums.push({
                                title: album.querySelector("name").textContent,
                                cover: image ? image.textContent : "",
                                source: "",
                                mbid: album.querySelector("mbid").textContent
                            });
                        });

                        callback(albums);
                    }, function () {
                        callback([]);
                    });
                }
            }, function (data) {
                callback(data.info ? data : null);
            });
        }
    });
})();
