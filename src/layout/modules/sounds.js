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

            songsPlaying[src].remove();
            delete songsPlaying[src];

        }).bind("timeupdate", function () {

        }).bind("play", function () {

        }).bind("pause", function () {

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
     * @param {Boolean} smoothStart (true - резкий старт, плавный финиш)
     */
    function smoothInterval(src, newVolume, smoothStart) {
        var songData = songsPlaying[src];
        var volumeDiff = newVolume - songData.dom.volume;

        var iterationsNum = 100;
        var increase = Math.PI / iterationsNum;
        var counter = 0;

        clearInterval(songData.interval);
        songData.iteration = 0;

        songData.interval = setInterval(function () {
            var yPos = smoothStart ? 1 - Math.cos(counter) : Math.sin(counter);
            counter += increase;

            if (yPos >= 1) {
                clearInterval(songData.interval);
                return;
            }

            var diff = volumeDiff * yPos;
            songData.dom.volume += diff;
        }, FADING_TIMEOUT_MS / iterationsNum);
    }


    return {
        /**
         * @param {HTMLElement|Undefined} elem
         */
        play: function Sounds_play(elem) {





            if (elem) {
                var src = elem.data("url");
                if (songsPlaying[src])
                    return;

                Settings.get("volume")

                var audioElem = createAudioElem(src);

                // FADING_TIMEOUT_MS
            } else {

            }

            // если elem нет
                // если нет текущей играющей песни (песен), выйти
                // песни - current и next, при ended current next становится current, next - другая или null
                // у каждой играбщей песни есть уровень громкости, не зависящий от общего level
                // продолжить играть песни
                // найти p.song с таким URL, как у песни "current", поменять ему иконку на pause
            // иначе
                // если

            // поменять иконку play на pause в header
        },

        /**
         * @param {HTMLElement|Undefined} elem
         */
        pause: function Sounds_pause(elem) {
            // clear timeouts
        },

        /**
         * @param {Float} newLevel
         */
        changeVolumeLevel: function Sounds_changeVolumeLevel(newLevel) {
            Settings.set("volume", newLevel);

            Object.keys(songsPlaying).forEach(function (audioSrc) {
                var audioElem = songsPlaying[audioSrc].dom;
                var isEnding = (audioElem.duration - audioElem.currentTime < FADING_TIMEOUT_MS / 1000);
                var isStarting = (audioElem.currentTime * 1000 < FADING_TIMEOUT_MS);

                if (isEnding)
                    return;

                if (isStarting) {
                    smoothInterval(audioSrc, newLevel, true);
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
