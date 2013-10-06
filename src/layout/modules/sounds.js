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

    /**
     * @param {HTMLAudioElement} domElem
     * @param {Float} newVolume
     * @param {Boolean} smoothStart (true - резкий старт, плавный финиш)
     * @param {Function} callback
     */
    function smoothInterval(domElem, newVolume, msForInterval, smoothStart, callback) {
        var oldVolume = domElem.volume;
        var volumeDiff = newVolume - oldVolume;

        var defaultIterationsNum = 100;
        var iterationsNum = Math.ceil(msForInterval * defaultIterationsNum / FADING_TIMEOUT_MS);
        var increase = Math.PI / iterationsNum;
        var counter = 0;

        clearInterval(songData.interval);
        songData.iteration = 0;

        songData.interval = setInterval(function () {
            var yPos = smoothStart ? 1 - Math.cos(counter) : Math.sin(counter);
            counter += increase;

            if (yPos >= 1) {
                songData.dom.volume = newVolume;

                clearInterval(songData.interval);
                callback && callback.call(songData.dom);

                return;
            }

            var diff = volumeDiff * yPos;
            songData.dom.volume = oldVolume + diff;
        }, FADING_TIMEOUT_MS / iterationsNum);
    }

    function Track(audioSrc) {
        var smoothSwitch = Settings.get("smoothTracksSwitch");
        var volume = Settings.get("volume");

        this.dom = new Audio(audioSrc);
        this.dom.track = this;
        this.dom.volume = smoothSwitch ? 0 : volume;

        this.dom.bind("timeupdate", updateProgressElem);
        this.dom.bind("play", onPlayContinue);

        if (smoothSwitch) {
            smoothIncreaseVolume();
            this.dom.bind("timeupdate", onTimeUpdateSwitchTrack);
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
        }
    };


    return {
        /**
         * @param {HTMLElement|Number|Undefined} elem
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

            if (elem instanceof HTMLElement) {
                audioSrc = elem.data("url");
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
                    }
                } else {
                    track.dom
                        .unbind("timeupdate", onTimeUpdateSwitchTrack)
                        .unbind("ended", onEndedSwitchTrack)
                        .unbind("ended", dropTrackFromCurrentlyPlaying);

                    if (smoothSwitch) {
                        track.dom.play();

                        // @todo time available can be less than FADING_TIMEOUT_MS
                        smoothDecreaseVolume(dropTrackFromCurrentlyPlaying)
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

            if (!playlist.length)
                throw new Error("Playlist is empty");

            switch (playingTracks.length) {
                case 0:
                    if (playingMode === MODE_SHUFFLE) {
                        var trackIndex = getRandomTrackIndex();
                        this.play(trackIndex);
                    } else {
                        this.play();
                    }

                    break;

                case 1:
                    // ends playing - enabled smooth
                    break;

                default:
                    xxx
            }

            // ни один трек не играет
            // треков несколько
            // трек заканчивает играть (мод?)
            // включен режим рипита
        },

        playPrev: function Sounds_playPrev() {

        },

        pause: function Sounds_pause() {

        },

        /**
         * @param {Float} newLevel
         */
        changeVolumeLevel: function Sounds_changeVolumeLevel(newLevel) {
            Settings.set("volume", newLevel);

            // ???
        },

        updatePlaylist: function Sounds_updatePlaylist() {
            playlist.length = 0;

            $$(".music p.song").each(function () {
                playlist.push(this.data("url"));
            });
        },

        /**
         * Обновление текущего времени в проигрываемой песне
         * @param {HTMLElement} elem
         * @param {Number} offsetX
         */
        updateCurrentTime: function Sounds_updateCurrentTime(elem, offsetX) {

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
