parallel({
    dom: function (callback) {
        document.addEventListener("DOMContentLoaded", callback, false);
    },
    settings: function (callback) {
        Settings.load(callback);
    }
}, function (res) {
    "use strict";

    drawBaseUI(bindClickHandlers);


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

                    // stat

                    // @todo redraw every page
                    drawBaseUI();
                });
            },
            // список локальных треков в облаке Google Drive
            "header span.local": function (evt) {
                SyncFS.requestCurrentFilesList(function (files) {
                    // output.push({
                    //     id: audio.querySelector("id").textContent,
                    //     source: audio.querySelector("url").textContent,
                    //     artist: audio.querySelector("artist").textContent,
                    //     song: audio.querySelector("title").textContent,
                    //     duration: Math.floor(duration / 60) + ":" + strpad(duration % 60),
                    //     cloudTitle: cloudTitle,
                    //     downloadTitle: downloadTitle
                    // });

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
                var songElem = this.closestParent("p.song");
                var songURL = songElem.data("url");

                SyncFS.queueFile(this.data("artist"), this.data("title"), songURL);
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
                    return drawArtist(matches[1], searchElem.data("mbid"));

                matches = searchQuery.match(/^album:(.+)/);
                if (matches)
                    return drawAlbum(matches[1], searchElem.data("mbid"));

                drawSearchSongs(searchQuery);
            },
            "a[href^='artist:'], a[href^='album:']": function (evt) {
                evt.preventDefault();

                var headerElem = $("header input[type='search']");
                var headerBtn = $("header .search");
                var searchMBID = this.data("mbid");

                if (searchMBID.length)
                    headerElem.data("mbid", searchMBID);

                headerElem.val(this.attr("href"));
                headerBtn.click();
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

        // keyup - сбрасывать mbid в searchfield

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
    function drawArtist(artist, mbid) {
        emptyContent();

        parallel({
            vk: function (callback) {
                VK.searchMusicByArtist(artist, callback);
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

                        // обновляем обложку альбома
                        Covers.load(album.cover);
                    });
                });
            });
        });
    }

    function drawAlbum(album, mbid) {
        emptyContent();
        console.log(album);

        if (!mbid)
            return console.log("sorry");

        Lastfm.getAlbumInfoByMBID(mbid, function (album) {
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
                        VK.searchMusic(searchQuery.join(" "), {count: 10}, function (arr) {
                            if (arr.length) {
                                var trackIndex = 0; // по умолчанию отдаем первый трек

                                for (var i = 0; i < arr.length; i++) {
                                    if (arr[i].originalDuration == duration) {
                                        trackIndex = i;
                                        break;
                                    }
                                }

                                Templates.render("songs", {songs: [arr[trackIndex]]}, function (html) {
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
