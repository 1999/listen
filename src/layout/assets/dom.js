/* ==========================================================
 * DOM sugar for new browsers
 * https://github.com/1999/dom
 * ==========================================================
 * Copyright 2013 Dmitry Sorin <info@staypositive.ru>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */

(function () {
    // shim for browsers with missing support for insertAdjacentElement
    if (!HTMLElement.prototype.insertAdjacentElement) {
        var adjacentElementDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "insertAdjacentHTML");
        adjacentElementDescriptor.value = function (where, parsedNode) {
            switch (where) {
                case "beforeBegin":
                    this.parentNode.insertBefore(parsedNode, this);
                    break;

                case "afterBegin":
                    this.insertBefore(parsedNode, this.firstChild);
                    break;

                case "beforeEnd":
                    this.appendChild(parsedNode);
                    break;

                case "afterEnd":
                    if (this.nextSibling)
                        this.parentNode.insertBefore(parsedNode, this.nextSibling);
                    else
                        this.parentNode.appendChild(parsedNode);

                    break;
            }
        }

        Object.defineProperty(HTMLElement.prototype, "insertAdjacentElement", adjacentElementDescriptor);
    }

    var HTMLExtendedElement = {
        /**
         * Find closest ancestor node
         * @param {String} selector
         * @return {HTMLElement|Null}
         */
        closestParent: function (selector) {
            var matchesSelectorFn = (Element.prototype.matchesSelector || Element.prototype.webkitMatchesSelector || Element.prototype.mozMatchesSelector);
            var elem = this;

            while (elem.parentNode) {
                if (matchesSelectorFn.call(elem, selector))
                    return elem;

                elem = elem.parentNode;
            }

            return null;
        },
        /**
         * Bind event listener to node
         * @param {String} evtType
         * @param {Function} callback
         * @param {Boolean} singleton
         * @return {HTMLElement} refers to this
         */
        bind: function (evtType, callback, singleton) {
            if (singleton) {
                this["on" + evtType] = callback;
            } else {
                this.addEventListener(evtType, callback, false);
            }

            return this;
        },
        /**
         * Remove node
         * @return {HTMLElement} refers to this
         */
        remove: function () {
            return this.parentNode.removeChild(this);
        },
        /**
         * Get innerHTML property of a node or set it
         * @param {String|Undefined} newHTML
         * @return {HTMLElement|String} innerHTML or node which refers to this
         */
        html: function (newHTML) {
            if (newHTML !== undefined) {
                this.innerHTML = newHTML;
                return this;
            }

            return this.innerHTML;
        },
        /**
         * Get textContent property of a node or set it
         * @param {String|Undefined} newContent
         * @return {HTMLElement|String} textContent or node which refers to this
         */
        text: function (newContent) {
            if (newContent !== undefined) {
                this.textContent = newContent;
                return this;
            }

            return this.textContent;
        },
        /**
         * Empty innerHTML of a node
         * @type {HTMLElement} refers to this
         */
        empty: function () {
            return this.html("");
        },
        /**
         * Append HTML code, HTMLElement or NodeList to a node
         * @param {String|HTMLElement|NodeList} contents
         * @return {HTMLElement} refers to this
         */
        append: function (contents) {
            if (typeof contents === "string") {
                this.insertAdjacentHTML("beforeEnd", contents);
            } else if (contents instanceof HTMLElement) {
                this.insertAdjacentElement("beforeEnd", contents);
            } else if (contents instanceof NodeList) {
                for (var i = 0; i < contents.length; i++) {
                    this.insertAdjacentElement("beforeEnd", contents[i]);
                }
            }

            return this;
        },
        /**
         * Insert HTML code, HTMLElement or NodeList to the beginning of a node contents
         * @param {String|HTMLElement|NodeList} contents
         * @return {HTMLElement} refers to this
         */
        prepend: function (contents) {
            if (typeof contents === "string") {
                this.insertAdjacentHTML("afterBegin", contents);
            } else if (contents instanceof HTMLElement) {
                this.insertAdjacentElement("afterBegin", contents);
            } else if (contents instanceof NodeList) {
                for (var i = 0; i < contents.length; i++) {
                    this.insertAdjacentElement("afterBegin", contents[i]);
                }
            }

            return this;
        },
        /**
         * Insert HTML code, HTMLElement or NodeList before a node
         * @param {String|HTMLElement|NodeList} contents
         * @return {HTMLElement} refers to this
         */
        before: function (contents) {
            if (typeof contents === "string") {
                this.insertAdjacentHTML("beforeBegin", contents);
            } else if (contents instanceof HTMLElement) {
                this.insertAdjacentElement("beforeBegin", contents);
            } else if (contents instanceof NodeList) {
                for (var i = 0; i < contents.length; i++) {
                    this.insertAdjacentElement("beforeBegin", contents[i]);
                }
            }

            return this;
        },
        /**
         * Insert HTML code, HTMLElement or NodeList after a node
         * @param {String|HTMLElement|NodeList} contents
         * @return {HTMLElement} refers to this
         */
        after: function (contents) {
            if (typeof contents === "string") {
                this.insertAdjacentHTML("afterEnd", contents);
            } else if (contents instanceof HTMLElement) {
                this.insertAdjacentElement("afterEnd", contents);
            } else if (contents instanceof NodeList) {
                for (var i = 0; i < contents.length; i++) {
                    this.insertAdjacentElement("afterEnd", contents[i]);
                }
            }

            return this;
        },
        /**
         * Get value of a node or set it
         * @param {Mixed|Undefined} newValue
         * @return {HTMLElement|Mixed} node value or node which refers to this
         */
        val: function (newValue) {
            if (newValue === undefined)
                return this.value;

            this.value = newValue;
            return this;
        },
        /**
         * Add one or mutiple classes to a node classList
         * @param [arguments] classNames
         * @return {HTMLElement} refers to this
         */
        addClass: function () {
            var classNames = Array.prototype.slice.call(arguments, 0);
            for (var i = 0; i < classNames.length; i++)
                this.classList.add(classNames[i]);

            return this;
        },
        /**
         * Remove one or mutiple classes from a node classList. If arguments count is 0, than classList is cleared
         * @param [arguments] classNames
         * @return {HTMLElement} refers to this
         */
        removeClass: function () {
            var classNames = Array.prototype.slice.call(arguments, 0);
            if (classNames.length) {
                for (var i = 0; i < classNames.length; i++) {
                    this.classList.remove(classNames[i]);
                }
            } else {
                this.className = "";
            }

            return this;
        },
        /**
         * Check whether one or all of the classes are in the classList property of a node
         * @param [arguments] classNames
         * @return {Boolean}
         */
        hasClass: function () {
            var classNames = Array.prototype.slice.call(arguments, 0);
            var contains = true;

            for (var i = 0; i < classNames.length; i++) {
                if (!this.classList.contains(classNames[i])) {
                    contains = false;
                    break;
                }
            }

            return contains;
        },
        /**
         * Toggle the existence of a class in an element's list of classes
         * @type {Boolean}
         */
        toggleClass: function (className, force) {
            return this.classList.toggle(className, force);
        },
        /**
         * Get attribute(s) of a node or set it
         * @param {String} key
         * @param {Mixed} value
         * @return {HTMLElement} refers to this
         *
         * or
         * @param {Object} key-value map of the attributes
         * @return {HTMLElement} refers to this
         *
         * or
         * @param {String} key
         * @return {Mixed} attribute's value
         */
        attr: function (key, value) {
            if (value === undefined && typeof key === "string")
                return this.getAttribute(key);

            var attributes = {};
            if (arguments.length === 1) {
                attributes = key;
            } else {
                attributes[key] = value;
            }

            for (var attrKey in attributes)
                this.setAttribute(attrKey, attributes[key]);

            return this;
        },
        /**
         * Remove node's attribute
         * @return {HTMLElement} refers to this
         */
        removeAttr: function (key) {
            this.removeAttribute(key);
            return this;
        },
        /**
         * Get dataset value(s) or set it
         * @param {String} key
         * @param {Mixed} value
         * @return {HTMLElement} refers to this
         *
         * or
         * @param {Object} key-value map of the dataset
         * @return {HTMLElement} refers to this
         *
         * or
         * @param {String} key
         * @return {Mixed} attribute's value
         */
        data: function (key, value) {
            if (value === undefined && typeof key === "string")
                return (this.dataset[key] || "");

            var data = {};
            if (arguments.length === 1) {
                data = key;
            } else {
                data[key] = value;
            }

            for (var dataKey in data)
                this.dataset[dataKey] = data[key];

            return this;
        },
        /**
         * Delete dataset properties from a node. If arguments count is 0, than dataset of a node will be cleared
         * @param [arguments] dataset keys
         * @return {HTMLElement} refers to this
         */
        removeData: function () {
            var datasetKeys = Array.prototype.slice.call(arguments, 0);

            for (var key in this.dataset) {
                if (!datasetKeys.length || datasetKeys.indexOf(key) !== -1) {
                    delete this.dataset[key];
                }
            }

            return this;
        },
        /**
         * Get style property value(s) of a node or set it
         * @param {String} key
         * @param {Mixed} value
         * @return {HTMLElement} refers to this
         *
         * or
         * @param {Object} key-value map of the dataset
         * @return {HTMLElement} refers to this
         *
         * or
         * @param {String} key
         * @return {Mixed} attribute's value
         */
        css: function (key, value) {
            if (value === undefined && typeof key === "string")
                return this.style[key];

            var styles = {};
            if (arguments.length === 1) {
                styles = key;
            } else {
                styles[key] = value;
            }

            for (var cssKey in styles)
                this.style[cssKey] = styles[key];

            return this;
        }
    };

    var NodeExtendedList = {
        /**
         * Apply callback to each element of the list
         * @param {Function} callback where this refers to parsed element of the list
         * @return {NodeList} refers to this
         */
        each: function (callback) {
            for (var i = 0; i < this.length; i++)
                callback.call(this[i], i);

            return this;
        },
        /**
         * Bind event listener to every element of the list
         * @param {String} evtType
         * @param {Function} callback
         * @param {Boolean} singleton
         * @return {NodeList} refers to this
         */
        bind: function (evtType, callback, singleton) {
            for (var i = 0; i < this.length; i++)
                this[i].bind(evtType, callback, singleton);

            return this;
        },
        /**
         * Empty innerHTML properties of every element in the list
         * @return {NodeList} refers to this
         */
        empty: function () {
            for (var i = 0; i < this.length; i++)
                this[i].empty();

            return this;
        },
        /**
         * Remove every element of the list from their parents
         * @return {NodeList} refers to this
         */
        remove: function () {
            for (var i = 0; i < this.length; i++)
                this[i].remove();

            return this;
        },
        /**
         * Add one or mutiple classes to every element's classList
         * @param [arguments] classNames
         * @return {NodeList} refers to this
         */
        addClass: function () {
            for (var i = 0; i < this.length; i++)
                this[i].addClass.apply(this[i], Array.prototype.slice.call(arguments, 0));

            return this;
        },
        /**
         * Remove one or mutiple classes from every element's classList. If arguments count is 0, than classList is cleared
         * @return {NodeList} refers to this
         */
        removeClass: function () {
            for (var i = 0; i < this.length; i++)
                this[i].removeClass.apply(this[i], Array.prototype.slice.call(arguments, 0));

            return this;
        }
    };

    var elementPropertiesObject = {};
    for (var methodName in HTMLExtendedElement) {
        elementPropertiesObject[methodName] = {
            value: HTMLExtendedElement[methodName]
        };
    }

    var listPropertiesObject = {};
    for (var methodName in NodeExtendedList) {
        listPropertiesObject[methodName] = {
            value: NodeExtendedList[methodName]
        };
    }

    /**
     * Shortened and more convenient "querySelector"
     * @return {HTMLElement|Null}
     * @throws {TypeError} if arguments are invalid
     *
     * @example
     * $(document.body) returns a document body itself
     * $("<div>smth</div>") returns a new div element with innerHTML property set to "smth"
     * $("div.wrapper p") returns the same as document.querySelector("div.wrapper p")
     * $(parentNode, "p") returns the same as parentNode.querySelector("p")
     */
    window.$ = function () {
        switch (arguments.length) {
            case 1:
                if (arguments[0] instanceof HTMLElement)
                    return arguments[0];

                if (typeof arguments[0] === "string") {
                    if (!/^<(.|[\r\n\t])+>$/.test(arguments[0]))
                        return document.querySelector(arguments[0]);

                    var tmpElem = document.createElement("div");
                    tmpElem.innerHTML = arguments[0];
                    return tmpElem.firstChild;
                }

                break;

            case 2:
                if (arguments[0] instanceof HTMLElement && typeof arguments[1] === "string")
                    return arguments[0].querySelector(arguments[1]);

                break;
        }

        throw new TypeError("Can't use these arguments");
    };

    /**
     * Shortened and more convenient "querySelectorAll"
     * @return {NodeList}
     * @throws {TypeError} if arguments are invalid
     *
     * @example
     * $$(nodeList) returns a nodeList itself
     * $$("div.wrapper p") returns the same as document.querySelectorAll("div.wrapper p")
     * $$(parentNode, "p") returns the same as parentNode.querySelectorAll("p")
     */
    window.$$ = function () {
        switch (arguments.length) {
            case 1:
                if (arguments[0] instanceof NodeList)
                    return arguments[0];

                if (typeof arguments[0] === "string")
                    return document.querySelectorAll(arguments[0]);

                break;

            case 2:
                if (arguments[0] instanceof HTMLElement && typeof arguments[1] === "string")
                    return arguments[0].querySelectorAll(arguments[1]);

                break;
        }

        throw new TypeError("Can't use these arguments");
    };

    HTMLElement.prototype.__proto__ = Object.create(Object.getPrototypeOf(HTMLElement.prototype), elementPropertiesObject);
    NodeList.prototype.__proto__ = Object.create(Object.getPrototypeOf(NodeList.prototype), listPropertiesObject);
})();
