Sounds = (function () {
    "use strict";

    var MODE_SHUFFLE = "shuffle";
    var MODE_REPEAT = "repeat";
    var MODE_DEFAULT = "";

    var NOTIFICATION_NAME = "switchTrack";
    var NOTIFICATION_TIMEOUT_MS = 5000;

    var playlist = []; // [{url, artist, title, index}, ...}
    var playingTrack;
    var notificationTimeoutId;

    chrome.notifications && chrome.notifications.onClicked.addListener(function (notificationId) {
        if (notificationId !== NOTIFICATION_NAME) {
            return;
        }

        chrome.notifications.clear(NOTIFICATION_NAME, function () {});
        clearTimeout(notificationTimeoutId);
        notificationTimeoutId = null;

        chrome.app.window.current().show();
    });

    chrome.notifications && chrome.notifications.onButtonClicked.addListener(function (notificationId, buttonIndex) {
        if (notificationId !== NOTIFICATION_NAME) {
            return;
        }

        chrome.notifications.clear(NOTIFICATION_NAME, function () {});
        clearTimeout(notificationTimeoutId);
        notificationTimeoutId = null;

        switch (buttonIndex) {
            case 0: Sounds.playPrev(); break;
            case 1: Sounds.playNext(); break;
        }
    });

    function showNotification(options) {
        if (!Settings.get("showNotifications"))
            return;

        var method = "create";

        if (notificationTimeoutId) {
            clearTimeout(notificationTimeoutId);
            method = "update";
        }

        chrome.notifications && chrome.notifications[method](NOTIFICATION_NAME, {
            type: "basic",
            iconUrl: options.cover || chrome.runtime.getURL("pics/icons/128.png"),
            title: options.artist,
            message: options.track,
            buttons: [
                {
                    title: chrome.i18n.getMessage("notificationTrackPrev")
                },
                {
                    title: chrome.i18n.getMessage("notificationTrackNext")
                }
            ]
        }, function () {
            notificationTimeoutId = setTimeout(function () {
                chrome.notifications.clear(NOTIFICATION_NAME, function () {});
                notificationTimeoutId = null;
            }, options.show ? NOTIFICATION_TIMEOUT_MS : 0);
        });
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

    function onEndedSwitchTrack() {
        Sounds.playNext(true);
        updateRateCounter();
    }

    function updateProgressElem() {
        var audioSrc = this.attr("src").replace(/'/g, "\\'");
        var trackContainer = $(".music p.song[data-url='" + audioSrc + "']");
        var width = Math.ceil(document.body.clientWidth * this.currentTime / this.duration) + "px";

        $("footer .song-playing-progress").css("width", width);

        if (trackContainer) {
            var progressElem = $(".music div.song-playing-bg").removeClass("hidden");
            $(progressElem, ".song-playing-progress").css("width", width);

            if (trackContainer.previousSibling !== progressElem) {
                trackContainer.before(progressElem);
            }
        }

        // The track must be longer than 30 seconds.
        // And the track has been played for at least half its duration, or for 4 minutes (whichever occurs earlier.)
        // @see http://www.lastfm.ru/api/scrobbling#scrobble-requests
        if (!this.container.scrobbled && this.duration > 30) {
            if (this.currentTime > this.duration / 2 || this.currentTime >= 4 * 60) {
                var playlistIndex = getPlaylistIndexOfURL(this.attr("src"));
                if (Lastfm.isAuthorized && playlistIndex !== -1) {
                    var trackPlaylistData = playlist[playlistIndex];
                    Lastfm.scrobble(trackPlaylistData.artist, trackPlaylistData.title, null, null, Math.round(this.duration));

                    this.container.scrobbled = true;
                }
            }
        }
    }

    function onPlayContinue() {
        var audioSrc = this.attr("src").replace(/'/g, "\\'");
        var progressElem = $(".music div.song-playing-bg").data("url", audioSrc);
        var trackContainer = $(".music p.song[data-url='" + audioSrc + "']");

        if (trackContainer) {
            // update song container buttons
            $(trackContainer, ".play").addClass("hidden");
            $(trackContainer, ".pause").removeClass("hidden");

            trackContainer.before(progressElem);
            $(progressElem, ".song-playing-progress").css("width", "0");
        }
    }

    function onDurationChange() {
        var playlistIndex = getPlaylistIndexOfURL(this.attr("src"));
        if (!Lastfm.isAuthorized || playlistIndex === -1) {
            return;
        }

        var trackPlaylistData = playlist[playlistIndex];
        Lastfm.updateNowPlaying(trackPlaylistData.artist, trackPlaylistData.title, null, null, Math.round(this.duration));

        // getID3v1Data(audioSrc, function (data) {
        //     console.log(JSON.stringify(data));
        // });
    }

    function updateRateCounter() {
        // @todo может быть открыта страница настроек с уже показанным преложением
        var payElem = $("header div.pay");

        var currentCnt = Settings.get("headerRateCounter") + 1;
        Settings.set("headerRateCounter", currentCnt);

        if (currentCnt >= Config.constants.header_rate_limit && !payElem) {
            var headerPay = Settings.get("headerPay");
            var totalCloseActions = 0;

            for (var key in headerPay) {
                totalCloseActions += headerPay[key];
            }

            Templates.render("header-pay", {
                payText: chrome.i18n.getMessage("headerCallActionText", [chrome.runtime.getManifest().name, Config.constants.vk_repost_url, Config.constants.cws_app_link]),
                vkRepost: chrome.i18n.getMessage("vkRepost"),
                cwsRate: chrome.i18n.getMessage("rateCWS"),
                close: chrome.i18n.getMessage("close"),
                hideClose: ((totalCloseActions % 5) === 1) // hide close every 5th show
            }, function (html) {
                $("header").append(html);
            });
        }
    }

    // Get content-length of the MP3 file, then get its last 128 bytes with Range header
    function getID3v1Data(audioSrc, callback) {
        // @todo cache - uploaded track cant change its ID3v1
        loadResource(audioSrc, {
            method: "HEAD",
            onload: function () {
                var contentLength = this.getResponseHeader("Content-Length");
                var bytesRangeHeader = "bytes=" + (contentLength - 128) + "-" + contentLength;

                loadResource(audioSrc, {
                    headers: {
                        Range: bytesRangeHeader
                    },
                    responseType: "blob",
                    onload: function () {
                        var blob = this.response;

                        parallel({
                            tag: function (callback) {
                                readBinary(blob.slice(0, 3, "text/plain"), callback);
                            },
                            artist: function (callback) {
                                readBinary(blob.slice(33, 63, "text/plain"), callback);
                            },
                            title: function (callback) {
                                readBinary(blob.slice(3, 33, "text/plain"), callback);
                            }
                        }, function (res) {
                            if (res.tag !== "TAG")
                                return callback();

                            callback({
                                artist: res.artist.trim(),
                                title: res.title.trim()
                            });
                        });
                    },
                    onerror: function (evt) {
                        console.error(evt);
                        callback();
                    }
                });
            },
            onerror: function (evt) {
                console.error(evt);
                callback();
            }
        });
    }

    function readBinary(blob, callback) {
        var reader = new FileReader;
        reader.onloadend = function () {
            callback(reader.result);
        };

        reader.readAsBinaryString(blob);
    }

    function Track(audioSrc) {
        this.dom = new Audio(audioSrc);
        this.dom.volume = Settings.get("volume");
        this.dom.container = this;

        this.dom
            .bind("timeupdate", updateProgressElem)
            .bind("play", onPlayContinue)
            .bind("durationchange", onDurationChange)
            .bind("ended", onEndedSwitchTrack);

        document.body.append(this.dom);
        this.dom.play();
    }

    Track.prototype.destruct = function () {
        this.dom
            .unbind("timeupdate", updateProgressElem)
            .unbind("play", onPlayContinue)
            .unbind("durationchange", onDurationChange)
            .unbind("ended", onEndedSwitchTrack);

        this.dom.remove();
    };


    return {
        updatePlaylist: function Sounds_updatePlaylist() {
            playlist.length = 0;

            $$(".music p.song").each(function (index) {
                playlist.push({
                    url: this.data("url"),
                    artist: this.data("artist"),
                    title: this.data("title"),
                    index: index
                });
            });

            var isShuffleModeEnabled = (Settings.get("songsPlayingMode") === MODE_SHUFFLE);
            if (isShuffleModeEnabled) {
                playlist.sort(function () {
                    return (Math.random() > 0.5) ? -1 : 1;
                });
            }

            // starting from now MagicSearch can update playlist until the app view changes
            MagicSearch.startAppendMode();
        },

        /**
         * @param {String|Number|Undefined} elem
         */
        play: function Sounds_play(elem) {
            var playingMode = Settings.get("songsPlayingMode");
            var audioSrc;
            var playlistIndex;;

            if (elem === undefined) {
                // hack to build playlist during the first click
                if (!playlist.length) {
                    this.updatePlaylist();
                }

                if (!playingTrack) {
                    this.play(0);
                    return;
                }

                if (!playingTrack.dom.paused)
                    throw new Error("Playlst is already playing");

                playingTrack.dom.play();

                audioSrc = playingTrack.dom.attr("src");
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

                if (playingTrack && playingTrack.dom.attr("src") === playlist[playlistIndex].url) {
                    playingTrack.dom.play();
                } else {
                    if (playingTrack) {
                        playingTrack.destruct();
                    }

                    playingTrack = new Track(audioSrc);

                    CPA.sendEvent("Lyfecycle", "Dayuse.New", "Songs played", 1);

                    // update statistics
                    var songsPlayed = Settings.get("songsPlayed");
                    Settings.set("songsPlayed", songsPlayed + 1);
                }
            }

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
            var songTitleElem = $("footer .song-title").removeClass("hidden");
            $(songTitleElem, ".track-artist").attr("href", "artist:" + playlist[playlistIndex].artist).html(playlist[playlistIndex].artist);
            $(songTitleElem, ".track-title").text(playlist[playlistIndex].title);
        },

        playNext: function Sounds_playNext(autoSwitch) {
            if (!playlist.length) {
                this.updatePlaylist();

                if (!playlist.length) {
                    throw new Error("Playlist is empty");
                }
            }

            if (!playingTrack) {
                this.play();
                return;
            }

            var playingMode = Settings.get("songsPlayingMode");
            var currentTrackPlaylistIndex = getPlaylistIndexOfURL(playingTrack.dom.attr("src"));
            var isCurrentTrackInPlaylist = (currentTrackPlaylistIndex !== -1);
            var nextTrackIndex;

            if (isCurrentTrackInPlaylist) {
                if (playlist.length === 1) {
                    nextTrackIndex = 0;
                } else if (playingMode === MODE_REPEAT && autoSwitch) {
                    nextTrackIndex = currentTrackPlaylistIndex;
                } else {
                    nextTrackIndex = (currentTrackPlaylistIndex + 1 < playlist.length) ? currentTrackPlaylistIndex + 1 : 0;
                }
            } else {
                nextTrackIndex = 0;
            }

            this.play(nextTrackIndex);

            showNotification({
                artist: playlist[nextTrackIndex].artist.trim(),
                track: playlist[nextTrackIndex].title.trim(),
                cover: (Navigation.currentView === "searchAlbum") ? $(".info .album-cover").attr("src") : null,
                show: autoSwitch
            });
        },

        playPrev: function Sounds_playPrev() {
            if (!playlist.length) {
                this.updatePlaylist();

                if (!playlist.length) {
                    throw new Error("Playlist is empty");
                }
            }

            if (!playingTrack) {
                this.play();
                return;
            }

            var playingMode = Settings.get("songsPlayingMode");
            var currentTrackPlaylistIndex = getPlaylistIndexOfURL(playingTrack.dom.attr("src"));
            var isCurrentTrackInPlaylist = (currentTrackPlaylistIndex !== -1);
            var nextTrackIndex;

            if (isCurrentTrackInPlaylist) {
                if (playlist.length === 1) {
                    nextTrackIndex = 0;
                } else {
                    nextTrackIndex = (currentTrackPlaylistIndex === 0) ? playlist.length - 1 : currentTrackPlaylistIndex - 1;
                }
            } else {
                nextTrackIndex = 0;
            }

            this.play(nextTrackIndex);
        },

        pause: function Sounds_pause() {
            if (!playingTrack)
                throw new Error("Tracks are not playing");

            playingTrack.dom.pause();

            // update song containers
            $$(".music p.song").each(function () {
                $(this, ".play").removeClass("hidden");
                $(this, ".pause").addClass("hidden");
            });

            // update player state
            $("footer .play").removeClass("hidden");
            $("footer .pause").addClass("hidden");
        },

        /**
         * @param {Float} newLevel
         */
        changeVolumeLevel: function Sounds_changeVolumeLevel(newLevel) {
            Settings.set("volume", newLevel);

            if (!playingTrack)
                return;

            playingTrack.dom.volume = newLevel;
        },

        /**
         * @param {Float} percent
         */
        updateCurrentTime: function Sounds_updateCurrentTime(percent) {
            if (!playingTrack)
                throw new Error("Tracks are not currently playing");

            playingTrack.dom.currentTime = playingTrack.dom.duration * percent;
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

            if (mode === MODE_SHUFFLE) {
                playlist.sort(function () {
                    return (Math.random() > 0.5) ? -1 : 1;
                });
            } else {
                playlist.sort(function (a, b) {
                    return (a.index - b.index);
                });
            }
        },

        disableMode: function Sounds_disableMode() {
            Settings.set("songsPlayingMode", "");
            $$("footer span.mode").removeClass("active");

            playlist.sort(function (a, b) {
                return (a.index - b.index);
            });
        }
    };
})();
