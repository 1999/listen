var app = app || {};

(function () {
    'use strict';

    app.appView = Backbone.View.extend({
        initialize: function AppAppView_initialize() {
            console.log('init', this, arguments);
            // this.listenTo(this.model, "change", this.render);

            // render top level UI when app starts
            this.render();
        },

        render: function AppAppView_render() {
            var route;

            $(document.body).empty().addClass("user").removeClass("guest");

            var blink = false;
            var seenChangelog = Settings.get("changelog");
            var changelog;

            try {
                changelog = chrome.runtime.getManifest().changelog;
            } catch (ex) {
                changelog = {};
            }

            for (var key in changelog) {
                if (seenChangelog.indexOf(key) === -1) {
                    blink = true;
                    break;
                }
            }

            Templates.render("user", {
                placeholder: chrome.i18n.getMessage("searchPlaceholder"),
                localTitle: chrome.i18n.getMessage("localTitle"),
                volume: Settings.get("volume"),
                isShuffled: (Settings.get("songsPlayingMode") === "shuffle"),
                isRepeated: (Settings.get("songsPlayingMode") === "repeat"),
                shuffleTitle: chrome.i18n.getMessage("modeShuffle"),
                repeatTitle: chrome.i18n.getMessage("modeRepeat"),
                newsTitle: chrome.i18n.getMessage("appNews"),
                settingsTitle: chrome.i18n.getMessage("settings"),
                cloudTitle: chrome.i18n.getMessage("cloudListTitle"),
                blink: blink
            }, function (html) {
                $(document.body).html(html);

                // update rewind slider position
                var rewindContainer = $(".rewind-container");
                var footer = $("footer");
                rewindContainer.css("bottom", (footer.clientHeight - 5) + "px");

                // callback && callback();
            });

            // if (supportsMP3()) {
            //     if (Settings.get("vkToken").length) {
            //         route = 'current';
            //     } else {
            //         route = 'guest';
            //     }
            // } else {
            //     route = 'chromium';
            // }

            // app.router.navigate(route, {
            //     trigger: true,
            //     replace: true
            // });

            Settings.set("appUsedToday", true);

            return this;
        }
    });
})();
