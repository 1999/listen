API = (function () {
    "use strict";

    return createModule("API", {
        clearAuth: function API_clearAuth() {
            Settings.remove("vkToken");
        }
    });
})();
