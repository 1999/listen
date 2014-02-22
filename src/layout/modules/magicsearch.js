MagicSearch = (function () {
    "use strict";

    var appendEnabled = false;
    var currentList;
    var pendingXHR;
    var pedingTimeout;


    return {
        /**
         * Parses list elements in series but with a min. time gap 350ms
         * When called with aother node list, stops working
         */
        run: function MagicSearch_run(nodeList, index) {
            index = index || 0;
            pedingTimeout = null;

            if (!nodeList.length)
                return;

            if (currentList !== nodeList && index === 0) {
                currentList = nodeList;

                if (pendingXHR && pendingXHR.readyState !== XMLHttpRequest.DONE) {
                    // reset performing requests
                    pendingXHR.abort();

                    // if templates rendering lasted too long, clear its layer
                    Captcha.clear();
                }

                if (pedingTimeout) {
                    window.clearTimeout(pedingTimeout);
                }
            }

            var timeStart = Date.now();
            var song = nodeList[index].data("track").replace(/\(.+?\)/g, "").replace(/\[.+?\]/g, ""); // Make love (not war) -> Make love
            var artist = nodeList[index].data("artist");
            var duration = nodeList[index].data("duration") || 0;
            var searchQuery = [];

            (artist + " " + song).replace(/\-/g, " ").replace(/[\.|,]/g, " ").split(" ").forEach(function (word) {
                word = word.toLowerCase().trim();
                if (!word.length)
                    return;

                searchQuery.push(word);
            });

            // cut remixes with a search for exact song duration overlap
            pendingXHR = VK.searchMusic(searchQuery.join(" "), {count: 10}, function (data) {
                pendingXHR = null;

                if (data.count) {
                    var trackIndex = 0; // output first track by default
                    var bestTrack;
                    var timeDiff;

                    for (var i = 0; i < data.songs.length; i++) {
                        timeDiff = Math.abs(data.songs[i].originalDuration - duration);

                        if (!duration || timeDiff <= 3) {
                            trackIndex = i;
                            break;
                        }
                    }

                    bestTrack = data.songs[trackIndex];

                    Templates.render("songs", {
                        songs: [bestTrack],
                        showDownload: Settings.get("showDownloadButtons"),
                        progress: false
                    }, function (html) {
                        // delete existing song container & its progress bar if exists
                        var existingSong = $(".music p.song[data-url='" + bestTrack.source + "']");
                        if (existingSong) {
                            existingSong.remove();
                        }

                        var existingPlayingProgress = $(".music .song-playing-bg[data-url='" + bestTrack.source + "']");
                        if (existingPlayingProgress) {
                            existingPlayingProgress.addClass("hidden");
                        }

                        // replace text with song container
                        nodeList[index].after(html).remove();

                        if (appendEnabled) {
                            Sounds.updatePlaylist();
                        }
                    });
                }

                var newIndex = index + 1;
                if (newIndex >= nodeList.length) {
                    currentList = null;
                    return;
                }

                // if search has changed, stop
                if (nodeList !== currentList)
                    return;

                var timeTotal = Date.now() - timeStart;
                var timeoutMs = Math.max(350 - timeTotal, 0);

                pedingTimeout = window.setTimeout(MagicSearch.run, timeoutMs, nodeList, newIndex);
            });
        },

        startAppendMode: function MagicSearch_startAppendMode() {
            appendEnabled = true;
        },

        stopAppendMode: function MagicSearch_stopAppendMode() {
            appendEnabled = false;
        }
    };
})();
