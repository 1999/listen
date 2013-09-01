/**
 * Вывод сообщений в табы и файл лога
 *
 * this.logger.error("error caught")
 * this.logger.info("Smth intresting happened: %s", exception)
 * this.logger.warn("Current time: %i", Date.now())
 *
 * Возможные плейсхолдеры:
 * %s - string
 * %d, %i - integer
 * %f - float
 * %j - json
 */
(function () {
    "use strict";

    var fileAppender = (function () {
        var isRunning = false;
        var messagesQueue = [];

        return {
            push: function (resultStr) {
                messagesQueue.push(resultStr)

                if (isRunning)
                    return;

                isRunning = true;

                (window.webkitRequestFileSystem || window.requestFileSystem)(window.PERSISTENT, 0, function onFileSystemGot(windowFsLink) {
                    windowFsLink.root.getFile("debug.log", {create: true, exclusive: false}, function (fileEntry) {
                        fileEntry.createWriter(function (fileWriter) {
                            fileWriter.seek(fileWriter.length);

                            fileWriter.onwriteend = function (e) {
                                isRunning = false;

                                if (messagesQueue.length) {
                                    onFileSystemGot(windowFsLink);
                                }
                            };

                            var blob = new Blob(["\n" + messagesQueue.join("\n")], {type: "text/plain"});
                            fileWriter.write(blob);

                            messagesQueue.length = 0;
                        });
                    });
                });
            }
        }
    })();

    // запись в консоль табов расширения
    function notifyConsole(level, data) {
        chrome.runtime.sendMessage({type: "notifyLog", level: level, data: data});
    }

    /**
     * Соответствует ли сообщение по уровню отладки
     *
     * @param {String} level уровень "info", "warn" и "error"
     * @param {String} type тип лога "console" и "file"
     * @return {Boolean}
     */
    function passesLogLevel(level, type) {
        var key = "logLevel" + type.charAt(0).toUpperCase() + type.substr(1);
        var currentLevel = Settings.get(key);

        switch (currentLevel) {
            case "error": return (level === "error");
            case "warn": return (level === "error" || level === "warn");
            case "info": return true;
        }
    }

    /**
     * Замена плейсхолдеров в переданной строке
     *
     * @param  {String} data
     * @return {String}
     */
    function replacePlaceholders(data) {
        var resultStr = data[0];
        var hasPlaceholders;
        var placeholderIndex = 1;

        if (data.length > 1) {
            resultStr = data[0].replace(/%([s|i|d|f|j])/gm, function (total, match) {
                var replacer;

                switch (match) {
                    case "s":
                        replacer = (data[placeholderIndex] || "") + "";
                        break;

                    case "i":
                    case "d":
                        replacer = parseInt(data[placeholderIndex], 10);
                        break;

                    case "f":
                        replacer = parseFloat(data[placeholderIndex]);
                        break;

                    case "j":
                        replacer = JSON.stringify(data[placeholderIndex] || "");
                        break;
                }

                hasPlaceholders = true;
                placeholderIndex += 1;

                return replacer;
            });
        }

        return resultStr;
    }

    /**
     * Общий хэлпер для вызова методов Logger.prototype
     *
     * @this {Logger}
     */
    function helper(level, args) {
        var formattedDateString = formatDate(new Date, "%Y-%M-%D %H:%N:%S");
        var resultStr = [formattedDateString, this.module || "Core", level.toUpperCase(), replacePlaceholders(args)].join("\t");

        if (passesLogLevel(level, "console"))
            notifyConsole(level, resultStr);

        if (passesLogLevel(level, "file"))
            fileAppender.push(resultStr);
    }

    function Logger(moduleName) {
        this.module = moduleName;
    }

    Logger.prototype = {
        info: function Logger_info() {
            helper.call(this, "info", arguments);
        },

        error: function Logger_error() {
            helper.call(this, "error", arguments);
        },

        warn: function Logger_warn() {
            helper.call(this, "warn", arguments);
        }
    };

    Logger.writeInitMessage = function Logger_writeInitMessage() {
        this.info("Initializing application v%s build %s dated %s",
                    chrome.runtime.getManifest().version,
                    Config.buildInfo.revision,
                    new Date(Config.buildInfo.date * 1000));
    };

    Logger.__proto__ = Logger.prototype;
    window.Logger = Logger;
})();
