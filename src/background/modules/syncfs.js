SyncFS = (function () {
    "use strict";

    var ID3V1_START = "TAG";
    var NULLSTRING = String.fromCharCode(0);

    var pendingDownloads = []; // список URL скачиваемых файлов
    var downloadedFilesIds = []; // список ID скачанных файлов
    var cachedCounter = -1;

    chrome.syncFileSystem.onFileStatusChanged.addListener(function (details) {
        if (details.direction !== "remote_to_local")
            return;

        cachedCounter = -1;
        updateCurrentCounter();
    });

    chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
        if (req.action === "currentSyncFSCounter") {
            sendResponse(SyncFS.getCurrentCounterValue());
        } else if (req.action === "saveGoogleDrive") {
            SyncFS.save(req.artist, req.title, req.url, req.id);
        }
    });


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

        reader.readAsBinaryString(blob);
    }

    function updateCurrentCounter() {
        // @todo use http://developer.chrome.com/apps/syncFileSystem.html#method-getServiceStatus

        chrome.syncFileSystem.requestFileSystem(function (fs) {
            if (!fs)
                return;

            var dirReader = fs.root.createReader();

            dirReader.readEntries(function (results) {
                cachedCounter = 0;
                downloadedFilesIds.length = 0;

                var tasks = [];

                for (var i = 0; i < results.length; i++) {
                    if (!/\.mp3$/.test(results[i].name))
                        continue;

                    (function (fileEntry) {
                        tasks[tasks.length] = function (callback) {
                            cachedCounter += 1;

                            fileEntry.file(function (file) {
                                var reader = new FileReader;
                                reader.onloadend = function () {
                                    var id3v1 = reader.result.substr(reader.result.length - 128);
                                    var commentText = id3v1.substr(97, 30).replace(new RegExp(NULLSTRING, "g"), "");

                                    if (commentText.length && /^[\d]+$/.test(commentText))
                                        downloadedFilesIds.push(commentText);

                                    callback();
                                };

                                reader.readAsBinaryString(file);
                            }, function (err) {
                                console.error(err);
                                calback();
                            });
                        };
                    })(results[i]);
                }

                parallel(tasks, notifyAppWindows);
            });
        });
    }

    function notifyAppWindows() {
        chrome.runtime.sendMessage({
            action: "syncFsCounterUpdated",
            value: SyncFS.getCurrentCounterValue(),
            files: downloadedFilesIds
        });
    }


    return {
        /**
         * Возвращает текущее состояние счетчика
         */
        getCurrentCounterValue: function SyncFS_getCurrentCounterValue() {
            if (cachedCounter === -1) {
                updateCurrentCounter();
                return "...";
            }

            var output;

            if (cachedCounter > 0) {
                output = cachedCounter;
                if (pendingDownloads.length) {
                    output += "+";
                }
            } else {
                output = pendingDownloads.length ? "..." : "";
            }

            return output;
        },

        /**
         * Save file into sync filesystem
         *
         * @param {String} artist
         * @param {String} title
         * @param {String} url
         */
        save: function SyncFS_save(artist, title, url, audioId) {
            artist = artist.trim();
            title = title.trim();

            if (pendingDownloads.indexOf(url) !== -1)
                return;

            pendingDownloads.push(url);
            notifyAppWindows();

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
                                        var index = pendingDownloads.indexOf(url);
                                        pendingDownloads.splice(index, 1);

                                        cachedCounter += 1;
                                        downloadedFilesIds.push(audioId);

                                        notifyAppWindows();
                                    };

                                    fileWriter.onprogress = function (evt) {
                                        var percents = Math.floor((evt.loaded / evt.total) * 100);
                                        console.log("[%s] %i percents of file written", url, percents);
                                    };

                                    fileWriter.onerror = function (evt) {
                                        console.error("Write failed: " + evt);

                                        var index = pendingDownloads.indexOf(url);
                                        pendingDownloads.splice(index, 1);

                                        notifyAppWindows();
                                    };

                                    fileWriter.write(resultBlob);
                                });
                            });
                        });
                    });
                },
                onerror: function (error) {
                    console.error(error);

                    var index = pendingDownloads.indexOf(url);
                    pendingDownloads.splice(index, 1);

                    notifyAppWindows();
                },
                onprogress: function (percents) {
                    console.log("[%s] %i percents downloaded", url, percents);
                }
            });
        }
    };
})();