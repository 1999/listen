Sounds = (function () {
    "use strict";

    var FADING_TIMEOUT_MS = 1500; // время затухания текущей композиции
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

    function getPlaylistIndexOfURL(url) {
        var index = -1;

        playlist.forEach(function (elem, i) {
            if (elem.url === url) {
                index = i;
            }
        });

        return index;
    }

    function dropTrackFromCurrentlyPlaying() {
        var index = playingTracks.indexOf(this.track);
        var audioSrc = this.attr("src");
        var progressElem = $(".music div.song-playing-bg[data-url='" + audioSrc + "']");

        if (index !== -1) {
            playingTracks.splice(index, 1);
        }

        // when "repeat this track" is enabled, there's no need to delete progress element
        var hasSameTrackPlaying = playingTracks.some(function (track) {
            return (track.dom.attr("src") === audioSrc);
        });

        if (progressElem && !hasSameTrackPlaying) {
            progressElem.remove();
        }

        this.remove();
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
        updateRateCounter();
    }

    function onEndedSwitchTrack() {
        var trackIndex = playingTracks.indexOf(this.track);

        if (trackIndex !== -1) {
            Sounds.playNext();
        } else {
            Sounds.play(0);
        }

        this.unbind("ended", onEndedSwitchTrack);
        updateRateCounter();
    }

    function updateProgressElem() {
        var audioSrc = this.attr("src");
        var progressElem = $(".music div.song-playing-bg[data-url='" + audioSrc + "']");
        var headerProgressElem = $("footer .song-playing-progress");
        var trackContainer = $(".music p.song[data-url='" + audioSrc + "']");
        var width = Math.ceil(document.body.clientWidth * this.currentTime / this.duration) + "px";

        headerProgressElem.css("width", width);

        if (trackContainer && progressElem) {
            $(progressElem, ".song-playing-progress").css("width", width);
        }
    }

    function onPlayContinue() {
        var audioSrc = this.attr("src");
        var progressElem = $(".music div.song-playing-bg[data-url='" + audioSrc + "']");
        var trackContainer = $(".music p.song[data-url='" + audioSrc + "']");

        if (!trackContainer || progressElem)
            return;

        // update song container buttons
        $(trackContainer, ".play").addClass("hidden");
        $(trackContainer, ".pause").removeClass("hidden");

        Templates.render("song-progress", {
            src: audioSrc
        }, function (html) {
            trackContainer.before(html);
        });
    }

    function updateRateCounter() {
        // @todo может быть открыта страница настроек с уже показанным преложением
        var payElem = $("header div.pay");

        var currentCnt = Settings.get("headerRateCounter") + 1;
        Settings.set("headerRateCounter", currentCnt);

        if (currentCnt >= Config.constants.header_rate_limit && !payElem) {
            Templates.render("header-pay", {
                payText: chrome.i18n.getMessage("moneyMaker", [chrome.runtime.getManifest().name, Config.constants.yamoney_link, Config.constants.cws_app_link]),
                payYaMoney: chrome.i18n.getMessage("yandexMoney"),
                cwsRate: chrome.i18n.getMessage("rateCWS"),
                close: chrome.i18n.getMessage("close")
            }, function (html) {
                $("header").append(html);
            });
        }
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

        document.body.append(this.dom);
        this.dom.play();
    }

    Track.prototype = {
        get isEnding() {
            return (this.dom.duration - this.dom.currentTime < FADING_TIMEOUT_MS / 1000);
        },

        get isStarting() {
            return (this.dom.currentTime * 1000 < FADING_TIMEOUT_MS);
        },

        smoothIncreaseVolume: function Track_smoothIncreaseVolume(callback) {
            this.smoothIntervalId = smooth({
                dom: this.dom,
                volume: Settings.get("volume"),
                timeInterval: FADING_TIMEOUT_MS,
                smoothStart: false
            }, callback);
        },

        smoothDecreaseVolume: function Track_smoothDecreaseVolume(callback) {
            this.smoothIntervalId = smooth({
                dom: this.dom,
                volume: 0,
                timeInterval: Math.min(FADING_TIMEOUT_MS, this.dom.duration - this.dom.currentTime),
                smoothStart: true
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
            var audioSrc;
            var playlistIndex;;

            if (canBeContinued === undefined) {
                canBeContinued = true;
            }

            if (elem === undefined) {
                // hack to build playlist during the first click
                if (!playlist.length) {
                    this.updatePlaylist();
                }

                if (!playingTracks.length) {
                    var trackIndex = (playingMode === MODE_SHUFFLE) ? getRandomTrackIndex() : 0;
                    this.play(trackIndex, true);

                    return;
                }

                // tracks can be paused
                var allTracksArePaused = playingTracks.every(function (track) {
                    return track.dom.paused;
                });

                if (!allTracksArePaused)
                    throw new Error("Playlst is already playing");

                playingTracks.forEach(function (track) {
                    track.dom.play();

                    if (smoothSwitch && (track.isStarting || !track.isEnding)) {
                        // If track is ending, it will be automatically switched to the next track by "onTimeUpdateSwitchTrack"
                        // This will call "play" method, which will smoothly decrease volume level, so there's nothing to do here
                        track.smoothIncreaseVolume();
                    }
                });

                audioSrc = playingTracks[playingTracks.length - 1].dom.attr("src");
                playlistIndex = getPlaylistIndexOfURL(audioSrc);

                if (playlistIndex === -1) {
                    throw new Error("No such track in playlist");
                }
            } else {
                var isTrackContinuedPlaying = false;

                if (typeof elem === "string") {
                    audioSrc = elem;
                    playlistIndex = getPlaylistIndexOfURL(audioSrc);

                    if (playlistIndex === -1) {
                        throw new Error("No such track in playlist");
                    }
                } else {
                    audioSrc = playlist[elem].url;
                    playlistIndex = elem;
                }

                // track can be already started playing and now is in paused mode
                // "canBeContinued" set to "true" allows to continue playing this track
                // otherwise the track will be started playing from the beginning (repeat mode)
                var isTrackPlaying = playingTracks.some(function (track) {
                    return (track.dom.attr("src") === playlist[playlistIndex].url);
                });

                playingTracks.forEach(function (track) {
                    var trackSrc = track.dom.attr("src");

                    if (isTrackPlaying && canBeContinued && audioSrc === trackSrc) {
                        isTrackContinuedPlaying = true;
                        track.dom.play();

                        if (smoothSwitch) {
                            track.smoothIncreaseVolume(function () {
                                // colume level can be changed during these 2 seconds, so set it in callback
                                this.volume = Settings.get("volume");
                            });
                        }
                    } else {
                        track.dom
                            .unbind("timeupdate", onTimeUpdateSwitchTrack)
                            .unbind("timeupdate", updateProgressElem)
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

                    // update statistics
                    var songsPlayed = Settings.get("songsPlayed");
                    Settings.set("songsPlayed", songsPlayed + 1);
                }
            }

            // delete current playing progress
            $$(".music .song-playing-bg").remove();
            $("footer .song-playing-progress").css("width", "0");

            // update song containers
            $$(".music p.song").each(function () {
                if (this.data("url") === audioSrc) {
                    $(this, ".play").addClass("hidden");
                    $(this, ".pause").removeClass("hidden");
                } else {
                    $(this, ".play").removeClass("hidden");
                    $(this, ".pause").addClass("hidden");
                }
            });

            // update player state
            $("footer .play").addClass("hidden");
            $("footer .pause").removeClass("hidden");

            // update player current song
            $("footer .song-title").text(playlist[playlistIndex].artist + " - " + playlist[playlistIndex].title);
        },

        playNext: function Sounds_playNext() {
            var playingMode = Settings.get("songsPlayingMode");
            var smoothSwitch = Settings.get("smoothTracksSwitch");
            var currentTrackIndex;
            var currentTrackPlaylistIndex;
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
            currentTrackPlaylistIndex = getPlaylistIndexOfURL(playingTracks[currentTrackIndex].dom.attr("src"));
            isCurrentTrackInPlaylist = (currentTrackPlaylistIndex !== -1);

            if (isCurrentTrackInPlaylist) {
                if (playlist.length === 1) {
                    nextTrackIndex = 0;
                } else if (playingMode === MODE_SHUFFLE) {
                    nextTrackIndex = getRandomTrackIndex();
                } else if (playingMode === MODE_REPEAT) {
                    nextTrackIndex = currentTrackPlaylistIndex;
                } else {
                    nextTrackIndex = (currentTrackPlaylistIndex + 1 < playlist.length) ? currentTrackPlaylistIndex + 1 : 0;
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
            var currentTrackPlaylistIndex;
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
            currentTrackPlaylistIndex = getPlaylistIndexOfURL(playingTracks[currentTrackIndex].dom.attr("src"));
            isCurrentTrackInPlaylist = (currentTrackPlaylistIndex !== -1);

            if (isCurrentTrackInPlaylist) {
                if (playlist.length === 1) {
                    nextTrackIndex = 0;
                } else if (playingMode === MODE_SHUFFLE) {
                    nextTrackIndex = getRandomTrackIndex();
                } else if (playingMode === MODE_REPEAT) {
                    nextTrackIndex = currentTrackPlaylistIndex;
                } else {
                    nextTrackIndex = (currentTrackPlaylistIndex === 0) ? playlist.length - 1 : currentTrackPlaylistIndex - 1;
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
            } else {
                playingTracks.forEach(function (track) {
                    if (track.isEnding)
                        return;

                    track.smoothDecreaseVolume(function () {
                        track.dom.pause();
                    });
                });
            }

            // update song containers
            $$(".music p.song").each(function () {
                $(this, ".play").removeClass("hidden");
                $(this, ".pause").addClass("hidden");
            });

            // update player state
            $("footer .play").removeClass("hidden");
            $("footer .pause").addClass("hidden");

            // delete current playing progress
            $$(".music .song-playing-bg").remove();
            $("footer .song-playing-progress").css("width", "0");
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
                playlist.push({
                    url: this.data("url"),
                    artist: this.data("artist"),
                    title: this.data("title")
                });
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

        onVisibleTracksUpdated: function Sounds_onVisibleTracksUpdated() {
            if (!playingTracks.length)
                return;

            var currentTrack = playingTracks[playingTracks.length - 1];
            onPlayContinue.call(currentTrack.dom);
        },

        /**
         * @param {String} mode ("shuffle" или "repeat")
         */
        enableMode: function Sounds_enableMode(mode) {
            Settings.set("songsPlayingMode", mode);

            $$("footer span.mode").each(function () {
                if (this.data("mode") === mode) {
                    this.addClass("active");
                } else {
                    this.removeClass("active");
                }
            });
        },

        disableMode: function Sounds_disableMode() {
            Settings.set("songsPlayingMode", "");
            $$("footer span.mode").removeClass("active");
        }
    };
})();
