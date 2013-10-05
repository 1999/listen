Sounds = (function () {
    "use strict";

    var FADING_TIMEOUT_MS = 2000; // время затухания текущей композиции

    // список играющих песен, где ключ - URL песни, а значение - объект вида:
    // {HTMLAudioElement} "dom", {Number} "interval" (interval id), {Number} "iteration"
    var songsPlaying = {};

    function createAudioElem(src) {
        var audioElem = new Audio(src);
        audioElem.volume = 0;
        audioElem.bind("ended", onEnded).bind("timeupdate", onTimeUpdate);

        document.body.append(audioElem);
        songsPlaying[src] = {
            dom: audioElem,
            interval: 0
        };
    }

    function onTimeUpdate() {
        var audioSrc = this.attr("src");
        var songContainer = $(".music p.song[data-url='" + audioSrc + "']");
        var progressElem = $(".music div.song-playing-bg[data-url='" + audioSrc + "']");
        var isEnding = (this.duration - this.currentTime < FADING_TIMEOUT_MS / 1000);

        if (!progressElem) {
            var innerProgressElem = $("<div>&nbsp;</div>").addClass("song-playing-progress").css("width", "0");
            progressElem = $("<div/>").addClass("song-playing-bg").append(innerProgressElem).data("url", audioSrc);

            if (songContainer) {
                songContainer.before(progressElem);
            }
        }

        var width = Math.ceil(document.body.clientWidth * this.currentTime / this.duration) + "px";
        $(progressElem, ".song-playing-progress").css("width", width);

        if (!isEnding)
            return;

        var isPlayerPaused = $("header span.playpause").hasClass("glyphicon-play");
        var mode = Settings.get("songsPlayingMode");

        if (isPlayerPaused || this.hasClass("ending"))
            return;

        // переключение на следующий трек должно срабатывать только 1 раз
        this.addClass("ending");
        smoothInterval(audioSrc, 0, FADING_TIMEOUT_MS, true);

        switch (mode) {
            case "shuffle":
                var songs = [].slice.call($$(".music p.song"), 0).sort(function () {
                    return (Math.random() < 0.5) ? -1 : 1;
                });

                if (songs.length === 1) {
                    this.bind("ended", function () {
                        Sounds.play(songContainer);
                    });
                } else {
                    var nextSongIndex = (songs[0].data("url") === audioSrc) ? 1 : 0;
                    Sounds.play(songs[nextSongIndex]);
                }

                break;

            case "repeat":
                this.bind("ended", function () {
                    Sounds.play(songContainer);
                });

                break;

            default:
                var matchesSelectorFn = (Element.prototype.matchesSelector || Element.prototype.webkitMatchesSelector);
                var node, nextSongContainer;

                if (songContainer) {
                    node = songContainer.nextSibling;

                    while (node) {
                        if (matchesSelectorFn.call(node, "p.song")) {
                            nextSongContainer = node;
                            break;
                        }

                        node = node.nextSibling;
                    }
                } else {
                    nextSongContainer = $(".music p.song");
                }

                if (nextSongContainer) {
                    Sounds.play(nextSongContainer);
                }

                break;
        }
    }

    function onEnded() {
        var src = this.attr("src");

        songsPlaying[src].dom.unbind("ended", onEnded).unbind("timeupdate", onTimeUpdate).remove();
        delete songsPlaying[src];

        // удаляем progress фон
        var progressElem = $(".music div.song-playing-bg[data-url='" + src + "']");
        if (progressElem) {
            progressElem.remove();
        }

        // обновляем rate counter
        if (!this.hasClass("ending-via-button")) {
            var currentCnt = Settings.get("headerRateCounter") + 1;
            var payElem = $("header div.pay");
            Settings.set("headerRateCounter", currentCnt);
        }

        // при достижении header_rate_limit показываем слой с кнопками
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

    /**
     * @param {String} src
     * @param {Float} newVolume
     * @param {Number} msForInterval
     * @param {Boolean} smoothStart (true - резкий старт, плавный финиш)
     * @param {Function} callback
     */
    function smoothInterval(src, newVolume, msForInterval, smoothStart, callback) {
        var songData = songsPlaying[src];
        var oldVolume = songData.dom.volume;
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


    return {
        /**
         * @param {HTMLElement|Undefined} elem
         */
        play: function Sounds_play(elem) {
            if (elem) {
                if (!elem.hasClass("played")) {
                    var songsPlayed = Settings.get("songsPlayed");
                    Settings.set("songsPlayed", songsPlayed + 1);
                }

                elem.addClass("played");

                var originalAudioSrc = elem.data("url");
                if (!songsPlaying[originalAudioSrc]) {
                    createAudioElem(originalAudioSrc);
                }

                $(elem, "span.play").addClass("glyphicon-pause").removeClass("glyphicon-play");

                Object.keys(songsPlaying).forEach(function (audioSrc) {
                    var audioElem = songsPlaying[audioSrc].dom;

                    if (audioSrc === originalAudioSrc) {
                        smoothInterval(audioSrc, Settings.get("volume"), FADING_TIMEOUT_MS, true);
                    } else {
                        var songContainer = $(".music p.song[data-url='" + audioSrc + "']");
                        if (songContainer) {
                            $(songContainer, "span.play").addClass("glyphicon-play").removeClass("glyphicon-pause");
                        }

                        audioElem.unbind("ended", onEnded).unbind("timeupdate", onTimeUpdate);
                        var progressElem = $(".music div.song-playing-bg[data-url='" + audioSrc + "']");
                        if (progressElem) {
                            progressElem.remove();
                        }

                        smoothInterval(audioSrc, 0, FADING_TIMEOUT_MS, false, function () {
                            audioElem.remove();
                            delete songsPlaying[audioSrc];
                        });
                    }

                    audioElem.play();
                });
            } else {
                var songsSources = Object.keys(songsPlaying);

                if (songsSources.length) {
                    songsSources.forEach(function (audioSrc) {
                        var audioElem = songsPlaying[audioSrc].dom;
                        var isStarting = (audioElem.currentTime * 1000 < FADING_TIMEOUT_MS);
                        var isEnding = (audioElem.duration - audioElem.currentTime < FADING_TIMEOUT_MS / 1000);

                        if (isEnding) {
                            smoothInterval(audioSrc, 0, (audioElem.duration - audioElem.currentTime) * 1000, false);
                        } else {
                            var msForInterval = isStarting ? FADING_TIMEOUT_MS - audioElem.currentTime * 1000 : FADING_TIMEOUT_MS;
                            smoothInterval(audioSrc, Settings.get("volume"), msForInterval, true);

                            var songContainer = $(".music p.song[data-url='" + audioSrc + "']");
                            $(songContainer, "span.play").addClass("glyphicon-pause").removeClass("glyphicon-play");
                        }

                        audioElem.play();
                    });
                } else {
                    this.play($(".music p.song"));
                }
            }

            $("header span.playpause").addClass("glyphicon-pause").removeClass("glyphicon-play");
        },

        playNext: function Sounds_playNext() {
            var songsKeys = Object.keys(songsPlaying);

            if (songsKeys.length) {
                songsKeys.forEach(function (audioSrc) {
                    var audioElem = songsPlaying[audioSrc].dom;
                    audioElem.play();

                    if (audioElem.hasClass("ending"))
                        return;

                    // @todo переписать
                    audioElem.addClass("ending-via-button");
                    audioElem.currentTime = audioElem.duration - 0.2;
                });
            } else {
                this.play();
            }
        },

        playPrev: function Sounds_playPrev() {
            var songsKeys = Object.keys(songsPlaying);

            if (songsKeys.length) {
                if (["shuffle", "repeat"].indexOf(Settings.get("songsPlayingMode")) !== -1) {
                    // @todo возвращаться на предыдущую песню в случае "shuffle"
                    return this.playNext();
                }

                // @todo
                if (songsKeys.length > 1)
                    return;

                var songContainer = $(".music p.song[data-url='" + songsKeys[0] + "']");
                if (songContainer) {
                    var totalContainers = $$(".music p.song");
                    var prevSongIndex;

                    if (totalContainers.length === 1) {
                        this.play(songContainer);
                    } else {
                        totalContainers.each(function (index) {
                            if (this === songContainer) {
                                prevSongIndex = index ? index - 1 : totalContainers.length - 1;
                            }
                        });

                        this.play(totalContainers[prevSongIndex]);
                    }
                } else {
                    var firstVisibleElem = $(".music p.song");
                    if (firstVisibleElem) {
                        this.play(firstVisibleElem);
                    }
                }
            } else {
                this.play();
            }
        },

        pause: function Sounds_pause() {
            Object.keys(songsPlaying).forEach(function (audioSrc) {
                var audioElem = songsPlaying[audioSrc].dom;
                var isEnding = (audioElem.duration - audioElem.currentTime < FADING_TIMEOUT_MS / 1000);

                if (isEnding)
                    return;

                smoothInterval(audioSrc, 0, FADING_TIMEOUT_MS, false, function () {
                    this.pause();
                });
            });

            $$(".music span.play").addClass("glyphicon-play").removeClass("glyphicon-pause");
            $("header span.playpause").removeClass("glyphicon-pause").addClass("glyphicon-play");
        },

        /**
         * @param {Float} newLevel
         */
        changeVolumeLevel: function Sounds_changeVolumeLevel(newLevel) {
            Settings.set("volume", newLevel);

            Object.keys(songsPlaying).forEach(function (audioSrc) {
                var audioElem = songsPlaying[audioSrc].dom;
                var isStarting = (audioElem.currentTime * 1000 < FADING_TIMEOUT_MS);
                var isEnding = (audioElem.duration - audioElem.currentTime < FADING_TIMEOUT_MS / 1000);

                if (audioElem.paused || isEnding)
                    return;

                if (isStarting) {
                    smoothInterval(audioSrc, newLevel, FADING_TIMEOUT_MS - audioElem.currentTime * 1000, true);
                } else {
                    audioElem.volume = newLevel;
                }
            });
        },

        /**
         * Обновление текущего времени в проигрываемой песне
         * @param {HTMLElement} elem
         * @param {Number} offsetX
         */
        updateCurrentTime: function Sounds_updateCurrentTime(elem, offsetX) {
            var audioSrc = elem.data("url");
            var currentSong = songsPlaying[audioSrc];

            if (!currentSong)
                return;

            currentSong.dom.currentTime = currentSong.dom.duration * offsetX / elem.clientWidth;
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
