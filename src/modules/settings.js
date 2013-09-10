Settings = (function () {
    "use strict";

    var currentPrefs = {};

    chrome.storage.onChanged.addListener(function (changes, areaName) {
        for (var key in changes) {
            if (!/^settings\./.test(key))
                continue;

            if (!currentPrefs[key])
                throw new Error("Can't set preference (" + key + ") which was not described in config.js settings part");

            if (currentPrefs[key].storageType !== areaName)
                throw new Error("Preference storage types differ (current: " + currentPrefs[key].storageType + ", new: " + areaName + ")");

            currentPrefs[key].value = changes[key].newValue;
        }
    });


    return {
        load: function Settings_load(callback) {
            parallel({
                local: function (callback) {
                    var keys = Object.keys(Config.default_settings_local).map(function (key) {
                        return "settings." + key;
                    });

                    chrome.storage.local.get(keys, callback);
                },
                sync: function (callback) {
                    var keys = Object.keys(Config.default_settings_sync).map(function (key) {
                        return "settings." + key;
                    });

                    chrome.storage.sync.get(keys, callback);
                }
            }, function (settings) {
                ["local", "sync"].forEach(function (storageType) {
                    var storageKey;

                    for (var key in Config["default_settings_" + storageType]) {
                        storageKey = "settings." + key;

                        currentPrefs[storageKey] = {
                            value: (settings[storageType][storageKey] !== undefined) ? settings[storageType][storageKey] : Config["default_settings_" + storageType][key],
                            storageType: storageType,
                            isDefault: (settings[storageType][storageKey] === undefined)
                        };
                    }
                });

                callback();
            });
        },

        get: function Settings_get(key) {
            key = "settings." + key;
            return currentPrefs[key] ? currentPrefs[key].value : null;
        },

        /**
         * Сохранение настройки
         * @param {String} key
         * @param {Mixed} value
         */
        set: function Settings_set(key, value) {
            key = "settings." + key;
            if (!currentPrefs[key])
                throw new Error("Can't set preference (" + key + ") which was not described in config.js settings part");

            currentPrefs[key].value = value;

            // @todo минимизировать запись в chrome.storage
            var storageData = {};
            storageData[key] = value;
            chrome.storage[currentPrefs[key].storageType].set(storageData);
        },

        remove: function Settings_remove(key) {
            var storageKey = "settings." + key;
            if (!currentPrefs[storageKey])
                throw new Error("Can't remove preference (" + key + ") which was not described in config.js settings part");

            chrome.storage[currentPrefs[storageKey].storageType].remove(storageKey);

            currentPrefs[storageKey].isDefault = true;
            currentPrefs[storageKey].value = Config["default_settings_" + currentPrefs[storageKey].storageType][key];
        },

        /**
         * Является ли значение настройки установленным пользователем вручную
         * @return {Boolean}
         */
        hasUserValue: function Settings_hasUserValue(key) {
            key = "settings." + key;
            if (!currentPrefs[key])
                throw new Error("Can't get preference (" + key + ") which was not described in config.js settings part");

            return !currentPrefs[key].isDefault;
        },

        /**
         * Полный дамп настроек для отладки
         * @return {Object}
         */
        dump: function Settings_dump() {
            var output = {
                local: {},
                sync: {}
            };

            for (var key in currentPrefs)
                output[currentPrefs[key].storageType][key] = currentPrefs[key].value;

            return output;
        }
    };
})();
