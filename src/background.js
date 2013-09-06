window.onerror = function(msg, url, line) {
    var msgError = msg + " in " + url + " (line: " + line + ")";
    console.error(msgError);

    // @todo y.mail way?
};

(function () {
    "use strict";

    // list of callbacks waiting for rendering templates
    var templatesRenderingCallbacks = {};

    // sandbox messages listener (rendering templates)
    window.addEventListener("message", function (evt) {
        if (!templatesRenderingCallbacks[evt.data.id])
            return;

        templatesRenderingCallbacks[evt.data.id](evt.data.content);
        delete templatesRenderingCallbacks[evt.data.id];
    });

    /**
     * Отрисовка mustache-шаблонов
     *
     * @param {String} tplName
     * @param {Object} placeholders
     * @param {Function} callback
     */
    function renderTemplate(tplName, placeholders, callback) {
        if (typeof placeholders === "function") {
            callback = placeholders;
            placeholders = {};
        }

        var iframe = document.getElementById("sandbox");
        if (!iframe)
            return callback("");

        var requestId = Math.random() + "";
        templatesRenderingCallbacks[requestId] = callback;

        iframe.contentWindow.postMessage({id: requestId, tplName: tplName, placeholders: placeholders}, "*");
    }

    /**
     * Скачивание обложек для альбомов
     *
     * @param {String} url
     * @param {Function} callback
     */
    function downloadCover(url, callback) {
        var fileName = md5(url);

        (window.requestFileSystem || window.webkitRequestFileSystem)(window.PERSISTENT, 0, function (fs) {
            fs.root.getFile(fileName, {create: false}, function (fileEntry) {
                callback(fileEntry.toURL());
            }, function (err) {
                if ([err.NOT_FOUND_ERR, err.NOT_READABLE_ERR].indexOf(err.code) === -1)
                    return callback("");

                loadResource(url, {
                    responseType: "blob",
                    onload: function (blob) {
                        (window.requestFileSystem || window.webkitRequestFileSystem)(window.PERSISTENT, 0, function (fs) {
                            fs.root.getFile(fileName, {create: true}, function (fileEntry) {
                                fileEntry.createWriter(function (fileWriter) {
                                    fileWriter.onwriteend = function (evt) {
                                        callback(fileEntry.toURL());
                                    };

                                    fileWriter.onerror = function (evt) {
                                        console.error("Write failed: " + evt);
                                        callback("");
                                    };

                                    fileWriter.write(blob);
                                });
                            });
                        });
                    },
                    onerror: function (error) {
                        console.error("Download failed: " + error);
                        callback("");
                    }
                });
            });
        }, function (err) {
            callback("");
        });
    }

    /**
     * Save into sync file system
     *
     * @param {String} url
     */
    function saveGoogleDrive(artist, title, url) {
        console.log(arguments);

        loadResource(url, {
            responseType: "blob",
            onload: function (blob) {
                console.log("Blob size is " + blob.size);

                var tagStart = blob.size - 128;

                parallel({
                    tag: function (callback) {
                        var reader = new FileReader;
                        reader.onloadend = function () {
                            callback(reader.result);
                        };

                        reader.readAsText(blob.slice(tagStart, tagStart + 3, "text/plain"));
                    },
                    artist: function (callback) {
                        var reader = new FileReader;
                        reader.onloadend = function () {
                            callback(reader.result);
                        };

                        reader.readAsText(blob.slice(tagStart + 33, tagStart + 63, "text/plain"));
                    },
                    title: function (callback) {
                        var reader = new FileReader;
                        reader.onloadend = function () {
                            callback(reader.result);
                        };

                        reader.readAsText(blob.slice(tagStart + 3, tagStart + 33, "text/plain"));
                    }
                }, function (res) {
                    var needsChanges = false;
                    var resultBlob;

                    // todo нужно не просто создавать строку, а забивать остаток мусором

                    if (res.tag === "TAG") {
                        if (res.artist !== artist)
                            needsChanges = true;

                        if (res.title !== title)
                            needsChanges = true;

                        if (needsChanges) {
                            var tagString = "TAG";

                            if (title.length < 30) {
                                tagString += title;
                                while (tagString < 33) {
                                    tagString += " ";
                                }
                            } else {
                                tagString += title.substr(0, 30);
                            }

                            if (artist.length < 30) {
                                tagString += artist;
                                while (tagString < 63) {
                                    tagString += " ";
                                }
                            } else {
                                tagString += artist.substr(0, 30);
                            }

                            while (tagString < 128) {
                                tagString += " ";
                            }

                            var tagBlob = new Blob([tagString], {type: "text/plain"});
                            resultBlob = new Blob([blob, tagBlob], {type: "audio/mpeg"});
                        } else {
                            resultBlob = blob;
                        }
                    } else {
                        var tagString = "TAG";

                        if (title.length < 30) {
                            tagString += title;
                            while (tagString < 33) {
                                tagString += " ";
                            }
                        } else {
                            tagString += title.substr(0, 30);
                        }

                        if (artist.length < 30) {
                            tagString += artist;
                            while (tagString < 63) {
                                tagString += " ";
                            }
                        } else {
                            tagString += artist.substr(0, 30);
                        }

                        while (tagString < 128) {
                            tagString += " ";
                        }

                        var tagBlob = new Blob([tagString], {type: "text/plain"});
                        resultBlob = new Blob([blob, tagBlob], {type: "audio/mpeg"});
                    }

                    chrome.syncFileSystem.requestFileSystem(function (fs) {
                        fs.root.getFile(uuid() + ".mp3", {create: true}, function (fileEntry) {
                            fileEntry.createWriter(function (fileWriter) {
                                fileWriter.onwriteend = function (evt) {
                                    console.log(fileEntry.toURL());
                                };

                                fileWriter.onerror = function (evt) {
                                    console.error("Write failed: " + evt);
                                    // callback("");
                                };

                                fileWriter.write(resultBlob);
                            });
                        });
                    });
                });
            },
            onerror: function (error) {
                console.error(error);
            }
        });
    }


    // install & update handling
    chrome.runtime.onInstalled.addListener(function (details) {
        switch (details) {
            case "install":
                Logger.writeInitMessage();
                break;

            case "update":
                if (chrome.runtime.getManifest().version === details.previousVersion)
                    return;

                Logger.writeInitMessage();
                break;
        }
    });

    // alarms
    // chrome.alarms.onAlarm.addListener(function (alarmInfo) {
    //     switch (alarmInfo.name) {

    //     }
    // });

    function openAppWindow() {
        chrome.app.window.create("main.html", {
            id: uuid(),
            minWidth: 800,
            minHeight: 540
        });
    }

    // app lifecycle
    chrome.app.runtime.onLaunched.addListener(openAppWindow);
    chrome.app.runtime.onRestarted.addListener(openAppWindow);

    // messages listener
    chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
        var isAsyncResponse = false;

        switch (req.action) {
            case "renderTemplate":
                renderTemplate(req.tplName, req.placeholders, sendResponse);
                isAsyncResponse = true;
                break;

            case "coverDownload":
                downloadCover(req.url, sendResponse);
                isAsyncResponse = true;
                break;

            case "saveGoogleDrive":
                saveGoogleDrive(req.artist, req.title, req.url);
                break;
        }

        return isAsyncResponse;
    });
})();
