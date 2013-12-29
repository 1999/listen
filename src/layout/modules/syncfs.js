SyncFS = (function () {
    "use strict";

    var downloadedFilesIds = [];

    chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
        if (req.action === "syncFsCounterUpdated") {
            downloadedFilesIds = req.files;
            $("header span.header-local span.counter").text(req.value);
        }
    });

    chrome.syncFileSystem.onFileStatusChanged.addListener(function (details) {
        chrome.syncFileSystem.requestFileSystem(function (fs) {
            var dirReader = fs.root.createReader();
            dirReader.readEntries(function (results) {
                $("header span.header-local span.counter").text(results.length || "");
            }, function (err) {
                throw new Error(err);
            });
        });
    });

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


    return {
        get downloadedIds() {
            return downloadedFilesIds;
        },

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
                    fileEntry.remove(callback);
                });
            });
        },

        isWorking: function SyncFS_isWorking(callback) {
            if (!chrome.syncFileSystem.getServiceStatus)
                return callback(true);

            chrome.syncFileSystem.getServiceStatus(function (status) {
                callback(status === "running");
            });
        },

        requestCurrentFilesNum: function SyncFS_requestCurrentFilesNum(callback) {
            chrome.runtime.sendMessage({
                action: "currentSyncFSCounter"
            }, callback);
        },

        queueFile: function SyncFS_queueFile(artist, title, url, id) {
            chrome.runtime.sendMessage({
                action: "saveGoogleDrive",
                url: url,
                artist: artist,
                title: title,
                id: id
            });
        }
    };
})();
