Tests = (function () {
    "use strict";

    return {
        vkPeopleUsePlaylists: function Tests_vkPeopleUsePlaylists() {
            if (!Settings.get("vkToken").length) {
                return;
            }

            VK.getAlbums(function (albumsCount) {
                if (albumsCount !== null) {
                    CPA.sendEvent("Tests", "vkPeopleUsePlaylists", "At least one", albumsCount > 0);
                }
            });
        }
    };
})();
