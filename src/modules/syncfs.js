SyncFS = (function () {
    "use strict";

    return createModule("SyncFS", {
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
            chrome.syncFileSystem.requestFileSystem(function (fs) {
                var dirReader = fs.root.createReader();

                dirReader.readEntries(function (results) {
                    var output = 0;

                    for (var i = 0; i < results.length; i++) {
                        if (/\.mp3$/.test(results.item(i).name)) {
                            output += 1;
                        }
                    }

                    callback(output);
                });
            });
        },

        queueFile: function SyncFS_queueFile(title, url) {
            chrome.runtime.sendMessage({
                action: "saveGoogleDrive",
                url: url,
                title: title
            });
        }
    });
})();
