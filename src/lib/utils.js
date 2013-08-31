(function (exports) {
    exports.createModule = function (moduleName, proto) {
        return Object.create(proto, {
            value: new Logger(moduleName)
        });
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

    function createRequestParams(params) {
        var output = "";

        for (var key in params)
            output.push(encodeURIComponent(key) + "=" + encodeURIComponent(params[key]));

        return output.join("&");
    }
})(window);
