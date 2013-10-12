Lastfm = (function () {
    "use strict";

    var BASE_URL = "http://ws.audioscrobbler.com/2.0/";

    function makeSignedKey(args) {
        var output = "";
        Object.keys(args).sort().forEach(function (key) {
            output += key + args[key];
        });

        return md5(output + Config.constants.lastfm_api_sig);
    }

    function makeAPIRequest(requestMethod, isSigned, options, onload, onerror) {
        if (typeof options === "function") {
            onerror = onload;
            onload = options;
            options = {};
        }

        options.api_key = Config.constants.lastfm_api_key;

        if (isSigned)
            options.api_sig = makeSignedKey(options);

        loadResource(BASE_URL, {
            responseType: "xml",
            method: requestMethod,
            data: options,
            onload: function (xml) {
                if (!xml || xml.documentElement.getAttribute("status") === "failed")
                    return onerror();

                onload(xml);
            },
            onerror: onerror
        }, this);
    }

    return {
        getArtistInfo: function Lastfm_getInfo(searchQuery, callback) {
            searchQuery = searchQuery.split(" ").map(function (part) {
                return part.charAt(0).toUpperCase() + part.substr(1).toLowerCase();
            }).join(" ");

            parallel({
                info: function (callback) {
                    makeAPIRequest("GET", false, {
                        method: "artist.getinfo",
                        artist: searchQuery
                    }, function (xml) {
                        callback(xml.querySelector("bio > summary").textContent);
                    }, function () {
                        callback(null);
                    });
                },
                similar: function (callback) {
                    // @todo similar есть и в просто artist.getInfo
                    makeAPIRequest("GET", false, {
                        method: "artist.getSimilar",
                        artist: searchQuery,
                        limit: 10,
                        autocorrect: 1
                    }, function (xml) {
                        var artists = [];
                        [].forEach.call(xml.querySelectorAll("artist > name"), function (artistName) {
                            artists.push(artistName.textContent);
                        });

                        callback(artists);
                    }, function () {
                        callback(null);
                    });
                },
                tracks: function (callback) {
                    makeAPIRequest("GET", false, {
                        method: "artist.gettoptracks",
                        artist: searchQuery
                    }, function (xml) {
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
                    makeAPIRequest("GET", false, {
                        method: "artist.gettopalbums",
                        artist: searchQuery
                    }, function (xml) {
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

        getAlbumInfo: function Lastfm_getAlbumInfo(searchData, callback) {
            searchData.method = "album.getinfo";

            makeAPIRequest("GET", false, searchData, function (xml) {
                var cover = (xml.querySelector("album > image[size='large']") || xml.querySelector("album > image[size='medium']") || xml.querySelector("album > image[size='small']"));
                var shortDescriptionNode = xml.querySelector("album > wiki > summary");
                var fullDescriptionNode = xml.querySelector("album > wiki > content");

                var output = {
                    artist: xml.querySelector("album > artist").textContent,
                    title: xml.querySelector("album > name").textContent,
                    albumDescription: shortDescriptionNode ? shortDescriptionNode.textContent : "",
                    fullDescription: fullDescriptionNode ? fullDescriptionNode.textContent : "",
                    cover: cover ? cover.textContent : "",
                    songs: []
                };

                [].forEach.call(xml.querySelectorAll("album > tracks > track"), function (track) {
                    output.songs.push({
                        number: track.getAttribute("rank"),
                        title: track.querySelector("name").textContent,
                        duration: track.querySelector("duration").textContent
                    });
                });

                callback(output);
            }, function () {
                callback(null);
            });
        },

        getSession: function Lastfm_getSession(token, callback) {
            makeAPIRequest("GET", true, {
                method: "auth.getSession",
                token: token,
                api_key: Config.constants.lastfm_api_key
            }, function (xml) {
                callback({
                    name: xml.querySelector("session > name").textContent,
                    key: xml.querySelector("session > key").textContent
                });
            }, function () {
                callback(null);
            });
        },

        get isAuthorized() {
            return (Settings.get("lastfmToken").length > 0);
        },

        updateNowPlaying: function Lastfm_updateNowPlaying(artist, trackTitle, album, trackNumber, durationSec) {
            var options = {
                method: "track.updateNowPlaying",
                artist: artist,
                track: trackTitle,
                sk: Settings.get("lastfmToken")
            };

            if (album)
                options.album = album;

            if (typeof trackNumber === "number")
                options.trackNumber = trackNumber;

            if (durationSec)
                options.duration = durationSec;

            makeAPIRequest("POST", true, options, function (xml) {
                chrome.storage.local.get("installId", function (records) {
                    CPA.sendEvent("Actions", "LFM_updateNowPlaying", {
                        artist: artist,
                        title: trackTitle,
                        id: records.installId
                    });
                });
            });
        },

        scrobble: function Lastfm_scrobble(artist, trackTitle, album, trackNumber, durationSec) {
            var options = {
                method: "track.scrobble",
                artist: artist,
                track: trackTitle,
                timestamp: Math.round(Date.now() / 1000) - durationSec,
                sk: Settings.get("lastfmToken")
            };

            // chosenByUser[i] (Optional) : Set to 1 if the user chose this song, or 0 if the song was chosen by someone else (such as a radio station or recommendation service). Assumes 1 if not specified

            if (album)
                options.album = album;

            if (typeof trackNumber === "number")
                options.trackNumber = trackNumber;

            if (durationSec)
                options.duration = durationSec;

            makeAPIRequest("POST", true, options, function (xml) {
                chrome.storage.local.get("installId", function (records) {
                    CPA.sendEvent("Actions", "LFM_scrobble", {
                        artist: artist,
                        title: trackTitle,
                        id: records.installId
                    });
                });
            });
        }
    };
})();
