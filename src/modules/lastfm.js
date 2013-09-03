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
                                mbid: album.querySelector("mbid").textContent
                            });
                        });

                        callback(albums);
                    }, function () {
                        callback([]);
                    });
                }
            }, callback);
        },

        getAlbumInfoByMBID: function Lastfm_getAlbumInfoByMBID(mbid, callback) {
            makeAPIRequest("album.getinfo", {mbid: mbid}, function (xml) {
                var cover = (xml.querySelector("album > image[size='large']") || xml.querySelector("album > image[size='medium']") || xml.querySelector("album > image[size='small']"));

                var output = {
                    artist: xml.querySelector("album > artist").textContent,
                    title: xml.querySelector("album > name").textContent,
                    albumDescription: xml.querySelector("album > wiki > summary").textContent,
                    fullDescription: xml.querySelector("album > wiki > content").textContent,
                    cover: cover ? cover.textContent : "",
                    songs: []
                };

                [].forEach.call(xml.querySelectorAll("album > tracks > track"), function (track) {
                    output.songs.push(track.querySelector("name").textContent);
                });

                callback(output);
            }, function () {
                callback(null);
            });
        },

        getAlbumInfo: function Lastfm_getAlbumInfo(artist, album, callback) {
            makeAPIRequest("album.getinfo", {
                artist: artist,
                album: album
            }, function (xml) {
                var cover = (xml.querySelector("album > image[size='large']") || xml.querySelector("album > image[size='medium']") || xml.querySelector("album > image[size='small']"));

                var output = {
                    artist: xml.querySelector("album > artist").textContent,
                    title: xml.querySelector("album > name").textContent,
                    albumDescription: xml.querySelector("album > wiki > summary").textContent,
                    fullDescription: xml.querySelector("album > wiki > content").textContent,
                    cover: cover ? cover.textContent : "",
                    songs: []
                };

                [].forEach.call(xml.querySelectorAll("album > tracks > track"), function (track) {
                    output.songs.push(track.querySelector("name").textContent);
                });

                callback(output);
            }, function () {
                callback(null);
            });
        }
    });
})();
