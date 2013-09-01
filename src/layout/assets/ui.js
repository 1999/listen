document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    Settings.load(function () {
        drawBaseUI();

        // отрисовка базового UI (user или guest) и навешивание обработчиков
        function drawBaseUI() {
            var vkToken = Settings.get("vkToken");
            $(".content").empty();

            if (vkToken) {
                Templates.render("user", {
                    placeholder: chrome.i18n.getMessage("searchPlaceholder"),
                    localTitle: chrome.i18n.getMessage("localTitle")
                }, function (html) {
                    $(".content").html(html);

                    // todo parallel
                    VK.getCurrent(function (songs) {
                        songs.forEach(function (song) {
                            song.cloudTitle = "";
                            song.downloadTitle = "";
                            song.duration = Math.floor(song.duration / 60) + ":" + (song.duration % 60);
                        });

                        Templates.render("songs", {songs: songs}, function (html) {
                            $(".music").html(html);

                            $$(".music span.play").bind("click", function () {
                                var songElem = this.closestParent("p.song");

                                Templates.render("song-playing", {source: songElem.data("url")}, function (html) {
                                    songElem.after(html).remove();
                                });
                            });
                        });
                    });

                    $("header input[type='search']").bind("keyup", function () {
                        VK.searchMusic(this.value, function (songs) {
                            Templates.render("songs", {songs: songs}, function (html) {
                                $(".music").html(html);
                            });
                        });
                    });
                });
            } else {
                Templates.render("guest", {
                    welcomeHeader: chrome.i18n.getMessage("welcomeHeader"),
                    welcomeText: chrome.i18n.getMessage("welcomeText"),
                    faqHeader: chrome.i18n.getMessage("faqHeader"),
                    faqItems: chrome.i18n.getMessage("faqText", chrome.runtime.getManifest().name).split("|").map(function (text) {
                        return {text: text};
                    }),
                    sendStat: chrome.i18n.getMessage("faqSendStatCheckbox"),
                    authVK: chrome.i18n.getMessage("authorizeVK")
                }, function (html) {
                    $(".content").html(html);

                    $(".auth").bind("click", function () {
                        this.disabled = "disabled";
                        var baseURL = "https://" + chrome.runtime.id + ".chromiumapp.org/cb";

                        chrome.identity.launchWebAuthFlow({
                            url: "https://oauth.vk.com/authorize?" + createRequestParams({
                                client_id: Config.constants.vk_app_id,
                                scope: Config.constants.vk_app_scope.join(","),
                                redirect_uri: baseURL,
                                display: "page",
                                v: "5.0",
                                response_type: "token"
                            }),
                            interactive: true
                        }, function (responseURL) {
                            var response = parseQuery(responseURL.replace(baseURL + "#", ""));
                            Settings.set("vkToken", response.access_token);

                            // @todo redraw every page
                            drawBaseUI();
                        });
                    });
                });
            }
        }
    });
}, false);
