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
        var storageKey = "cover." + url;

        chrome.storage.local.get(storageKey, function (items) {
            if (items[storageKey]) {
                (window.requestFileSystem || window.webkitRequestFileSystem)(window.PERSISTENT, 0, function (fs) {
                    fs.root.getFile(items[storageKey], {create: false}, function (fileEntry) {
                        callback(fileEntry.toURL());
                    }, function (err) {
                        // в chrome.storage.local запись есть, а в песочнице нет, атата!
                        chrome.storage.local.remove(storageKey);
                        callback("");
                    });
                }, function (err) {
                    callback("");
                });
            } else {
                loadResource(url, {
                    responseType: "blob",
                    onload: function (blob) {
                        var storageValue = uuid();

                        (window.requestFileSystem || window.webkitRequestFileSystem)(window.PERSISTENT, 0, function (fs) {
                            fs.root.getFile(storageValue, {create: true}, function (fileEntry) {
                                fileEntry.createWriter(function (fileWriter) {
                                    fileWriter.onwriteend = function (evt) {
                                        var records = {};
                                        records[storageKey] = storageValue;
                                        chrome.storage.local.set(records);

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
                        console.error(error);
                        callback("");
                    }
                });
            }
        });
    }

    /**
     * Save into sync file system
     *
     * @param {String} url
     */
    function saveGoogleDrive(title, url) {
        console.log(arguments);
        loadResource(url, {
            responseType: "blob",
            onload: function (blob) {
                // console.log("yes");
                // console.log(new Blob([blob, "{}"], {type: "application/octet-stream"}));
                //
                console.log("Blob size is " + blob.size);
                var tagBlob1 = blob.slice(0, 128);
                var tagBlob2 = blob.slice(blob.size - 128);

                var reader1 = new FileReader;
                reader1.onloadend = function () {
                    console.log("Read result1: " + reader1.result);
                };

                reader1.readAsText(tagBlob1);

                var reader2 = new FileReader;
                reader2.onloadend = function () {
                    console.log("Read result2: " + reader2.result);
                };

                reader2.readAsText(tagBlob2);

                return;

                chrome.syncFileSystem.requestFileSystem(function (fs) {
                    fs.root.getFile(title + ".mp3", {create: true}, function (fileEntry) {
                        fileEntry.createWriter(function (fileWriter) {
                            fileWriter.onwriteend = function (evt) {
                                console.log(fileEntry.toURL());
                                // callback(fileEntry.toURL());
                            };

                            fileWriter.onerror = function (evt) {
                                // console.error("Write failed: " + evt);
                                // callback("");
                            };

                            fileWriter.write(blob);
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
                saveGoogleDrive(req.title, req.url);
                break;
        }

        return isAsyncResponse;
    });
})();
