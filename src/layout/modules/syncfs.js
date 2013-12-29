SyncFS = (function () {
    "use strict";

    var ID3V1_START = "TAG";
    var NULLSTRING = String.fromCharCode(0);

    var pendingQueue = []; // do not allow simultaneous multiple download processed
    var downloadingURL; // active download URL
    var downloadedFilesIds = []; // vkids of files in the cloud

    // listen to syncfs file changes
    chrome.syncFileSystem.onFileStatusChanged.addListener(function (details) {
        requestFilesNum(function (num) {
            $("header span.header-local span.counter").text(num || "");
        });
    });

    // load downloaded files vkids immediately
    chrome.syncFileSystem.requestFileSystem(function (fs) {
        if (!fs)
            return;

        var dirReader = fs.root.createReader();
        dirReader.readEntries(function (results) {
            [].forEach.call(results, function (fileEntry) {
                if (!/\.mp3$/.test(fileEntry.name))
                    return;

                getAudioIdFromFile(fileEntry, function (vkId) {
                    if (vkId) {
                        downloadedFilesIds.push(vkId);
                    }
                });
            });
        });
    });

    function requestFilesNum(callback) {
        chrome.syncFileSystem.requestFileSystem(function (fs) {
            var dirReader = fs.root.createReader();
            dirReader.readEntries(function (results) {
                var cnt = 0;

                [].forEach.call(results, function (fileEntry) {
                    if (!/\.mp3$/.test(fileEntry.name))
                        return;

                    cnt += 1;
                });

                callback(cnt);
            }, function (err) {
                throw new Error(err);
            });
        });
    }

    function getArtistAndTitle(fileEntry, callback) {
        var defaultArtist = chrome.i18n.getMessage("unknownArtist");
        var defaultTrack = chrome.i18n.getMessage("unknownTrack");

        fileEntry.file(function (file) {
            // blobs can contain cyrillic symbols which take 2 bytes (charCodes < 128 take 1, 128..2048 take 2, more than 2048 take 3 bytes)
            // FileReader.prototype.readAsText() returns text, but its length can differ with blob's length
            var songTitleByteStart = file.size - 128 + 3;
            var blobSongTitle = file.slice(songTitleByteStart, songTitleByteStart + 30, "text/plain");
            var songArtistByteStart = file.size - 128 + 3 + 30;
            var blobSongArtist = file.slice(songArtistByteStart, songArtistByteStart + 30, "text/plain");
            var tasks = {};

            [
                {
                    title: "artist",
                    blob: blobSongArtist
                },
                {
                    title: "song",
                    blob: blobSongTitle
                }
            ].forEach(function (taskData) {
                tasks[taskData.title] = function (callback) {
                    var reader = new FileReader;
                    reader.onloadend = function () {
                        if (!reader.result) {
                            console.error("Result is null");
                            return callback();
                        }

                        var nullRegex = new RegExp(String.fromCharCode(0), "g");
                        var output = reader.result.trim().replace(nullRegex, "");

                        callback(output);
                    };

                    reader.onerror = function (err) {
                        console.error(err);
                        callback();
                    };

                    reader.readAsText(taskData.blob);
                };
            });

            parallel(tasks, function (results) {
                callback({
                    artist: results.artist || defaultArtist,
                    song: results.song || defaultTrack
                });
            });
        }, function (err) {
            console.error(err);
            callback({artist: defaultArtist, song: defaultTrack});
        });
    }

    function getAudioIdFromFile(fileEntry, callback) {
        fileEntry.file(function (file) {
            readBinary(file, function (binStr) {
                if (!binStr) {
                    callback();
                    throw new Error("Resulting binary string is empty");
                }

                var id3v1 = binStr.substr(binStr.length - 128);
                var commentText = id3v1.substr(97, 30).replace(new RegExp(NULLSTRING, "g"), "");

                if (commentText.length && /^[\d]+$/.test(commentText)) {
                    callback(commentText);
                } else {
                    callback();
                }
            });
        }, function (err) {
            callback();
            throw new Error("Error while getting file blob: " + err.message);
        });
    }

    /**
     * Создание безопасной строки длиной bytesLength байт
     *
     * @param {String} str
     * @param {Number} bytesLength
     * @return {String}
     */
    function makeSafeString(str, bytesLength) {
        var output = "";
        var nullString = String.fromCharCode(0);
        var index = 0;
        var totalBytesLength = 0;
        var code, bytes;

        while (totalBytesLength < bytesLength) {
            if (index === -1 || index >= str.length) {
                output += nullString;
                totalBytesLength += 1;
            } else {
                code = str.charCodeAt(index);

                if (code < 128) { // 1 byte
                    output += str[index];

                    index += 1;
                    totalBytesLength += 1;
                } else {
                    bytes = (code >= 128 && code < 2048) ? 2 : 3;

                    if (totalBytesLength + bytes > bytesLength) { // когда сумма не вмещается в 30 байт, не добавляем символ
                        index = -1;
                    } else {
                        output += str[index];

                        index += 1;
                        totalBytesLength += bytes;
                    }
                }
            }
        }

        return output;
    }

    function readBinary(blob, callback) {
        var reader = new FileReader;
        reader.onloadend = function () {
            callback(reader.result);
        };

        reader.onerror = function (evt) {
            throw new Error("Error while reading file: " + evt.type);
        };

        reader.readAsBinaryString(blob);
    }


    return {
        requestCurrentFilesList: function SyncFS_requestCurrentFilesList(callback) {
            chrome.syncFileSystem.requestFileSystem(function (fs) {
                var dirReader = fs.root.createReader();

                dirReader.readEntries(function (results) {
                    var output = [];
                    var cloudTitle = chrome.i18n.getMessage("cloudTitle");
                    var downloadTitle = chrome.i18n.getMessage("downloadTitle");
                    var addTitle = chrome.i18n.getMessage("addToMyAudio");
                    var tasks = [];
                    var index;

                    [].forEach.call(results, function (fileEntry) {
                        if (!/\.mp3$/.test(fileEntry.name))
                            return;

                        // @todo duplicating VK module. needs refactoring
                        output.push({
                            id: fileEntry.name,
                            source: fileEntry.toURL(),
                            ownerId: null,
                            noadd: true,
                            artist: null,
                            song: null,
                            duration: "0:00",
                            pending: true,
                            cloudTitle: cloudTitle,
                            downloadTitle: downloadTitle,
                            addTitle: addTitle
                        });

                        tasks.push(function (callback) {
                            getArtistAndTitle(fileEntry, callback);
                        });
                    });

                    parallel(tasks, function (id3v1Data) {
                        id3v1Data.forEach(function (data, index) {
                            output[index].artist = data.artist;
                            output[index].song = data.song;
                        });

                        callback(output);
                    });
                });
            });
        },

        remove: function SyncFS_remove(fileName, callback) {
            chrome.syncFileSystem.requestFileSystem(function (fs) {
                fs.root.getFile(fileName, {create: false}, function (fileEntry) {
                    getAudioIdFromFile(fileEntry, function (vkId) {
                        if (vkId) {
                            var index = downloadedFilesIds.indexOf(vkId);
                            if (index !== -1) {
                                downloadedFilesIds.splice(index, 1);
                            }
                        }

                        fileEntry.remove(callback);
                    });
                });
            });
        },

        requestCurrentFilesNum: function SyncFS_requestCurrentFilesNum(callback) {
            requestFilesNum(function (num) {
                callback(num || "");
            });
        },

        queueFile: function SyncFS_queueFile(artist, title, url, audioId) {
            if (downloadingURL) {
                var hasUrlInQueue = pendingQueue.some(function (elem) {
                    return (elem.url === url);
                });

                if (!hasUrlInQueue) {
                    pendingQueue.push({
                        artist: artist,
                        title: title,
                        url: url,
                        audioId: audioId
                    });
                }

                return;
            }

            artist = artist.trim();
            title = title.trim();
            downloadingURL = url;

            loadResource(url, {
                responseType: "blob",
                timeout: 0,
                onload: function (blob) {
                    var tagStart = blob.size - 128;

                    parallel({
                        tag: function (callback) {
                            readBinary(blob.slice(tagStart, tagStart + 3, "text/plain"), callback);
                        },
                        artist: function (callback) {
                            readBinary(blob.slice(tagStart + 33, tagStart + 63, "text/plain"), callback);
                        },
                        title: function (callback) {
                            readBinary(blob.slice(tagStart + 3, tagStart + 33, "text/plain"), callback);
                        }
                    }, function (res) {
                        // http://mpgedit.org/mpgedit/mpeg_format/mpeghdr.htm#MPEGTAG
                        var tagData = ID3V1_START;
                        var totalBytesLength = 3;

                        tagData += makeSafeString(title, 30);
                        tagData += makeSafeString(artist, 30);
                        tagData += makeSafeString("", 30); // album
                        tagData += makeSafeString("", 4); // year
                        tagData += makeSafeString(audioId, 30); // comment
                        tagData += makeSafeString("", 1); // year

                        console.log("Construct new blob from original data and tag data: %s", tagData);

                        var resultBlob = (res.tag !== "TAG")
                            ? new Blob([blob, tagData], {type: "audio/mpeg"})
                            : new Blob([blob.slice(0, tagStart), tagData], {type: "audio/mpeg"});

                        chrome.syncFileSystem.requestFileSystem(function (fs) {
                            fs.root.getFile(artist + " - " + title + ".mp3", {create: true}, function (fileEntry) {
                                fileEntry.createWriter(function (fileWriter) {
                                    fileWriter.onwriteend = function (evt) {
                                        CPA.sendEvent("Actions", "saveGoogleDrive", {
                                            artist: artist,
                                            title: title
                                        });

                                        downloadingURL = null;
                                        downloadedFilesIds.push(audioId);

                                        if (pendingQueue.length) {
                                            var args = pendingQueue.shift();
                                            SyncFS.save(args.artist, args.title, args.url, args.audioId);
                                        }
                                    };

                                    fileWriter.onprogress = function (evt) {
                                        var percents = Math.floor((evt.loaded / evt.total) * 100);
                                        console.log("[%s] %i percents of file written", url, percents);
                                    };

                                    fileWriter.onerror = function (evt) {
                                        console.error("Write failed: " + evt);
                                        downloadingURL = null;

                                        if (pendingQueue.length) {
                                            var args = pendingQueue.shift();
                                            SyncFS.queueFile(args.artist, args.title, args.url, args.audioId);
                                        }

                                        throw new Error("Failed writing file: " + evt.type);
                                    };

                                    fileWriter.write(resultBlob);
                                });
                            });
                        });
                    });
                },
                onerror: function (evt) {
                    console.error(error);
                    downloadingURL = null;

                    if (pendingQueue.length) {
                        var args = pendingQueue.shift();
                        SyncFS.save(args.artist, args.title, args.url, args.audioId);
                    }

                    throw new Error("Failed downloading file: " + evt.type);
                },
                onprogress: function (percents) {
                    console.log("[%s] %i percents downloaded", url, percents);
                }
            });
        },

        get downloadedIds() {
            return downloadedFilesIds;
        },

        isWorking: function SyncFS_isWorking(callback) {
            if (!chrome.syncFileSystem.getServiceStatus)
                return callback(true);

            chrome.syncFileSystem.getServiceStatus(function (status) {
                callback(status === "running");
            });
        }
    };
})();
