Navigation = (function () {
    "use strict";

    var states = [];
    var currentStateIndex = -1;


    function pushState(state, args) {
        switch (state) {
            case "guest":
                states.length = 0;
                currentStateIndex = -1;
                break;

            case "settings":
                if (!states.length || states[states.length - 1].view !== "settings") {
                    states.push({view: "settings"});
                    currentStateIndex += 1;
                }

                break;

            case "cloud":
                if (!states.length || states[states.length - 1].view !== "cloud") {
                    states.push({view: "cloud"});
                    currentStateIndex += 1;
                }

                break;

            case "current":
                if (!states.length || states[states.length - 1].view !== "current") {
                    states.push({view: "current"});
                    currentStateIndex += 1;
                }

                break;

            case "search":
            case "searchArtist":
            case "searchAlbum":
                var needsPush = false;

                if (!states.length || states[states.length - 1].view !== state) {
                    needsPush = true;
                } else {
                    var lastState = states[states.length - 1];

                    ["mbid", "artist", "album", "searchQuery"].forEach(function (param) {
                        if (lastState.search[param] !== args[param]) {
                            needsPush = true;
                        }
                    });
                }

                if (needsPush) {
                    states.push({view: state, search: args});
                    currentStateIndex += 1;
                }

                break;
        }

        var navPrevBtn = $("header .header-navback");
        var navNextBtn = $("header .header-navforward");

        if (!navPrevBtn)
            return;

        switch (states.length) {
            case 0:
                navPrevBtn.addClass("hidden");
                navNextBtn.addClass("hidden");
                break;

            case 1:
                navPrevBtn.removeClass("hidden").addClass("inactive");
                navNextBtn.removeClass("hidden").addClass("inactive");
                break;

            default:
                navPrevBtn.removeClass("hidden").removeClass("inactive");
                navNextBtn.removeClass("hidden").addClass("inactive");
        }
    }


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


    function drawGuestUI(callback) {
        $(document.body).empty().addClass("guest").removeClass("user");

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
            $(document.body).html(html);
            callback();

            CPA.sendAppView("Guest");
        });
    }

    function drawUserUI(callback) {
        $(document.body).empty().addClass("user").removeClass("guest");

        Templates.render("user", {
            placeholder: chrome.i18n.getMessage("searchPlaceholder"),
            localTitle: chrome.i18n.getMessage("localTitle"),
            volume: Settings.get("volume"),
            isShuffled: (Settings.get("songsPlayingMode") === "shuffle"),
            isRepeated: (Settings.get("songsPlayingMode") === "repeat"),
            shuffleTitle: chrome.i18n.getMessage("modeShuffle"),
            repeatTitle: chrome.i18n.getMessage("modeRepeat")
        }, function (html) {
            $(document.body).html(html);
            callback();
        });
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
                saved: chrome.i18n.getMessage("saved"),
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

                    // set transitionend listeners
                    $$(".settings .saved").bind("transitionend", function () {
                        this.addClass("hidden").removeClass("saved-hiding");
                    });
                });
            });
        });

        CPA.sendAppView("User.Settings");
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


    return {
        back: function Navigation_back() {

        },

        forward: function Navigation_forward() {
            // disable-enable BF buttons
        },

        dispatch: function Navigation_dispatch(viewType, args) {
            switch (viewType) {
                case "guest":
                    drawGuestUI(function () {
                        pushState("guest");
                    });

                    break;

                // this is not actually a "view", it can be called only once
                case "user":
                    drawUserUI(function () {
                        if (navigator.onLine) {
                            drawCurrentAudio();
                            pushState("current");
                        } else {
                            drawCloudSongs();
                            pushState("cloud");
                        }

                        SyncFS.requestCurrentFilesNum(function (num) {
                            $("header span.local span.counter").text(num);
                        });
                    });

                    break;

                case "settings":
                    drawSettings();
                    pushState("settings");
                    break;

                case "cloud":
                    drawCloudSongs();
                    pushState("cloud");
                    break;

                case "current":
                    drawCurrentAudio();
                    pushState("current");
                    break;

                case "search":
                    drawSearchSongs(args.searchQuery);
                    pushState("search", {searchQuery: args.searchQuery});
                    break;

                case "searchArtist":
                    drawArtist(args.artist);
                    pushState("searchArtist", {artist: args.artist});
                    break;

                case "searchAlbum":
                    drawAlbum(args);
                    pushState("searchAlbum", args);
                    break;

                default:
                    throw new Error("Unsupported viewType: " + viewType);
            }
        }
    };
})();
