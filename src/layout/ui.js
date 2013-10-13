window.onerror = function(msg, url, line) {
    var msgError = msg + " in " + url + " (line: " + line + ")";
    console.error(msgError);

    if (!Settings.get("isDebug")) {
        CPA.sendEvent("Errors", chrome.runtime.getManifest().version, {
            msg: msg,
            url: url,
            line: line
        });
    }
};

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

            if (Settings.get("study").indexOf("cloud") !== -1) {
                $(".info").html(infoHTML);
                $(".music").html(musicHTML);

                callback && callback();
                return;
            }

            Templates.render("info-callout-cloud", {
                text: chrome.i18n.getMessage("cloudStudyText", chrome.runtime.getManifest().name),
                downloadText: chrome.i18n.getMessage("cloudStudyDownload"),
                listText: chrome.i18n.getMessage("cloudStudyList")
            }, function (studyHTML) {
                infoHTML = studyHTML + infoHTML;

                $(".info").html(infoHTML);
                $(".music").html(musicHTML);

                callback && callback();
            });
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
                localTitle: chrome.i18n.getMessage("localTitle"),
                volume: Settings.get("volume"),
                isShuffled: (Settings.get("songsPlayingMode") === "shuffle"),
                isRepeated: (Settings.get("songsPlayingMode") === "repeat"),
                shuffleTitle: chrome.i18n.getMessage("modeShuffle"),
                repeatTitle: chrome.i18n.getMessage("modeRepeat")
            }, function (html) {
                $(document.body).addClass("user").removeClass("guest").html(html);

                callback && callback();

                if (navigator.onLine) {
                    drawCurrentAudio();
                } else {
                    drawCloudSongs();
                }

                SyncFS.requestCurrentFilesNum(function (num) {
                    $("header span.local span.counter").text(num);
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
                    btn.removeAttr("disabled");

                    if (!responseURL)
                        return;

                    var response = parseQuery(responseURL.replace(baseURL + "#", ""));
                    if (!response.access_token)
                        return;

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
            // открытие настроек
            "header .settings": function (evt) {
                drawSettings();
            },
            // список локальных треков в облаке Google Drive
            "header span.local": function (evt) {
                drawCloudSongs();
            },
            // поиск песен, исполнителей итд.
            "header .search": function (evt) {
                var searchElem = $("header input[type='search']");
                var searchQuery = searchElem.val();
                var matches;

                if (!navigator.onLine)
                    return drawCloudSongs();

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
            ".pay .closePay": function (evt) {
                var headerPay = Settings.get("headerPay");
                headerPay.close += 1;
                Settings.set("headerPay", headerPay);

                Settings.set("headerRateCounter", 0);
                this.closestParent("div.pay").remove();

                evt.stopImmediatePropagation();
            },
            ".pay .cwsrate": function (evt) {
                var headerPay = Settings.get("headerPay");
                headerPay.ratecws += 1;
                Settings.set("headerPay", headerPay);

                window.open(Config.constants.cws_app_link + "/reviews");

                Settings.set("headerRateCounter", 0);
                this.closestParent("div.pay").remove();

                evt.stopImmediatePropagation();
            },
            ".pay .yamoney": function (evt) {
                var headerPay = Settings.get("headerPay");
                headerPay.yamoney += 1;
                Settings.set("headerPay", headerPay);

                window.open(Config.constants.yamoney_link);

                Settings.set("headerRateCounter", 0);
                this.closestParent("div.pay").remove();

                evt.stopImmediatePropagation();
            },
            // закрытие обучалок
            ".study button.close": function (evt) {
                var container = this.closestParent(".study");
                var currentStudy = Settings.get("study");

                currentStudy.push(container.data("study"));
                Settings.set("study", currentStudy);

                container.remove();
                evt.stopImmediatePropagation();
            },
            // get LastFM token
            ".settings .get-lastfm-token": function (evt) {
                var btn = this.attr("disabled", "disabled");
                var baseURL = "https://" + chrome.runtime.id + ".chromiumapp.org/cb";

                chrome.identity.launchWebAuthFlow({
                    url: "http://www.last.fm/api/auth/?api_key=" + Config.constants.lastfm_api_key,
                    interactive: true
                }, function (responseURL) {
                    if (!responseURL) {
                        btn.removeAttr("disabled");
                        return;
                    }

                    var response = parseQuery(responseURL.replace(baseURL + "?", ""));
                    if (!response.token) {
                        btn.removeAttr("disabled");
                        return;
                    }

                    Lastfm.getSession(response.token, function (sessionData) {
                        btn.removeAttr("disabled");

                        if (!sessionData) {
                            return;
                        }

                        Settings.set("lastfmToken", sessionData.key);

                        chrome.storage.local.get("installId", function (records) {
                            CPA.sendEvent("Lyfecycle", "LFM_Authorized", {
                                id: records.installId,
                                name: sessionData.name
                            });
                        });

                        drawSettings();
                    });
                });
            },
            // drop LastFM token
            ".settings .drop-lastfm-token": function (evt) {
                Settings.set("lastfmToken", "");

                chrome.storage.local.get("installId", function (records) {
                    CPA.sendEvent("Lyfecycle", "LFM_Reset", {
                        id: records.installId
                    });
                });

                drawSettings();
            },
            // drop VK token
            ".settings .drop-vk-auth": function (evt) {
                Settings.set("vkToken", "");
                Settings.set("lastfmToken", "");

                chrome.storage.local.get("installId", function (records) {
                    CPA.sendEvent("Lyfecycle", "VK_Reset", {
                        id: records.installId
                    });

                    CPA.sendEvent("Lyfecycle", "LFM_Reset", {
                        id: records.installId
                    });
                });

                drawBaseUI();
            },
            // save sendStat setting
            ".settings input[name='sendStatChkbx'][type='radio']": function (evt) {
                var optionValue = this.value === "1" ? true : false;
                CPA.changePermittedState(optionValue);
            },
            // save smoothSwitch setting
            ".settings input[name='smoothSwitch'][type='radio']": function (evt) {
                var optionValue = this.value === "1" ? true : false;
                Settings.set("smoothTracksSwitch", optionValue);
            },
            // save showNotifications setting
            ".settings input[name='showNotifications'][type='radio']": function (evt) {
                var optionValue = this.value === "1" ? true : false;
                Settings.set("showNotifications", optionValue);
            },
            // play music file
            ".music span.play": function (evt) {
                Sounds.updatePlaylist();

                var songContainer = this.closestParent("p.song");
                Sounds.play(songContainer.data("url"));

                evt.stopImmediatePropagation();
            },
            // pause music file
            ".music span.pause": function (evt) {
                Sounds.pause();
                evt.stopImmediatePropagation();
            },
            // скачивание песни в sync file system
            ".music span.cloud": function (evt) {
                evt.stopImmediatePropagation();

                if (this.hasClass("pending"))
                    return;

                // @todo обрабатывать более умно
                if (!navigator.onLine)
                    return;

                var songElem = this.closestParent("p.song");
                var songURL = songElem.data("url");
                var audioId = songElem.data("vkid");

                SyncFS.queueFile(this.data("artist"), this.data("title"), songURL, audioId);
                this.addClass("pending");
            },
            // скачивание песни
            ".music a[download]": function (evt) {
                evt.stopImmediatePropagation();

                var songContainer = this.closest("p.song");

                CPA.sendEvent("Actions", "saveLocal", {
                    artist: songContainer.data("artist"),
                    title: songContainer.data("title")
                });
            },
            ".music div.more": function (evt) {
                if (this.hasClass("loading"))
                    return;

                var totalSongsListed = $$(".music p.song").length;
                var self = this.addClass("loading");
                var searchType = this.data("type");
                var queryString = this.data("query");

                var onDataReady = function (data) {
                    Templates.render("songs", {songs: data.songs}, function (music) {
                        var newTotalSongsListed = totalSongsListed + data.songs.length;
                        self.removeClass("loading").before(music);

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
            "a[href^='artist:'], a[href^='album:']": function (evt) {
                evt.preventDefault();
                evt.stopImmediatePropagation();

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
            ".music p.song": function (evt) {
                if (this.previousSibling && matchesSelectorFn.call(this.previousSibling, ".song-playing-bg")) {
                    Sounds.updateCurrentTime(evt.layerX / this.clientWidth);
                }
            },
            // start playing songs from header
            "footer span.play": function () {
                Sounds.play();
            },
            // pause playing songs from header
            "footer span.pause": function () {
                Sounds.pause();
            },
            // play previous song from header
            "footer span.prev": function () {
                Sounds.playPrev();
            },
            // play next song from header
            "footer span.next": function () {
                Sounds.playNext();
            },
            // включение режимов "shuffle" и "repeat"
            "footer span.mode": function (evt) {
                if (this.hasClass("active")) {
                    Sounds.disableMode();
                } else {
                    Sounds.enableMode(this.data("mode"));
                }
            },
            // set playing track current time
            "footer .song-playing-bg": function (evt) {
                var isPlaying = $("footer span.play").hasClass("hidden");
                var percent = evt.layerX / document.body.clientWidth;

                if (!isPlaying)
                    return;

                Sounds.updateCurrentTime(percent);
            },
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
        }).bind("submit", function (evt) {
            evt.preventDefault();

            var lastButton = $(this, "button[type='button']:last-of-type");
            if (!lastButton)
                throw new Error("No button found for making fake submit");

            lastButton.click();
        });

        window.addEventListener("online", function (evt) {
            var headerSearchInput = $("header input[type='search']");

            if (headerSearchInput) {
                headerSearchInput.removeAttr("disabled");
            }
        }, false);

        window.addEventListener("offline", function () {
            var headerSearchInput = $("header input[type='search']");

            if (headerSearchInput) {
                headerSearchInput.attr("disabled", "disabled");
                drawCloudSongs();
            }
        }, false);

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

        var volumeRangeInput = $("footer input[type='range']");
        if (volumeRangeInput) {
            volumeRangeInput.bind("change", function () {
                Sounds.changeVolumeLevel(this.value);
            });
        }

        window.onscroll = function () {
            var pageHeight = Math.max(document.body.offsetHeight, document.body.clientHeight);
            var scrollTop = window.innerHeight + window.scrollY;
            var more = $(".music div.more");

            if (scrollTop + 160 >= pageHeight && more) {
                more.click();
            }
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
                fillContent("", music, function () {
                    Sounds.onVisibleTracksUpdated();
                });
            });
        });

        CPA.sendAppView("User.CurrentAudio");
    }

    function drawCloudSongs() {
        emptyContent();

        SyncFS.requestCurrentFilesList(function (songs) {
            Templates.render("songs", {songs: songs}, function (music) {
                fillContent("", music, function () {
                    Sounds.onVisibleTracksUpdated();

                    // update songs data from Google Drive syncable filesystem
                    $$(".music p.song").each(function () {
                        var audioSrc = this.data("url");
                        var durationElem = $(this, ".duration");

                        var audio = new Audio(audioSrc);
                        audio.bind("durationchange", function () {
                            durationElem.html(Math.floor(audio.duration / 60) + ":" + strpad(Math.ceil(audio.duration) % 60));
                        });
                    });
                });
            });
        });

        CPA.sendAppView("User.CloudSongs");
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
                        artistDescription: createValidHTML(res.lastfm.info),
                        artist: searchQuery,
                        albums: res.lastfm.albums,
                        similarArtists: chrome.i18n.getMessage("similarArtists"),
                        similarList: res.lastfm.similar
                    }, callback);
                },
                music: function (callback) {
                    var more = (res.vk.count > res.vk.songs.length);

                    Templates.render("songs", {
                        songs: res.vk.songs,
                        more: more,
                        type: "global",
                        query: searchQuery
                    }, callback);
                }
            }, function (data) {
                fillContent(data.info, data.music, function () {
                    Sounds.onVisibleTracksUpdated();

                    res.lastfm.albums.forEach(function (album) {
                        if (!album.cover)
                            return;

                        // загружаем обложку альбома
                        Covers.load(album.cover);
                    });
                });
            });
        });

        CPA.sendAppView("User.Search");
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
                    // @todo res.lastfm.tracks

                    Templates.render("info-artist", {
                        hasArtistDescription: (res.lastfm.info !== null && res.lastfm.info.trim().length),
                        artistDescription: createValidHTML(res.lastfm.info),
                        artist: artist,
                        albums: res.lastfm.albums,
                        similarArtists: chrome.i18n.getMessage("similarArtists"),
                        similarList: res.lastfm.similar
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
                    Sounds.onVisibleTracksUpdated();

                    res.lastfm.albums.forEach(function (album) {
                        if (!album.cover)
                            return;

                        // обновляем обложку альбома
                        Covers.load(album.cover);
                    });
                });
            });
        });

        CPA.sendAppView("User.SearchArtist");
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
                                    Sounds.onVisibleTracksUpdated();
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

        CPA.sendAppView("User.SearchAlbum");
    }

    function drawSettings() {
        emptyContent();

        CPA.isTrackingPermitted(function (isTrackingPermitted) {
            Templates.render("settings", {
                vkAuthTitle: chrome.i18n.getMessage("vkAuthTitle"),
                dropVkAuth: chrome.i18n.getMessage("dropVkAuth"),
                lastFmAuthTitle: chrome.i18n.getMessage("lastFmAuthTitle"),
                lastFmAuthorized: (Settings.get("lastfmToken").length > 0),
                dropLastFmAuth: chrome.i18n.getMessage("dropLastFmAuth"),
                getLastFmAuth: chrome.i18n.getMessage("getLastFmAuth"),
                smoothSwitchTitle: chrome.i18n.getMessage("smoothSwitchTitle"),
                smoothSwitch: Settings.get("smoothTracksSwitch"),
                sendStatisticsTitle: chrome.i18n.getMessage("sendStatisticsTitle"),
                sendStat: isTrackingPermitted,
                showNotificationsTitle: chrome.i18n.getMessage("showNotificationsTitle"),
                showNotifications: Settings.get("showNotifications"),
                yes: chrome.i18n.getMessage("yes"),
                no: chrome.i18n.getMessage("no")
            }, function (html) {
                fillContent(html, "", function () {
                    var isHeaderPayShown = ($("header div.pay") !== null);
                    if (isHeaderPayShown)
                        return;

                    Templates.render("info-pay", {
                        payText: chrome.i18n.getMessage("moneyMaker", [chrome.runtime.getManifest().name, Config.constants.yamoney_link, Config.constants.cws_app_link]),
                        payYaMoney: chrome.i18n.getMessage("yandexMoney"),
                        cwsRate: chrome.i18n.getMessage("rateCWS"),
                        close: chrome.i18n.getMessage("close")
                    }, function (html) {
                        $(".info").prepend(html);
                    });
                });
            });
        });
    }
});
