parallel({
    dom: function (callback) {
        document.addEventListener("DOMContentLoaded", callback, false);
    },
    settings: function (callback) {
        Settings.load(callback);
    }
}, function () {
    "use strict";

    drawBaseUI();
    bindClickHandlers();


    function fillContent(infoHTML, musicHTML) {
        var onTransitionEnd = function () {
            this.unbind("transitionend", onTransitionEnd);

            $(".info").html(infoHTML);
            $(".music").html(musicHTML);
        };

        $(".loading-content").addClass("transparent").bind("transitionend", onTransitionEnd);
    }

    function emptyContent() {
        $(".music").empty();
        $(".info").empty();

        $(".loading-content").removeClass("transparent");
    }

    // отрисовка базового UI (user или guest) и навешивание обработчиков
    function drawBaseUI() {
        var vkToken = Settings.get("vkToken");
        $(document.body).empty();

        if (vkToken) {
            Templates.render("user", {
                placeholder: chrome.i18n.getMessage("searchPlaceholder"),
                localTitle: chrome.i18n.getMessage("localTitle")
            }, function (html) {
                $(document.body).addClass("user").removeClass("guest").html(html);

                drawCurrentAudio();
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
                $(document.body).addClass("guest").removeClass("user").html(html);
            });
        }
    }

    // биндинги
    function bindClickHandlers() {
        var matchesSelectorFn = (Element.prototype.matchesSelector || Element.prototype.webkitMatchesSelector);

        var routes = {
            // ВК-авторизация
            ".auth": function (evt) {
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
            },
            // закрытие окна уведомления
            ".music span.play": function (evt) {
                var songElem = this.closestParent("p.song");

                // todo - переключение
                Templates.render("song-playing", {source: songElem.data("url")}, function (html) {
                    songElem.after(html).remove();
                });
            },
            // поиск песен, исполнителей итд.
            "header .search": function (evt) {
                var searchQuery = $("header input[type='search']").val();
                var matches;

                if (!searchQuery.length)
                    return drawCurrentAudio();

                matches = searchQuery.match(/^artist:(.+)/);
                if (matches)
                    return drawArtist(matches[1]);

                matches = searchQuery.match(/^album:(.+)/);
                if (matches)
                    return drawAlbum(matches[1]);

                drawSearchSongs(searchQuery);
            }
        };

        $(document.body).bind("click", function (evt) {
            var elem;
            var selectedRoute;

            stuff:
            for (var route in routes) {
                elem = evt.target;
                while (elem && elem !== document.documentElement) {
                    if (matchesSelectorFn.call(elem, route)) {
                        selectedRoute = route;
                        break stuff;
                    }

                    elem = elem.parentNode;
                }
            }

            if (!selectedRoute)
                return;

            routes[selectedRoute].call(elem, evt);
            evt.stopImmediatePropagation();
        });

        $(document.body).bind("submit", function (evt) {
            evt.preventDefault();

            var lastButton = $(this, "button[type='button']:last-of-type");
            if (!lastButton)
                throw new Error("No button found for making fake submit");

            lastButton.click();
        });
    }

    function drawCurrentAudio() {
        VK.getCurrent(function (songs) {
            Templates.render("songs", {songs: songs}, function (music) {
                fillContent("", music);
            });
        });
    }

    function drawSearchSongs(searchQuery) {
        emptyContent();

        parallel({
            vk: function (callback) {
                VK.searchMusic(searchQuery, callback);
            },
            lastfm: function (callback) {
                Lastfm.getArtistInfo(searchQuery, callback);
            }
        }, function (res) {
            parallel({
                info: function (callback) {
                    Templates.render("info-artist", {
                        hasArtistDescription: (res.lastfm.info !== null && res.lastfm.info.trim().length),
                        artistDescription: res.lastfm.info,
                        albums: res.lastfm.albums
                    }, callback);
                },
                music: function (callback) {
                    Templates.render("songs", {songs: res.vk}, callback);
                }
            }, function (data) {
                fillContent(data.info, data.music);

                // update covers
                res.lastfm.albums.forEach(function (album) {
                    if (!album.cover)
                        return;

                    chrome.runtime.sendMessage({action: "coverDownload", url: album.cover}, function (coverURL) {
                        if (coverURL) {
                            // ...
                        }
                    });
                });
            });
        });
    }
});
