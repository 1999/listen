Sounds = (function () {
    "use strict";

    var FADING_TIMEOUT_MS = 2000; // время затухания текущей композиции
    var MODE_SHUFFLE = "shuffle";
    var MODE_REPEAT = "repeat";
    var MODE_DEFAULT = "";

    var playlist = [];
    var playingTracks = [];

    function getRandomTrackIndex() {
        var rand = Math.random();
        var interval = 1 / playlist.length;

        return (rand === 1) ? playlist.length - 1 : Math.floor(rand / interval);
    }

    function dropTrackFromCurrentlyPlaying() {
        var index = playingTracks.indexOf(this.track);
        var progressElem = $(".music div.song-playing-bg[data-url='" + this.attr("src") + "']");

        if (index !== -1) {
            playingTracks.splice(index);
        }

        if (progressElem) {
            progressElem.remove();
        }
    }

    function onTimeUpdateSwitchTrack() {
        var trackIndex = playingTracks.indexOf(this.track);

        if (!this.track.isEnding)
            return;

        if (trackIndex !== -1) {
            Sounds.playNext();
        } else {
            Sounds.play(0);
        }

        this.unbind("timeupdate", onTimeUpdateSwitchTrack);
    }

    function onEndedSwitchTrack() {
        var trackIndex = playingTracks.indexOf(this.track);

        if (trackIndex !== -1) {
            Sounds.playNext();
        } else {
            Sounds.play(0);
        }

        this.unbind("ended", onEndedSwitchTrack);
    }

    function updateProgressElem() {
        var audioSrc = this.attr("src");
        var progressElem = $(".music div.song-playing-bg[data-url='" + audioSrc + "']");
        var trackContainer = $(".music p.song[data-url='" + audioSrc + "']");

        if (!trackContainer || !progressElem)
            return;

        var width = Math.ceil(trackContainer.clientWidth * this.currentTime / this.duration) + "px";
        $(progressElem, ".song-playing-progress").css("width", width);
    }

    function onPlayContinue() {
        var audioSrc = this.attr("src");
        var progressElem = $(".music div.song-playing-bg[data-url='" + audioSrc + "']");
        var trackContainer = $(".music p.song[data-url='" + audioSrc + "']");

        if (!trackContainer || progressElem)
            return;

        Templates.render("song-progress", {
            src: audioSrc
        }, function (html) {
            trackContainer.before(html);
        });
    }

    function smooth(options, callback) {
        clearInterval(options.dom.track.smoothIntervalId);

        var oldVolume = options.dom.volume;
        var newVolume = options.volume;
        var volumeDiff = newVolume - oldVolume;

        var defaultIterationsNum = 100;
        var iterationsNum = Math.ceil(options.timeInterval * defaultIterationsNum / FADING_TIMEOUT_MS);
        var increase = Math.PI / iterationsNum;
        var counter = 0;

        return setInterval(function () {
            var yPos = options.smoothStart ? 1 - Math.cos(counter) : Math.sin(counter);
            counter += increase;

            if (yPos >= 1) {
                options.dom.volume = newVolume;

                clearInterval(options.dom.track.smoothIntervalId);
                callback && callback.call(options.dom);

                return;
            }

            var diff = volumeDiff * yPos;
            options.dom.volume = oldVolume + diff;
        }, FADING_TIMEOUT_MS / iterationsNum);
    }

    function Track(audioSrc) {
        var smoothSwitch = Settings.get("smoothTracksSwitch");
        var volume = Settings.get("volume");

        this.dom = new Audio(audioSrc);
        this.dom.track = this;
        this.dom.volume = smoothSwitch ? 0 : volume;

        this.smoothIntervalId = null;

        this.dom.bind("timeupdate", updateProgressElem);
        this.dom.bind("play", onPlayContinue);

        if (smoothSwitch) {
            this.dom.bind("timeupdate", onTimeUpdateSwitchTrack);
            this.smoothIncreaseVolume();
        } else {
            this.dom.bind("ended", onEndedSwitchTrack);
        }

        this.dom.bind("ended", dropTrackFromCurrentlyPlaying);
        this.dom.play();
    }

    Track.prototype = {
        get isEnding() {
            return (this.dom.duration - this.dom.currentTime < FADING_TIMEOUT_MS / 1000);
        },

        get isStarting() {
            return (this.dom.currentTime * 1000 < FADING_TIMEOUT_MS);
        },

        smoothDecreaseVolume: function Track_smoothDecreaseVolume(callback) {
            this.smoothIntervalId = smooth({
                dom: this.dom,
                volume: 0,
                timeInterval: Math.min(FADING_TIMEOUT_MS, this.dom.duration - this.dom.currentTime),
                smoothStart: true
            }, callback);
        },

        smoothIncreaseVolume: function Track_smoothIncreaseVolume(callback) {
            this.smoothIntervalId = smooth({
                dom: this.dom,
                volume: Settings.get("volume"),
                timeInterval: FADING_TIMEOUT_MS,
                smoothStart: false
            }, callback);
        }
    };


    return {
        /**
         * @param {String|Number|Undefined} elem
         * @param {Boolean} canBeContinued
         */
        play: function Sounds_play(elem, canBeContinued) {
            var playingMode = Settings.get("songsPlayingMode");
            var smoothSwitch = Settings.get("smoothTracksSwitch");

            if (canBeContinued === undefined) {
                canBeContinued = true;
            }

            if (elem === undefined) {
                if (playingTracks.length) {
                    // tracks can be paused
                    var allTracksArePaused = playingTracks.every(function (track) {
                        return track.dom.paused;
                    });

                    if (!allTracksArePaused)
                        throw new Error("Playlst is already playing");

                    allTracksArePaused.forEach(function (track) {
                        track.dom.play();
                    });
                } else {
                    var trackIndex = (playingMode === MODE_SHUFFLE) ? getRandomTrackIndex() : 0;
                    this.play(trackIndex, true);
                }

                return;
            }

            var audioSrc;
            var playlistIndex;
            var isTrackContinuedPlaying = false;

            if (typeof elem === "string") {
                audioSrc = elem;
                playlistIndex = playlist.indexOf(audioSrc);

                if (playlistIndex === -1) {
                    throw new Error("No such track in playlist");
                }
            } else {
                audioSrc = playlist[elem];
                playlistIndex = elem;
            }

            // track can be already started playing and now is in paused mode
            // "canBeContinued" set to "true" allows to continue playing this track
            // otherwise the track will be started playing from the beginning (repeat mode)
            var isTrackPlaying = playingTracks.some(function (track) {
                return (track.dom.attr("src") === playlist[playlistIndex]);
            });

            playingTracks.forEach(function (track) {
                var trackSrc = track.dom.data("src");

                if (isTrackPlaying && canBeContinued && audioSrc === trackSrc) {
                    isTrackContinuedPlaying = true;
                    track.dom.play();

                    if (smoothSwitch) {
                        // @todo time available can be less than FADING_TIMEOUT_MS
                        smoothIncreaseVolume();

                        // @todo on end -> set as current volume (it can be changed during smooth)
                    }
                } else {
                    track.dom
                        .unbind("timeupdate", onTimeUpdateSwitchTrack)
                        .unbind("ended", onEndedSwitchTrack)
                        .unbind("ended", dropTrackFromCurrentlyPlaying);

                    if (smoothSwitch) {
                        track.dom.play();
                        track.smoothDecreaseVolume(dropTrackFromCurrentlyPlaying);
                    } else {
                        dropTrackFromCurrentlyPlaying.call(track.dom);
                    }
                }
            });

            if (!isTrackContinuedPlaying) {
                var track = new Track(audioSrc);
                playingTracks.push(track);
            }
        },

        playNext: function Sounds_playNext() {
            var playingMode = Settings.get("songsPlayingMode");
            var smoothSwitch = Settings.get("smoothTracksSwitch");
            var currentTrackIndex;
            var nextTrackIndex;
            var isCurrentTrackInPlaylist;

            if (!playlist.length)
                throw new Error("Playlist is empty");

            if (!playingTracks.length) {
                this.play();
                return;
            }

            // If "smoothTracksSwitch" is enabled then there can be 2+ currently playing tracks (playingTracks).
            // Some of them can be ending, some can be starting. This means that the most recent track is the last one.
            // This is the "currently playing track". And if "smoothTracksSwitch" is switched off, there can be only one currently playing track.
            currentTrackIndex = smoothSwitch ? playingTracks.length - 1 : 0;
            isCurrentTrackInPlaylist = (playlist.indexOf(playingTracks[currentTrackIndex].dom.attr("src")) !== -1);

            if (isCurrentTrackInPlaylist) {
                if (playlist.length === 1) {
                    nextTrackIndex = 0;
                } else if (playingMode === MODE_SHUFFLE) {
                    nextTrackIndex = getRandomTrackIndex();
                } else if (playingMode === MODE_REPEAT) {
                    nextTrackIndex = currentTrackIndex;
                } else {
                    nextTrackIndex = (currentTrackIndex + 1 < playlist.length) ? currentTrackIndex + 1 : 0;
                }
            } else {
                nextTrackIndex = (playingMode === MODE_SHUFFLE) ? getRandomTrackIndex() : 0;
            }

            this.play(nextTrackIndex, false);
        },

        playPrev: function Sounds_playPrev() {
            // @todo playlist can be changed

            var playingMode = Settings.get("songsPlayingMode");
            var smoothSwitch = Settings.get("smoothTracksSwitch");
            var currentTrackIndex;
            var nextTrackIndex;
            var isCurrentTrackInPlaylist;

            if (!playlist.length)
                throw new Error("Playlist is empty");

            if (!playingTracks.length) {
                this.play();
                return;
            }

            // If "smoothTracksSwitch" is enabled then there can be 2+ currently playing tracks (playingTracks).
            // Some of them can be ending, some can be starting. This means that the most recent track is the last one.
            // This is the "currently playing track". And if "smoothTracksSwitch" is switched off, there can be only one currently playing track.
            currentTrackIndex = smoothSwitch ? playingTracks.length - 1 : 0;
            isCurrentTrackInPlaylist = (playlist.indexOf(playingTracks[currentTrackIndex].dom.attr("src")) !== -1);

            if (isCurrentTrackInPlaylist) {
                if (playlist.length === 1) {
                    nextTrackIndex = 0;
                } else if (playingMode === MODE_SHUFFLE) {
                    nextTrackIndex = getRandomTrackIndex();
                } else if (playingMode === MODE_REPEAT) {
                    nextTrackIndex = currentTrackIndex;
                } else {
                    nextTrackIndex = (currentTrackIndex === 0) ? playlist.length - 1 : currentTrackIndex - 1;
                }
            } else {
                nextTrackIndex = (playingMode === MODE_SHUFFLE) ? getRandomTrackIndex() : 0;
            }

            this.play(nextTrackIndex, false);
        },

        pause: function Sounds_pause() {
            var smoothSwitch = Settings.get("smoothTracksSwitch");

            if (!playingTracks.length)
                throw new Error("Tracks are not playing");

            if (!smoothSwitch) {
                playingTracks[0].dom.pause();
                return;
            }

            playingTracks.forEach(function (track) {
                if (track.isEnding)
                    return;

                track.smoothDecreaseVolume(function () {
                    track.dom.pause();
                });
            });
        },

        /**
         * @param {Float} newLevel
         */
        changeVolumeLevel: function Sounds_changeVolumeLevel(newLevel) {
            Settings.set("volume", newLevel);

            if (!playingTracks.length)
                return;

            var smoothSwitch = Settings.get("smoothTracksSwitch");
            if (smoothSwitch) {
                playingTracks.forEach(function (track) {
                    if (track.isEnding || track.isStarting)
                        return;

                    track.dom.volume = newLevel;
                });
            } else {
                playingTracks[0].dom.volume = newLevel;
            }
        },

        updatePlaylist: function Sounds_updatePlaylist() {
            playlist.length = 0;

            $$(".music p.song").each(function () {
                playlist.push(this.data("url"));
            });
        },

        /**
         * @param {Float} percent
         */
        updateCurrentTime: function Sounds_updateCurrentTime(percent) {
            if (!playingTracks.length)
                throw new Error("Tracks are not currently playing");

            var currentTrack = playingTracks[playingTracks.length - 1];
            currentTrack.dom.currentTime = currentTrack.dom.duration * percent;
        },

        updateSettimeCaret: function Sounds_updateSettimeCaret(elem, offsetX) {

        },

        /**
         * @param {String} mode ("shuffle" или "repeat")
         */
        enableMode: function Sounds_enableMode(mode) {
            Settings.set("songsPlayingMode", mode);

            $$("header span.mode").each(function () {
                if (this.data("mode") === mode) {
                    this.addClass("active");
                } else {
                    this.removeClass("active");
                }
            });
        },

        disableMode: function Sounds_disableMode() {
            Settings.set("songsPlayingMode", "");
            $$("header span.mode").removeClass("active");
        }
    };
})();
