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

    var evtHandlers = [
        // sendStat checkbox on guest page
        {
            selector: "input[name='sendStat']",
            evtType: "click",
            callback: function () {
                CPA.changePermittedState(this.checked);
            }
        },
        // authorization button on guest page
        {
            selector: ".auth",
            evtType: "click",
            callback: function (evt) {
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
                    Navigation.dispatch("user");
                });
            }
        },
        // opening settings UI
        {
            selector: "header .header-settings",
            evtType: "click",
            callback: function (evt) {
                Navigation.dispatch("settings");
            }
        },
        // opening changelog
        {
            selector: "header .header-news",
            evtType: "click",
            callback: function (evt) {
                Navigation.dispatch("news");
            }
        },
        // Google Drive synchronized tracks
        {
            selector: "header .header-local",
            evtType: "click",
            callback: function (evt) {
                Navigation.dispatch("cloud");
            }
        },
        // go back to the previous app view
        {
            selector: "header .header-navback",
            evtType: "click",
            callback: function (evt) {
                Navigation.back();
            }
        },
        // go to the next app view
        {
            selector: "header .header-navforward",
            evtType: "click",
            callback: function (evt) {
                Navigation.forward();
            }
        },
        // search for bands, albums, songs etc
        {
            selector: "header .search",
            evtType: "click",
            callback: function (evt) {
                var searchElem = $("header input[type='search']");
                var searchQuery = searchElem.val();
                var matches;

                if (!navigator.onLine)
                    return Navigation.dispatch("cloud");

                if (!searchQuery.length)
                    return Navigation.dispatch("current");

                matches = searchQuery.match(/^artist:(.+)/);
                if (matches)
                    return Navigation.dispatch("searchArtist", {artist: matches[1]});

                var mbid = searchElem.data("mbid");
                var ymid = searchElem.data("ymid");
                var artist = searchElem.data("artist");
                var album = searchElem.data("album");

                if (mbid.length)
                    return Navigation.dispatch("searchAlbum", {mbid: mbid, searchQuery: searchQuery});

                if (ymid.length)
                    return Navigation.dispatch("searchAlbum", {ymid: ymid, searchQuery: searchQuery});

                if (artist.length && album.length)
                    return Navigation.dispatch("searchAlbum", {artist: artist, album: album, searchQuery: searchQuery});

                Navigation.dispatch("search", {searchQuery: searchQuery});
            }
        },
        // close pay layer with "close" link
        {
            selector: ".pay .pay-close",
            evtType: "click",
            callback: function (evt) {
                var headerPay = Settings.get("headerPay");
                headerPay.close += 1;
                Settings.set("headerPay", headerPay);

                Settings.set("headerRateCounter", 0);
                this.closestParent("div.pay").remove();

                evt.stopImmediatePropagation();
            }
        },
        // close pay layer with "Rate CWS" button
        {
            selector: ".pay .pay-cwsrate",
            evtType: "click",
            callback: function (evt) {
                var headerPay = Settings.get("headerPay");
                headerPay.ratecws += 1;
                Settings.set("headerPay", headerPay);

                window.open(Config.constants.cws_app_link + "/reviews");

                Settings.set("headerRateCounter", 0);
                this.closestParent("div.pay").remove();

                evt.stopImmediatePropagation();
            }
        },
        // close pay layer with "Yamoney" button
        {
            selector: ".pay .pay-yamoney",
            evtType: "click",
            callback: function (evt) {
                var headerPay = Settings.get("headerPay");
                headerPay.yamoney += 1;
                Settings.set("headerPay", headerPay);

                window.open(Config.constants.yamoney_link);

                Settings.set("headerRateCounter", 0);
                this.closestParent("div.pay").remove();

                evt.stopImmediatePropagation();
            }
        },
        // close study layer(s)
        {
            selector: ".study button.close",
            evtType: "click",
            callback: function (evt) {
                var container = this.closestParent(".study");
                var currentStudy = Settings.get("study");

                currentStudy.push(container.data("study"));
                Settings.set("study", currentStudy);

                container.remove();
                evt.stopImmediatePropagation();
            }
        },
        // get LFM token
        {
            selector: ".study .study-lastfm-auth, .settings .get-lastfm-token",
            evtType: "click",
            callback: function (evt) {
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

                        Navigation.dispatch("settings");
                    });
                });
            }
        },
        // drop LFM token
        {
            selector: ".settings .drop-lastfm-token",
            evtType: "click",
            callback: function (evt) {
                Settings.set("lastfmToken", "");

                chrome.storage.local.get("installId", function (records) {
                    CPA.sendEvent("Lyfecycle", "LFM_Reset", {
                        id: records.installId
                    });
                });

                Navigation.dispatch("settings");
            }
        },
        // drop VK token
        {
            selector: ".settings .drop-vk-auth",
            evtType: "click",
            callback: function (evt) {
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

                Navigation.dispatch("guest");
            }
        },
        // save sendStat option value
        {
            selector: ".settings input[name='sendStatChkbx'][type='radio']",
            evtType: "click",
            callback: function (evt) {
                var optionValue = this.value === "1" ? true : false;
                CPA.changePermittedState(optionValue);

                var savedElem = $(this.closestParent("div.radio"), ".saved").removeClass("hidden");

                // browsers optimize classList manipulations, so .removeClass(display=none).addClass(transition) doesn't work
                // make transition on the next tick to prevent this
                window.setTimeout(function () {
                    savedElem.addClass("saved-hiding")
                }, 0);
            }
        },
        // save smoothTracksSwitch option value
        {
            selector: ".settings input[name='smoothSwitch'][type='radio']",
            evtType: "click",
            callback: function (evt) {
                var optionValue = this.value === "1" ? true : false;
                Settings.set("smoothTracksSwitch", optionValue);

                var savedElem = $(this.closestParent("div.radio"), ".saved").removeClass("hidden");

                // browsers optimize classList manipulations, so .removeClass(display=none).addClass(transition) doesn't work
                // make transition on the next tick to prevent this
                window.setTimeout(function () {
                    savedElem.addClass("saved-hiding")
                }, 0);
            }
        },
        // save showNotifications setting
        {
            selector: ".settings input[name='showNotifications'][type='radio']",
            evtType: "click",
            callback: function (evt) {
                var optionValue = this.value === "1" ? true : false;
                Settings.set("showNotifications", optionValue);

                var savedElem = $(this.closestParent("div.radio"), ".saved").removeClass("hidden");

                // browsers optimize classList manipulations, so .removeClass(display=none).addClass(transition) doesn't work
                // make transition on the next tick to prevent this
                window.setTimeout(function () {
                    savedElem.addClass("saved-hiding")
                }, 0);
            }
        },
        // play music file
        {
            selector: ".music .play",
            evtType: "click",
            callback: function (evt) {
                Sounds.updatePlaylist();

                var songContainer = this.closestParent("p.song");
                Sounds.play(songContainer.data("url"));

                evt.stopImmediatePropagation();
            }
        },
        // pause music file
        {
            selector: ".music .pause",
            evtType: "click",
            callback: function (evt) {
                Sounds.pause();
                evt.stopImmediatePropagation();
            }
        },
        // save MP3 file into Google Drive cloud
        {
            selector: ".music .cloud",
            evtType: "click",
            callback: function (evt) {
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
            }
        },
        // download MP3 file to local computer
        {
            selector: ".music a[download]",
            evtType: "click",
            callback: function (evt) {
                evt.stopImmediatePropagation();

                var songContainer = this.closest("p.song");

                CPA.sendEvent("Actions", "saveLocal", {
                    artist: songContainer.data("artist"),
                    title: songContainer.data("title")
                });
            }
        },
        // load more songs on window croll
        {
            selector: ".music .more",
            evtType: "click",
            callback: function (evt) {
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
            }
        },
        // search for artists
        {
            selector: "a[href^='artist:'], a[href^='album:']",
            evtType: "click",
            callback: function (evt) {
                evt.preventDefault();
                evt.stopImmediatePropagation();

                var headerElem = $("header input[type='search']").removeData();
                var headerBtn = $("header .search");

                var mbid = this.data("mbid");
                var ymid = this.data("ymid");
                var artist = this.data("artist");
                var album = this.data("album");

                if (mbid.length) {
                    headerElem.data("mbid", mbid);
                } else if (ymid.length) {
                    headerElem.data("ymid", ymid);
                } else if (artist.length && album.length) {
                    headerElem.data({artist: artist, album: album});
                }

                var searchValue = /^artist:/.test(this.attr("href")) ? this.attr("href") : artist + " - " + album;
                headerElem.val(searchValue);

                headerBtn.click();
            }
        },
        // update currently playing song currentTime
        {
            selector: ".music p.song",
            evtType: "click",
            callback: function (evt) {
                var matchesSelectorFn = (Element.prototype.matchesSelector || Element.prototype.webkitMatchesSelector);

                if (this.previousSibling && matchesSelectorFn.call(this.previousSibling, ".song-playing-bg")) {
                    Sounds.updateCurrentTime(evt.layerX / this.clientWidth);
                }
            }
        },
        // start playing songs from header
        {
            selector: "footer .play",
            evtType: "click",
            callback: function (evt) {
                Sounds.play();
            }
        },
        // pause playing songs
        {
            selector: "footer .pause",
            evtType: "click",
            callback: function (evt) {
                Sounds.pause();
            }
        },
        // play previous song
        {
            selector: "footer .prev",
            evtType: "click",
            callback: function (evt) {
                Sounds.playPrev();
            }
        },
        // play next song
        {
            selector: "footer .next",
            evtType: "click",
            callback: function (evt) {
                Sounds.playNext();
            }
        },
        // enable/disable shuffle/repeat playing modes
        {
            selector: "footer .mode",
            evtType: "click",
            callback: function (evt) {
                if (this.hasClass("active")) {
                    Sounds.disableMode();
                } else {
                    Sounds.enableMode(this.data("mode"));
                }
            }
        },
        // set playing track current time
        {
            selector: "footer .song-playing-bg",
            evtType: "click",
            callback: function (evt) {
                var isPlaying = $("footer span.play").hasClass("hidden");
                var percent = evt.layerX / document.body.clientWidth;

                if (!isPlaying)
                    return;

                Sounds.updateCurrentTime(percent);
            }
        },
        {
            selector: "header input[type='search']",
            evtType: "keyup",
            callback: function (evt) {
                this.removeData();
            }
        },
        {
            selector: "header input[type='search']",
            evtType: "search",
            callback: function (evt) {
                if (!this.val().length) {
                    Navigation.dispatch("current");
                }
            }
        },
        // change volume level
        {
            selector: "footer input[type='range']",
            evtType: "change",
            callback: function (evt) {
                Sounds.changeVolumeLevel(this.value);
            }
        }
    ];

    var mutationObserver = new MutationObserver(function (mutationRecords, observer) {
        mutationRecords.forEach(function (mutationRecord) {
            [].forEach.call(mutationRecord.addedNodes, function (node) {
                if (node.nodeType !== Node.ELEMENT_NODE)
                    return;

                // we can't check an empty node for querySelector/matchesSelector
                if (!node.hasChildNodes()) {
                    node = node.parentNode;
                }

                evtHandlers.forEach(function (handlerData) {
                    $$(node, handlerData.selector).bind(handlerData.evtType, handlerData.callback);
                });
            });

            [].forEach.call(mutationRecord.removedNodes, function (node) {
                if (node.nodeType !== Node.ELEMENT_NODE)
                    return;

                // we can't check an empty node for querySelector/matchesSelector
                if (!node.hasChildNodes()) {
                    node = node.parentNode;
                }

                if (!node)
                    return;

                evtHandlers.forEach(function (handlerData) {
                    $$(node, handlerData.selector).unbind(handlerData.evtType, handlerData.callback);
                });
            });
        });
    });

    mutationObserver.observe(document.body, {
        subtree: true,
        childList: true
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
            Navigation.dispatch("cloud");
        }
    }, false);

    window.addEventListener("scroll", function () {
        var pageHeight = Math.max(document.body.offsetHeight, document.body.clientHeight);
        var scrollTop = window.innerHeight + window.scrollY;
        var more = $(".music div.more");

        if (scrollTop + 160 >= pageHeight && more) {
            more.click();
        }
    }, false);

    // @see https://code.google.com/p/chromium/issues/detail?id=90793
    document.addEventListener("webkitvisibilitychange", function () {
        Navigation.appWindowVisible = !document.webkitHidden;
        console.log(document.webkitHidden);
    }, false);

    document.body.bind("submit", function (evt) {
        evt.preventDefault();

        var lastButton = $(this, "button[type='button']:last-of-type");
        if (!lastButton)
            throw new Error("No button found for making fake submit");

        lastButton.click();
    });


    if (Settings.get("vkToken").length) {
        Navigation.dispatch("user");
    } else {
        Navigation.dispatch("guest");
    }
});
