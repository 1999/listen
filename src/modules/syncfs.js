SyncFS = (function () {
    "use strict";

    chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
        if (req.action === "syncFsCounterUpdted") {
            $("header span.local span.counter").text(req.value);
        }
    });


    return {
        requestCurrentFilesList: function SyncFS_requestCurrentFilesList(callback) {
            chrome.syncFileSystem.requestFileSystem(function (fs) {
                var dirReader = fs.root.createReader();

                dirReader.readEntries(function (results) {
                    var output = [];

                    for (var i = 0; i < results.length; i++) {
                        if (/\.mp3$/.test(results.item(i).name)) {
                            output.push(results.item(i).toURL());
                        }
                    }

                    callback(output);
                });
            });
        },

        requestCurrentFilesNum: function SyncFS_requestCurrentFilesNum(callback) {
            chrome.runtime.sendMessage({
                action: "currentSyncFSCounter"
            }, callback);
        },

        queueFile: function SyncFS_queueFile(artist, title, url) {
            chrome.runtime.sendMessage({
                action: "saveGoogleDrive",
                url: url,
                artist: artist,
                title: title
            });
        }
    };
})();
