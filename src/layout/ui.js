parallel({
    dom: function (callback) {
        document.addEventListener("DOMContentLoaded", callback, false);
    },
    settings: function (callback) {
        Settings.load(callback);
    }
}, function (res) {
    "use strict";

    drawBaseUI(bindHandlers);


    function fillContent(infoHTML, musicHTML, callback) {
        var onTransitionEnd = function () {
            this.unbind("transitionend", onTransitionEnd);

            $(".info").html(infoHTML);
            $(".music").html(musicHTML);

            callback && callback();
        };

        $(".loading-content").addClass("transparent").bind("transitionend", onTransitionEnd);
    }

    function emptyContent() {
        $(".music").empty();
        $(".info").empty();

        $(".loading-content").removeClass("transparent");
    }

    // отрисовка базового UI (user или guest) и навешивание обработчиков
    function drawBaseUI(callback) {
        var vkToken = Settings.get("vkToken");
        $(document.body).empty();

        if (vkToken) {
            Templates.render("user", {
                placeholder: chrome.i18n.getMessage("searchPlaceholder"),
                localTitle: chrome.i18n.getMessage("localTitle")
            }, function (html) {
                $(document.body).addClass("user").removeClass("guest").html(html);

                callback && callback();
                CPA.sendAppView("User");

                drawCurrentAudio();

                SyncFS.requestCurrentFilesNum(function (num) {
                    $("header span.local span.counter").text(num);
                });
            });

            // todo syncfs
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

                CPA.sendAppView("Guest");

                callback && callback();
            });
        }
    }

    // биндинги
    function bindHandlers() {
        var matchesSelectorFn = (Element.prototype.matchesSelector || Element.prototype.webkitMatchesSelector);

        var routes = {
            "input[name='sendStat']": function (evt) {
                CPA.changePermittedState(this.checked);
            },
            // ВК-авторизация
            ".auth": function (evt) {
                var btn = this;

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
                    if (!response.access_token) {
                        btn.removeAttr("disabled");
                        return;
                    }

                    Settings.set("vkToken", response.access_token);

                    chrome.storage.local.get("installId", function (records) {
                        CPA.sendEvent("Lyfecycle", "Authorized", {
                            id: records.installId,
                            uid: response.user_id
                        });
                    });

                    // @todo redraw every page
                    drawBaseUI();
                });
            },
            // список локальных треков в облаке Google Drive
            "header span.local": function (evt) {
                emptyContent();

                SyncFS.requestCurrentFilesList(function (songs) {
                    Templates.render("songs", {songs: songs}, function (music) {
                        fillContent("", music);
                    });
                });
            },
            // проигрывание песни и постановка на паузу
            ".music span.play": function (evt) {
                var songElem = this.closestParent("p.song");
                var headerAudio = $("header audio");
                var currentPlayingSource = headerAudio.attr("src");
                var currentPlayingSongElem;

                if (this.hasClass("glyphicon-play")) {
                    if (currentPlayingSource === songElem.data("url")) {
                        headerAudio.play();
                    } else {
                        currentPlayingSongElem = $(".music p.song[data-url='" + currentPlayingSource + "']");
                        if (currentPlayingSongElem)
                            $(currentPlayingSongElem, "span.play").removeClass("glyphicon-pause").addClass("glyphicon-play")

                        headerAudio.attr("src", songElem.data("url")).removeClass("hidden").play();
                    }

                    if (!this.hasClass("played")) {
                        var songsPlayed = Settings.get("songsPlayed");
                        Settings.set("songsPlayed", songsPlayed + 1);

                        this.addClass("played");
                    }

                    this.removeClass("glyphicon-play").addClass("glyphicon-pause");
                } else {
                    headerAudio.pause();
                    this.addClass("glyphicon-play").removeClass("glyphicon-pause");
                }
            },
            // скачивание песни в sync file system
            ".music span.cloud": function (evt) {
                if (this.hasClass("pending"))
                    return;

                var songElem = this.closestParent("p.song");
                var songURL = songElem.data("url");

                SyncFS.queueFile(this.data("artist"), this.data("title"), songURL);
                this.addClass("pending");
            },
            ".music div.more": function (evt) {
                var totalSongsListed = $$(".music p.song").length;
                var self = this;
                var searchType = this.data("type");
                var queryString = this.data("query");

                var onDataReady = function (data) {
                    Templates.render("songs", {songs: data.songs}, function (music) {
                        var newTotalSongsListed = totalSongsListed + data.songs.length;
                        self.before(music);

                        if (newTotalSongsListed >= data.count) {
                            self.remove();
                        }
                    });
                };

                switch (searchType) {
                    case "current":
                        VK.getCurrent(totalSongsListed, onDataReady);
                        break;

                    case "artist":
                        VK.searchMusicByArtist(queryString, {offset: totalSongsListed}, onDataReady);
                        break;

                    case "global":
                        VK.searchMusic(queryString, {offset: totalSongsListed}, onDataReady);
                        break;
                }
            },
            // поиск песен, исполнителей итд.
            "header .search": function (evt) {
                var searchElem = $("header input[type='search']");
                var searchQuery = searchElem.val();
                var matches;

                if (!searchQuery.length)
                    return drawCurrentAudio();

                matches = searchQuery.match(/^artist:(.+)/);
                if (matches)
                    return drawArtist(matches[1]);

                var mbid = searchElem.data("mbid");
                var artist = searchElem.data("artist");
                var album = searchElem.data("album");

                if (mbid.length)
                    return drawAlbum({mbid: mbid});

                if (artist.length && album.length)
                    return drawAlbum({artist: artist, album: album});

                drawSearchSongs(searchQuery);
            },
            "a[href^='artist:'], a[href^='album:']": function (evt) {
                evt.preventDefault();

                var headerElem = $("header input[type='search']").removeData();
                var headerBtn = $("header .search");

                var mbid = this.data("mbid");
                var artist = this.data("artist");
                var album = this.data("album");

                if (mbid.length) {
                    headerElem.data("mbid", mbid);
                } else if (artist.length && album.length) {
                    headerElem.data({artist: artist, album: album});
                }

                var searchValue = /^artist:/.test(this.attr("href")) ? this.attr("href") : artist + " - " + album;
                headerElem.val(searchValue);

                headerBtn.click();
            },
            "header .closePay": function (evt) {
                Settings.set("headerRateCounter", 0);
                $("header div.pay").remove();

                evt.stopImmediatePropagation();
            },
            "header .cwsrate": function (evt) {
                window.open(Config.constants.cws_app_link + "/reviews");
                $("header .closePay").click();
            },
            "header .yamoney": function (evt) {
                window.open(Config.constants.yamoney_link);
                $("header .closePay").click();
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

        var headerAudioElem = $("header audio");
        if (headerAudioElem) {
            headerAudioElem.bind("play", function () {
                // очищаем текущий прогресс-элемент
                var progressElem = $("div.song-playing-bg") || $("<div class='song-playing-bg'>&nbsp;</div>");
                var source = this.attr("src");

                var songElem;
                $$("p.song").each(function () {
                    if (this.data("url") === source) {
                        songElem = this;
                    }
                });

                songElem.before(progressElem.css("width", "0"));
            }).bind("timeupdate", function () {
                var playingBg = $("div.song-playing-bg");
                if (playingBg) {
                    var width = Math.ceil(document.body.clientWidth * this.currentTime / this.duration) + "px";
                    $("div.song-playing-bg").css("width", width);
                }
            }).bind("progress", function (evt) {
                // @todo http://www.sitepoint.com/essential-audio-and-video-events-for-html5/
            }).bind("play", function () {
                var audioSource = this.attr("src");
                var songPlaying = $(".music p.song[data-url='" + audioSource + "']");

                if (!songPlaying)
                    return;

                $(songPlaying, "span.play").addClass("glyphicon-pause").removeClass("glyphicon-play");
            }).bind("pause", function () {
                var audioSource = this.attr("src");
                var songPlaying = $(".music p.song[data-url='" + audioSource + "']");

                if (!songPlaying)
                    return;

                $(songPlaying, "span.play").removeClass("glyphicon-pause").addClass("glyphicon-play");
            }).bind("ended", function () {
                var currentCnt = Settings.get("headerRateCounter") + 1;
                var payElem = $("header div.pay");
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

                var audioSource = this.attr("src");
                var songPlaying = $(".music p.song[data-url='" + audioSource + "']");
                var matchesSelectorFn = Element.prototype.webkitMatchesSelector || Element.prototype.matchesSelector;

                if (!songPlaying)
                    return;

                $(songPlaying, "span.play").removeClass("glyphicon-pause").addClass("glyphicon-play");

                var nextSong = songPlaying.nextSibling;
                if (nextSong && matchesSelectorFn.call(nextSong, "p.song")) {
                    $(nextSong, "span.play").click();
                }
            });
        }

        var headerSearchInput = $("header input[type='search']");
        if (headerSearchInput) {
            headerSearchInput.bind("keyup", function () {
                this.removeData();
            }).bind("search", function () {
                if (!this.val().length) {
                    drawCurrentAudio();
                }
            });
        }

        window.onscroll = function () {
            // console.log([document.body.scrollTop + document.body.clientHeight, document.body.scrollHeight]);

            // var goPos = this.scrollHeight - 160;
            //         if (this.scrollTop + this.clientHeight > goPos) {
        };
    }

    function drawCurrentAudio() {
        emptyContent();

        VK.getCurrent(0, function (data) {
            var more = (data.count > data.songs.length);

            Templates.render("songs", {
                songs: data.songs,
                more: more,
                type: "current"
            }, function (music) {
                fillContent("", music);
            });
        });
    }

    function drawSearchSongs(searchQuery) {
        emptyContent();

        parallel({
            vk: function (callback) {
                VK.searchMusic(searchQuery, {}, callback);
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
                        artist: searchQuery,
                        albums: res.lastfm.albums
                    }, callback);
                },
                music: function (callback) {
                    Templates.render("songs", {songs: res.vk}, callback);
                }
            }, function (data) {
                fillContent(data.info, data.music, function () {
                    res.lastfm.albums.forEach(function (album) {
                        if (!album.cover)
                            return;

                        // загружаем обложку альбома
                        Covers.load(album.cover);
                    });
                });
            });
        });
    }

    // todo mbid support
    function drawArtist(artist) {
        emptyContent();

        parallel({
            vk: function (callback) {
                VK.searchMusicByArtist(artist, {}, callback);
            },
            lastfm: function (callback) {
                Lastfm.getArtistInfo(artist, callback);
            }
        }, function (res) {
            parallel({
                info: function (callback) {
                    Templates.render("info-artist", {
                        hasArtistDescription: (res.lastfm.info !== null && res.lastfm.info.trim().length),
                        artistDescription: createValidHTML(res.lastfm.info),
                        artist: artist,
                        albums: res.lastfm.albums
                    }, callback);
                },
                music: function (callback) {
                    var more = (res.vk.count > res.vk.songs.length);

                    Templates.render("songs", {
                        songs: res.vk.songs,
                        more: more,
                        type: "artist",
                        query: artist
                    }, callback);
                }
            }, function (data) {
                fillContent(data.info, data.music, function () {
                    res.lastfm.albums.forEach(function (album) {
                        if (!album.cover)
                            return;

                        // обновляем обложку альбома
                        Covers.load(album.cover);
                    });
                });
            });
        });
    }

    function drawAlbum(searchData) {
        emptyContent();

        Lastfm.getAlbumInfo(searchData, function (album) {
            parallel({
                info: function (callback) {
                    Templates.render("info-album", {
                        albumCover: album.cover,
                        artist: album.artist,
                        title: album.title,
                        albumDescription: createValidHTML(album.albumDescription)
                    }, callback);
                },
                music: function (callback) {
                    var queueSongs = [];
                    album.songs.forEach(function (song) {
                        queueSongs.push({
                            artist: album.artist,
                            song: song.title,
                            number: song.number
                        });
                    });

                    Templates.render("song-queue", {songs: queueSongs}, callback);
                }
            }, function (res) {
                fillContent(res.info, res.music, function () {
                    Covers.load(album.cover);
                });

                if (!album.songs.length)
                    return;

                (function parseSongsList(songRank) {
                    window.setTimeout(function () {
                        var song = album.songs[songRank].title;
                        var duration = album.songs[songRank].duration;
                        var originalRank = album.songs[songRank].number;
                        var searchQuery = [];

                        (album.artist + " " + song).replace(/\-/g, " ").replace(/[\.|,]/g, " ").split(" ").forEach(function (word) {
                            word = word.toLowerCase().trim();
                            if (!word.length)
                                return;

                            searchQuery.push(word);
                        });

                        // существует множество ремиксов, отсеиваем их поиском по длительности песни
                        VK.searchMusic(searchQuery.join(" "), {count: 10}, function (data) {
                            if (data.count) {
                                var trackIndex = 0; // по умолчанию отдаем первый трек

                                for (var i = 0; i < data.songs.length; i++) {
                                    if (data.songs[i].originalDuration == duration) {
                                        trackIndex = i;
                                        break;
                                    }
                                }

                                Templates.render("songs", {songs: [data.songs[trackIndex]]}, function (html) {
                                    $(".music p.song-queue[data-queue='" + originalRank + "']").after(html).remove();
                                });
                            }

                            if (songRank < album.songs.length - 1) {
                                parseSongsList(songRank + 1);
                            }
                        });
                    }, 350);
                })(0);
            });
        });
    }
});
