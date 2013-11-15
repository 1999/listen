DND = (function () {
    "use strict";

    function getArtistAndTitleFromLocalFile(file, callback) {
        var defaultArtist = chrome.i18n.getMessage("unknownArtist");
        var defaultTrack = chrome.i18n.getMessage("unknownTrack");

        var reader = new FileReader;
        var nullRegex = new RegExp(String.fromCharCode(0), "g");
        var artist;
        var song;

        reader.onloadend = function () {
            if (reader.result && reader.result.substr(0, 3) === "TAG") {
                artist = reader.result.substr(33, 30).replace(nullRegex, "").trim();
                song = reader.result.substr(3, 30).replace(nullRegex, "").trim();
            }

            callback({
                artist: artist || defaultArtist,
                song: song || defaultTrack
            });
        };

        reader.onerror = function () {
            callback({
                artist: defaultArtist,
                song: defaultTrack
            });
        };

        reader.readAsText(file.slice(file.size - 128, file.size, "text/plain"), "windows-1251");
    }


    return {
        finish: function DND_finish() {
            document.documentElement.removeClass("overlay-required");
            document.body.removeClass("overlay-required");

            $(".dnd-overlay").addClass("hidden");
            $(".dnd-container").removeClass("dnd-container-dragover");
        },

        upload: function DND_upload(file) {
            var id = "rn" + Math.round(Math.random() * 100000);

            Templates.render("dnd-file", {
                id: id,
                artist: chrome.i18n.getMessage("unknownArtist"),
                song: chrome.i18n.getMessage("unknownTrack")
            }, function (html) {
                $(".dnd-container").append(html);

                getArtistAndTitleFromLocalFile(file, function (data) {
                    $("#" + id + " .dnd-artist").html(data.artist);
                    $("#" + id + " .dnd-song").html(data.song);
                });

                VK.upload(file, function (percentsUploaded) {
                    var progressElem = $("#" + id + " .progress-bar");
                    progressElem.css("width", percentsUploaded + "%").attr("aria-valuenow", percentsUploaded);
                }, function (uploaded) {
                    var uploadingFileContainer = $("#" + id).addClass("ready");
                    var progressElem = $(uploadingFileContainer, ".progress-bar").removeClass("active");

                    if (uploaded) {
                        progressElem.addClass("progress-bar-success");
                    } else {
                        progressElem.addClass("progress-bar-danger");
                    }

                    var uploadingFiles = $$(".dnd-file");
                    var readyFiles = $$(".dnd-file.ready");

                    if (uploadingFiles.length === readyFiles.length) {
                        Templates.render("dnd-ready", {
                            allFilesUploaded: chrome.i18n.getMessage("allFilesUploaded"),
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
