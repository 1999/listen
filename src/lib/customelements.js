// cut and simple custom elements polyfill
// @link http://www.html5rocks.com/en/tutorials/webcomponents/customelements/
(function () {
    "use strict";

    if ("register" in document)
        return;

    var originalCreateElement = Document.prototype.create.bind(Document.prototype);
    var registeredCustomElements = Object.create(null);
    var nop = function () {};

    /**
     * @param {String} nodeName
     * @param {Object} nodeAPI
     * @return {Function} constructor
     */
    Document.prototype.register = function (nodeName, nodeAPI) {
        var dashIndex = nodeName.indexOf("-");
        if (dashIndex <= 0)
            throw new Error("Failed to call 'register': " + nodeName + " is not a valid name.");

        if (registeredCustomElements[nodeName])
            throw new Error("Failed to call 'register' for type '" + nodeName + "': a type with that name is already registered.");

        nodeAPI = nodeAPI || {};
        nodeAPI.prototype = nodeAPI.prototype || Object.create(HTMLElement.prototype);

        registeredCustomElements[nodeName] = proto;
    };

    Document.prototype.createElement = function (nodeName) {
        var elem = originalCreateElement(nodeName);

        if (registeredCustomElements[nodeName]) {
            elem.__proto__ = registeredCustomElements[nodeName].prototype;

            if (typeof registeredCustomElements[nodeName].createdCallback === "function") {
                registeredCustomElements[nodeName].createdCallback.call(elem);
            }
        }

        return elem;
    };
})();
