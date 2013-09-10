SyncFS = (function() {
    "use strict";

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

    /**
     * Save into sync file system
     *
     * @param {String} url
     */
    // function saveGoogleDrive(artist, title, url) {
    //     console.log(arguments);

    //     loadResource(url, {
    //         responseType: "blob",
    //         onload: function (blob) {
    //             console.log("Blob size is " + blob.size);

    //             var tagStart = blob.size - 128;

    //             parallel({
    //                 tag: function (callback) {
    //                     var reader = new FileReader;
    //                     reader.onloadend = function () {
    //                         callback(reader.result);
    //                     };

    //                     reader.readAsText(blob.slice(tagStart, tagStart + 3, "text/plain"));
    //                 },
    //                 artist: function (callback) {
    //                     var reader = new FileReader;
    //                     reader.onloadend = function () {
    //                         callback(reader.result);
    //                     };

    //                     reader.readAsText(blob.slice(tagStart + 33, tagStart + 63, "text/plain"));
    //                 },
    //                 title: function (callback) {
    //                     var reader = new FileReader;
    //                     reader.onloadend = function () {
    //                         callback(reader.result);
    //                     };

    //                     reader.readAsText(blob.slice(tagStart + 3, tagStart + 33, "text/plain"));
    //                 }
    //             }, function (res) {
    //                 var needsChanges = false;
    //                 var resultBlob;

    //                 // todo нужно не просто создавать строку, а забивать остаток мусором

    //                 if (res.tag === "TAG") {
    //                     if (res.artist !== artist)
    //                         needsChanges = true;

    //                     if (res.title !== title)
    //                         needsChanges = true;

    //                     if (needsChanges) {
    //                         var tagString = "TAG";

    //                         if (title.length < 30) {
    //                             tagString += title;
    //                             while (tagString < 33) {
    //                                 tagString += " ";
    //                             }
    //                         } else {
    //                             tagString += title.substr(0, 30);
    //                         }

    //                         if (artist.length < 30) {
    //                             tagString += artist;
    //                             while (tagString < 63) {
    //                                 tagString += " ";
    //                             }
    //                         } else {
    //                             tagString += artist.substr(0, 30);
    //                         }

    //                         while (tagString < 128) {
    //                             tagString += " ";
    //                         }

    //                         var tagBlob = new Blob([tagString], {type: "text/plain"});
    //                         resultBlob = new Blob([blob, tagBlob], {type: "audio/mpeg"});
    //                     } else {
    //                         resultBlob = blob;
    //                     }
    //                 } else {
    //                     var tagString = "TAG";

    //                     if (title.length < 30) {
    //                         tagString += title;
    //                         while (tagString < 33) {
    //                             tagString += " ";
    //                         }
    //                     } else {
    //                         tagString += title.substr(0, 30);
    //                     }

    //                     if (artist.length < 30) {
    //                         tagString += artist;
    //                         while (tagString < 63) {
    //                             tagString += " ";
    //                         }
    //                     } else {
    //                         tagString += artist.substr(0, 30);
    //                     }

    //                     while (tagString < 128) {
    //                         tagString += " ";
    //                     }

    //                     var tagBlob = new Blob([tagString], {type: "text/plain"});
    //                     resultBlob = new Blob([blob, tagBlob], {type: "audio/mpeg"});
    //                 }

    //                 chrome.syncFileSystem.requestFileSystem(function (fs) {
    //                     fs.root.getFile(uuid() + ".mp3", {create: true}, function (fileEntry) {
    //                         fileEntry.createWriter(function (fileWriter) {
    //                             fileWriter.onwriteend = function (evt) {
    //                                 console.log(fileEntry.toURL());
    //                             };

    //                             fileWriter.onerror = function (evt) {
    //                                 console.error("Write failed: " + evt);
    //                                 // callback("");
    //                             };

    //                             fileWriter.write(resultBlob);
    //                         });
    //                     });
    //                 });
    //             });
    //         },
    //         onerror: function (error) {
    //             console.error(error);
    //         }
    //     });
    // }


    return {

    };
})();