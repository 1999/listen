(function (exports) {
    "use strict";

    // Расширенный async.parallel с chrome-like синтаксисом и сахаром от DOM Events
    // @see https://npmjs.org/package/async#parallel
    exports.parallel = function (tasks, callback, ctx) {
        if (!(this instanceof exports.parallel))
            return new exports.parallel(tasks, callback, ctx);

        var isNamedQueue = !Array.isArray(tasks);
        var tasksKeys = isNamedQueue ? Object.keys(tasks) : new Array(tasks.length);

        this.completed = false;
        this.result = isNamedQueue ? {} : [];
        this.ctx = ctx;

        if (typeof callback === "function")
            this.addListener(callback);

        if (!tasksKeys.length) {
            while (callback = this._listeners.shift())
                callback.call(this.ctx, this.result);

            return;
        }

        var tasksTotalNum = tasksKeys.length;
        var tasksProcessedNum = 0;

        (function processTasks() {
            if (!tasksKeys.length)
                return;

            var self = this;
            var ctx = this.ctx;
            var taskIndex = tasksKeys.shift() || tasks.length - tasksKeys.length - 1;

            tasks[taskIndex].call(ctx, function (data) {
                self.result[taskIndex] = data;
                tasksProcessedNum += 1;

                if (tasksProcessedNum < tasksTotalNum)
                    return processTasks.call(self);

                // set state as "completed"
                self.completed = true;

                // run callback listeners
                if (self._listeners && self._listeners.length) {
                    while (callback = self._listeners.shift()) {
                        callback.call(ctx, self.result);
                    }
                }
            });

            processTasks.call(this);
        }).call(this);
    };

    exports.parallel.prototype = {
        completed: false,
        result: null,
        ctx: undefined,

        addListener: function listenerObj_addListener(callback) {
            if (typeof callback !== "function")
                return;

            if (this.completed)
                return callback.call(this.ctx, this.result);

            this._listeners = this._listeners || [];
            if (this._listeners.indexOf(callback) === -1)
                this._listeners.push(callback);
        },

        removeListener: function listenerObj_removeListener(callback) {
            if (typeof callback !== "function")
                return;

            this._listeners = this._listeners || [];

            var index = this._listeners.indexOf(callback);
            if (index !== -1)
                this._listeners.splice(index, 1);
        }
    };

    exports.createModule = function (moduleName, exportedObject) {
        return Object.create(exportedObject, {
            logger: {
                configurable: false,
                enumerable: false,
                writable: false,
                value: new Logger(moduleName)
            }
        });
    };

    exports.uuid = function () {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            var v = (c == "x") ? r : (r&0x3|0x8);

            return v.toString(16);
        });
    };

    /**
     * Копирование свойств объекта from в объект to
     * @param {Object} from
     * @param {Object} to
     * @return {Object} to
     */
    exports.copyOwnProperties = function (from, to) {
        if (typeof from !== "object" || typeof to !== "object")
            throw new TypeError("Not an object");

        for (var prop in from) {
            if (from.hasOwnProperty(prop)) {
                to[prop] = from[prop];
            }
        }

        return to;
    };

    /**
     * Копирование объекта
     * @param {Object} src
     * @param {Boolean} deep
     * @return {Object}
     */
    exports.copyObj = function (src, deep) {
        if (typeof src !== "object" || !src)
            throw new TypeError("Not an object");

        if (Array.isArray(src)) {
            return src.map(function (el) {
                return deep ? copyObj(el, deep) : el;
            });
        }

        var result = {};
        for (var key in src) {
            result[key] = (deep && typeof src[key] === "object" && src[key] !== null)
                ? copyObj(src[key], deep)
                : src[key];
        }

        return result;
    };

    exports.createValidHTML = function (html) {
        var doc = document.implementation.createDocument("http://www.w3.org/1999/xhtml", "html", null);

        try {
            doc.documentElement.innerHTML = html;
        } catch (ex) {
            return html;
        }

        [].forEach.call(doc.querySelectorAll("a[href]"), function (anchor) {
            anchor.setAttribute("target", "_blank");
        });

        return doc.documentElement.innerHTML;
    };

    exports.resolveURL = function (baseURL, relativeURL) {
        var html = document.implementation.createHTMLDocument("");
        var base = html.createElement("base");
        base.setAttribute("href", baseURL);
        var img = html.createElement("img");
        img.setAttribute("src", relativeURL);
        html.head.appendChild(base);
        html.body.appendChild(img);
        return img.src;
    };

    /**
     * Returns a date string in a requested format.
     *
     * @param {Date} date A date to format.
     * @param {String} format an arbitrary string, with date component placeholders.
     *
     * The following date component are available:
     *      "%d" - day number (1..31),
     *      "%m" - month number (1..12),
     *      "%y" - last two digits of the year,
     *      "%Y" - year,
     *      "%h" - hour (0..23),
     *      "%n" - minutes (0..59),
     *      "%s" - seconds (0..59).
     * Each placeholder is available in uppercase which adds leading 0 to single-digit numbers (except %Y).
     */
    exports.formatDate = function (date, format) {
        function leadZero(str) {
            return str.length > 1 ? str : "0" + str;
        }

        function formatCode(match, code) {
            switch (code) {
                case "d":
                    return date.getDate();
                case "D":
                    return leadZero("" + date.getDate());
                case "m":
                    return date.getMonth() + 1;
                case "M":
                    return leadZero("" + (date.getMonth() + 1));
                case "y":
                    return ("" + date.getFullYear()).substr(2, 2);
                case "Y":
                    return date.getFullYear();
                case "h":
                    return date.getHours();
                case "H":
                    return leadZero("" + date.getHours());
                case "n":
                    return date.getMinutes();
                case "N":
                    return leadZero("" + date.getMinutes());
                case "s":
                    return date.getSeconds();
                case "S":
                    return leadZero("" + date.getSeconds());
                case "%":
                    return "%";
                default:
                    return code;
            }
        }

        return format.replace(/%([dDmMyYhHnNsS%])/g, formatCode);
    };

    exports.loadResource = function (url, options, ctx) {
        var xhr = new XMLHttpRequest;
        var method = options.method || "GET";
        var params = options.data ? createRequestParams(options.data) : null;
        var sendData = (method.toUpperCase() === "POST") ? params : null;
        var isXML = false;

        if (method.toUpperCase() === "GET" && params)
            url += "?" + params;

        xhr.open(method, url, true);
        xhr.timeout = options.timeout || 25000;

        switch (options.responseType) {
            case "blob":
            case "document":
            case "arraybuffer":
                xhr.responseType = options.responseType;
                break;

            case "xml":
                isXML = true;
                break;
        }

        if (options.onload) {
            xhr.onload = function () {
                var arg = isXML ? xhr.responseXML : xhr.response;
                options.onload.call(ctx, arg);
            };
        }

        if (options.onerror) {
            xhr.onabort = xhr.onerror = function (evt) {
                options.onerror.call(ctx, evt.type);
            };
        }

        xhr.send(sendData);
    };

    exports.createRequestParams = function (params) {
        var output = [];

        for (var key in params)
            output.push(encodeURIComponent(key) + "=" + encodeURIComponent(params[key]));

        return output.join("&");
    };

    exports.parseQuery = function (str) {
        var parts = str.split("&");
        var output = {};
        var splitted, key;

        if (!str.length)
            return output;

        for (var i = 0; i < parts.length; i++) {
            splitted = parts[i].split("=");
            key = splitted.shift();

            if (output[key] !== undefined) {
                output[key] = [output[key]];
                output[key].push(splitted.join("="));
            } else {
                output[key] = splitted.join("=");
            }
        }

        return output;
    };
})(window);
