VK = (function () {
    "use strict";

    var BASE_URL = "https://api.vk.com/method/";

    function makeAPIRequest(method, options, onload, onerror) {
        if (typeof options === "function") {
            onerror = onload;
            onload = options;
            options = {};
        }

        options.access_token = Settings.get("vkToken");
        options.v = "5.0";
        options.count = options.count || 300;
        options.offset = options.offset || 0;

        loadResource(BASE_URL + method + ".xml", {
            responseType: "xml",
            data: options,
            onload: function (xml) {
                var error = xml.querySelector("error");
                if (!error) {
                    return onload(xml);
                }

                var errorCode = error.querySelector("error_code");
                var errorMsg = error.querySelector("error_msg");

                if (!errorCode) {
                    throw new Error("Unsupported VK error: (none)");
                }

                switch (parseInt(errorCode.textContent, 10)) {
                    case 5: // invalid token
                        Settings.set("vkToken", "");
                        Settings.set("lastfmToken", "");

                        Navigation.dispatch("guest");
                        break;

                    case 6: // too many requests
                        window.setTimeout(function () {
                            makeAPIRequest(method, options, onload, onerror);
                        }, 350);

                        break;

                    case 14: // captcha
                        var captchaSid = error.querySelector("captcha_sid").textContent;
                        var captchaImg = error.querySelector("captcha_img").textContent;

                        Captcha.show(captchaImg, function (codeInserted) {
                            options.captcha_sid = captchaSid;
                            options.captcha_key = codeInserted;

                            makeAPIRequest(method, options, onload, onerror);
                        });

                        break;

                    case 17: // validation required (https://vk.com/dev/need_validation)
                        var redirectURI = error.querySelector("redirect_uri").textContent;
                        window.open(redirectURI);
                        break;

                    case 270: // copyright
                        onerror && onerror("Copyright error");
                        break;

                    case 301: // wrong name for uploaded file
                        onerror && onerror("Wrong filename");
                        break;

                    default:
                        throw new Error("Unsupported VK error: " + errorCode.textContent + " (" + (errorMsg && errorMsg.textContent) + ")");
                }
            },
            onerror: onerror
        });
    }

    function xmlToArray(xml, options) {
        var output = [];
        var cloudTitle = chrome.i18n.getMessage("cloudTitle");
        var downloadTitle = chrome.i18n.getMessage("downloadTitle");
        var addTitle = chrome.i18n.getMessage("addToMyAudio");
        var countNode = xml.querySelector("count");
        var count = countNode ? parseInt(countNode.textContent, 10) : 0;

        [].forEach.call(xml.querySelectorAll("audio"), function (audio) {
            var audioIdNode = audio.querySelector("id");
            if (!audioIdNode)
                return;

            var audioId = audioIdNode.textContent;
            var duration = audio.querySelector("duration").textContent;

            output.push({
                id: audioId,
                ownerId: audio.querySelector("owner_id").textContent,
                pending: (SyncFS.downloadedIds.indexOf(audioId) !== -1 || !options.syncfs),
                noadd: options.current ? true : false,
                source: audio.querySelector("url").textContent,
                artist: audio.querySelector("artist").textContent,
                song: audio.querySelector("title").textContent,
                originalDuration: duration,
                duration: Math.floor(duration / 60) + ":" + strpad(duration % 60),
                cloudTitle: cloudTitle,
                downloadTitle: downloadTitle,
                addTitle: addTitle
            });
        });

        return {
            count: output.length ? count : 0,
            showDownload: Settings.get("showDownloadButtons"),
            songs: output
        };
    }


    return {
        searchMusic: function VK_searchMusic(query, params, callback) {
            var pendingXHR;

            params = copyOwnProperties(params, {
                q: query,
                auto_complete: 1,
                lyrics: 0,
                performer_only: 0,
                sort: 2
            });

            parallel({
                vkdata: function (callback) {
                    pendingXHR = makeAPIRequest("audio.search", params, callback);
                },
                syncfs: function (callback) {
                    SyncFS.isWorking(callback);
                }
            }, function (results) {
                callback(xmlToArray(results.vkdata, {syncfs: results.syncfs}));
            });

            return pendingXHR;
        },

        searchMusicByArtist: function VK_searchMusicByArtist(query, params, callback) {
            var pendingXHR;

            params = copyOwnProperties(params, {
                q: query,
                auto_complete: 0,
                lyrics: 0,
                performer_only: 1,
                sort: 2
            });

            parallel({
                vkdata: function (callback) {
                    pendingXHR = makeAPIRequest("audio.search", params, callback);
                },
                syncfs: function (callback) {
                    SyncFS.isWorking(callback);
                }
            }, function (results) {
                callback(xmlToArray(results.vkdata, {syncfs: results.syncfs}));
            });

            return pendingXHR;
        },

        getCurrent: function VK_getCurrent(offset, callback) {
            var pendingXHR;

            parallel({
                vkdata: function (callback) {
                    pendingXHR = makeAPIRequest("audio.get", {offset: offset}, callback);
                },
                syncfs: function (callback) {
                    SyncFS.isWorking(callback);
                }
            }, function (results) {
                var output = xmlToArray(results.vkdata, {
                    syncfs: results.syncfs,
                    current: true
                });

                callback(output);
            });

            return pendingXHR;
        },

        getAlbums: function VK_getAlbums(callback) {
            return makeAPIRequest("audio.getAlbums", {count: 1}, function (xml) {
                var countNode = xml.querySelector("count");
                var output = countNode ? countNode.textContent : null;

                callback(output);
            }, function (err) {
                callback(null);
            });
        },

        add: function VK_add(ownerId, audioId, callback) {
            return makeAPIRequest("audio.add", {
                audio_id: audioId,
                owner_id: ownerId
            }, function (xml) {
                var responseNode = xml.querySelector("response");
                var output = (responseNode && responseNode.textContent) ? responseNode.textContent : null;

                callback(output);
            }, function (err) {
                callback(null);
            });
        },

        upload: function VK_upload(file, progressListener, callback) {
            return makeAPIRequest("audio.getUploadServer", function (xml) {
                var uploadUrl = xml.querySelector("upload_url").textContent;

                loadResource(uploadUrl, {
                    method: "POST",
                    timeout: 0,
                    data: {
                        file: file
                    },
                    onload: function (responseText) {
                        makeAPIRequest("audio.save", JSON.parse(responseText), function () {
                            callback(true);
                        }, function () {
                            callback(false);
                        });
                    },
                    onUploadProgress: progressListener
                });
            }, function (err) {
                callback(null);
            });
        }
    };
})();
