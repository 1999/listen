Covers = (function () {
    "use strict";

    chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
        if (req.action === "coverDownload") {
            Covers.request(req.url, sendResponse);
            return true;
        }
    });


    return {
        request: function Covers_request(url, callback) {
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
    };
})();
