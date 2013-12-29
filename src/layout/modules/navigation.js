Navigation = (function () {
    "use strict";

    var states = [];
    var currentStateIndex = -1;
    var visibilityState = true;


    function updateBackForwardButtonsState() {
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
                if (currentStateIndex) {
                    navPrevBtn.removeClass("hidden").removeClass("inactive");
                } else {
                    navPrevBtn.removeClass("hidden").addClass("inactive");
                }

                if (currentStateIndex === states.length - 1) {
                    navNextBtn.removeClass("hidden").addClass("inactive");
                } else {
                    navNextBtn.removeClass("hidden").removeClass("inactive");
                }
        }
    }

    function drawUIAccordingToState() {
        if (!Settings.get("vkToken").length) {
            states.length = 0;
            currentStateIndex = -1;

            drawGuestUI();
            return;
        }

        var currentState = states[currentStateIndex];
        switch (currentState.view) {
            case "settings":
                drawSettings();
                break;

            case "news":
                drawChangelog();
                break;

            case "cloud":
                drawCloudSongs();
                break;

            case "current":
                drawCurrentAudio();
                break;

            case "search":
                drawSearchSongs(currentState.search.searchQuery);
                break;

            case "searchArtist":
                drawArtist(currentState.search.artist);
                break;

            case "searchAlbum":
                drawAlbum(currentState.search);
                break;
        }
    }

    function mergeYmResultsIntoLFM(lfm, ym) {
        if (!lfm)
            return ym;

        if (!ym)
            return lfm;

        lfm.ymid = ym.info.ymid;

        var ymTrack;
        var hasSameTrack;

        while (lfm.tracks.length < 10 && ym.tracks.length) {
            ymTrack = ym.tracks.shift();

            hasSameTrack = lfm.tracks.some(function (track) {
                return (track.song.trim().toLowerCase() === ymTrack.song.trim().toLowerCase());
            });

            if (!hasSameTrack) {
                lfm.tracks.push(ymTrack);
            }
        }

        var ymAlbum;
        var hasSameAlbum;

        while (ym.albums.length) {
            ymAlbum = ym.albums.shift();

            hasSameAlbum = lfm.albums.some(function (album) {
                return (album.title.trim().toLowerCase() === ymAlbum.title.trim().toLowerCase());
            });

            if (!hasSameAlbum) {
                lfm.albums.push(ymAlbum);
            }
        }

        return lfm;
    }


    function fillContent(infoHTML, musicHTML, callback) {
        var onTransitionEnd = function () {
            this.unbind("transitionend", onTransitionEnd);

            var lessonNeeds, tplData;
            var lessonsPassed = Settings.get("study");

            // if user has already authorized in LastFM
            // there's no need to encourage him to do that afterwards when he logs out
            if (Lastfm.isAuthorized && lessonsPassed.indexOf("lastfm") === -1) {
                lessonsPassed.push("lastfm");
                Settings.set("study", lessonsPassed);
            }

            if (lessonsPassed.indexOf("cloud") === -1) {
                lessonNeeds = "cloud";
            } else if (lessonsPassed.indexOf("lastfm") === -1 && !Lastfm.isAuthorized && Navigation.currentView !== "settings") {
                lessonNeeds = "lastfm";
            }

            if (!lessonNeeds) {
                $(".info").html(infoHTML);
                $(".music").html(musicHTML);

                callback && callback();
                return;
            }

            switch (lessonNeeds) {
                case "cloud":
                    tplData = {
                        text: chrome.i18n.getMessage("cloudStudyText", chrome.runtime.getManifest().name),
                        downloadText: chrome.i18n.getMessage("cloudStudyDownload"),
                        listText: chrome.i18n.getMessage("cloudStudyList")
                    };

                    break;

                case "lastfm":
                    tplData = {
                        text: chrome.i18n.getMessage("advLastFM"),
                        authTitle: chrome.i18n.getMessage("getLastFmAuth"),
                        close: chrome.i18n.getMessage("close")
                    };

                    break;
            }

            Templates.render("info-callout-" + lessonNeeds, tplData, function (studyHTML) {
                infoHTML = studyHTML + infoHTML;

                $(".info").html(infoHTML);
                $(".music").html(musicHTML);

                callback && callback();
            });
        };

        $(".loading-content .spinner").addClass("spinner-transition", "spinner-transparent").bind("transitionend", onTransitionEnd);
    }

    function emptyContent() {
        $(".music").empty();
        $(".info").empty();

        $(".loading-content .spinner").removeClass("spinner-transparent", "spinner-transition");
    }


    function drawGuestUI() {
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
        });

        CPA.sendAppView("Guest");
    }

    function drawUserUI(callback) {
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
            callback && callback();
        });
    }


    function drawSettings() {
        emptyContent();

        // update search input data
        $("header input[type='search']").val("");

        CPA.isTrackingPermitted(function (isTrackingPermitted) {
            Templates.render("settings", {
                vkAuthTitle: chrome.i18n.getMessage("vkAuthTitle"),
                dropVkAuth: chrome.i18n.getMessage("dropVkAuth"),
                lastFmAuthTitle: chrome.i18n.getMessage("lastFmAuthTitle"),
                lastFmAuthorized: (Settings.get("lastfmToken").length > 0),
                dropLastFmAuth: chrome.i18n.getMessage("dropLastFmAuth"),
                getLastFmAuth: chrome.i18n.getMessage("getLastFmAuth"),
                sendStatisticsTitle: chrome.i18n.getMessage("sendStatisticsTitle"),
                sendStat: isTrackingPermitted,
                showNotificationsTitle: chrome.i18n.getMessage("showNotificationsTitle"),
                showNotifications: Settings.get("showNotifications"),
                saved: chrome.i18n.getMessage("saved"),
                yes: chrome.i18n.getMessage("yes"),
                no: chrome.i18n.getMessage("no")
            }, function (html) {
                fillContent(html, "", function () {
                    // set transitionend listeners
                    $$(".settings .saved").bind("transitionend", function () {
                        this.addClass("hidden").removeClass("saved-hiding");
                    });
                });
            });
        });

        CPA.sendAppView("User.Settings");
    }

    function drawChangelog() {
        emptyContent();

        var seenChangelog = Settings.get("changelog");
        var appName = chrome.runtime.getManifest().name;
        var changelog;

        try {
            changelog = chrome.runtime.getManifest().changelog;
        } catch (ex) {
            changelog = {};
        }

        var tplData = {
            changelogKeys: [],
            appName: chrome.runtime.getManifest().name
        };

        Object.keys(changelog).sort(function (a, b) {
            return 0 - a.localeCompare(b);
        }).forEach(function (key) {
            var changelogData = changelog[key].map(function (i18nKey) {
                return chrome.i18n.getMessage("changelog_" + key.replace(/\./g, "_") + "_" + i18nKey, appName);
            });

            tplData.changelogKeys.push({
                changelog: changelogData,
                key: key
            });

            if (seenChangelog.indexOf(key) === -1) {
                seenChangelog.push(key);
            }
        });

        Templates.render("news", tplData, function (html) {
            fillContent(html, "");
        });

        $("header .header-news").removeClass("header-news-blinking");
        Settings.set("changelog", seenChangelog);

        CPA.sendAppView("User.News");
    }

    function drawCurrentAudio() {
        emptyContent();

        // update search input data
        $("header input[type='search']").val("");

        parallel({
            vk: function (callback) {
                VK.getCurrent(0, function (data) {
                    var more = (data.count > data.songs.length);

                    Templates.render("songs", {
                        songs: data.songs,
                        more: more,
                        showDownload: Settings.get("showDownloadButtons"),
                        type: "current",
                        progress: true
                    }, callback);
                });
            },
            lastfm: function (callback) {
                if (!Lastfm.isAuthorized)
                    return callback({html: "", recommended: []});

                Lastfm.getRecommendedArtists(function (recommendedList) {
                    Templates.render("info-artists-similar", {
                        recommended: recommendedList,
                        recommendedArtistsTitle: chrome.i18n.getMessage("lastFmRecommends")
                    }, function (html) {
                        callback({html: html, recommended: recommendedList});
                    });
                });
            }
        }, function (res) {
            fillContent(res.lastfm.html, res.vk, function () {
                res.lastfm.recommended.forEach(function (artist) {
                    if (!artist.cover)
                        return;

                    // загружаем обложку исполнителя
                    Covers.loadFigure(artist.cover);
                });
            });
        });

        CPA.sendAppView("User.CurrentAudio");
    }

    function drawCloudSongs() {
        emptyContent();

        // update search input data
        $("header input[type='search']").val("");

        SyncFS.requestCurrentFilesList(function (songs) {
            Templates.render("songs", {
                songs: songs,
                showDownload: false,
                progress: true,
                showRemove: true,
                removeTitle: chrome.i18n.getMessage("removeTitle")
            }, function (music) {
                fillContent("", music, function () {
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

        // update search input data
        var searchElem = $("header input[type='search']");
        searchElem.removeData().val(searchQuery);

        parallel({
            vk: function (callback) {
                VK.searchMusic(searchQuery, {}, callback);
            },
            lastfm: function (callback) {
                Lastfm.getArtistInfo(searchQuery, callback);
            },
            ym: function (callback) {
                YMusic.getArtistInfo(searchQuery, callback);
            }
        }, function (res) {
            mergeYmResultsIntoLFM(res.lastfm, res.ym);

            parallel({
                info: function (callback) {
                    Templates.render("info-artist", {
                        hasArtistDescription: (res.lastfm.info !== null && res.lastfm.info.trim().length),
                        artistDescription: createValidHTML(res.lastfm.info || ""),
                        artist: searchQuery,
                        albums: res.lastfm.albums,
                        similarArtists: chrome.i18n.getMessage("similarArtists"),
                        similarList: res.lastfm.similar
                    }, callback);
                },
                music: function (callback) {
                    var more = (res.vk.count > res.vk.songs.length);
                    var popularSongsQueue = res.lastfm.tracks.map(function (track) {
                        track.artist = track.artist ? track.artist : searchQuery;
                        return track;
                    });

                    Templates.render("songs", {
                        songs: res.vk.songs,
                        more: more,
                        showDownload: Settings.get("showDownloadButtons"),
                        type: "global",
                        query: searchQuery,
                        mostPopularTracks: chrome.i18n.getMessage("mostPopularTracks"),
                        popular: popularSongsQueue,
                        progress: true
                    }, callback);
                }
            }, function (data) {
                fillContent(data.info, data.music, function () {
                    res.lastfm.albums.forEach(function (album) {
                        if (!album.cover)
                            return;

                        // загружаем обложку альбома
                        Covers.loadFigure(album.cover);
                    });

                    MagicSearch.run($$(".music .song-queue"));
                });
            });
        });

        CPA.sendAppView("User.Search");
    }

    // todo mbid support
    function drawArtist(artist) {
        emptyContent();

        // update search input data
        var searchElem = $("header input[type='search']");
        searchElem.removeData().val("artist:" + artist);

        parallel({
            vk: function (callback) {
                VK.searchMusicByArtist(artist, {}, callback);
            },
            lastfm: function (callback) {
                Lastfm.getArtistInfo(artist, callback);
            },
            ym: function (callback) {
                YMusic.getArtistInfo(artist, callback);
            }
        }, function (res) {
            mergeYmResultsIntoLFM(res.lastfm, res.ym);

            parallel({
                info: function (callback) {
                    Templates.render("info-artist", {
                        hasArtistDescription: (res.lastfm.info !== null && res.lastfm.info.trim().length),
                        artistDescription: createValidHTML(res.lastfm.info || ""),
                        artist: artist,
                        albums: res.lastfm.albums,
                        similarArtists: chrome.i18n.getMessage("similarArtists"),
                        similarList: res.lastfm.similar
                    }, callback);
                },
                music: function (callback) {
                    var more = (res.vk.count > res.vk.songs.length);
                    var popularSongsQueue = res.lastfm.tracks.map(function (track) {
                        track.artist = artist;
                        return track;
                    });

                    Templates.render("songs", {
                        songs: res.vk.songs,
                        more: more,
                        showDownload: Settings.get("showDownloadButtons"),
                        type: "artist",
                        query: artist,
                        mostPopularTracks: chrome.i18n.getMessage("mostPopularTracks"),
                        popular: popularSongsQueue,
                        progress: true
                    }, callback);
                }
            }, function (data) {
                fillContent(data.info, data.music, function () {
                    res.lastfm.albums.forEach(function (album) {
                        // обновляем обложку альбома
                        Covers.loadFigure(album.cover);
                    });

                    MagicSearch.run($$(".music .song-queue"));
                });
            });
        });

        CPA.sendAppView("User.SearchArtist");
    }

    function drawAlbum(searchData) {
        emptyContent();

        // update search input data
        var searchElem = $("header input[type='search']").removeData().val(searchData.searchQuery);
        var reqSearchData = {};

        if (searchData.mbid) {
            searchElem.data("mbid", searchData.mbid);
            reqSearchData.mbid = searchData.mbid;
        } else if (searchData.ymid) {
            searchElem.data("ymid", searchData.ymid);
            reqSearchData.ymid = searchData.ymid;
        } else {
            searchElem.data({
                artist: searchData.artist,
                album: searchData.album
            });

            reqSearchData.artist = searchData.artist;
            reqSearchData.album = searchData.album;
        }

        var onAlbumInfoReady = function (album) {
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
                            number: song.number,
                            duration: song.duration
                        });
                    });

                    Templates.render("song-queue", {songs: queueSongs}, callback);
                }
            }, function (res) {
                fillContent(res.info, res.music, function () {
                    Covers.loadFigure(album.cover);

                    if (!album.songs.length)
                        return;

                    MagicSearch.run($$(".music .song-queue"));
                });
            });
        };

        if (reqSearchData.ymid) {
            YMusic.getAlbumInfo(reqSearchData, onAlbumInfoReady);
        } else {
            Lastfm.getAlbumInfo(reqSearchData, onAlbumInfoReady);
        }

        CPA.sendAppView("User.SearchAlbum");
    }


    return {
        back: function Navigation_back() {
            if (!states.length)
                throw new Error("States list is empty");

            if (currentStateIndex === 0)
                throw new Error("Current state is the first one");

            MagicSearch.stopAppendMode();

            currentStateIndex -= 1;
            drawUIAccordingToState();
            updateBackForwardButtonsState();
        },

        forward: function Navigation_forward() {
            if (!states.length)
                throw new Error("States list is empty");

            if (currentStateIndex === states.length - 1)
                throw new Error("Current state is the last one");

            MagicSearch.stopAppendMode();

            currentStateIndex += 1;
            drawUIAccordingToState();
            updateBackForwardButtonsState();
        },

        dispatch: function Navigation_dispatch(viewType, args) {
            if (states.length) {
                // cut all states after current
                states.length = currentStateIndex + 1;
            }

            switch (viewType) {
                case "guest":
                    // do nothing
                    break;

                // this is not actually a "view", it can be called only once
                case "user":
                    drawUserUI(function () {
                        SyncFS.requestCurrentFilesNum(function (num) {
                            $("header span.header-local span.counter").text(num);
                        });

                        if (navigator.onLine) {
                            if (window.appNavig !== undefined) {
                                Navigation.dispatch(appNavig.view, appNavig.args);
                            } else {
                                Navigation.dispatch("current");
                            }
                        } else {
                            Navigation.dispatch("cloud");
                        }
                    });

                    break;

                case "settings":
                case "cloud":
                case "current":
                case "news":
                    if (!states.length || states[currentStateIndex].view !== viewType) {
                        MagicSearch.stopAppendMode();

                        states.push({view: viewType});
                        currentStateIndex += 1;
                    }

                    break;

                case "search":
                case "searchArtist":
                case "searchAlbum":
                    var needsPush = false;

                    if (currentStateIndex === -1 || states[currentStateIndex].view !== viewType) {
                        needsPush = true;
                    } else {
                        ["mbid", "ymid", "artist", "album", "searchQuery"].forEach(function (param) {
                            if (states[currentStateIndex].search[param] !== args[param]) {
                                needsPush = true;
                            }
                        });
                    }

                    if (needsPush) {
                        MagicSearch.stopAppendMode();

                        states.push({view: viewType, search: args});
                        currentStateIndex += 1;
                    }

                    break;

                default:
                    throw new Error("Unsupported viewType: " + viewType);
            }

            drawUIAccordingToState();
            updateBackForwardButtonsState();
        },

        get currentView() {
            return states.length ? states[currentStateIndex].view : null;
        },

        get appWindowVisible() {
            return visibilityState;
        },

        set appWindowVisible(value) {
            visibilityState = value;
        }
    };
})();
