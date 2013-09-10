API = (function () {
    "use strict";

    return {
        clearAuth: function API_clearAuth() {
            Settings.remove("vkToken");
        }
    };
})();
