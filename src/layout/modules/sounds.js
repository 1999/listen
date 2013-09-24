Sounds = (function () {
    "use strict";

    var FADING_TIMEOUT_MS = 1500; // время затухания текущей композиции

    // список играющих песен, где ключ - URL песни, а значение - объект вида:
    // {HTMLAudioElement} "dom", {Number} "interval" (interval id), {Number} "iteration"
    var songsPlaying = {};

    function createAudioElem(src) {
        var audioElem = new Audio(src);
        audioElem.volume = 0;

        audioElem.bind("ended", function () {
            var src = this.attr("src");
            var isPlayerPaused = $("header span.playpause").hasClass("paused");
            var mode = Settings.get("songsPlayingMode");

            songsPlaying[src].dom.remove();
            delete songsPlaying[src];

            // обновляем rate counter
            var currentCnt = Settings.get("headerRateCounter") + 1;
            var payElem = $("header div.pay");
            Settings.set("headerRateCounter", currentCnt);

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

            if (isPlayerPaused)
                return;

            switch (mode) {
                case "shuffle":
                    var songs = [].slice.call($$(".music p.song"), 0).sort(function () {
                        return (Math.random() < 0.5);
                    });

                    Sounds.play(songs[0]);
                    break;

                case "repeat":
                    var songContainer = $(".music p.song[data-url='" + src + "']");
                    Sounds.play(songContainer);
                    break;

                default:
                    var endedSongContainer = $(".music p.song[data-url='" + src + "']");
                    var matchesSelectorFn = (Element.prototype.matchesSelector || Element.prototype.webkitMatchesSelector);
                    var node = endedSongContainer.nextSibling;
                    var nextSongContainer;

                    while (node) {
                        if (matchesSelectorFn.call(node, "p.song")) {
                            nextSongContainer = node;
                            break;
                        }

                        node = node.nextSibling;
                    }

                    if (nextSongContainer) {
                        Sounds.play(nextSongContainer);
                    }

                    break;
            }
        }).bind("timeupdate", function () {
            var matchesSelectorFn = (Element.prototype.matchesSelector || Element.prototype.webkitMatchesSelector);
            var songContainer = $(".music p.song[data-url='" + this.attr("src") + "']");
            var progressElem = songContainer.previousSibling;

            if (!progressElem || !matchesSelectorFn.call(progressElem, "div.song-playing-bg")) {
                progressElem = $("<div class='song-playing-bg'>&nbsp;</div>");
                songContainer.before(progressElem.css("width", "0"));
            }

            var width = Math.ceil(document.body.clientWidth * this.currentTime / this.duration) + "px";
            progressElem.css("width", width);
        });

        document.body.append(audioElem);
        songsPlaying[src] = {
            dom: audioElem,
            interval: 0
        };
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
                var originalAudioSrc = elem.data("url");
                if (songsPlaying[originalAudioSrc])
                    return;

                if (elem.hasClass("played")) {
                    var songsPlayed = Settings.get("songsPlayed");
                    Settings.set("songsPlayed", songsPlayed + 1);
                }

                elem.addClass("played");
                createAudioElem(originalAudioSrc);
                $(elem, "span.glyphicon-play").addClass("glyphicon-pause").removeClass("glyphicon-play");

                Object.keys(songsPlaying).forEach(function (audioSrc) {
                    var audioElem = songsPlaying[audioSrc].dom;

                    if (audioSrc === originalAudioSrc) {
                        smoothInterval(audioSrc, Settings.get("volume"), FADING_TIMEOUT_MS, true);
                    } else {
                        smoothInterval(audioSrc, 0, FADING_TIMEOUT_MS, false, function () {
                            songsPlaying[audioSrc].dom.remove();
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

                        if (isStarting) {
                            smoothInterval(audioSrc, Settings.get("volume"), FADING_TIMEOUT_MS - audioElem.currentTime * 1000, true);
                        } else if (isEnding) {
                            smoothInterval(audioSrc, 0, (audioElem.duration - audioElem.currentTime) * 1000, false);
                        }

                        audioElem.play();
                    });
                } else {
                    this.play($(".music p.song"));
                }
            }

            $("header span.playpause").removeClass("paused");
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

            $("header span.playpause").removeClass("paused");
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
