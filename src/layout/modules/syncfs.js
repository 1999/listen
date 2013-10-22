SyncFS = (function () {
    "use strict";

    var downloadedFilesIds = [];

    chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
        if (req.action === "syncFsCounterUpdated") {
            downloadedFilesIds = req.files;
            $("header span.header-local span.counter").text(req.value);
        }
    });

    function getArtistAndTitle(fileEntry, callback) {
        var defaultArtist = chrome.i18n.getMessage("unknownArtist");
        var defaultTrack = chrome.i18n.getMessage("unknownTrack");

        fileEntry.file(function (file) {
            var reader = new FileReader;
            reader.onloadend = function () {
                if (!reader.result) {
                    console.error("Result is null");
                    return callback({artist: defaultArtist, song: defaultTrack});
                }

                var id3v1 = reader.result.substr(reader.result.length - 128);
                if (id3v1.indexOf("TAG") !== 0)
                    return callback({artist: defaultArtist, song: defaultTrack});

                callback({
                    artist: id3v1.substr(33, 30).trim(),
                    song: id3v1.substr(3, 30).trim()
                });
            };

            reader.readAsBinaryString(file);
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
                    var tasks = [];
                    var index;

                    [].forEach.call(results, function (fileEntry) {
                        if (!/\.mp3$/.test(fileEntry.name))
                            return;

                        output.push({
                            id: null,
                            source: fileEntry.toURL(),
                            artist: null,
                            song: null,
                            duration: "0:00",
                            pending: true,
                            cloudTitle: cloudTitle,
                            downloadTitle: downloadTitle
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
