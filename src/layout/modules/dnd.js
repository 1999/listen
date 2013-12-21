DND = (function () {
    "use strict";

    function getArtistAndTitleFromLocalFile(file, callback) {
        var defaultArtist = chrome.i18n.getMessage("unknownArtist");
        var defaultTrack = chrome.i18n.getMessage("unknownTrack");

        parallel({
            tag: function (callback) {
                var blob = file.slice(file.size - 128, file.size - 125, "text/plain");
                requestID3v1(blob, callback);
            },
            artist: function (callback) {
                var blob = file.slice(file.size - 95, file.size - 65, "text/plain");
                requestID3v1(blob, callback);
            },
            song: function (callback) {
                var blob = file.slice(file.size - 125, file.size - 95, "text/plain");
                requestID3v1(blob, callback);
            }
        }, function (res) {
            if (res.tag === "TAG") {
                res.artist = res.artist || defaultArtist;
                res.song = res.song || defaultTrack;
            } else {
                res.artist = defaultArtist;
                res.song = defaultTrack;
            }

            callback(res);
        });
    }


    return {
        finish: function DND_finish() {
            document.documentElement.removeClass("overlay-required");
            document.body.removeClass("overlay-required");

            $(".dnd-overlay").addClass("hidden");
            $(".dnd-container").empty().removeClass("dnd-container-dragover");
        },

        upload: function DND_upload(file) {
            var id = "rn" + Math.round(Math.random() * 100000);

            Templates.render("dnd-file", {
                id: id,
                artist: chrome.i18n.getMessage("unknownArtist"),
                song: chrome.i18n.getMessage("unknownTrack")
            }, function (html) {
                $(".dnd-container").append(html);

                var pageHeight = Math.max(document.body.offsetHeight, document.body.clientHeight);
                if ($(".dnd-overlay").clientHeight > pageHeight) {
                    document.documentElement.removeClass("overlay-required");
                    document.body.removeClass("overlay-required");
                } else {
                    document.documentElement.addClass("overlay-required");
                    document.body.addClass("overlay-required");
                }

                getArtistAndTitleFromLocalFile(file, function (data) {
                    $("#" + id + " .dnd-artist").html(data.artist);
                    $("#" + id + " .dnd-song").html(data.song);
                });

                VK.upload(file, function (percentsUploaded) {
                    var progressElem = $("#" + id + " .progress-bar");
                    progressElem.css("width", percentsUploaded + "%").attr("aria-valuenow", percentsUploaded);
                }, function (uploaded) {
                    var uploadingFileContainer = $("#" + id).addClass("ready");
                    var progressContainer = $(uploadingFileContainer, ".progress").removeClass("active", "progress-striped");
                    var progressElem = $(uploadingFileContainer, ".progress-bar");

                    if (uploaded) {
                        progressElem.addClass("progress-bar-success");
                    } else {
                        progressElem.addClass("progress-bar-danger");
                    }

                    var uploadingFiles = $$(".dnd-file");
                    var readyFiles = $$(".dnd-file.ready");

                    if (uploadingFiles.length === readyFiles.length) {
                        Templates.render("dnd-ready", {
                            allFilesProcessed: chrome.i18n.getMessage("allFilesProcessed"),
                            nextStep: chrome.i18n.getMessage("continue")
                        }, function (html) {
                            $(".dnd-container").append(html);
                        });
                    }
                });
            });
        }
    };
})();
