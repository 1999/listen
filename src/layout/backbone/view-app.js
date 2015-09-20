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
            var method;

            if (supportsMP3()) {
                if (Settings.get("vkToken").length) {
                    this.drawUserUI();
                } else {
                    this.drawGuestUI(false);
                }
            } else {
                this.drawGuestUI(true);
            }

            Settings.set("appUsedToday", true);
            return this;
        },

        drawUserUI: function AppAppView_drawUserUI() {
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
            });
        },

        drawGuestUI: function AppAppView_drawGuestUI(isMissingMP3) {
            $(document.body).empty().addClass("guest").removeClass("user");

            Templates.render("guest", {
                welcomeHeader: chrome.i18n.getMessage("welcomeHeader"),
                welcomeText: chrome.i18n.getMessage("welcomeText"),
                faqHeader: chrome.i18n.getMessage("faqHeader"),
                faqItems: chrome.i18n.getMessage("faqText", chrome.runtime.getManifest().name).split("|").map(function (text) {
                    return {text: text};
                }),
                sendStat: chrome.i18n.getMessage("faqSendStatCheckbox"),
                authVK: chrome.i18n.getMessage("authorizeVK"),
                missMP3Text: chrome.i18n.getMessage("missMp3"),
                thisIsImportant: chrome.i18n.getMessage("thisIsImportant"),
                installGoogleChrome: chrome.i18n.getMessage("installGoogleChrome"),
                isMissingMP3: isMissingMP3
            }, function (html) {
                $(document.body).html(html);
            });

            CPA.sendAppView(isMissingMP3 ? "MissingMP3" : "Guest");
        }
    });
})();
