YMusic = (function () {
    "use strict";

    var BASE_URL = "https://api.music.yandex.net/api/";
    var STORAGE_URL = "http://storage.music.yandex.ru/get/";
    var BASE_REGION = 225;

    function getCover(storageDir, coverNum, size) {
        return STORAGE_URL + storageDir + "/" + coverNum + "." + size + "x" + size + ".jpg";
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
        },

        getArtistInfo: function YMusic_getArtistInfo(searchQuery, callback) {
            searchQuery = searchQuery.split(" ").map(function (part) {
                return part.charAt(0).toUpperCase() + part.substr(1).toLowerCase();
            }).join(" ");

            loadResource(BASE_URL + "search", {
                responseType: "xml",
                data: {
                    text: searchQuery,
                    nocorrect: 0,
                    type: "all",
                    page: 0
                },
                onload: function (xml) {
                    var bestArtist = xml.querySelector("search > best > artist[id]");
                    if (!bestArtist) {
                        return callback(null);
                    }

                    var artistId = bestArtist.getAttribute("id");
                    var output = {
                        info: {
                            name: bestArtist.querySelector("name").textContent,
                            info: "",
                            ymid: artistId
                        },
                        albums: [],
                        tracks: [],
                        similar: []
                    };

                    [].forEach.call(xml.querySelectorAll("search > tracks > track[id]"), function (trackNode) {
                        output.tracks.push({
                            song: trackNode.querySelector("title").textContent,
                            duration: Math.round(trackNode.getAttribute("duration-millis") / 1000)
                        });
                    });

                    [].forEach.call(xml.querySelectorAll("search > albums > album[id]"), function (albumNode) {
                        var coverNode = albumNode.querySelector("cover[id]");

                        // if album artists are different, skip it
                        var isArtistTakingPart = [].some.call(albumNode.querySelectorAll("artist[id]"), function (artist) {
                            return (artist.getAttribute("id") == artistId);
                        });

                        if (!isArtistTakingPart)
                            return;

                        output.albums.push({
                            title: albumNode.querySelector("title").textContent,
                            cover: coverNode ? getCover(albumNode.getAttribute("storage-dir"), coverNode.getAttribute("id"), 150) : "",
                            ymid: albumNode.getAttribute("id")
                        });
                    });

                    callback(output);
                },
                onerror: function () {
                    callback(null);
                }
            });
        },

        getAlbumInfo: function YMusic_getAlbumInfo(searchData, callback) {
            loadResource(BASE_URL + "album-tracks", {
                responseType: "xml",
                data: {
                    "album-id": searchData.ymid,
                    region: BASE_REGION
                },
                onload: function (xml) {
                    var albumNode = xml.querySelector("album");
                    var coverNode = xml.querySelector("album > cover[id]");
                    var trackNumber = 1;

                    if (!albumNode) {
                        return callback(null)
                    }

                    var output = {
                        artist: xml.querySelector("album > artist[role='performer'] > name").textContent,
                        title: xml.querySelector("album > title").textContent,
                        albumDescription: "",
                        fullDescription: "",
                        cover: coverNode ? getCover(albumNode.getAttribute("storage-dir"), coverNode.getAttribute("id"), 300) : "",
                        songs: []
                    };

                    [].forEach.call(albumNode.querySelectorAll("tracks track"), function (track) {
                        output.songs.push({
                            number: trackNumber,
                            title: track.querySelector("title").textContent,
                            duration: track.getAttribute("duration")
                        });

                        trackNumber += 1;
                    });

                    callback(output);
                },
                onerror: function () {
                    callback(null);
                }
            });
        },
    };
})();
