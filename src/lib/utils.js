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

    exports.uuid = function () {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0;
            var v = (c == "x") ? r : (r&0x3|0x8);

            return v.toString(16);
        });
    };

    exports.strpad = function (str) {
        str = str + "";
        return (str.length === 1) ? "0" + str : str;
    };

    exports.getCurrentLocale = function () {
        return chrome.i18n.getMessage("@@ui_locale").split("_")[0];
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
            var correctMatches = anchor.getAttribute("href").match(/^http:\/\/www\.last\.fm\/music\/(.+)/);

            if (correctMatches && !/^Read\smore/.test(anchor.textContent)) {
                anchor.setAttribute("href", "artist:" + correctMatches[1].replace(/\+/g, " "));
            } else {
                anchor.setAttribute("target", "_blank");
            }
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

    exports.loadResource = function(url, options, ctx) {
        var xhr = new XMLHttpRequest;
        var method = options.method || "GET";
        var isXML = false;
        var sendData = null;

        if (method.toUpperCase() === "GET") {
            var getParams = createRequestParams(options.data);
            if (getParams.length) {
                url += "?" + getParams;
            }
        }

        xhr.open(method, url, true);
        xhr.timeout = (options.timeout !== undefined) ? options.timeout : 25000;

        if (options.headers) {
            for (var headerName in options.headers) {
                xhr.setRequestHeader(headerName, options.headers[headerName]);
            }
        }

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
                var responseXML = null;

                if (isXML && !xhr.responseXML) {
                    // VK can response with invalid characters, replace them
                    // @see http://msdn.microsoft.com/en-us/library/k1y7hyy9(v=vs.71).aspx
                    var invalidCharCodes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 65534, 65535].map(function (charCode) {
                        return String.fromCharCode(charCode);
                    });

                    var invalidSymbolsRegex = new RegExp("[" + invalidCharCodes.join("|") + "]", "gm");
                    var responseText = xhr.responseText.replace(/[\x00-\x1f]/, "").replace(invalidSymbolsRegex, "");

                    // re-create XMLDocument
                    var parser = new DOMParser;
                    var doc = parser.parseFromString(responseText, "text/xml");

                    if (!doc || !(doc instanceof XMLDocument))
                        throw new Error("URL was not valid: " + url);

                    var parseError = doc.querySelector("parsererror");
                    if (parseError)
                        throw new Error("Parse error for " + url + ": " + parseError.innerText);

                    responseXML = doc;
                }

                var arg = isXML ? (xhr.responseXML || responseXML) : xhr.response;
                options.onload.call(ctx || xhr, arg);
            };
        }

        if (options.onprogress) {
            xhr.onprogress = function (evt) {
                var percents = Math.floor((evt.position / evt.totalSize) * 100);
                options.onprogress.call(ctx || xhr, percents);
            };
        }

        if (options.onUploadProgress) {
            xhr.upload.onprogress = function (evt) {
                var percents = Math.floor((evt.position / evt.totalSize) * 100);
                options.onUploadProgress.call(ctx || xhr, percents);
            };
        }

        if (options.onerror) {
            xhr.onerror = function (evt) {
                options.onerror.call(ctx || xhr, evt);
            };

            xhr.onabort = function (evt) {
                options.onerror.call(ctx || xhr, evt);
            }
        }

        if (method.toUpperCase() === "POST") {
            for (var key in options.data) {
                sendData = sendData || new FormData;
                sendData.append(key, options.data[key]);
            }
        }

        xhr.send(sendData);
        return xhr;
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
