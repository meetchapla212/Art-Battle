(function (ko$1, $$1) {
	'use strict';

	var ko$1__default = 'default' in ko$1 ? ko$1['default'] : ko$1;
	$$1 = $$1 && Object.prototype.hasOwnProperty.call($$1, 'default') ? $$1['default'] : $$1;

	var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var knockout_punches = createCommonjsModule(function (module) {
	/**
	 * @license Knockout.Punches
	 * Enhanced binding syntaxes for Knockout 3+
	 * (c) Michael Best
	 * License: MIT (http://www.opensource.org/licenses/mit-license.php)
	 * Version 0.5.1
	 */
	(function (factory) {
	    {
	        // CommonJS module
	        var ko = ko$1__default;
	        factory(ko);
	    }
	}(function(ko) {

	// Add a preprocess function to a binding handler.
	function addBindingPreprocessor(bindingKeyOrHandler, preprocessFn) {
	    return chainPreprocessor(getOrCreateHandler(bindingKeyOrHandler), 'preprocess', preprocessFn);
	}

	// These utility functions are separated out because they're also used by
	// preprocessBindingProperty

	// Get the binding handler or create a new, empty one
	function getOrCreateHandler(bindingKeyOrHandler) {
	    return typeof bindingKeyOrHandler === 'object' ? bindingKeyOrHandler :
	        (ko.getBindingHandler(bindingKeyOrHandler) || (ko.bindingHandlers[bindingKeyOrHandler] = {}));
	}
	// Add a preprocess function
	function chainPreprocessor(obj, prop, fn) {
	    if (obj[prop]) {
	        // If the handler already has a preprocess function, chain the new
	        // one after the existing one. If the previous function in the chain
	        // returns a falsy value (to remove the binding), the chain ends. This
	        // method allows each function to modify and return the binding value.
	        var previousFn = obj[prop];
	        obj[prop] = function(value, binding, addBinding) {
	            value = previousFn.call(this, value, binding, addBinding);
	            if (value)
	                return fn.call(this, value, binding, addBinding);
	        };
	    } else {
	        obj[prop] = fn;
	    }
	    return obj;
	}

	// Add a preprocessNode function to the binding provider. If a
	// function already exists, chain the new one after it. This calls
	// each function in the chain until one modifies the node. This
	// method allows only one function to modify the node.
	function addNodePreprocessor(preprocessFn) {
	    var provider = ko.bindingProvider.instance;
	    if (provider.preprocessNode) {
	        var previousPreprocessFn = provider.preprocessNode;
	        provider.preprocessNode = function(node) {
	            var newNodes = previousPreprocessFn.call(this, node);
	            if (!newNodes)
	                newNodes = preprocessFn.call(this, node);
	            return newNodes;
	        };
	    } else {
	        provider.preprocessNode = preprocessFn;
	    }
	}

	function addBindingHandlerCreator(matchRegex, callbackFn) {
	    var oldGetHandler = ko.getBindingHandler;
	    ko.getBindingHandler = function(bindingKey) {
	        var match;
	        return oldGetHandler(bindingKey) || ((match = bindingKey.match(matchRegex)) && callbackFn(match, bindingKey));
	    };
	}

	// Create shortcuts to commonly used ko functions
	var ko_unwrap = ko.unwrap;

	// Create "punches" object and export utility functions
	var ko_punches = ko.punches = {
	    utils: {
	        addBindingPreprocessor: addBindingPreprocessor,
	        addNodePreprocessor: addNodePreprocessor,
	        addBindingHandlerCreator: addBindingHandlerCreator,

	        // previous names retained for backwards compitibility
	        setBindingPreprocessor: addBindingPreprocessor,
	        setNodePreprocessor: addNodePreprocessor
	    }
	};

	ko_punches.enableAll = function () {
	    // Enable interpolation markup
	    enableInterpolationMarkup();
	    enableAttributeInterpolationMarkup();

	    // Enable auto-namspacing of attr, css, event, and style
	    enableAutoNamespacedSyntax('attr');
	    enableAutoNamespacedSyntax('css');
	    enableAutoNamespacedSyntax('event');
	    enableAutoNamespacedSyntax('style');

	    // Make sure that Knockout knows to bind checked after attr.value (see #40)
	    ko.bindingHandlers.checked.after.push('attr.value');

	    // Enable filter syntax for text, html, and attr
	    enableTextFilter('text');
	    enableTextFilter('html');
	    addDefaultNamespacedBindingPreprocessor('attr', filterPreprocessor);

	    // Enable wrapped callbacks for click, submit, event, optionsAfterRender, and template options
	    enableWrappedCallback('click');
	    enableWrappedCallback('submit');
	    enableWrappedCallback('optionsAfterRender');
	    addDefaultNamespacedBindingPreprocessor('event', wrappedCallbackPreprocessor);
	    addBindingPropertyPreprocessor('template', 'beforeRemove', wrappedCallbackPreprocessor);
	    addBindingPropertyPreprocessor('template', 'afterAdd', wrappedCallbackPreprocessor);
	    addBindingPropertyPreprocessor('template', 'afterRender', wrappedCallbackPreprocessor);
	};
	// Convert input in the form of `expression | filter1 | filter2:arg1:arg2` to a function call format
	// with filters accessed as ko.filters.filter1, etc.
	function filterPreprocessor(input) {
	    // Check if the input contains any | characters; if not, just return
	    if (input.indexOf('|') === -1)
	        return input;

	    // Split the input into tokens, in which | and : are individual tokens, quoted strings are ignored, and all tokens are space-trimmed
	    var tokens = input.match(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|\|\||[|:]|[^\s|:"'][^|:"']*[^\s|:"']|[^\s|:"']/g);
	    if (tokens && tokens.length > 1) {
	        // Append a line so that we don't need a separate code block to deal with the last item
	        tokens.push('|');
	        input = tokens[0];
	        var lastToken, token, inFilters = false, nextIsFilter = false;
	        for (var i = 1, token; token = tokens[i]; ++i) {
	            if (token === '|') {
	                if (inFilters) {
	                    if (lastToken === ':')
	                        input += "undefined";
	                    input += ')';
	                }
	                nextIsFilter = true;
	                inFilters = true;
	            } else {
	                if (nextIsFilter) {
	                    input = "ko.filters['" + token + "'](" + input;
	                } else if (inFilters && token === ':') {
	                    if (lastToken === ':')
	                        input += "undefined";
	                    input += ",";
	                } else {
	                    input += token;
	                }
	                nextIsFilter = false;
	            }
	            lastToken = token;
	        }
	    }
	    return input;
	}

	// Set the filter preprocessor for a specific binding
	function enableTextFilter(bindingKeyOrHandler) {
	    addBindingPreprocessor(bindingKeyOrHandler, filterPreprocessor);
	}

	var filters = {};

	// Convert value to uppercase
	filters.uppercase = function(value) {
	    return String.prototype.toUpperCase.call(ko_unwrap(value));
	};

	// Convert value to lowercase
	filters.lowercase = function(value) {
	    return String.prototype.toLowerCase.call(ko_unwrap(value));
	};

	// Return default value if the input value is empty or null
	filters['default'] = function (value, defaultValue) {
	    value = ko_unwrap(value);
	    if (typeof value === "function") {
	        return value;
	    }
	    if (typeof value === "string") {
	        return trim(value) === '' ? defaultValue : value;
	    }
	    return value == null || value.length == 0 ? defaultValue : value;
	};

	// Return the value with the search string replaced with the replacement string
	filters.replace = function(value, search, replace) {
	    return String.prototype.replace.call(ko_unwrap(value), search, replace);
	};

	filters.fit = function(value, length, replacement, trimWhere) {
	    value = ko_unwrap(value);
	    if (length && ('' + value).length > length) {
	        replacement = '' + (replacement || '...');
	        length = length - replacement.length;
	        value = '' + value;
	        switch (trimWhere) {
	            case 'left':
	                return replacement + value.slice(-length);
	            case 'middle':
	                var leftLen = Math.ceil(length / 2);
	                return value.substr(0, leftLen) + replacement + value.slice(leftLen-length);
	            default:
	                return value.substr(0, length) + replacement;
	        }
	    } else {
	        return value;
	    }
	};

	// Convert a model object to JSON
	filters.json = function(rootObject, space, replacer) {     // replacer and space are optional
	    return ko.toJSON(rootObject, replacer, space);
	};

	// Format a number using the browser's toLocaleString
	filters.number = function(value) {
	    return (+ko_unwrap(value)).toLocaleString();
	};

	// Export the filters object for general access
	ko.filters = filters;

	// Export the preprocessor functions
	ko_punches.textFilter = {
	    preprocessor: filterPreprocessor,
	    enableForBinding: enableTextFilter
	};
	// Support dynamically-created, namespaced bindings. The binding key syntax is
	// "namespace.binding". Within a certain namespace, we can dynamically create the
	// handler for any binding. This is particularly useful for bindings that work
	// the same way, but just set a different named value, such as for element
	// attributes or CSS classes.
	var namespacedBindingMatch = /([^\.]+)\.(.+)/, namespaceDivider = '.';
	addBindingHandlerCreator(namespacedBindingMatch, function (match, bindingKey) {
	    var namespace = match[1],
	        namespaceHandler = ko.bindingHandlers[namespace];
	    if (namespaceHandler) {
	        var bindingName = match[2],
	            handlerFn = namespaceHandler.getNamespacedHandler || defaultGetNamespacedHandler,
	            handler = handlerFn.call(namespaceHandler, bindingName, namespace, bindingKey);
	        ko.bindingHandlers[bindingKey] = handler;
	        return handler;
	    }
	});

	// Knockout's built-in bindings "attr", "event", "css" and "style" include the idea of
	// namespaces, representing it using a single binding that takes an object map of names
	// to values. This default handler translates a binding of "namespacedName: value"
	// to "namespace: {name: value}" to automatically support those built-in bindings.
	function defaultGetNamespacedHandler(name, namespace, namespacedName) {
	    var handler = ko.utils.extend({}, this);
	    function setHandlerFunction(funcName) {
	        if (handler[funcName]) {
	            handler[funcName] = function(element, valueAccessor) {
	                function subValueAccessor() {
	                    var result = {};
	                    result[name] = valueAccessor();
	                    return result;
	                }
	                var args = Array.prototype.slice.call(arguments, 0);
	                args[1] = subValueAccessor;
	                return ko.bindingHandlers[namespace][funcName].apply(this, args);
	            };
	        }
	    }
	    // Set new init and update functions that wrap the originals
	    setHandlerFunction('init');
	    setHandlerFunction('update');
	    // Clear any preprocess function since preprocessing of the new binding would need to be different
	    if (handler.preprocess)
	        handler.preprocess = null;
	    if (ko.virtualElements.allowedBindings[namespace])
	        ko.virtualElements.allowedBindings[namespacedName] = true;
	    return handler;
	}

	// Adds a preprocess function for every generated namespace.x binding. This can
	// be called multiple times for the same binding, and the preprocess functions will
	// be chained. If the binding has a custom getNamespacedHandler method, make sure that
	// it's set before this function is used.
	function addDefaultNamespacedBindingPreprocessor(namespace, preprocessFn) {
	    var handler = ko.getBindingHandler(namespace);
	    if (handler) {
	        var previousHandlerFn = handler.getNamespacedHandler || defaultGetNamespacedHandler;
	        handler.getNamespacedHandler = function() {
	            return addBindingPreprocessor(previousHandlerFn.apply(this, arguments), preprocessFn);
	        };
	    }
	}

	function autoNamespacedPreprocessor(value, binding, addBinding) {
	    if (value.charAt(0) !== "{")
	        return value;

	    // Handle two-level binding specified as "binding: {key: value}" by parsing inner
	    // object and converting to "binding.key: value"
	    var subBindings = ko.expressionRewriting.parseObjectLiteral(value);
	    ko.utils.arrayForEach(subBindings, function(keyValue) {
	        addBinding(binding + namespaceDivider + keyValue.key, keyValue.value);
	    });
	}

	// Set the namespaced preprocessor for a specific binding
	function enableAutoNamespacedSyntax(bindingKeyOrHandler) {
	    addBindingPreprocessor(bindingKeyOrHandler, autoNamespacedPreprocessor);
	}

	// Export the preprocessor functions
	ko_punches.namespacedBinding = {
	    defaultGetHandler: defaultGetNamespacedHandler,
	    setDefaultBindingPreprocessor: addDefaultNamespacedBindingPreprocessor,    // for backwards compat.
	    addDefaultBindingPreprocessor: addDefaultNamespacedBindingPreprocessor,
	    preprocessor: autoNamespacedPreprocessor,
	    enableForBinding: enableAutoNamespacedSyntax
	};
	// Wrap a callback function in an anonymous function so that it is called with the appropriate
	// "this" value.
	function wrappedCallbackPreprocessor(val) {
	    // Matches either an isolated identifier or something ending with a property accessor
	    if (/^([$_a-z][$\w]*|.+(\.\s*[$_a-z][$\w]*|\[.+\]))$/i.test(val)) {
	        return 'function(_x,_y,_z){return(' + val + ')(_x,_y,_z);}';
	    } else {
	        return val;
	    }
	}

	// Set the wrappedCallback preprocessor for a specific binding
	function enableWrappedCallback(bindingKeyOrHandler) {
	    addBindingPreprocessor(bindingKeyOrHandler, wrappedCallbackPreprocessor);
	}

	// Export the preprocessor functions
	ko_punches.wrappedCallback = {
	    preprocessor: wrappedCallbackPreprocessor,
	    enableForBinding: enableWrappedCallback
	};
	// Attach a preprocess function to a specific property of a binding. This allows you to
	// preprocess binding "options" using the same preprocess functions that work for bindings.
	function addBindingPropertyPreprocessor(bindingKeyOrHandler, property, preprocessFn) {
	    var handler = getOrCreateHandler(bindingKeyOrHandler);
	    if (!handler._propertyPreprocessors) {
	        // Initialize the binding preprocessor
	        chainPreprocessor(handler, 'preprocess', propertyPreprocessor);
	        handler._propertyPreprocessors = {};
	    }
	    // Add the property preprocess function
	    chainPreprocessor(handler._propertyPreprocessors, property, preprocessFn);
	}

	// In order to preprocess a binding property, we have to preprocess the binding itself.
	// This preprocess function splits up the binding value and runs each property's preprocess
	// function if it's set.
	function propertyPreprocessor(value, binding, addBinding) {
	    if (value.charAt(0) !== "{")
	        return value;

	    var subBindings = ko.expressionRewriting.parseObjectLiteral(value),
	        resultStrings = [],
	        propertyPreprocessors = this._propertyPreprocessors || {};
	    ko.utils.arrayForEach(subBindings, function(keyValue) {
	        var prop = keyValue.key, propVal = keyValue.value;
	        if (propertyPreprocessors[prop]) {
	            propVal = propertyPreprocessors[prop](propVal, prop, addBinding);
	        }
	        if (propVal) {
	            resultStrings.push("'" + prop + "':" + propVal);
	        }
	    });
	    return "{" + resultStrings.join(",") + "}";
	}

	// Export the preprocessor functions
	ko_punches.preprocessBindingProperty = {
	    setPreprocessor: addBindingPropertyPreprocessor,     // for backwards compat.
	    addPreprocessor: addBindingPropertyPreprocessor
	};
	// Wrap an expression in an anonymous function so that it is called when the event happens
	function makeExpressionCallbackPreprocessor(args) {
	    return function expressionCallbackPreprocessor(val) {
	        return 'function('+args+'){return(' + val + ');}';
	    };
	}

	var eventExpressionPreprocessor = makeExpressionCallbackPreprocessor("$data,$event");

	// Set the expressionCallback preprocessor for a specific binding
	function enableExpressionCallback(bindingKeyOrHandler, args) {
	    var args = Array.prototype.slice.call(arguments, 1).join();
	    addBindingPreprocessor(bindingKeyOrHandler, makeExpressionCallbackPreprocessor(args));
	}

	// Export the preprocessor functions
	ko_punches.expressionCallback = {
	    makePreprocessor: makeExpressionCallbackPreprocessor,
	    eventPreprocessor: eventExpressionPreprocessor,
	    enableForBinding: enableExpressionCallback
	};

	// Create an "on" namespace for events to use the expression method
	ko.bindingHandlers.on = {
	    getNamespacedHandler: function(eventName) {
	        var handler = ko.getBindingHandler('event' + namespaceDivider + eventName);
	        return addBindingPreprocessor(handler, eventExpressionPreprocessor);
	    }
	};
	// Performance comparison at http://jsperf.com/markup-interpolation-comparison
	function parseInterpolationMarkup(textToParse, outerTextCallback, expressionCallback) {
	    function innerParse(text) {
	        var innerMatch = text.match(/^([\s\S]*)}}([\s\S]*?)\{\{([\s\S]*)$/);
	        if (innerMatch) {
	            innerParse(innerMatch[1]);
	            outerTextCallback(innerMatch[2]);
	            expressionCallback(innerMatch[3]);
	        } else {
	            expressionCallback(text);
	        }
	    }
	    var outerMatch = textToParse.match(/^([\s\S]*?)\{\{([\s\S]*)}}([\s\S]*)$/);
	    if (outerMatch) {
	        outerTextCallback(outerMatch[1]);
	        innerParse(outerMatch[2]);
	        outerTextCallback(outerMatch[3]);
	    }
	}

	function trim(string) {
	    return string == null ? '' :
	        string.trim ?
	            string.trim() :
	            string.toString().replace(/^[\s\xa0]+|[\s\xa0]+$/g, '');
	}

	function interpolationMarkupPreprocessor(node) {
	    // only needs to work with text nodes
	    if (node.nodeType === 3 && node.nodeValue && node.nodeValue.indexOf('{{') !== -1 && (node.parentNode || {}).nodeName != "TEXTAREA") {
	        var nodes = [];
	        function addTextNode(text) {
	            if (text)
	                nodes.push(document.createTextNode(text));
	        }
	        function wrapExpr(expressionText) {
	            if (expressionText)
	                nodes.push.apply(nodes, ko_punches_interpolationMarkup.wrapExpression(expressionText, node));
	        }
	        parseInterpolationMarkup(node.nodeValue, addTextNode, wrapExpr);

	        if (nodes.length) {
	            if (node.parentNode) {
	                for (var i = 0, n = nodes.length, parent = node.parentNode; i < n; ++i) {
	                    parent.insertBefore(nodes[i], node);
	                }
	                parent.removeChild(node);
	            }
	            return nodes;
	        }
	    }
	}

	if (!ko.virtualElements.allowedBindings.html) {
	    // Virtual html binding
	    // SO Question: http://stackoverflow.com/a/15348139
	    var overridden = ko.bindingHandlers.html.update;
	    ko.bindingHandlers.html.update = function (element, valueAccessor) {
	        if (element.nodeType === 8) {
	            var html = ko_unwrap(valueAccessor());
	            if (html != null) {
	                var parsedNodes = ko.utils.parseHtmlFragment('' + html);
	                ko.virtualElements.setDomNodeChildren(element, parsedNodes);
	            } else {
	                ko.virtualElements.emptyNode(element);
	            }
	        } else {
	            overridden(element, valueAccessor);
	        }
	    };
	    ko.virtualElements.allowedBindings.html = true;
	}

	function wrapExpression(expressionText, node) {
	    var ownerDocument = node ? node.ownerDocument : document,
	        closeComment = true,
	        binding,
	        expressionText = trim(expressionText),
	        firstChar = expressionText[0],
	        lastChar = expressionText[expressionText.length - 1],
	        result = [],
	        matches;

	    if (firstChar === '#') {
	        if (lastChar === '/') {
	            binding = expressionText.slice(1, -1);
	        } else {
	            binding = expressionText.slice(1);
	            closeComment = false;
	        }
	        if (matches = binding.match(/^([^,"'{}()\/:[\]\s]+)\s+([^\s:].*)/)) {
	            binding = matches[1] + ':' + matches[2];
	        }
	    } else if (firstChar === '/') ; else if (firstChar === '{' && lastChar === '}') {
	        binding = "html:" + trim(expressionText.slice(1, -1));
	    } else {
	        binding = "text:" + trim(expressionText);
	    }

	    if (binding)
	        result.push(ownerDocument.createComment("ko " + binding));
	    if (closeComment)
	        result.push(ownerDocument.createComment("/ko"));
	    return result;
	}
	function enableInterpolationMarkup() {
	    addNodePreprocessor(interpolationMarkupPreprocessor);
	}

	// Export the preprocessor functions
	var ko_punches_interpolationMarkup = ko_punches.interpolationMarkup = {
	    preprocessor: interpolationMarkupPreprocessor,
	    enable: enableInterpolationMarkup,
	    wrapExpression: wrapExpression
	};


	var dataBind = 'data-bind';
	function attributeInterpolationMarkerPreprocessor(node) {
	    if (node.nodeType === 1 && node.attributes.length) {
	        var dataBindAttribute = node.getAttribute(dataBind);
	        for (var attrs = ko.utils.arrayPushAll([], node.attributes), n = attrs.length, i = 0; i < n; ++i) {
	            var attr = attrs[i];
	            if (attr.specified && attr.name != dataBind && attr.value.indexOf('{{') !== -1) {
	                var parts = [], attrValue = '';
	                function addText(text) {
	                    if (text)
	                        parts.push('"' + text.replace(/"/g, '\\"') + '"');
	                }
	                function addExpr(expressionText) {
	                    if (expressionText) {
	                        attrValue = expressionText;
	                        parts.push('ko.unwrap(' + expressionText + ')');
	                    }
	                }
	                parseInterpolationMarkup(attr.value, addText, addExpr);

	                if (parts.length > 1) {
	                    attrValue = '""+' + parts.join('+');
	                }

	                if (attrValue) {
	                    var attrName = attr.name.toLowerCase();
	                    var attrBinding = ko_punches_attributeInterpolationMarkup.attributeBinding(attrName, attrValue, node) || attributeBinding(attrName, attrValue);
	                    if (!dataBindAttribute) {
	                        dataBindAttribute = attrBinding;
	                    } else {
	                        dataBindAttribute += ',' + attrBinding;
	                    }
	                    node.setAttribute(dataBind, dataBindAttribute);
	                    // Using removeAttribute instead of removeAttributeNode because IE clears the
	                    // class if you use removeAttributeNode to remove the id.
	                    node.removeAttribute(attr.name);
	                }
	            }
	        }
	    }
	}

	function attributeBinding(name, value, node) {
	    if (ko.getBindingHandler(name)) {
	        return name + ':' + value;
	    } else {
	        return 'attr.' + name + ':' + value;
	    }
	}

	function enableAttributeInterpolationMarkup() {
	    addNodePreprocessor(attributeInterpolationMarkerPreprocessor);
	}

	var ko_punches_attributeInterpolationMarkup = ko_punches.attributeInterpolationMarkup = {
	    preprocessor: attributeInterpolationMarkerPreprocessor,
	    enable: enableAttributeInterpolationMarkup,
	    attributeBinding: attributeBinding
	};

	    return ko_punches;
	}));
	});

	/**
	 * Checks if `value` is the
	 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
	 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(_.noop);
	 * // => true
	 *
	 * _.isObject(null);
	 * // => false
	 */
	function isObject(value) {
	  var type = typeof value;
	  return value != null && (type == 'object' || type == 'function');
	}

	var isObject_1 = isObject;

	/** Detect free variable `global` from Node.js. */
	var freeGlobal = typeof commonjsGlobal == 'object' && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;

	var _freeGlobal = freeGlobal;

	/** Detect free variable `self`. */
	var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

	/** Used as a reference to the global object. */
	var root = _freeGlobal || freeSelf || Function('return this')();

	var _root = root;

	/**
	 * Gets the timestamp of the number of milliseconds that have elapsed since
	 * the Unix epoch (1 January 1970 00:00:00 UTC).
	 *
	 * @static
	 * @memberOf _
	 * @since 2.4.0
	 * @category Date
	 * @returns {number} Returns the timestamp.
	 * @example
	 *
	 * _.defer(function(stamp) {
	 *   console.log(_.now() - stamp);
	 * }, _.now());
	 * // => Logs the number of milliseconds it took for the deferred invocation.
	 */
	var now = function() {
	  return _root.Date.now();
	};

	var now_1 = now;

	/** Used to match a single whitespace character. */
	var reWhitespace = /\s/;

	/**
	 * Used by `_.trim` and `_.trimEnd` to get the index of the last non-whitespace
	 * character of `string`.
	 *
	 * @private
	 * @param {string} string The string to inspect.
	 * @returns {number} Returns the index of the last non-whitespace character.
	 */
	function trimmedEndIndex(string) {
	  var index = string.length;

	  while (index-- && reWhitespace.test(string.charAt(index))) {}
	  return index;
	}

	var _trimmedEndIndex = trimmedEndIndex;

	/** Used to match leading whitespace. */
	var reTrimStart = /^\s+/;

	/**
	 * The base implementation of `_.trim`.
	 *
	 * @private
	 * @param {string} string The string to trim.
	 * @returns {string} Returns the trimmed string.
	 */
	function baseTrim(string) {
	  return string
	    ? string.slice(0, _trimmedEndIndex(string) + 1).replace(reTrimStart, '')
	    : string;
	}

	var _baseTrim = baseTrim;

	/** Built-in value references. */
	var Symbol$1 = _root.Symbol;

	var _Symbol = Symbol$1;

	/** Used for built-in method references. */
	var objectProto = Object.prototype;

	/** Used to check objects for own properties. */
	var hasOwnProperty = objectProto.hasOwnProperty;

	/**
	 * Used to resolve the
	 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var nativeObjectToString = objectProto.toString;

	/** Built-in value references. */
	var symToStringTag = _Symbol ? _Symbol.toStringTag : undefined;

	/**
	 * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
	 *
	 * @private
	 * @param {*} value The value to query.
	 * @returns {string} Returns the raw `toStringTag`.
	 */
	function getRawTag(value) {
	  var isOwn = hasOwnProperty.call(value, symToStringTag),
	      tag = value[symToStringTag];

	  try {
	    value[symToStringTag] = undefined;
	    var unmasked = true;
	  } catch (e) {}

	  var result = nativeObjectToString.call(value);
	  if (unmasked) {
	    if (isOwn) {
	      value[symToStringTag] = tag;
	    } else {
	      delete value[symToStringTag];
	    }
	  }
	  return result;
	}

	var _getRawTag = getRawTag;

	/** Used for built-in method references. */
	var objectProto$1 = Object.prototype;

	/**
	 * Used to resolve the
	 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
	 * of values.
	 */
	var nativeObjectToString$1 = objectProto$1.toString;

	/**
	 * Converts `value` to a string using `Object.prototype.toString`.
	 *
	 * @private
	 * @param {*} value The value to convert.
	 * @returns {string} Returns the converted string.
	 */
	function objectToString(value) {
	  return nativeObjectToString$1.call(value);
	}

	var _objectToString = objectToString;

	/** `Object#toString` result references. */
	var nullTag = '[object Null]',
	    undefinedTag = '[object Undefined]';

	/** Built-in value references. */
	var symToStringTag$1 = _Symbol ? _Symbol.toStringTag : undefined;

	/**
	 * The base implementation of `getTag` without fallbacks for buggy environments.
	 *
	 * @private
	 * @param {*} value The value to query.
	 * @returns {string} Returns the `toStringTag`.
	 */
	function baseGetTag(value) {
	  if (value == null) {
	    return value === undefined ? undefinedTag : nullTag;
	  }
	  return (symToStringTag$1 && symToStringTag$1 in Object(value))
	    ? _getRawTag(value)
	    : _objectToString(value);
	}

	var _baseGetTag = baseGetTag;

	/**
	 * Checks if `value` is object-like. A value is object-like if it's not `null`
	 * and has a `typeof` result of "object".
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	 * @example
	 *
	 * _.isObjectLike({});
	 * // => true
	 *
	 * _.isObjectLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isObjectLike(_.noop);
	 * // => false
	 *
	 * _.isObjectLike(null);
	 * // => false
	 */
	function isObjectLike(value) {
	  return value != null && typeof value == 'object';
	}

	var isObjectLike_1 = isObjectLike;

	/** `Object#toString` result references. */
	var symbolTag = '[object Symbol]';

	/**
	 * Checks if `value` is classified as a `Symbol` primitive or object.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
	 * @example
	 *
	 * _.isSymbol(Symbol.iterator);
	 * // => true
	 *
	 * _.isSymbol('abc');
	 * // => false
	 */
	function isSymbol(value) {
	  return typeof value == 'symbol' ||
	    (isObjectLike_1(value) && _baseGetTag(value) == symbolTag);
	}

	var isSymbol_1 = isSymbol;

	/** Used as references for various `Number` constants. */
	var NAN = 0 / 0;

	/** Used to detect bad signed hexadecimal string values. */
	var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

	/** Used to detect binary string values. */
	var reIsBinary = /^0b[01]+$/i;

	/** Used to detect octal string values. */
	var reIsOctal = /^0o[0-7]+$/i;

	/** Built-in method references without a dependency on `root`. */
	var freeParseInt = parseInt;

	/**
	 * Converts `value` to a number.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to process.
	 * @returns {number} Returns the number.
	 * @example
	 *
	 * _.toNumber(3.2);
	 * // => 3.2
	 *
	 * _.toNumber(Number.MIN_VALUE);
	 * // => 5e-324
	 *
	 * _.toNumber(Infinity);
	 * // => Infinity
	 *
	 * _.toNumber('3.2');
	 * // => 3.2
	 */
	function toNumber(value) {
	  if (typeof value == 'number') {
	    return value;
	  }
	  if (isSymbol_1(value)) {
	    return NAN;
	  }
	  if (isObject_1(value)) {
	    var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
	    value = isObject_1(other) ? (other + '') : other;
	  }
	  if (typeof value != 'string') {
	    return value === 0 ? value : +value;
	  }
	  value = _baseTrim(value);
	  var isBinary = reIsBinary.test(value);
	  return (isBinary || reIsOctal.test(value))
	    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
	    : (reIsBadHex.test(value) ? NAN : +value);
	}

	var toNumber_1 = toNumber;

	/** Error message constants. */
	var FUNC_ERROR_TEXT = 'Expected a function';

	/* Built-in method references for those with the same name as other `lodash` methods. */
	var nativeMax = Math.max,
	    nativeMin = Math.min;

	/**
	 * Creates a debounced function that delays invoking `func` until after `wait`
	 * milliseconds have elapsed since the last time the debounced function was
	 * invoked. The debounced function comes with a `cancel` method to cancel
	 * delayed `func` invocations and a `flush` method to immediately invoke them.
	 * Provide `options` to indicate whether `func` should be invoked on the
	 * leading and/or trailing edge of the `wait` timeout. The `func` is invoked
	 * with the last arguments provided to the debounced function. Subsequent
	 * calls to the debounced function return the result of the last `func`
	 * invocation.
	 *
	 * **Note:** If `leading` and `trailing` options are `true`, `func` is
	 * invoked on the trailing edge of the timeout only if the debounced function
	 * is invoked more than once during the `wait` timeout.
	 *
	 * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
	 * until to the next tick, similar to `setTimeout` with a timeout of `0`.
	 *
	 * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
	 * for details over the differences between `_.debounce` and `_.throttle`.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Function
	 * @param {Function} func The function to debounce.
	 * @param {number} [wait=0] The number of milliseconds to delay.
	 * @param {Object} [options={}] The options object.
	 * @param {boolean} [options.leading=false]
	 *  Specify invoking on the leading edge of the timeout.
	 * @param {number} [options.maxWait]
	 *  The maximum time `func` is allowed to be delayed before it's invoked.
	 * @param {boolean} [options.trailing=true]
	 *  Specify invoking on the trailing edge of the timeout.
	 * @returns {Function} Returns the new debounced function.
	 * @example
	 *
	 * // Avoid costly calculations while the window size is in flux.
	 * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
	 *
	 * // Invoke `sendMail` when clicked, debouncing subsequent calls.
	 * jQuery(element).on('click', _.debounce(sendMail, 300, {
	 *   'leading': true,
	 *   'trailing': false
	 * }));
	 *
	 * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
	 * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
	 * var source = new EventSource('/stream');
	 * jQuery(source).on('message', debounced);
	 *
	 * // Cancel the trailing debounced invocation.
	 * jQuery(window).on('popstate', debounced.cancel);
	 */
	function debounce(func, wait, options) {
	  var lastArgs,
	      lastThis,
	      maxWait,
	      result,
	      timerId,
	      lastCallTime,
	      lastInvokeTime = 0,
	      leading = false,
	      maxing = false,
	      trailing = true;

	  if (typeof func != 'function') {
	    throw new TypeError(FUNC_ERROR_TEXT);
	  }
	  wait = toNumber_1(wait) || 0;
	  if (isObject_1(options)) {
	    leading = !!options.leading;
	    maxing = 'maxWait' in options;
	    maxWait = maxing ? nativeMax(toNumber_1(options.maxWait) || 0, wait) : maxWait;
	    trailing = 'trailing' in options ? !!options.trailing : trailing;
	  }

	  function invokeFunc(time) {
	    var args = lastArgs,
	        thisArg = lastThis;

	    lastArgs = lastThis = undefined;
	    lastInvokeTime = time;
	    result = func.apply(thisArg, args);
	    return result;
	  }

	  function leadingEdge(time) {
	    // Reset any `maxWait` timer.
	    lastInvokeTime = time;
	    // Start the timer for the trailing edge.
	    timerId = setTimeout(timerExpired, wait);
	    // Invoke the leading edge.
	    return leading ? invokeFunc(time) : result;
	  }

	  function remainingWait(time) {
	    var timeSinceLastCall = time - lastCallTime,
	        timeSinceLastInvoke = time - lastInvokeTime,
	        timeWaiting = wait - timeSinceLastCall;

	    return maxing
	      ? nativeMin(timeWaiting, maxWait - timeSinceLastInvoke)
	      : timeWaiting;
	  }

	  function shouldInvoke(time) {
	    var timeSinceLastCall = time - lastCallTime,
	        timeSinceLastInvoke = time - lastInvokeTime;

	    // Either this is the first call, activity has stopped and we're at the
	    // trailing edge, the system time has gone backwards and we're treating
	    // it as the trailing edge, or we've hit the `maxWait` limit.
	    return (lastCallTime === undefined || (timeSinceLastCall >= wait) ||
	      (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
	  }

	  function timerExpired() {
	    var time = now_1();
	    if (shouldInvoke(time)) {
	      return trailingEdge(time);
	    }
	    // Restart the timer.
	    timerId = setTimeout(timerExpired, remainingWait(time));
	  }

	  function trailingEdge(time) {
	    timerId = undefined;

	    // Only invoke if we have `lastArgs` which means `func` has been
	    // debounced at least once.
	    if (trailing && lastArgs) {
	      return invokeFunc(time);
	    }
	    lastArgs = lastThis = undefined;
	    return result;
	  }

	  function cancel() {
	    if (timerId !== undefined) {
	      clearTimeout(timerId);
	    }
	    lastInvokeTime = 0;
	    lastArgs = lastCallTime = lastThis = timerId = undefined;
	  }

	  function flush() {
	    return timerId === undefined ? result : trailingEdge(now_1());
	  }

	  function debounced() {
	    var time = now_1(),
	        isInvoking = shouldInvoke(time);

	    lastArgs = arguments;
	    lastThis = this;
	    lastCallTime = time;

	    if (isInvoking) {
	      if (timerId === undefined) {
	        return leadingEdge(lastCallTime);
	      }
	      if (maxing) {
	        // Handle invocations in a tight loop.
	        clearTimeout(timerId);
	        timerId = setTimeout(timerExpired, wait);
	        return invokeFunc(lastCallTime);
	      }
	    }
	    if (timerId === undefined) {
	      timerId = setTimeout(timerExpired, wait);
	    }
	    return result;
	  }
	  debounced.cancel = cancel;
	  debounced.flush = flush;
	  return debounced;
	}

	var debounce_1 = debounce;

	/** Error message constants. */
	var FUNC_ERROR_TEXT$1 = 'Expected a function';

	/**
	 * Creates a throttled function that only invokes `func` at most once per
	 * every `wait` milliseconds. The throttled function comes with a `cancel`
	 * method to cancel delayed `func` invocations and a `flush` method to
	 * immediately invoke them. Provide `options` to indicate whether `func`
	 * should be invoked on the leading and/or trailing edge of the `wait`
	 * timeout. The `func` is invoked with the last arguments provided to the
	 * throttled function. Subsequent calls to the throttled function return the
	 * result of the last `func` invocation.
	 *
	 * **Note:** If `leading` and `trailing` options are `true`, `func` is
	 * invoked on the trailing edge of the timeout only if the throttled function
	 * is invoked more than once during the `wait` timeout.
	 *
	 * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
	 * until to the next tick, similar to `setTimeout` with a timeout of `0`.
	 *
	 * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
	 * for details over the differences between `_.throttle` and `_.debounce`.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Function
	 * @param {Function} func The function to throttle.
	 * @param {number} [wait=0] The number of milliseconds to throttle invocations to.
	 * @param {Object} [options={}] The options object.
	 * @param {boolean} [options.leading=true]
	 *  Specify invoking on the leading edge of the timeout.
	 * @param {boolean} [options.trailing=true]
	 *  Specify invoking on the trailing edge of the timeout.
	 * @returns {Function} Returns the new throttled function.
	 * @example
	 *
	 * // Avoid excessively updating the position while scrolling.
	 * jQuery(window).on('scroll', _.throttle(updatePosition, 100));
	 *
	 * // Invoke `renewToken` when the click event is fired, but not more than once every 5 minutes.
	 * var throttled = _.throttle(renewToken, 300000, { 'trailing': false });
	 * jQuery(element).on('click', throttled);
	 *
	 * // Cancel the trailing throttled invocation.
	 * jQuery(window).on('popstate', throttled.cancel);
	 */
	function throttle(func, wait, options) {
	  var leading = true,
	      trailing = true;

	  if (typeof func != 'function') {
	    throw new TypeError(FUNC_ERROR_TEXT$1);
	  }
	  if (isObject_1(options)) {
	    leading = 'leading' in options ? !!options.leading : leading;
	    trailing = 'trailing' in options ? !!options.trailing : trailing;
	  }
	  return debounce_1(func, wait, {
	    'leading': leading,
	    'maxWait': wait,
	    'trailing': trailing
	  });
	}

	var throttle_1 = throttle;

	var infiniteScrollBindingHandler = {
	    init: function init(el, valueAccessor, allBindings, viewModel, bindingContext) {
	        var opts = valueAccessor();

	        var _ref = typeof opts === 'function' ? { offset: 1500, handler: opts } : opts,
	            handler = _ref.handler,
	            offset = _ref.offset;

	        var $el = $(el);
	        var $window = $(window);
	        var prevScrolledDist = 0;
	        var handleScroll = throttle_1(function (e) {
	            var windowScrollTop = $window.scrollTop();
	            var windowHeight = $window.height();
	            if (typeof windowScrollTop === 'undefined' || typeof windowHeight === 'undefined') {
	                throw new Error('[knockout-contrib/bindings.infiniteScroll]: Error calculating window scrolled distance');
	            }
	            var scrolledDist = windowScrollTop + windowHeight;
	            if (scrolledDist < prevScrolledDist) {
	                prevScrolledDist = scrolledDist;
	                return;
	            }
	            prevScrolledDist = scrolledDist;
	            var elOffset = $el.offset();
	            var elHeight = $el.outerHeight();
	            if (typeof elOffset === 'undefined' || typeof elHeight === 'undefined') {
	                throw new Error('[knockout-contrib/bindings.infiniteScroll]: Error calculating element trigger point');
	            }
	            var triggerPoint = elOffset.top - elHeight - offset;
	            if (scrolledDist < triggerPoint) return;
	            var promise = handler.call(bindingContext.$data);
	            disarmTrigger();
	            if (promise && typeof promise.then === 'function') {
	                promise.then(armTrigger).catch(function (err) {
	                    throw err;
	                });
	            } else {
	                requestAnimationFrame(armTrigger);
	            }
	        }, 300);
	        function armTrigger() {
	            document.addEventListener('scroll', handleScroll);
	        }
	        function disarmTrigger() {
	            document.removeEventListener('scroll', handleScroll);
	        }
	        armTrigger();
	        ko$1.utils.domNodeDisposal.addDisposeCallback(el, disarmTrigger);
	    }
	};

	/*! *****************************************************************************
	Copyright (c) Microsoft Corporation.

	Permission to use, copy, modify, and/or distribute this software for any
	purpose with or without fee is hereby granted.

	THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
	REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
	AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
	INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
	LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
	OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
	PERFORMANCE OF THIS SOFTWARE.
	***************************************************************************** */

	function __awaiter(thisArg, _arguments, P, generator) {
	    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
	    return new (P || (P = Promise))(function (resolve, reject) {
	        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
	        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
	        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
	        step((generator = generator.apply(thisArg, _arguments || [])).next());
	    });
	}

	function __generator(thisArg, body) {
	    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
	    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
	    function verb(n) { return function (v) { return step([n, v]); }; }
	    function step(op) {
	        if (f) throw new TypeError("Generator is already executing.");
	        while (_) try {
	            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
	            if (y = 0, t) op = [op[0] & 2, t.value];
	            switch (op[0]) {
	                case 0: case 1: t = op; break;
	                case 4: _.label++; return { value: op[1], done: false };
	                case 5: _.label++; y = op[1]; op = [0]; continue;
	                case 7: op = _.ops.pop(); _.trys.pop(); continue;
	                default:
	                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
	                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
	                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
	                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
	                    if (t[2]) _.ops.pop();
	                    _.trys.pop(); continue;
	            }
	            op = body.call(thisArg, _);
	        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
	        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
	    }
	}

	// export function MakeRequestGeneric<T>(url: string, method: 'GET' | 'PUT' | 'POST' | 'DELETE', data?: Object): JQueryPromise<T> {
	//     options.dataType = 'json';
	//     options.contentType = 'application/json';
	//     options.type = method;
	//     XMLHttpRequest; xhr = new XMLHttpRequest();
	//     return request;
	// }
	function Request(url, method, data, progressCb, token) {
	    return __awaiter(this, void 0, Promise, function () {
	        return __generator(this, function (_a) {
	            return [2 /*return*/, new Promise(function (resolve, reject) {
	                    var xhr = new XMLHttpRequest();
	                    xhr.addEventListener('progress', function (evt) {
	                        if (evt.lengthComputable) {
	                            var percentComplete = evt.loaded / evt.total;
	                            if (progressCb instanceof Function) {
	                                progressCb(percentComplete);
	                            }
	                        }
	                    }, false);
	                    xhr.onreadystatechange = function (event) {
	                        if (xhr.readyState !== 4)
	                            return;
	                        if (xhr.status >= 200 && xhr.status < 300) {
	                            resolve(JSON.parse(xhr.response)); // OK
	                        }
	                        else {
	                            // Error
	                            try {
	                                reject(JSON.parse(xhr.response));
	                            }
	                            catch (e) {
	                                reject({
	                                    message: xhr.statusText + xhr.response,
	                                    status: xhr.status,
	                                    code: 'internal_err'
	                                });
	                            }
	                        }
	                    };
	                    xhr.open(method, url, true); // Async
	                    xhr.setRequestHeader('Content-Type', 'application/json');
	                    if (token && token.length > 0) {
	                        xhr.setRequestHeader('Authorization', "Bearer " + token);
	                    }
	                    data ? xhr.send(JSON.stringify(data)) : xhr.send();
	                })];
	        });
	    });
	}

	var Contestant = /** @class */ (function () {
	    /*
	    public ChildContestants: ContestantDTO[];
	    public City: CityDTO;
	    public CityText: string;
	    public Email: string;
	    public IsDuplicate: boolean;
	    public PhoneNumber: string;
	    public Website: string;
	     */
	    function Contestant(dto, readonly) {
	        this.Name = ko$1.observable('');
	        this.ReadOnly = ko$1.observable();
	        this.EntryId = ko$1.observable();
	        this.SelectedContestant = ko$1.observable();
	        this.RoundContestants = ko$1.observableArray();
	        this._id = dto._id;
	        this.ReadOnly(readonly);
	        this.Name(dto.Name);
	        this.EntryId(dto.EntryId);
	        /*this.ChildContestants = dto.ChildContestants;
	        this.City = dto.City;
	        this.CityText = dto.CityText;
	        this.Email = dto.Email;
	        this.IsDuplicate = dto.IsDuplicate;
	        this.PhoneNumber = dto.PhoneNumber;
	        this.Website = dto.Website;*/
	    }
	    Contestant.prototype.SetSelected = function (dto) {
	        if (dto && dto.contestant) {
	            this.Name(dto.contestant.Name);
	            if (this._id !== dto.contestant._id) {
	                this.oldId = this._id;
	                this._id = dto.contestant._id;
	                for (var i = 0; i < this.RoundContestants().length; i++) {
	                    this.RoundContestants()[i].Disabled(false);
	                }
	            }
	            this.ReadOnly(true);
	            this.EntryId(dto.contestant.EntryId);
	        }
	    };
	    Contestant.prototype.ToDTO = function () {
	        return {
	            ChildContestants: [],
	            City: undefined,
	            CityText: '',
	            Email: '',
	            IsDuplicate: false,
	            PhoneNumber: '',
	            Website: '',
	            EntryId: this.EntryId(),
	            Name: this.Name(),
	            _id: this._id,
	            oldId: this.oldId,
	        };
	    };
	    Contestant.prototype.Edit = function () {
	        this.ReadOnly(false);
	    };
	    Contestant.prototype.RegisterRoundContestantObj = function (roundContestant) {
	        this.RoundContestants().push(roundContestant);
	    };
	    return Contestant;
	}());

	function createCommonjsModule$1(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var byteLength_1 = byteLength;
	var toByteArray_1 = toByteArray;
	var fromByteArray_1 = fromByteArray;
	var lookup = [];
	var revLookup = [];
	var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
	var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

	for (var i = 0, len = code.length; i < len; ++i) {
	  lookup[i] = code[i];
	  revLookup[code.charCodeAt(i)] = i;
	} // Support decoding URL-safe base64 strings, as Node.js does.
	// See: https://en.wikipedia.org/wiki/Base64#URL_applications


	revLookup['-'.charCodeAt(0)] = 62;
	revLookup['_'.charCodeAt(0)] = 63;

	function getLens(b64) {
	  var len = b64.length;

	  if (len % 4 > 0) {
	    throw new Error('Invalid string. Length must be a multiple of 4');
	  } // Trim off extra bytes after placeholder bytes are found
	  // See: https://github.com/beatgammit/base64-js/issues/42


	  var validLen = b64.indexOf('=');
	  if (validLen === -1) validLen = len;
	  var placeHoldersLen = validLen === len ? 0 : 4 - validLen % 4;
	  return [validLen, placeHoldersLen];
	} // base64 is 4/3 + up to two characters of the original data


	function byteLength(b64) {
	  var lens = getLens(b64);
	  var validLen = lens[0];
	  var placeHoldersLen = lens[1];
	  return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
	}

	function _byteLength(b64, validLen, placeHoldersLen) {
	  return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
	}

	function toByteArray(b64) {
	  var tmp;
	  var lens = getLens(b64);
	  var validLen = lens[0];
	  var placeHoldersLen = lens[1];
	  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
	  var curByte = 0; // if there are placeholders, only get up to the last complete 4 chars

	  var len = placeHoldersLen > 0 ? validLen - 4 : validLen;
	  var i;

	  for (i = 0; i < len; i += 4) {
	    tmp = revLookup[b64.charCodeAt(i)] << 18 | revLookup[b64.charCodeAt(i + 1)] << 12 | revLookup[b64.charCodeAt(i + 2)] << 6 | revLookup[b64.charCodeAt(i + 3)];
	    arr[curByte++] = tmp >> 16 & 0xFF;
	    arr[curByte++] = tmp >> 8 & 0xFF;
	    arr[curByte++] = tmp & 0xFF;
	  }

	  if (placeHoldersLen === 2) {
	    tmp = revLookup[b64.charCodeAt(i)] << 2 | revLookup[b64.charCodeAt(i + 1)] >> 4;
	    arr[curByte++] = tmp & 0xFF;
	  }

	  if (placeHoldersLen === 1) {
	    tmp = revLookup[b64.charCodeAt(i)] << 10 | revLookup[b64.charCodeAt(i + 1)] << 4 | revLookup[b64.charCodeAt(i + 2)] >> 2;
	    arr[curByte++] = tmp >> 8 & 0xFF;
	    arr[curByte++] = tmp & 0xFF;
	  }

	  return arr;
	}

	function tripletToBase64(num) {
	  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F];
	}

	function encodeChunk(uint8, start, end) {
	  var tmp;
	  var output = [];

	  for (var i = start; i < end; i += 3) {
	    tmp = (uint8[i] << 16 & 0xFF0000) + (uint8[i + 1] << 8 & 0xFF00) + (uint8[i + 2] & 0xFF);
	    output.push(tripletToBase64(tmp));
	  }

	  return output.join('');
	}

	function fromByteArray(uint8) {
	  var tmp;
	  var len = uint8.length;
	  var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes

	  var parts = [];
	  var maxChunkLength = 16383; // must be multiple of 3
	  // go through the array every three bytes, we'll deal with trailing stuff later

	  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
	    parts.push(encodeChunk(uint8, i, i + maxChunkLength > len2 ? len2 : i + maxChunkLength));
	  } // pad the end with zeros, but make sure to not forget the extra bytes


	  if (extraBytes === 1) {
	    tmp = uint8[len - 1];
	    parts.push(lookup[tmp >> 2] + lookup[tmp << 4 & 0x3F] + '==');
	  } else if (extraBytes === 2) {
	    tmp = (uint8[len - 2] << 8) + uint8[len - 1];
	    parts.push(lookup[tmp >> 10] + lookup[tmp >> 4 & 0x3F] + lookup[tmp << 2 & 0x3F] + '=');
	  }

	  return parts.join('');
	}

	var base64Js = {
	  byteLength: byteLength_1,
	  toByteArray: toByteArray_1,
	  fromByteArray: fromByteArray_1
	};

	/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
	var read = function read(buffer, offset, isLE, mLen, nBytes) {
	  var e, m;
	  var eLen = nBytes * 8 - mLen - 1;
	  var eMax = (1 << eLen) - 1;
	  var eBias = eMax >> 1;
	  var nBits = -7;
	  var i = isLE ? nBytes - 1 : 0;
	  var d = isLE ? -1 : 1;
	  var s = buffer[offset + i];
	  i += d;
	  e = s & (1 << -nBits) - 1;
	  s >>= -nBits;
	  nBits += eLen;

	  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

	  m = e & (1 << -nBits) - 1;
	  e >>= -nBits;
	  nBits += mLen;

	  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

	  if (e === 0) {
	    e = 1 - eBias;
	  } else if (e === eMax) {
	    return m ? NaN : (s ? -1 : 1) * Infinity;
	  } else {
	    m = m + Math.pow(2, mLen);
	    e = e - eBias;
	  }

	  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
	};

	var write = function write(buffer, value, offset, isLE, mLen, nBytes) {
	  var e, m, c;
	  var eLen = nBytes * 8 - mLen - 1;
	  var eMax = (1 << eLen) - 1;
	  var eBias = eMax >> 1;
	  var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
	  var i = isLE ? 0 : nBytes - 1;
	  var d = isLE ? 1 : -1;
	  var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
	  value = Math.abs(value);

	  if (isNaN(value) || value === Infinity) {
	    m = isNaN(value) ? 1 : 0;
	    e = eMax;
	  } else {
	    e = Math.floor(Math.log(value) / Math.LN2);

	    if (value * (c = Math.pow(2, -e)) < 1) {
	      e--;
	      c *= 2;
	    }

	    if (e + eBias >= 1) {
	      value += rt / c;
	    } else {
	      value += rt * Math.pow(2, 1 - eBias);
	    }

	    if (value * c >= 2) {
	      e++;
	      c /= 2;
	    }

	    if (e + eBias >= eMax) {
	      m = 0;
	      e = eMax;
	    } else if (e + eBias >= 1) {
	      m = (value * c - 1) * Math.pow(2, mLen);
	      e = e + eBias;
	    } else {
	      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
	      e = 0;
	    }
	  }

	  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

	  e = e << mLen | m;
	  eLen += mLen;

	  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

	  buffer[offset + i - d] |= s * 128;
	};

	var ieee754 = {
	  read: read,
	  write: write
	};

	var buffer$1 = createCommonjsModule$1(function (module, exports) {

	  var customInspectSymbol = typeof Symbol === 'function' && typeof Symbol['for'] === 'function' ? // eslint-disable-line dot-notation
	  Symbol['for']('nodejs.util.inspect.custom') // eslint-disable-line dot-notation
	  : null;
	  exports.Buffer = Buffer;
	  exports.SlowBuffer = SlowBuffer;
	  exports.INSPECT_MAX_BYTES = 50;
	  var K_MAX_LENGTH = 0x7fffffff;
	  exports.kMaxLength = K_MAX_LENGTH;
	  /**
	   * If `Buffer.TYPED_ARRAY_SUPPORT`:
	   *   === true    Use Uint8Array implementation (fastest)
	   *   === false   Print warning and recommend using `buffer` v4.x which has an Object
	   *               implementation (most compatible, even IE6)
	   *
	   * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
	   * Opera 11.6+, iOS 4.2+.
	   *
	   * We report that the browser does not support typed arrays if the are not subclassable
	   * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
	   * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
	   * for __proto__ and has a buggy typed array implementation.
	   */

	  Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport();

	  if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' && typeof console.error === 'function') {
	    console.error('This browser lacks typed array (Uint8Array) support which is required by ' + '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.');
	  }

	  function typedArraySupport() {
	    // Can typed array instances can be augmented?
	    try {
	      var arr = new Uint8Array(1);
	      var proto = {
	        foo: function foo() {
	          return 42;
	        }
	      };
	      Object.setPrototypeOf(proto, Uint8Array.prototype);
	      Object.setPrototypeOf(arr, proto);
	      return arr.foo() === 42;
	    } catch (e) {
	      return false;
	    }
	  }

	  Object.defineProperty(Buffer.prototype, 'parent', {
	    enumerable: true,
	    get: function get() {
	      if (!Buffer.isBuffer(this)) return undefined;
	      return this.buffer;
	    }
	  });
	  Object.defineProperty(Buffer.prototype, 'offset', {
	    enumerable: true,
	    get: function get() {
	      if (!Buffer.isBuffer(this)) return undefined;
	      return this.byteOffset;
	    }
	  });

	  function createBuffer(length) {
	    if (length > K_MAX_LENGTH) {
	      throw new RangeError('The value "' + length + '" is invalid for option "size"');
	    } // Return an augmented `Uint8Array` instance


	    var buf = new Uint8Array(length);
	    Object.setPrototypeOf(buf, Buffer.prototype);
	    return buf;
	  }
	  /**
	   * The Buffer constructor returns instances of `Uint8Array` that have their
	   * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
	   * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
	   * and the `Uint8Array` methods. Square bracket notation works as expected -- it
	   * returns a single octet.
	   *
	   * The `Uint8Array` prototype remains unmodified.
	   */


	  function Buffer(arg, encodingOrOffset, length) {
	    // Common case.
	    if (typeof arg === 'number') {
	      if (typeof encodingOrOffset === 'string') {
	        throw new TypeError('The "string" argument must be of type string. Received type number');
	      }

	      return allocUnsafe(arg);
	    }

	    return from(arg, encodingOrOffset, length);
	  }

	  Buffer.poolSize = 8192; // not used by this implementation

	  function from(value, encodingOrOffset, length) {
	    if (typeof value === 'string') {
	      return fromString(value, encodingOrOffset);
	    }

	    if (ArrayBuffer.isView(value)) {
	      return fromArrayView(value);
	    }

	    if (value == null) {
	      throw new TypeError('The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' + 'or Array-like Object. Received type ' + babelHelpers["typeof"](value));
	    }

	    if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer)) {
	      return fromArrayBuffer(value, encodingOrOffset, length);
	    }

	    if (typeof SharedArrayBuffer !== 'undefined' && (isInstance(value, SharedArrayBuffer) || value && isInstance(value.buffer, SharedArrayBuffer))) {
	      return fromArrayBuffer(value, encodingOrOffset, length);
	    }

	    if (typeof value === 'number') {
	      throw new TypeError('The "value" argument must not be of type number. Received type number');
	    }

	    var valueOf = value.valueOf && value.valueOf();

	    if (valueOf != null && valueOf !== value) {
	      return Buffer.from(valueOf, encodingOrOffset, length);
	    }

	    var b = fromObject(value);
	    if (b) return b;

	    if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === 'function') {
	      return Buffer.from(value[Symbol.toPrimitive]('string'), encodingOrOffset, length);
	    }

	    throw new TypeError('The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' + 'or Array-like Object. Received type ' + babelHelpers["typeof"](value));
	  }
	  /**
	   * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
	   * if value is a number.
	   * Buffer.from(str[, encoding])
	   * Buffer.from(array)
	   * Buffer.from(buffer)
	   * Buffer.from(arrayBuffer[, byteOffset[, length]])
	   **/


	  Buffer.from = function (value, encodingOrOffset, length) {
	    return from(value, encodingOrOffset, length);
	  }; // Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
	  // https://github.com/feross/buffer/pull/148


	  Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype);
	  Object.setPrototypeOf(Buffer, Uint8Array);

	  function assertSize(size) {
	    if (typeof size !== 'number') {
	      throw new TypeError('"size" argument must be of type number');
	    } else if (size < 0) {
	      throw new RangeError('The value "' + size + '" is invalid for option "size"');
	    }
	  }

	  function alloc(size, fill, encoding) {
	    assertSize(size);

	    if (size <= 0) {
	      return createBuffer(size);
	    }

	    if (fill !== undefined) {
	      // Only pay attention to encoding if it's a string. This
	      // prevents accidentally sending in a number that would
	      // be interpreted as a start offset.
	      return typeof encoding === 'string' ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill);
	    }

	    return createBuffer(size);
	  }
	  /**
	   * Creates a new filled Buffer instance.
	   * alloc(size[, fill[, encoding]])
	   **/


	  Buffer.alloc = function (size, fill, encoding) {
	    return alloc(size, fill, encoding);
	  };

	  function allocUnsafe(size) {
	    assertSize(size);
	    return createBuffer(size < 0 ? 0 : checked(size) | 0);
	  }
	  /**
	   * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
	   * */


	  Buffer.allocUnsafe = function (size) {
	    return allocUnsafe(size);
	  };
	  /**
	   * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
	   */


	  Buffer.allocUnsafeSlow = function (size) {
	    return allocUnsafe(size);
	  };

	  function fromString(string, encoding) {
	    if (typeof encoding !== 'string' || encoding === '') {
	      encoding = 'utf8';
	    }

	    if (!Buffer.isEncoding(encoding)) {
	      throw new TypeError('Unknown encoding: ' + encoding);
	    }

	    var length = byteLength(string, encoding) | 0;
	    var buf = createBuffer(length);
	    var actual = buf.write(string, encoding);

	    if (actual !== length) {
	      // Writing a hex string, for example, that contains invalid characters will
	      // cause everything after the first invalid character to be ignored. (e.g.
	      // 'abxxcd' will be treated as 'ab')
	      buf = buf.slice(0, actual);
	    }

	    return buf;
	  }

	  function fromArrayLike(array) {
	    var length = array.length < 0 ? 0 : checked(array.length) | 0;
	    var buf = createBuffer(length);

	    for (var i = 0; i < length; i += 1) {
	      buf[i] = array[i] & 255;
	    }

	    return buf;
	  }

	  function fromArrayView(arrayView) {
	    if (isInstance(arrayView, Uint8Array)) {
	      var copy = new Uint8Array(arrayView);
	      return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength);
	    }

	    return fromArrayLike(arrayView);
	  }

	  function fromArrayBuffer(array, byteOffset, length) {
	    if (byteOffset < 0 || array.byteLength < byteOffset) {
	      throw new RangeError('"offset" is outside of buffer bounds');
	    }

	    if (array.byteLength < byteOffset + (length || 0)) {
	      throw new RangeError('"length" is outside of buffer bounds');
	    }

	    var buf;

	    if (byteOffset === undefined && length === undefined) {
	      buf = new Uint8Array(array);
	    } else if (length === undefined) {
	      buf = new Uint8Array(array, byteOffset);
	    } else {
	      buf = new Uint8Array(array, byteOffset, length);
	    } // Return an augmented `Uint8Array` instance


	    Object.setPrototypeOf(buf, Buffer.prototype);
	    return buf;
	  }

	  function fromObject(obj) {
	    if (Buffer.isBuffer(obj)) {
	      var len = checked(obj.length) | 0;
	      var buf = createBuffer(len);

	      if (buf.length === 0) {
	        return buf;
	      }

	      obj.copy(buf, 0, 0, len);
	      return buf;
	    }

	    if (obj.length !== undefined) {
	      if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
	        return createBuffer(0);
	      }

	      return fromArrayLike(obj);
	    }

	    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
	      return fromArrayLike(obj.data);
	    }
	  }

	  function checked(length) {
	    // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
	    // length is NaN (which is otherwise coerced to zero.)
	    if (length >= K_MAX_LENGTH) {
	      throw new RangeError('Attempt to allocate Buffer larger than maximum ' + 'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes');
	    }

	    return length | 0;
	  }

	  function SlowBuffer(length) {
	    if (+length != length) {
	      // eslint-disable-line eqeqeq
	      length = 0;
	    }

	    return Buffer.alloc(+length);
	  }

	  Buffer.isBuffer = function isBuffer(b) {
	    return b != null && b._isBuffer === true && b !== Buffer.prototype; // so Buffer.isBuffer(Buffer.prototype) will be false
	  };

	  Buffer.compare = function compare(a, b) {
	    if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength);
	    if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength);

	    if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
	      throw new TypeError('The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array');
	    }

	    if (a === b) return 0;
	    var x = a.length;
	    var y = b.length;

	    for (var i = 0, len = Math.min(x, y); i < len; ++i) {
	      if (a[i] !== b[i]) {
	        x = a[i];
	        y = b[i];
	        break;
	      }
	    }

	    if (x < y) return -1;
	    if (y < x) return 1;
	    return 0;
	  };

	  Buffer.isEncoding = function isEncoding(encoding) {
	    switch (String(encoding).toLowerCase()) {
	      case 'hex':
	      case 'utf8':
	      case 'utf-8':
	      case 'ascii':
	      case 'latin1':
	      case 'binary':
	      case 'base64':
	      case 'ucs2':
	      case 'ucs-2':
	      case 'utf16le':
	      case 'utf-16le':
	        return true;

	      default:
	        return false;
	    }
	  };

	  Buffer.concat = function concat(list, length) {
	    if (!Array.isArray(list)) {
	      throw new TypeError('"list" argument must be an Array of Buffers');
	    }

	    if (list.length === 0) {
	      return Buffer.alloc(0);
	    }

	    var i;

	    if (length === undefined) {
	      length = 0;

	      for (i = 0; i < list.length; ++i) {
	        length += list[i].length;
	      }
	    }

	    var buffer = Buffer.allocUnsafe(length);
	    var pos = 0;

	    for (i = 0; i < list.length; ++i) {
	      var buf = list[i];

	      if (isInstance(buf, Uint8Array)) {
	        if (pos + buf.length > buffer.length) {
	          Buffer.from(buf).copy(buffer, pos);
	        } else {
	          Uint8Array.prototype.set.call(buffer, buf, pos);
	        }
	      } else if (!Buffer.isBuffer(buf)) {
	        throw new TypeError('"list" argument must be an Array of Buffers');
	      } else {
	        buf.copy(buffer, pos);
	      }

	      pos += buf.length;
	    }

	    return buffer;
	  };

	  function byteLength(string, encoding) {
	    if (Buffer.isBuffer(string)) {
	      return string.length;
	    }

	    if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
	      return string.byteLength;
	    }

	    if (typeof string !== 'string') {
	      throw new TypeError('The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' + 'Received type ' + babelHelpers["typeof"](string));
	    }

	    var len = string.length;
	    var mustMatch = arguments.length > 2 && arguments[2] === true;
	    if (!mustMatch && len === 0) return 0; // Use a for loop to avoid recursion

	    var loweredCase = false;

	    for (;;) {
	      switch (encoding) {
	        case 'ascii':
	        case 'latin1':
	        case 'binary':
	          return len;

	        case 'utf8':
	        case 'utf-8':
	          return utf8ToBytes(string).length;

	        case 'ucs2':
	        case 'ucs-2':
	        case 'utf16le':
	        case 'utf-16le':
	          return len * 2;

	        case 'hex':
	          return len >>> 1;

	        case 'base64':
	          return base64ToBytes(string).length;

	        default:
	          if (loweredCase) {
	            return mustMatch ? -1 : utf8ToBytes(string).length; // assume utf8
	          }

	          encoding = ('' + encoding).toLowerCase();
	          loweredCase = true;
	      }
	    }
	  }

	  Buffer.byteLength = byteLength;

	  function slowToString(encoding, start, end) {
	    var loweredCase = false; // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
	    // property of a typed array.
	    // This behaves neither like String nor Uint8Array in that we set start/end
	    // to their upper/lower bounds if the value passed is out of range.
	    // undefined is handled specially as per ECMA-262 6th Edition,
	    // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.

	    if (start === undefined || start < 0) {
	      start = 0;
	    } // Return early if start > this.length. Done here to prevent potential uint32
	    // coercion fail below.


	    if (start > this.length) {
	      return '';
	    }

	    if (end === undefined || end > this.length) {
	      end = this.length;
	    }

	    if (end <= 0) {
	      return '';
	    } // Force coercion to uint32. This will also coerce falsey/NaN values to 0.


	    end >>>= 0;
	    start >>>= 0;

	    if (end <= start) {
	      return '';
	    }

	    if (!encoding) encoding = 'utf8';

	    while (true) {
	      switch (encoding) {
	        case 'hex':
	          return hexSlice(this, start, end);

	        case 'utf8':
	        case 'utf-8':
	          return utf8Slice(this, start, end);

	        case 'ascii':
	          return asciiSlice(this, start, end);

	        case 'latin1':
	        case 'binary':
	          return latin1Slice(this, start, end);

	        case 'base64':
	          return base64Slice(this, start, end);

	        case 'ucs2':
	        case 'ucs-2':
	        case 'utf16le':
	        case 'utf-16le':
	          return utf16leSlice(this, start, end);

	        default:
	          if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding);
	          encoding = (encoding + '').toLowerCase();
	          loweredCase = true;
	      }
	    }
	  } // This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
	  // to detect a Buffer instance. It's not possible to use `instanceof Buffer`
	  // reliably in a browserify context because there could be multiple different
	  // copies of the 'buffer' package in use. This method works even for Buffer
	  // instances that were created from another copy of the `buffer` package.
	  // See: https://github.com/feross/buffer/issues/154


	  Buffer.prototype._isBuffer = true;

	  function swap(b, n, m) {
	    var i = b[n];
	    b[n] = b[m];
	    b[m] = i;
	  }

	  Buffer.prototype.swap16 = function swap16() {
	    var len = this.length;

	    if (len % 2 !== 0) {
	      throw new RangeError('Buffer size must be a multiple of 16-bits');
	    }

	    for (var i = 0; i < len; i += 2) {
	      swap(this, i, i + 1);
	    }

	    return this;
	  };

	  Buffer.prototype.swap32 = function swap32() {
	    var len = this.length;

	    if (len % 4 !== 0) {
	      throw new RangeError('Buffer size must be a multiple of 32-bits');
	    }

	    for (var i = 0; i < len; i += 4) {
	      swap(this, i, i + 3);
	      swap(this, i + 1, i + 2);
	    }

	    return this;
	  };

	  Buffer.prototype.swap64 = function swap64() {
	    var len = this.length;

	    if (len % 8 !== 0) {
	      throw new RangeError('Buffer size must be a multiple of 64-bits');
	    }

	    for (var i = 0; i < len; i += 8) {
	      swap(this, i, i + 7);
	      swap(this, i + 1, i + 6);
	      swap(this, i + 2, i + 5);
	      swap(this, i + 3, i + 4);
	    }

	    return this;
	  };

	  Buffer.prototype.toString = function toString() {
	    var length = this.length;
	    if (length === 0) return '';
	    if (arguments.length === 0) return utf8Slice(this, 0, length);
	    return slowToString.apply(this, arguments);
	  };

	  Buffer.prototype.toLocaleString = Buffer.prototype.toString;

	  Buffer.prototype.equals = function equals(b) {
	    if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer');
	    if (this === b) return true;
	    return Buffer.compare(this, b) === 0;
	  };

	  Buffer.prototype.inspect = function inspect() {
	    var str = '';
	    var max = exports.INSPECT_MAX_BYTES;
	    str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim();
	    if (this.length > max) str += ' ... ';
	    return '<Buffer ' + str + '>';
	  };

	  if (customInspectSymbol) {
	    Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect;
	  }

	  Buffer.prototype.compare = function compare(target, start, end, thisStart, thisEnd) {
	    if (isInstance(target, Uint8Array)) {
	      target = Buffer.from(target, target.offset, target.byteLength);
	    }

	    if (!Buffer.isBuffer(target)) {
	      throw new TypeError('The "target" argument must be one of type Buffer or Uint8Array. ' + 'Received type ' + babelHelpers["typeof"](target));
	    }

	    if (start === undefined) {
	      start = 0;
	    }

	    if (end === undefined) {
	      end = target ? target.length : 0;
	    }

	    if (thisStart === undefined) {
	      thisStart = 0;
	    }

	    if (thisEnd === undefined) {
	      thisEnd = this.length;
	    }

	    if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
	      throw new RangeError('out of range index');
	    }

	    if (thisStart >= thisEnd && start >= end) {
	      return 0;
	    }

	    if (thisStart >= thisEnd) {
	      return -1;
	    }

	    if (start >= end) {
	      return 1;
	    }

	    start >>>= 0;
	    end >>>= 0;
	    thisStart >>>= 0;
	    thisEnd >>>= 0;
	    if (this === target) return 0;
	    var x = thisEnd - thisStart;
	    var y = end - start;
	    var len = Math.min(x, y);
	    var thisCopy = this.slice(thisStart, thisEnd);
	    var targetCopy = target.slice(start, end);

	    for (var i = 0; i < len; ++i) {
	      if (thisCopy[i] !== targetCopy[i]) {
	        x = thisCopy[i];
	        y = targetCopy[i];
	        break;
	      }
	    }

	    if (x < y) return -1;
	    if (y < x) return 1;
	    return 0;
	  }; // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
	  // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
	  //
	  // Arguments:
	  // - buffer - a Buffer to search
	  // - val - a string, Buffer, or number
	  // - byteOffset - an index into `buffer`; will be clamped to an int32
	  // - encoding - an optional encoding, relevant is val is a string
	  // - dir - true for indexOf, false for lastIndexOf


	  function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
	    // Empty buffer means no match
	    if (buffer.length === 0) return -1; // Normalize byteOffset

	    if (typeof byteOffset === 'string') {
	      encoding = byteOffset;
	      byteOffset = 0;
	    } else if (byteOffset > 0x7fffffff) {
	      byteOffset = 0x7fffffff;
	    } else if (byteOffset < -0x80000000) {
	      byteOffset = -0x80000000;
	    }

	    byteOffset = +byteOffset; // Coerce to Number.

	    if (numberIsNaN(byteOffset)) {
	      // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
	      byteOffset = dir ? 0 : buffer.length - 1;
	    } // Normalize byteOffset: negative offsets start from the end of the buffer


	    if (byteOffset < 0) byteOffset = buffer.length + byteOffset;

	    if (byteOffset >= buffer.length) {
	      if (dir) return -1;else byteOffset = buffer.length - 1;
	    } else if (byteOffset < 0) {
	      if (dir) byteOffset = 0;else return -1;
	    } // Normalize val


	    if (typeof val === 'string') {
	      val = Buffer.from(val, encoding);
	    } // Finally, search either indexOf (if dir is true) or lastIndexOf


	    if (Buffer.isBuffer(val)) {
	      // Special case: looking for empty string/buffer always fails
	      if (val.length === 0) {
	        return -1;
	      }

	      return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
	    } else if (typeof val === 'number') {
	      val = val & 0xFF; // Search for a byte value [0-255]

	      if (typeof Uint8Array.prototype.indexOf === 'function') {
	        if (dir) {
	          return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
	        } else {
	          return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
	        }
	      }

	      return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
	    }

	    throw new TypeError('val must be string, number or Buffer');
	  }

	  function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
	    var indexSize = 1;
	    var arrLength = arr.length;
	    var valLength = val.length;

	    if (encoding !== undefined) {
	      encoding = String(encoding).toLowerCase();

	      if (encoding === 'ucs2' || encoding === 'ucs-2' || encoding === 'utf16le' || encoding === 'utf-16le') {
	        if (arr.length < 2 || val.length < 2) {
	          return -1;
	        }

	        indexSize = 2;
	        arrLength /= 2;
	        valLength /= 2;
	        byteOffset /= 2;
	      }
	    }

	    function read(buf, i) {
	      if (indexSize === 1) {
	        return buf[i];
	      } else {
	        return buf.readUInt16BE(i * indexSize);
	      }
	    }

	    var i;

	    if (dir) {
	      var foundIndex = -1;

	      for (i = byteOffset; i < arrLength; i++) {
	        if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
	          if (foundIndex === -1) foundIndex = i;
	          if (i - foundIndex + 1 === valLength) return foundIndex * indexSize;
	        } else {
	          if (foundIndex !== -1) i -= i - foundIndex;
	          foundIndex = -1;
	        }
	      }
	    } else {
	      if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;

	      for (i = byteOffset; i >= 0; i--) {
	        var found = true;

	        for (var j = 0; j < valLength; j++) {
	          if (read(arr, i + j) !== read(val, j)) {
	            found = false;
	            break;
	          }
	        }

	        if (found) return i;
	      }
	    }

	    return -1;
	  }

	  Buffer.prototype.includes = function includes(val, byteOffset, encoding) {
	    return this.indexOf(val, byteOffset, encoding) !== -1;
	  };

	  Buffer.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
	    return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
	  };

	  Buffer.prototype.lastIndexOf = function lastIndexOf(val, byteOffset, encoding) {
	    return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
	  };

	  function hexWrite(buf, string, offset, length) {
	    offset = Number(offset) || 0;
	    var remaining = buf.length - offset;

	    if (!length) {
	      length = remaining;
	    } else {
	      length = Number(length);

	      if (length > remaining) {
	        length = remaining;
	      }
	    }

	    var strLen = string.length;

	    if (length > strLen / 2) {
	      length = strLen / 2;
	    }

	    for (var i = 0; i < length; ++i) {
	      var parsed = parseInt(string.substr(i * 2, 2), 16);
	      if (numberIsNaN(parsed)) return i;
	      buf[offset + i] = parsed;
	    }

	    return i;
	  }

	  function utf8Write(buf, string, offset, length) {
	    return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
	  }

	  function asciiWrite(buf, string, offset, length) {
	    return blitBuffer(asciiToBytes(string), buf, offset, length);
	  }

	  function base64Write(buf, string, offset, length) {
	    return blitBuffer(base64ToBytes(string), buf, offset, length);
	  }

	  function ucs2Write(buf, string, offset, length) {
	    return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
	  }

	  Buffer.prototype.write = function write(string, offset, length, encoding) {
	    // Buffer#write(string)
	    if (offset === undefined) {
	      encoding = 'utf8';
	      length = this.length;
	      offset = 0; // Buffer#write(string, encoding)
	    } else if (length === undefined && typeof offset === 'string') {
	      encoding = offset;
	      length = this.length;
	      offset = 0; // Buffer#write(string, offset[, length][, encoding])
	    } else if (isFinite(offset)) {
	      offset = offset >>> 0;

	      if (isFinite(length)) {
	        length = length >>> 0;
	        if (encoding === undefined) encoding = 'utf8';
	      } else {
	        encoding = length;
	        length = undefined;
	      }
	    } else {
	      throw new Error('Buffer.write(string, encoding, offset[, length]) is no longer supported');
	    }

	    var remaining = this.length - offset;
	    if (length === undefined || length > remaining) length = remaining;

	    if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
	      throw new RangeError('Attempt to write outside buffer bounds');
	    }

	    if (!encoding) encoding = 'utf8';
	    var loweredCase = false;

	    for (;;) {
	      switch (encoding) {
	        case 'hex':
	          return hexWrite(this, string, offset, length);

	        case 'utf8':
	        case 'utf-8':
	          return utf8Write(this, string, offset, length);

	        case 'ascii':
	        case 'latin1':
	        case 'binary':
	          return asciiWrite(this, string, offset, length);

	        case 'base64':
	          // Warning: maxLength not taken into account in base64Write
	          return base64Write(this, string, offset, length);

	        case 'ucs2':
	        case 'ucs-2':
	        case 'utf16le':
	        case 'utf-16le':
	          return ucs2Write(this, string, offset, length);

	        default:
	          if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding);
	          encoding = ('' + encoding).toLowerCase();
	          loweredCase = true;
	      }
	    }
	  };

	  Buffer.prototype.toJSON = function toJSON() {
	    return {
	      type: 'Buffer',
	      data: Array.prototype.slice.call(this._arr || this, 0)
	    };
	  };

	  function base64Slice(buf, start, end) {
	    if (start === 0 && end === buf.length) {
	      return base64Js.fromByteArray(buf);
	    } else {
	      return base64Js.fromByteArray(buf.slice(start, end));
	    }
	  }

	  function utf8Slice(buf, start, end) {
	    end = Math.min(buf.length, end);
	    var res = [];
	    var i = start;

	    while (i < end) {
	      var firstByte = buf[i];
	      var codePoint = null;
	      var bytesPerSequence = firstByte > 0xEF ? 4 : firstByte > 0xDF ? 3 : firstByte > 0xBF ? 2 : 1;

	      if (i + bytesPerSequence <= end) {
	        var secondByte, thirdByte, fourthByte, tempCodePoint;

	        switch (bytesPerSequence) {
	          case 1:
	            if (firstByte < 0x80) {
	              codePoint = firstByte;
	            }

	            break;

	          case 2:
	            secondByte = buf[i + 1];

	            if ((secondByte & 0xC0) === 0x80) {
	              tempCodePoint = (firstByte & 0x1F) << 0x6 | secondByte & 0x3F;

	              if (tempCodePoint > 0x7F) {
	                codePoint = tempCodePoint;
	              }
	            }

	            break;

	          case 3:
	            secondByte = buf[i + 1];
	            thirdByte = buf[i + 2];

	            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
	              tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | thirdByte & 0x3F;

	              if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
	                codePoint = tempCodePoint;
	              }
	            }

	            break;

	          case 4:
	            secondByte = buf[i + 1];
	            thirdByte = buf[i + 2];
	            fourthByte = buf[i + 3];

	            if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
	              tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | fourthByte & 0x3F;

	              if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
	                codePoint = tempCodePoint;
	              }
	            }

	        }
	      }

	      if (codePoint === null) {
	        // we did not generate a valid codePoint so insert a
	        // replacement char (U+FFFD) and advance only 1 byte
	        codePoint = 0xFFFD;
	        bytesPerSequence = 1;
	      } else if (codePoint > 0xFFFF) {
	        // encode to utf16 (surrogate pair dance)
	        codePoint -= 0x10000;
	        res.push(codePoint >>> 10 & 0x3FF | 0xD800);
	        codePoint = 0xDC00 | codePoint & 0x3FF;
	      }

	      res.push(codePoint);
	      i += bytesPerSequence;
	    }

	    return decodeCodePointsArray(res);
	  } // Based on http://stackoverflow.com/a/22747272/680742, the browser with
	  // the lowest limit is Chrome, with 0x10000 args.
	  // We go 1 magnitude less, for safety


	  var MAX_ARGUMENTS_LENGTH = 0x1000;

	  function decodeCodePointsArray(codePoints) {
	    var len = codePoints.length;

	    if (len <= MAX_ARGUMENTS_LENGTH) {
	      return String.fromCharCode.apply(String, codePoints); // avoid extra slice()
	    } // Decode in chunks to avoid "call stack size exceeded".


	    var res = '';
	    var i = 0;

	    while (i < len) {
	      res += String.fromCharCode.apply(String, codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH));
	    }

	    return res;
	  }

	  function asciiSlice(buf, start, end) {
	    var ret = '';
	    end = Math.min(buf.length, end);

	    for (var i = start; i < end; ++i) {
	      ret += String.fromCharCode(buf[i] & 0x7F);
	    }

	    return ret;
	  }

	  function latin1Slice(buf, start, end) {
	    var ret = '';
	    end = Math.min(buf.length, end);

	    for (var i = start; i < end; ++i) {
	      ret += String.fromCharCode(buf[i]);
	    }

	    return ret;
	  }

	  function hexSlice(buf, start, end) {
	    var len = buf.length;
	    if (!start || start < 0) start = 0;
	    if (!end || end < 0 || end > len) end = len;
	    var out = '';

	    for (var i = start; i < end; ++i) {
	      out += hexSliceLookupTable[buf[i]];
	    }

	    return out;
	  }

	  function utf16leSlice(buf, start, end) {
	    var bytes = buf.slice(start, end);
	    var res = ''; // If bytes.length is odd, the last 8 bits must be ignored (same as node.js)

	    for (var i = 0; i < bytes.length - 1; i += 2) {
	      res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
	    }

	    return res;
	  }

	  Buffer.prototype.slice = function slice(start, end) {
	    var len = this.length;
	    start = ~~start;
	    end = end === undefined ? len : ~~end;

	    if (start < 0) {
	      start += len;
	      if (start < 0) start = 0;
	    } else if (start > len) {
	      start = len;
	    }

	    if (end < 0) {
	      end += len;
	      if (end < 0) end = 0;
	    } else if (end > len) {
	      end = len;
	    }

	    if (end < start) end = start;
	    var newBuf = this.subarray(start, end); // Return an augmented `Uint8Array` instance

	    Object.setPrototypeOf(newBuf, Buffer.prototype);
	    return newBuf;
	  };
	  /*
	   * Need to make sure that buffer isn't trying to write out of bounds.
	   */


	  function checkOffset(offset, ext, length) {
	    if (offset % 1 !== 0 || offset < 0) throw new RangeError('offset is not uint');
	    if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length');
	  }

	  Buffer.prototype.readUintLE = Buffer.prototype.readUIntLE = function readUIntLE(offset, byteLength, noAssert) {
	    offset = offset >>> 0;
	    byteLength = byteLength >>> 0;
	    if (!noAssert) checkOffset(offset, byteLength, this.length);
	    var val = this[offset];
	    var mul = 1;
	    var i = 0;

	    while (++i < byteLength && (mul *= 0x100)) {
	      val += this[offset + i] * mul;
	    }

	    return val;
	  };

	  Buffer.prototype.readUintBE = Buffer.prototype.readUIntBE = function readUIntBE(offset, byteLength, noAssert) {
	    offset = offset >>> 0;
	    byteLength = byteLength >>> 0;

	    if (!noAssert) {
	      checkOffset(offset, byteLength, this.length);
	    }

	    var val = this[offset + --byteLength];
	    var mul = 1;

	    while (byteLength > 0 && (mul *= 0x100)) {
	      val += this[offset + --byteLength] * mul;
	    }

	    return val;
	  };

	  Buffer.prototype.readUint8 = Buffer.prototype.readUInt8 = function readUInt8(offset, noAssert) {
	    offset = offset >>> 0;
	    if (!noAssert) checkOffset(offset, 1, this.length);
	    return this[offset];
	  };

	  Buffer.prototype.readUint16LE = Buffer.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
	    offset = offset >>> 0;
	    if (!noAssert) checkOffset(offset, 2, this.length);
	    return this[offset] | this[offset + 1] << 8;
	  };

	  Buffer.prototype.readUint16BE = Buffer.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
	    offset = offset >>> 0;
	    if (!noAssert) checkOffset(offset, 2, this.length);
	    return this[offset] << 8 | this[offset + 1];
	  };

	  Buffer.prototype.readUint32LE = Buffer.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
	    offset = offset >>> 0;
	    if (!noAssert) checkOffset(offset, 4, this.length);
	    return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 0x1000000;
	  };

	  Buffer.prototype.readUint32BE = Buffer.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
	    offset = offset >>> 0;
	    if (!noAssert) checkOffset(offset, 4, this.length);
	    return this[offset] * 0x1000000 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
	  };

	  Buffer.prototype.readIntLE = function readIntLE(offset, byteLength, noAssert) {
	    offset = offset >>> 0;
	    byteLength = byteLength >>> 0;
	    if (!noAssert) checkOffset(offset, byteLength, this.length);
	    var val = this[offset];
	    var mul = 1;
	    var i = 0;

	    while (++i < byteLength && (mul *= 0x100)) {
	      val += this[offset + i] * mul;
	    }

	    mul *= 0x80;
	    if (val >= mul) val -= Math.pow(2, 8 * byteLength);
	    return val;
	  };

	  Buffer.prototype.readIntBE = function readIntBE(offset, byteLength, noAssert) {
	    offset = offset >>> 0;
	    byteLength = byteLength >>> 0;
	    if (!noAssert) checkOffset(offset, byteLength, this.length);
	    var i = byteLength;
	    var mul = 1;
	    var val = this[offset + --i];

	    while (i > 0 && (mul *= 0x100)) {
	      val += this[offset + --i] * mul;
	    }

	    mul *= 0x80;
	    if (val >= mul) val -= Math.pow(2, 8 * byteLength);
	    return val;
	  };

	  Buffer.prototype.readInt8 = function readInt8(offset, noAssert) {
	    offset = offset >>> 0;
	    if (!noAssert) checkOffset(offset, 1, this.length);
	    if (!(this[offset] & 0x80)) return this[offset];
	    return (0xff - this[offset] + 1) * -1;
	  };

	  Buffer.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
	    offset = offset >>> 0;
	    if (!noAssert) checkOffset(offset, 2, this.length);
	    var val = this[offset] | this[offset + 1] << 8;
	    return val & 0x8000 ? val | 0xFFFF0000 : val;
	  };

	  Buffer.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
	    offset = offset >>> 0;
	    if (!noAssert) checkOffset(offset, 2, this.length);
	    var val = this[offset + 1] | this[offset] << 8;
	    return val & 0x8000 ? val | 0xFFFF0000 : val;
	  };

	  Buffer.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
	    offset = offset >>> 0;
	    if (!noAssert) checkOffset(offset, 4, this.length);
	    return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
	  };

	  Buffer.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
	    offset = offset >>> 0;
	    if (!noAssert) checkOffset(offset, 4, this.length);
	    return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
	  };

	  Buffer.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
	    offset = offset >>> 0;
	    if (!noAssert) checkOffset(offset, 4, this.length);
	    return ieee754.read(this, offset, true, 23, 4);
	  };

	  Buffer.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
	    offset = offset >>> 0;
	    if (!noAssert) checkOffset(offset, 4, this.length);
	    return ieee754.read(this, offset, false, 23, 4);
	  };

	  Buffer.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
	    offset = offset >>> 0;
	    if (!noAssert) checkOffset(offset, 8, this.length);
	    return ieee754.read(this, offset, true, 52, 8);
	  };

	  Buffer.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
	    offset = offset >>> 0;
	    if (!noAssert) checkOffset(offset, 8, this.length);
	    return ieee754.read(this, offset, false, 52, 8);
	  };

	  function checkInt(buf, value, offset, ext, max, min) {
	    if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance');
	    if (value > max || value < min) throw new RangeError('"value" argument is out of bounds');
	    if (offset + ext > buf.length) throw new RangeError('Index out of range');
	  }

	  Buffer.prototype.writeUintLE = Buffer.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength, noAssert) {
	    value = +value;
	    offset = offset >>> 0;
	    byteLength = byteLength >>> 0;

	    if (!noAssert) {
	      var maxBytes = Math.pow(2, 8 * byteLength) - 1;
	      checkInt(this, value, offset, byteLength, maxBytes, 0);
	    }

	    var mul = 1;
	    var i = 0;
	    this[offset] = value & 0xFF;

	    while (++i < byteLength && (mul *= 0x100)) {
	      this[offset + i] = value / mul & 0xFF;
	    }

	    return offset + byteLength;
	  };

	  Buffer.prototype.writeUintBE = Buffer.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength, noAssert) {
	    value = +value;
	    offset = offset >>> 0;
	    byteLength = byteLength >>> 0;

	    if (!noAssert) {
	      var maxBytes = Math.pow(2, 8 * byteLength) - 1;
	      checkInt(this, value, offset, byteLength, maxBytes, 0);
	    }

	    var i = byteLength - 1;
	    var mul = 1;
	    this[offset + i] = value & 0xFF;

	    while (--i >= 0 && (mul *= 0x100)) {
	      this[offset + i] = value / mul & 0xFF;
	    }

	    return offset + byteLength;
	  };

	  Buffer.prototype.writeUint8 = Buffer.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
	    value = +value;
	    offset = offset >>> 0;
	    if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
	    this[offset] = value & 0xff;
	    return offset + 1;
	  };

	  Buffer.prototype.writeUint16LE = Buffer.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
	    value = +value;
	    offset = offset >>> 0;
	    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
	    this[offset] = value & 0xff;
	    this[offset + 1] = value >>> 8;
	    return offset + 2;
	  };

	  Buffer.prototype.writeUint16BE = Buffer.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
	    value = +value;
	    offset = offset >>> 0;
	    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
	    this[offset] = value >>> 8;
	    this[offset + 1] = value & 0xff;
	    return offset + 2;
	  };

	  Buffer.prototype.writeUint32LE = Buffer.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
	    value = +value;
	    offset = offset >>> 0;
	    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
	    this[offset + 3] = value >>> 24;
	    this[offset + 2] = value >>> 16;
	    this[offset + 1] = value >>> 8;
	    this[offset] = value & 0xff;
	    return offset + 4;
	  };

	  Buffer.prototype.writeUint32BE = Buffer.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
	    value = +value;
	    offset = offset >>> 0;
	    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
	    this[offset] = value >>> 24;
	    this[offset + 1] = value >>> 16;
	    this[offset + 2] = value >>> 8;
	    this[offset + 3] = value & 0xff;
	    return offset + 4;
	  };

	  Buffer.prototype.writeIntLE = function writeIntLE(value, offset, byteLength, noAssert) {
	    value = +value;
	    offset = offset >>> 0;

	    if (!noAssert) {
	      var limit = Math.pow(2, 8 * byteLength - 1);
	      checkInt(this, value, offset, byteLength, limit - 1, -limit);
	    }

	    var i = 0;
	    var mul = 1;
	    var sub = 0;
	    this[offset] = value & 0xFF;

	    while (++i < byteLength && (mul *= 0x100)) {
	      if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
	        sub = 1;
	      }

	      this[offset + i] = (value / mul >> 0) - sub & 0xFF;
	    }

	    return offset + byteLength;
	  };

	  Buffer.prototype.writeIntBE = function writeIntBE(value, offset, byteLength, noAssert) {
	    value = +value;
	    offset = offset >>> 0;

	    if (!noAssert) {
	      var limit = Math.pow(2, 8 * byteLength - 1);
	      checkInt(this, value, offset, byteLength, limit - 1, -limit);
	    }

	    var i = byteLength - 1;
	    var mul = 1;
	    var sub = 0;
	    this[offset + i] = value & 0xFF;

	    while (--i >= 0 && (mul *= 0x100)) {
	      if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
	        sub = 1;
	      }

	      this[offset + i] = (value / mul >> 0) - sub & 0xFF;
	    }

	    return offset + byteLength;
	  };

	  Buffer.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
	    value = +value;
	    offset = offset >>> 0;
	    if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
	    if (value < 0) value = 0xff + value + 1;
	    this[offset] = value & 0xff;
	    return offset + 1;
	  };

	  Buffer.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
	    value = +value;
	    offset = offset >>> 0;
	    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
	    this[offset] = value & 0xff;
	    this[offset + 1] = value >>> 8;
	    return offset + 2;
	  };

	  Buffer.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
	    value = +value;
	    offset = offset >>> 0;
	    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
	    this[offset] = value >>> 8;
	    this[offset + 1] = value & 0xff;
	    return offset + 2;
	  };

	  Buffer.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
	    value = +value;
	    offset = offset >>> 0;
	    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
	    this[offset] = value & 0xff;
	    this[offset + 1] = value >>> 8;
	    this[offset + 2] = value >>> 16;
	    this[offset + 3] = value >>> 24;
	    return offset + 4;
	  };

	  Buffer.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
	    value = +value;
	    offset = offset >>> 0;
	    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
	    if (value < 0) value = 0xffffffff + value + 1;
	    this[offset] = value >>> 24;
	    this[offset + 1] = value >>> 16;
	    this[offset + 2] = value >>> 8;
	    this[offset + 3] = value & 0xff;
	    return offset + 4;
	  };

	  function checkIEEE754(buf, value, offset, ext, max, min) {
	    if (offset + ext > buf.length) throw new RangeError('Index out of range');
	    if (offset < 0) throw new RangeError('Index out of range');
	  }

	  function writeFloat(buf, value, offset, littleEndian, noAssert) {
	    value = +value;
	    offset = offset >>> 0;

	    if (!noAssert) {
	      checkIEEE754(buf, value, offset, 4);
	    }

	    ieee754.write(buf, value, offset, littleEndian, 23, 4);
	    return offset + 4;
	  }

	  Buffer.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
	    return writeFloat(this, value, offset, true, noAssert);
	  };

	  Buffer.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
	    return writeFloat(this, value, offset, false, noAssert);
	  };

	  function writeDouble(buf, value, offset, littleEndian, noAssert) {
	    value = +value;
	    offset = offset >>> 0;

	    if (!noAssert) {
	      checkIEEE754(buf, value, offset, 8);
	    }

	    ieee754.write(buf, value, offset, littleEndian, 52, 8);
	    return offset + 8;
	  }

	  Buffer.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
	    return writeDouble(this, value, offset, true, noAssert);
	  };

	  Buffer.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
	    return writeDouble(this, value, offset, false, noAssert);
	  }; // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)


	  Buffer.prototype.copy = function copy(target, targetStart, start, end) {
	    if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer');
	    if (!start) start = 0;
	    if (!end && end !== 0) end = this.length;
	    if (targetStart >= target.length) targetStart = target.length;
	    if (!targetStart) targetStart = 0;
	    if (end > 0 && end < start) end = start; // Copy 0 bytes; we're done

	    if (end === start) return 0;
	    if (target.length === 0 || this.length === 0) return 0; // Fatal error conditions

	    if (targetStart < 0) {
	      throw new RangeError('targetStart out of bounds');
	    }

	    if (start < 0 || start >= this.length) throw new RangeError('Index out of range');
	    if (end < 0) throw new RangeError('sourceEnd out of bounds'); // Are we oob?

	    if (end > this.length) end = this.length;

	    if (target.length - targetStart < end - start) {
	      end = target.length - targetStart + start;
	    }

	    var len = end - start;

	    if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
	      // Use built-in when available, missing from IE11
	      this.copyWithin(targetStart, start, end);
	    } else {
	      Uint8Array.prototype.set.call(target, this.subarray(start, end), targetStart);
	    }

	    return len;
	  }; // Usage:
	  //    buffer.fill(number[, offset[, end]])
	  //    buffer.fill(buffer[, offset[, end]])
	  //    buffer.fill(string[, offset[, end]][, encoding])


	  Buffer.prototype.fill = function fill(val, start, end, encoding) {
	    // Handle string cases:
	    if (typeof val === 'string') {
	      if (typeof start === 'string') {
	        encoding = start;
	        start = 0;
	        end = this.length;
	      } else if (typeof end === 'string') {
	        encoding = end;
	        end = this.length;
	      }

	      if (encoding !== undefined && typeof encoding !== 'string') {
	        throw new TypeError('encoding must be a string');
	      }

	      if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
	        throw new TypeError('Unknown encoding: ' + encoding);
	      }

	      if (val.length === 1) {
	        var code = val.charCodeAt(0);

	        if (encoding === 'utf8' && code < 128 || encoding === 'latin1') {
	          // Fast path: If `val` fits into a single byte, use that numeric value.
	          val = code;
	        }
	      }
	    } else if (typeof val === 'number') {
	      val = val & 255;
	    } else if (typeof val === 'boolean') {
	      val = Number(val);
	    } // Invalid ranges are not set to a default, so can range check early.


	    if (start < 0 || this.length < start || this.length < end) {
	      throw new RangeError('Out of range index');
	    }

	    if (end <= start) {
	      return this;
	    }

	    start = start >>> 0;
	    end = end === undefined ? this.length : end >>> 0;
	    if (!val) val = 0;
	    var i;

	    if (typeof val === 'number') {
	      for (i = start; i < end; ++i) {
	        this[i] = val;
	      }
	    } else {
	      var bytes = Buffer.isBuffer(val) ? val : Buffer.from(val, encoding);
	      var len = bytes.length;

	      if (len === 0) {
	        throw new TypeError('The value "' + val + '" is invalid for argument "value"');
	      }

	      for (i = 0; i < end - start; ++i) {
	        this[i + start] = bytes[i % len];
	      }
	    }

	    return this;
	  }; // HELPER FUNCTIONS
	  // ================


	  var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;

	  function base64clean(str) {
	    // Node takes equal signs as end of the Base64 encoding
	    str = str.split('=')[0]; // Node strips out invalid characters like \n and \t from the string, base64-js does not

	    str = str.trim().replace(INVALID_BASE64_RE, ''); // Node converts strings with length < 2 to ''

	    if (str.length < 2) return ''; // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not

	    while (str.length % 4 !== 0) {
	      str = str + '=';
	    }

	    return str;
	  }

	  function utf8ToBytes(string, units) {
	    units = units || Infinity;
	    var codePoint;
	    var length = string.length;
	    var leadSurrogate = null;
	    var bytes = [];

	    for (var i = 0; i < length; ++i) {
	      codePoint = string.charCodeAt(i); // is surrogate component

	      if (codePoint > 0xD7FF && codePoint < 0xE000) {
	        // last char was a lead
	        if (!leadSurrogate) {
	          // no lead yet
	          if (codePoint > 0xDBFF) {
	            // unexpected trail
	            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
	            continue;
	          } else if (i + 1 === length) {
	            // unpaired lead
	            if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
	            continue;
	          } // valid lead


	          leadSurrogate = codePoint;
	          continue;
	        } // 2 leads in a row


	        if (codePoint < 0xDC00) {
	          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
	          leadSurrogate = codePoint;
	          continue;
	        } // valid surrogate pair


	        codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
	      } else if (leadSurrogate) {
	        // valid bmp char, but last char was a lead
	        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
	      }

	      leadSurrogate = null; // encode utf8

	      if (codePoint < 0x80) {
	        if ((units -= 1) < 0) break;
	        bytes.push(codePoint);
	      } else if (codePoint < 0x800) {
	        if ((units -= 2) < 0) break;
	        bytes.push(codePoint >> 0x6 | 0xC0, codePoint & 0x3F | 0x80);
	      } else if (codePoint < 0x10000) {
	        if ((units -= 3) < 0) break;
	        bytes.push(codePoint >> 0xC | 0xE0, codePoint >> 0x6 & 0x3F | 0x80, codePoint & 0x3F | 0x80);
	      } else if (codePoint < 0x110000) {
	        if ((units -= 4) < 0) break;
	        bytes.push(codePoint >> 0x12 | 0xF0, codePoint >> 0xC & 0x3F | 0x80, codePoint >> 0x6 & 0x3F | 0x80, codePoint & 0x3F | 0x80);
	      } else {
	        throw new Error('Invalid code point');
	      }
	    }

	    return bytes;
	  }

	  function asciiToBytes(str) {
	    var byteArray = [];

	    for (var i = 0; i < str.length; ++i) {
	      // Node's code seems to be doing this and not & 0x7F..
	      byteArray.push(str.charCodeAt(i) & 0xFF);
	    }

	    return byteArray;
	  }

	  function utf16leToBytes(str, units) {
	    var c, hi, lo;
	    var byteArray = [];

	    for (var i = 0; i < str.length; ++i) {
	      if ((units -= 2) < 0) break;
	      c = str.charCodeAt(i);
	      hi = c >> 8;
	      lo = c % 256;
	      byteArray.push(lo);
	      byteArray.push(hi);
	    }

	    return byteArray;
	  }

	  function base64ToBytes(str) {
	    return base64Js.toByteArray(base64clean(str));
	  }

	  function blitBuffer(src, dst, offset, length) {
	    for (var i = 0; i < length; ++i) {
	      if (i + offset >= dst.length || i >= src.length) break;
	      dst[i + offset] = src[i];
	    }

	    return i;
	  } // ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
	  // the `instanceof` check but they should be treated as of that type.
	  // See: https://github.com/feross/buffer/issues/166


	  function isInstance(obj, type) {
	    return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name;
	  }

	  function numberIsNaN(obj) {
	    // For IE11 support
	    return obj !== obj; // eslint-disable-line no-self-compare
	  } // Create lookup table for `toString('hex')`
	  // See: https://github.com/feross/buffer/issues/219


	  var hexSliceLookupTable = function () {
	    var alphabet = '0123456789abcdef';
	    var table = new Array(256);

	    for (var i = 0; i < 16; ++i) {
	      var i16 = i * 16;

	      for (var j = 0; j < 16; ++j) {
	        table[i16 + j] = alphabet[i] + alphabet[j];
	      }
	    }

	    return table;
	  }();
	});
	var buffer_1 = buffer$1.Buffer;
	buffer$1.SlowBuffer;
	buffer$1.INSPECT_MAX_BYTES;
	buffer$1.kMaxLength;

	function checkForMath(potentialGlobal) {
	    // eslint-disable-next-line eqeqeq
	    return potentialGlobal && potentialGlobal.Math == Math && potentialGlobal;
	}
	// https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
	function getGlobal() {
	    // eslint-disable-next-line no-undef
	    return (checkForMath(typeof globalThis === 'object' && globalThis) ||
	        checkForMath(typeof window === 'object' && window) ||
	        checkForMath(typeof self === 'object' && self) ||
	        checkForMath(typeof global === 'object' && global) ||
	        Function('return this')());
	}
	function isReactNative() {
	    var g = getGlobal();
	    return typeof g.navigator === 'object' && g.navigator.product === 'ReactNative';
	}
	var insecureRandomBytes = function insecureRandomBytes(size) {
	    var insecureWarning = isReactNative()
	        ? 'BSON: For React Native please polyfill crypto.getRandomValues, e.g. using: https://www.npmjs.com/package/react-native-get-random-values.'
	        : 'BSON: No cryptographic implementation for random bytes present, falling back to a less secure implementation.';
	    console.warn(insecureWarning);
	    var result = buffer_1.alloc(size);
	    for (var i = 0; i < size; ++i)
	        result[i] = Math.floor(Math.random() * 256);
	    return result;
	};
	var detectRandomBytes = function () {
	    if (typeof window !== 'undefined') {
	        // browser crypto implementation(s)
	        var target_1 = window.crypto || window.msCrypto; // allow for IE11
	        if (target_1 && target_1.getRandomValues) {
	            return function (size) { return target_1.getRandomValues(buffer_1.alloc(size)); };
	        }
	    }
	    if (typeof global !== 'undefined' && global.crypto && global.crypto.getRandomValues) {
	        // allow for RN packages such as https://www.npmjs.com/package/react-native-get-random-values to populate global
	        return function (size) { return global.crypto.getRandomValues(buffer_1.alloc(size)); };
	    }
	    var requiredRandomBytes;
	    try {
	        // eslint-disable-next-line @typescript-eslint/no-var-requires
	        requiredRandomBytes = require('crypto').randomBytes;
	    }
	    catch (e) {
	        // keep the fallback
	    }
	    // NOTE: in transpiled cases the above require might return null/undefined
	    return requiredRandomBytes || insecureRandomBytes;
	};
	var randomBytes = detectRandomBytes();
	function isAnyArrayBuffer(value) {
	    return ['[object ArrayBuffer]', '[object SharedArrayBuffer]'].includes(Object.prototype.toString.call(value));
	}
	function isUint8Array(value) {
	    return Object.prototype.toString.call(value) === '[object Uint8Array]';
	}
	function isRegExp(d) {
	    return Object.prototype.toString.call(d) === '[object RegExp]';
	}
	// To ensure that 0.4 of node works correctly
	function isDate(d) {
	    return isObjectLike$1(d) && Object.prototype.toString.call(d) === '[object Date]';
	}
	/**
	 * @internal
	 * this is to solve the `'someKey' in x` problem where x is unknown.
	 * https://github.com/typescript-eslint/typescript-eslint/issues/1071#issuecomment-541955753
	 */
	function isObjectLike$1(candidate) {
	    return typeof candidate === 'object' && candidate !== null;
	}
	function deprecate(fn, message) {
	    if (typeof require === 'function' &&
	        typeof window === 'undefined' &&
	        typeof self === 'undefined') {
	        // eslint-disable-next-line @typescript-eslint/no-var-requires
	        return require('util').deprecate(fn, message);
	    }
	    var warned = false;
	    function deprecated() {
	        var args = [];
	        for (var _i = 0; _i < arguments.length; _i++) {
	            args[_i] = arguments[_i];
	        }
	        if (!warned) {
	            console.warn(message);
	            warned = true;
	        }
	        return fn.apply(this, args);
	    }
	    return deprecated;
	}

	/**
	 * Makes sure that, if a Uint8Array is passed in, it is wrapped in a Buffer.
	 *
	 * @param potentialBuffer - The potential buffer
	 * @returns Buffer the input if potentialBuffer is a buffer, or a buffer that
	 * wraps a passed in Uint8Array
	 * @throws TypeError If anything other than a Buffer or Uint8Array is passed in
	 */
	function ensureBuffer(potentialBuffer) {
	    if (ArrayBuffer.isView(potentialBuffer)) {
	        return buffer_1.from(potentialBuffer.buffer, potentialBuffer.byteOffset, potentialBuffer.byteLength);
	    }
	    if (isAnyArrayBuffer(potentialBuffer)) {
	        return buffer_1.from(potentialBuffer);
	    }
	    throw new TypeError('Must use either Buffer or TypedArray');
	}

	// Validation regex for v4 uuid (validates with or without dashes)
	var VALIDATION_REGEX = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15})$/i;
	var uuidValidateString = function (str) {
	    return typeof str === 'string' && VALIDATION_REGEX.test(str);
	};
	var uuidHexStringToBuffer = function (hexString) {
	    if (!uuidValidateString(hexString)) {
	        throw new TypeError('UUID string representations must be a 32 or 36 character hex string (dashes excluded/included). Format: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" or "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx".');
	    }
	    var sanitizedHexString = hexString.replace(/-/g, '');
	    return buffer_1.from(sanitizedHexString, 'hex');
	};
	var bufferToUuidHexString = function (buffer, includeDashes) {
	    if (includeDashes === void 0) { includeDashes = true; }
	    return includeDashes
	        ? buffer.toString('hex', 0, 4) +
	            '-' +
	            buffer.toString('hex', 4, 6) +
	            '-' +
	            buffer.toString('hex', 6, 8) +
	            '-' +
	            buffer.toString('hex', 8, 10) +
	            '-' +
	            buffer.toString('hex', 10, 16)
	        : buffer.toString('hex');
	};

	var BYTE_LENGTH = 16;
	var kId$1 = Symbol('id');
	/**
	 * A class representation of the BSON UUID type.
	 * @public
	 */
	var UUID = /** @class */ (function () {
	    /**
	     * Create an UUID type
	     *
	     * @param input - Can be a 32 or 36 character hex string (dashes excluded/included) or a 16 byte binary Buffer.
	     */
	    function UUID(input) {
	        if (typeof input === 'undefined') {
	            // The most common use case (blank id, new UUID() instance)
	            this.id = UUID.generate();
	        }
	        else if (input instanceof UUID) {
	            this[kId$1] = buffer_1.from(input.id);
	            this.__id = input.__id;
	        }
	        else if (ArrayBuffer.isView(input) && input.byteLength === BYTE_LENGTH) {
	            this.id = ensureBuffer(input);
	        }
	        else if (typeof input === 'string') {
	            this.id = uuidHexStringToBuffer(input);
	        }
	        else {
	            throw new TypeError('Argument passed in UUID constructor must be a UUID, a 16 byte Buffer or a 32/36 character hex string (dashes excluded/included, format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).');
	        }
	    }
	    Object.defineProperty(UUID.prototype, "id", {
	        /**
	         * The UUID bytes
	         * @readonly
	         */
	        get: function () {
	            return this[kId$1];
	        },
	        set: function (value) {
	            this[kId$1] = value;
	            if (UUID.cacheHexString) {
	                this.__id = bufferToUuidHexString(value);
	            }
	        },
	        enumerable: false,
	        configurable: true
	    });
	    /**
	     * Generate a 16 byte uuid v4 buffer used in UUIDs
	     */
	    /**
	     * Returns the UUID id as a 32 or 36 character hex string representation, excluding/including dashes (defaults to 36 character dash separated)
	     * @param includeDashes - should the string exclude dash-separators.
	     * */
	    UUID.prototype.toHexString = function (includeDashes) {
	        if (includeDashes === void 0) { includeDashes = true; }
	        if (UUID.cacheHexString && this.__id) {
	            return this.__id;
	        }
	        var uuidHexString = bufferToUuidHexString(this.id, includeDashes);
	        if (UUID.cacheHexString) {
	            this.__id = uuidHexString;
	        }
	        return uuidHexString;
	    };
	    /**
	     * Converts the id into a 36 character (dashes included) hex string, unless a encoding is specified.
	     * @internal
	     */
	    UUID.prototype.toString = function (encoding) {
	        return encoding ? this.id.toString(encoding) : this.toHexString();
	    };
	    /**
	     * Converts the id into its JSON string representation. A 36 character (dashes included) hex string in the format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
	     * @internal
	     */
	    UUID.prototype.toJSON = function () {
	        return this.toHexString();
	    };
	    /**
	     * Compares the equality of this UUID with `otherID`.
	     *
	     * @param otherId - UUID instance to compare against.
	     */
	    UUID.prototype.equals = function (otherId) {
	        if (!otherId) {
	            return false;
	        }
	        if (otherId instanceof UUID) {
	            return otherId.id.equals(this.id);
	        }
	        try {
	            return new UUID(otherId).id.equals(this.id);
	        }
	        catch (_a) {
	            return false;
	        }
	    };
	    /**
	     * Creates a Binary instance from the current UUID.
	     */
	    UUID.prototype.toBinary = function () {
	        return new Binary(this.id, Binary.SUBTYPE_UUID);
	    };
	    /**
	     * Generates a populated buffer containing a v4 uuid
	     */
	    UUID.generate = function () {
	        var bytes = randomBytes(BYTE_LENGTH);
	        // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
	        // Kindly borrowed from https://github.com/uuidjs/uuid/blob/master/src/v4.js
	        bytes[6] = (bytes[6] & 0x0f) | 0x40;
	        bytes[8] = (bytes[8] & 0x3f) | 0x80;
	        return buffer_1.from(bytes);
	    };
	    /**
	     * Checks if a value is a valid bson UUID
	     * @param input - UUID, string or Buffer to validate.
	     */
	    UUID.isValid = function (input) {
	        if (!input) {
	            return false;
	        }
	        if (input instanceof UUID) {
	            return true;
	        }
	        if (typeof input === 'string') {
	            return uuidValidateString(input);
	        }
	        if (isUint8Array(input)) {
	            // check for length & uuid version (https://tools.ietf.org/html/rfc4122#section-4.1.3)
	            if (input.length !== BYTE_LENGTH) {
	                return false;
	            }
	            try {
	                // get this byte as hex:             xxxxxxxx-xxxx-XXxx-xxxx-xxxxxxxxxxxx
	                // check first part as uuid version: xxxxxxxx-xxxx-Xxxx-xxxx-xxxxxxxxxxxx
	                return parseInt(input[6].toString(16)[0], 10) === Binary.SUBTYPE_UUID;
	            }
	            catch (_a) {
	                return false;
	            }
	        }
	        return false;
	    };
	    /**
	     * Creates an UUID from a hex string representation of an UUID.
	     * @param hexString - 32 or 36 character hex string (dashes excluded/included).
	     */
	    UUID.createFromHexString = function (hexString) {
	        var buffer = uuidHexStringToBuffer(hexString);
	        return new UUID(buffer);
	    };
	    /**
	     * Converts to a string representation of this Id.
	     *
	     * @returns return the 36 character hex string representation.
	     * @internal
	     */
	    UUID.prototype[Symbol.for('nodejs.util.inspect.custom')] = function () {
	        return this.inspect();
	    };
	    UUID.prototype.inspect = function () {
	        return "new UUID(\"" + this.toHexString() + "\")";
	    };
	    return UUID;
	}());
	Object.defineProperty(UUID.prototype, '_bsontype', { value: 'UUID' });

	/**
	 * A class representation of the BSON Binary type.
	 * @public
	 */
	var Binary = /** @class */ (function () {
	    /**
	     * @param buffer - a buffer object containing the binary data.
	     * @param subType - the option binary type.
	     */
	    function Binary(buffer, subType) {
	        if (!(this instanceof Binary))
	            return new Binary(buffer, subType);
	        if (!(buffer == null) &&
	            !(typeof buffer === 'string') &&
	            !ArrayBuffer.isView(buffer) &&
	            !(buffer instanceof ArrayBuffer) &&
	            !Array.isArray(buffer)) {
	            throw new TypeError('Binary can only be constructed from string, Buffer, TypedArray, or Array<number>');
	        }
	        this.sub_type = subType !== null && subType !== void 0 ? subType : Binary.BSON_BINARY_SUBTYPE_DEFAULT;
	        if (buffer == null) {
	            // create an empty binary buffer
	            this.buffer = buffer_1.alloc(Binary.BUFFER_SIZE);
	            this.position = 0;
	        }
	        else {
	            if (typeof buffer === 'string') {
	                // string
	                this.buffer = buffer_1.from(buffer, 'binary');
	            }
	            else if (Array.isArray(buffer)) {
	                // number[]
	                this.buffer = buffer_1.from(buffer);
	            }
	            else {
	                // Buffer | TypedArray | ArrayBuffer
	                this.buffer = ensureBuffer(buffer);
	            }
	            this.position = this.buffer.byteLength;
	        }
	    }
	    /**
	     * Updates this binary with byte_value.
	     *
	     * @param byteValue - a single byte we wish to write.
	     */
	    Binary.prototype.put = function (byteValue) {
	        // If it's a string and a has more than one character throw an error
	        if (typeof byteValue === 'string' && byteValue.length !== 1) {
	            throw new TypeError('only accepts single character String');
	        }
	        else if (typeof byteValue !== 'number' && byteValue.length !== 1)
	            throw new TypeError('only accepts single character Uint8Array or Array');
	        // Decode the byte value once
	        var decodedByte;
	        if (typeof byteValue === 'string') {
	            decodedByte = byteValue.charCodeAt(0);
	        }
	        else if (typeof byteValue === 'number') {
	            decodedByte = byteValue;
	        }
	        else {
	            decodedByte = byteValue[0];
	        }
	        if (decodedByte < 0 || decodedByte > 255) {
	            throw new TypeError('only accepts number in a valid unsigned byte range 0-255');
	        }
	        if (this.buffer.length > this.position) {
	            this.buffer[this.position++] = decodedByte;
	        }
	        else {
	            var buffer = buffer_1.alloc(Binary.BUFFER_SIZE + this.buffer.length);
	            // Combine the two buffers together
	            this.buffer.copy(buffer, 0, 0, this.buffer.length);
	            this.buffer = buffer;
	            this.buffer[this.position++] = decodedByte;
	        }
	    };
	    /**
	     * Writes a buffer or string to the binary.
	     *
	     * @param sequence - a string or buffer to be written to the Binary BSON object.
	     * @param offset - specify the binary of where to write the content.
	     */
	    Binary.prototype.write = function (sequence, offset) {
	        offset = typeof offset === 'number' ? offset : this.position;
	        // If the buffer is to small let's extend the buffer
	        if (this.buffer.length < offset + sequence.length) {
	            var buffer = buffer_1.alloc(this.buffer.length + sequence.length);
	            this.buffer.copy(buffer, 0, 0, this.buffer.length);
	            // Assign the new buffer
	            this.buffer = buffer;
	        }
	        if (ArrayBuffer.isView(sequence)) {
	            this.buffer.set(ensureBuffer(sequence), offset);
	            this.position =
	                offset + sequence.byteLength > this.position ? offset + sequence.length : this.position;
	        }
	        else if (typeof sequence === 'string') {
	            this.buffer.write(sequence, offset, sequence.length, 'binary');
	            this.position =
	                offset + sequence.length > this.position ? offset + sequence.length : this.position;
	        }
	    };
	    /**
	     * Reads **length** bytes starting at **position**.
	     *
	     * @param position - read from the given position in the Binary.
	     * @param length - the number of bytes to read.
	     */
	    Binary.prototype.read = function (position, length) {
	        length = length && length > 0 ? length : this.position;
	        // Let's return the data based on the type we have
	        return this.buffer.slice(position, position + length);
	    };
	    /**
	     * Returns the value of this binary as a string.
	     * @param asRaw - Will skip converting to a string
	     * @remarks
	     * This is handy when calling this function conditionally for some key value pairs and not others
	     */
	    Binary.prototype.value = function (asRaw) {
	        asRaw = !!asRaw;
	        // Optimize to serialize for the situation where the data == size of buffer
	        if (asRaw && this.buffer.length === this.position) {
	            return this.buffer;
	        }
	        // If it's a node.js buffer object
	        if (asRaw) {
	            return this.buffer.slice(0, this.position);
	        }
	        return this.buffer.toString('binary', 0, this.position);
	    };
	    /** the length of the binary sequence */
	    Binary.prototype.length = function () {
	        return this.position;
	    };
	    /** @internal */
	    Binary.prototype.toJSON = function () {
	        return this.buffer.toString('base64');
	    };
	    /** @internal */
	    Binary.prototype.toString = function (format) {
	        return this.buffer.toString(format);
	    };
	    /** @internal */
	    Binary.prototype.toExtendedJSON = function (options) {
	        options = options || {};
	        var base64String = this.buffer.toString('base64');
	        var subType = Number(this.sub_type).toString(16);
	        if (options.legacy) {
	            return {
	                $binary: base64String,
	                $type: subType.length === 1 ? '0' + subType : subType
	            };
	        }
	        return {
	            $binary: {
	                base64: base64String,
	                subType: subType.length === 1 ? '0' + subType : subType
	            }
	        };
	    };
	    /** @internal */
	    Binary.prototype.toUUID = function () {
	        if (this.sub_type === Binary.SUBTYPE_UUID) {
	            return new UUID(this.buffer.slice(0, this.position));
	        }
	        throw new Error("Binary sub_type \"" + this.sub_type + "\" is not supported for converting to UUID. Only \"" + Binary.SUBTYPE_UUID + "\" is currently supported.");
	    };
	    /** @internal */
	    Binary.fromExtendedJSON = function (doc, options) {
	        options = options || {};
	        var data;
	        var type;
	        if ('$binary' in doc) {
	            if (options.legacy && typeof doc.$binary === 'string' && '$type' in doc) {
	                type = doc.$type ? parseInt(doc.$type, 16) : 0;
	                data = buffer_1.from(doc.$binary, 'base64');
	            }
	            else {
	                if (typeof doc.$binary !== 'string') {
	                    type = doc.$binary.subType ? parseInt(doc.$binary.subType, 16) : 0;
	                    data = buffer_1.from(doc.$binary.base64, 'base64');
	                }
	            }
	        }
	        else if ('$uuid' in doc) {
	            type = 4;
	            data = uuidHexStringToBuffer(doc.$uuid);
	        }
	        if (!data) {
	            throw new TypeError("Unexpected Binary Extended JSON format " + JSON.stringify(doc));
	        }
	        return new Binary(data, type);
	    };
	    /** @internal */
	    Binary.prototype[Symbol.for('nodejs.util.inspect.custom')] = function () {
	        return this.inspect();
	    };
	    Binary.prototype.inspect = function () {
	        var asBuffer = this.value(true);
	        return "new Binary(Buffer.from(\"" + asBuffer.toString('hex') + "\", \"hex\"), " + this.sub_type + ")";
	    };
	    /**
	     * Binary default subtype
	     * @internal
	     */
	    Binary.BSON_BINARY_SUBTYPE_DEFAULT = 0;
	    /** Initial buffer default size */
	    Binary.BUFFER_SIZE = 256;
	    /** Default BSON type */
	    Binary.SUBTYPE_DEFAULT = 0;
	    /** Function BSON type */
	    Binary.SUBTYPE_FUNCTION = 1;
	    /** Byte Array BSON type */
	    Binary.SUBTYPE_BYTE_ARRAY = 2;
	    /** Deprecated UUID BSON type @deprecated Please use SUBTYPE_UUID */
	    Binary.SUBTYPE_UUID_OLD = 3;
	    /** UUID BSON type */
	    Binary.SUBTYPE_UUID = 4;
	    /** MD5 BSON type */
	    Binary.SUBTYPE_MD5 = 5;
	    /** User BSON type */
	    Binary.SUBTYPE_USER_DEFINED = 128;
	    return Binary;
	}());
	Object.defineProperty(Binary.prototype, '_bsontype', { value: 'Binary' });

	/**
	 * A class representation of the BSON Code type.
	 * @public
	 */
	var Code = /** @class */ (function () {
	    /**
	     * @param code - a string or function.
	     * @param scope - an optional scope for the function.
	     */
	    function Code(code, scope) {
	        if (!(this instanceof Code))
	            return new Code(code, scope);
	        this.code = code;
	        this.scope = scope;
	    }
	    /** @internal */
	    Code.prototype.toJSON = function () {
	        return { code: this.code, scope: this.scope };
	    };
	    /** @internal */
	    Code.prototype.toExtendedJSON = function () {
	        if (this.scope) {
	            return { $code: this.code, $scope: this.scope };
	        }
	        return { $code: this.code };
	    };
	    /** @internal */
	    Code.fromExtendedJSON = function (doc) {
	        return new Code(doc.$code, doc.$scope);
	    };
	    /** @internal */
	    Code.prototype[Symbol.for('nodejs.util.inspect.custom')] = function () {
	        return this.inspect();
	    };
	    Code.prototype.inspect = function () {
	        var codeJson = this.toJSON();
	        return "new Code(\"" + codeJson.code + "\"" + (codeJson.scope ? ", " + JSON.stringify(codeJson.scope) : '') + ")";
	    };
	    return Code;
	}());
	Object.defineProperty(Code.prototype, '_bsontype', { value: 'Code' });

	/** @internal */
	function isDBRefLike(value) {
	    return (isObjectLike$1(value) &&
	        value.$id != null &&
	        typeof value.$ref === 'string' &&
	        (value.$db == null || typeof value.$db === 'string'));
	}
	/**
	 * A class representation of the BSON DBRef type.
	 * @public
	 */
	var DBRef = /** @class */ (function () {
	    /**
	     * @param collection - the collection name.
	     * @param oid - the reference ObjectId.
	     * @param db - optional db name, if omitted the reference is local to the current db.
	     */
	    function DBRef(collection, oid, db, fields) {
	        if (!(this instanceof DBRef))
	            return new DBRef(collection, oid, db, fields);
	        // check if namespace has been provided
	        var parts = collection.split('.');
	        if (parts.length === 2) {
	            db = parts.shift();
	            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	            collection = parts.shift();
	        }
	        this.collection = collection;
	        this.oid = oid;
	        this.db = db;
	        this.fields = fields || {};
	    }
	    Object.defineProperty(DBRef.prototype, "namespace", {
	        // Property provided for compatibility with the 1.x parser
	        // the 1.x parser used a "namespace" property, while 4.x uses "collection"
	        /** @internal */
	        get: function () {
	            return this.collection;
	        },
	        set: function (value) {
	            this.collection = value;
	        },
	        enumerable: false,
	        configurable: true
	    });
	    /** @internal */
	    DBRef.prototype.toJSON = function () {
	        var o = Object.assign({
	            $ref: this.collection,
	            $id: this.oid
	        }, this.fields);
	        if (this.db != null)
	            o.$db = this.db;
	        return o;
	    };
	    /** @internal */
	    DBRef.prototype.toExtendedJSON = function (options) {
	        options = options || {};
	        var o = {
	            $ref: this.collection,
	            $id: this.oid
	        };
	        if (options.legacy) {
	            return o;
	        }
	        if (this.db)
	            o.$db = this.db;
	        o = Object.assign(o, this.fields);
	        return o;
	    };
	    /** @internal */
	    DBRef.fromExtendedJSON = function (doc) {
	        var copy = Object.assign({}, doc);
	        delete copy.$ref;
	        delete copy.$id;
	        delete copy.$db;
	        return new DBRef(doc.$ref, doc.$id, doc.$db, copy);
	    };
	    /** @internal */
	    DBRef.prototype[Symbol.for('nodejs.util.inspect.custom')] = function () {
	        return this.inspect();
	    };
	    DBRef.prototype.inspect = function () {
	        // NOTE: if OID is an ObjectId class it will just print the oid string.
	        var oid = this.oid === undefined || this.oid.toString === undefined ? this.oid : this.oid.toString();
	        return "new DBRef(\"" + this.namespace + "\", new ObjectId(\"" + oid + "\")" + (this.db ? ", \"" + this.db + "\"" : '') + ")";
	    };
	    return DBRef;
	}());
	Object.defineProperty(DBRef.prototype, '_bsontype', { value: 'DBRef' });

	/**
	 * wasm optimizations, to do native i64 multiplication and divide
	 */
	var wasm = undefined;
	try {
	    wasm = new WebAssembly.Instance(new WebAssembly.Module(
	    // prettier-ignore
	    new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 13, 2, 96, 0, 1, 127, 96, 4, 127, 127, 127, 127, 1, 127, 3, 7, 6, 0, 1, 1, 1, 1, 1, 6, 6, 1, 127, 1, 65, 0, 11, 7, 50, 6, 3, 109, 117, 108, 0, 1, 5, 100, 105, 118, 95, 115, 0, 2, 5, 100, 105, 118, 95, 117, 0, 3, 5, 114, 101, 109, 95, 115, 0, 4, 5, 114, 101, 109, 95, 117, 0, 5, 8, 103, 101, 116, 95, 104, 105, 103, 104, 0, 0, 10, 191, 1, 6, 4, 0, 35, 0, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 126, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 127, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 128, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 129, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11, 36, 1, 1, 126, 32, 0, 173, 32, 1, 173, 66, 32, 134, 132, 32, 2, 173, 32, 3, 173, 66, 32, 134, 132, 130, 34, 4, 66, 32, 135, 167, 36, 0, 32, 4, 167, 11])), {}).exports;
	}
	catch (_a) {
	    // no wasm support
	}
	var TWO_PWR_16_DBL = 1 << 16;
	var TWO_PWR_24_DBL = 1 << 24;
	var TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL;
	var TWO_PWR_64_DBL = TWO_PWR_32_DBL * TWO_PWR_32_DBL;
	var TWO_PWR_63_DBL = TWO_PWR_64_DBL / 2;
	/** A cache of the Long representations of small integer values. */
	var INT_CACHE = {};
	/** A cache of the Long representations of small unsigned integer values. */
	var UINT_CACHE = {};
	/**
	 * A class representing a 64-bit integer
	 * @public
	 * @remarks
	 * The internal representation of a long is the two given signed, 32-bit values.
	 * We use 32-bit pieces because these are the size of integers on which
	 * Javascript performs bit-operations.  For operations like addition and
	 * multiplication, we split each number into 16 bit pieces, which can easily be
	 * multiplied within Javascript's floating-point representation without overflow
	 * or change in sign.
	 * In the algorithms below, we frequently reduce the negative case to the
	 * positive case by negating the input(s) and then post-processing the result.
	 * Note that we must ALWAYS check specially whether those values are MIN_VALUE
	 * (-2^63) because -MIN_VALUE == MIN_VALUE (since 2^63 cannot be represented as
	 * a positive number, it overflows back into a negative).  Not handling this
	 * case would often result in infinite recursion.
	 * Common constant values ZERO, ONE, NEG_ONE, etc. are found as static properties on this class.
	 */
	var Long = /** @class */ (function () {
	    /**
	     * Constructs a 64 bit two's-complement integer, given its low and high 32 bit values as *signed* integers.
	     *  See the from* functions below for more convenient ways of constructing Longs.
	     *
	     * Acceptable signatures are:
	     * - Long(low, high, unsigned?)
	     * - Long(bigint, unsigned?)
	     * - Long(string, unsigned?)
	     *
	     * @param low - The low (signed) 32 bits of the long
	     * @param high - The high (signed) 32 bits of the long
	     * @param unsigned - Whether unsigned or not, defaults to signed
	     */
	    function Long(low, high, unsigned) {
	        if (low === void 0) { low = 0; }
	        if (!(this instanceof Long))
	            return new Long(low, high, unsigned);
	        if (typeof low === 'bigint') {
	            Object.assign(this, Long.fromBigInt(low, !!high));
	        }
	        else if (typeof low === 'string') {
	            Object.assign(this, Long.fromString(low, !!high));
	        }
	        else {
	            this.low = low | 0;
	            this.high = high | 0;
	            this.unsigned = !!unsigned;
	        }
	        Object.defineProperty(this, '__isLong__', {
	            value: true,
	            configurable: false,
	            writable: false,
	            enumerable: false
	        });
	    }
	    /**
	     * Returns a Long representing the 64 bit integer that comes by concatenating the given low and high bits.
	     * Each is assumed to use 32 bits.
	     * @param lowBits - The low 32 bits
	     * @param highBits - The high 32 bits
	     * @param unsigned - Whether unsigned or not, defaults to signed
	     * @returns The corresponding Long value
	     */
	    Long.fromBits = function (lowBits, highBits, unsigned) {
	        return new Long(lowBits, highBits, unsigned);
	    };
	    /**
	     * Returns a Long representing the given 32 bit integer value.
	     * @param value - The 32 bit integer in question
	     * @param unsigned - Whether unsigned or not, defaults to signed
	     * @returns The corresponding Long value
	     */
	    Long.fromInt = function (value, unsigned) {
	        var obj, cachedObj, cache;
	        if (unsigned) {
	            value >>>= 0;
	            if ((cache = 0 <= value && value < 256)) {
	                cachedObj = UINT_CACHE[value];
	                if (cachedObj)
	                    return cachedObj;
	            }
	            obj = Long.fromBits(value, (value | 0) < 0 ? -1 : 0, true);
	            if (cache)
	                UINT_CACHE[value] = obj;
	            return obj;
	        }
	        else {
	            value |= 0;
	            if ((cache = -128 <= value && value < 128)) {
	                cachedObj = INT_CACHE[value];
	                if (cachedObj)
	                    return cachedObj;
	            }
	            obj = Long.fromBits(value, value < 0 ? -1 : 0, false);
	            if (cache)
	                INT_CACHE[value] = obj;
	            return obj;
	        }
	    };
	    /**
	     * Returns a Long representing the given value, provided that it is a finite number. Otherwise, zero is returned.
	     * @param value - The number in question
	     * @param unsigned - Whether unsigned or not, defaults to signed
	     * @returns The corresponding Long value
	     */
	    Long.fromNumber = function (value, unsigned) {
	        if (isNaN(value))
	            return unsigned ? Long.UZERO : Long.ZERO;
	        if (unsigned) {
	            if (value < 0)
	                return Long.UZERO;
	            if (value >= TWO_PWR_64_DBL)
	                return Long.MAX_UNSIGNED_VALUE;
	        }
	        else {
	            if (value <= -TWO_PWR_63_DBL)
	                return Long.MIN_VALUE;
	            if (value + 1 >= TWO_PWR_63_DBL)
	                return Long.MAX_VALUE;
	        }
	        if (value < 0)
	            return Long.fromNumber(-value, unsigned).neg();
	        return Long.fromBits(value % TWO_PWR_32_DBL | 0, (value / TWO_PWR_32_DBL) | 0, unsigned);
	    };
	    /**
	     * Returns a Long representing the given value, provided that it is a finite number. Otherwise, zero is returned.
	     * @param value - The number in question
	     * @param unsigned - Whether unsigned or not, defaults to signed
	     * @returns The corresponding Long value
	     */
	    Long.fromBigInt = function (value, unsigned) {
	        return Long.fromString(value.toString(), unsigned);
	    };
	    /**
	     * Returns a Long representation of the given string, written using the specified radix.
	     * @param str - The textual representation of the Long
	     * @param unsigned - Whether unsigned or not, defaults to signed
	     * @param radix - The radix in which the text is written (2-36), defaults to 10
	     * @returns The corresponding Long value
	     */
	    Long.fromString = function (str, unsigned, radix) {
	        if (str.length === 0)
	            throw Error('empty string');
	        if (str === 'NaN' || str === 'Infinity' || str === '+Infinity' || str === '-Infinity')
	            return Long.ZERO;
	        if (typeof unsigned === 'number') {
	            // For goog.math.long compatibility
	            (radix = unsigned), (unsigned = false);
	        }
	        else {
	            unsigned = !!unsigned;
	        }
	        radix = radix || 10;
	        if (radix < 2 || 36 < radix)
	            throw RangeError('radix');
	        var p;
	        if ((p = str.indexOf('-')) > 0)
	            throw Error('interior hyphen');
	        else if (p === 0) {
	            return Long.fromString(str.substring(1), unsigned, radix).neg();
	        }
	        // Do several (8) digits each time through the loop, so as to
	        // minimize the calls to the very expensive emulated div.
	        var radixToPower = Long.fromNumber(Math.pow(radix, 8));
	        var result = Long.ZERO;
	        for (var i = 0; i < str.length; i += 8) {
	            var size = Math.min(8, str.length - i), value = parseInt(str.substring(i, i + size), radix);
	            if (size < 8) {
	                var power = Long.fromNumber(Math.pow(radix, size));
	                result = result.mul(power).add(Long.fromNumber(value));
	            }
	            else {
	                result = result.mul(radixToPower);
	                result = result.add(Long.fromNumber(value));
	            }
	        }
	        result.unsigned = unsigned;
	        return result;
	    };
	    /**
	     * Creates a Long from its byte representation.
	     * @param bytes - Byte representation
	     * @param unsigned - Whether unsigned or not, defaults to signed
	     * @param le - Whether little or big endian, defaults to big endian
	     * @returns The corresponding Long value
	     */
	    Long.fromBytes = function (bytes, unsigned, le) {
	        return le ? Long.fromBytesLE(bytes, unsigned) : Long.fromBytesBE(bytes, unsigned);
	    };
	    /**
	     * Creates a Long from its little endian byte representation.
	     * @param bytes - Little endian byte representation
	     * @param unsigned - Whether unsigned or not, defaults to signed
	     * @returns The corresponding Long value
	     */
	    Long.fromBytesLE = function (bytes, unsigned) {
	        return new Long(bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24), bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24), unsigned);
	    };
	    /**
	     * Creates a Long from its big endian byte representation.
	     * @param bytes - Big endian byte representation
	     * @param unsigned - Whether unsigned or not, defaults to signed
	     * @returns The corresponding Long value
	     */
	    Long.fromBytesBE = function (bytes, unsigned) {
	        return new Long((bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7], (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3], unsigned);
	    };
	    /**
	     * Tests if the specified object is a Long.
	     */
	    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
	    Long.isLong = function (value) {
	        return isObjectLike$1(value) && value['__isLong__'] === true;
	    };
	    /**
	     * Converts the specified value to a Long.
	     * @param unsigned - Whether unsigned or not, defaults to signed
	     */
	    Long.fromValue = function (val, unsigned) {
	        if (typeof val === 'number')
	            return Long.fromNumber(val, unsigned);
	        if (typeof val === 'string')
	            return Long.fromString(val, unsigned);
	        // Throws for non-objects, converts non-instanceof Long:
	        return Long.fromBits(val.low, val.high, typeof unsigned === 'boolean' ? unsigned : val.unsigned);
	    };
	    /** Returns the sum of this and the specified Long. */
	    Long.prototype.add = function (addend) {
	        if (!Long.isLong(addend))
	            addend = Long.fromValue(addend);
	        // Divide each number into 4 chunks of 16 bits, and then sum the chunks.
	        var a48 = this.high >>> 16;
	        var a32 = this.high & 0xffff;
	        var a16 = this.low >>> 16;
	        var a00 = this.low & 0xffff;
	        var b48 = addend.high >>> 16;
	        var b32 = addend.high & 0xffff;
	        var b16 = addend.low >>> 16;
	        var b00 = addend.low & 0xffff;
	        var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
	        c00 += a00 + b00;
	        c16 += c00 >>> 16;
	        c00 &= 0xffff;
	        c16 += a16 + b16;
	        c32 += c16 >>> 16;
	        c16 &= 0xffff;
	        c32 += a32 + b32;
	        c48 += c32 >>> 16;
	        c32 &= 0xffff;
	        c48 += a48 + b48;
	        c48 &= 0xffff;
	        return Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32, this.unsigned);
	    };
	    /**
	     * Returns the sum of this and the specified Long.
	     * @returns Sum
	     */
	    Long.prototype.and = function (other) {
	        if (!Long.isLong(other))
	            other = Long.fromValue(other);
	        return Long.fromBits(this.low & other.low, this.high & other.high, this.unsigned);
	    };
	    /**
	     * Compares this Long's value with the specified's.
	     * @returns 0 if they are the same, 1 if the this is greater and -1 if the given one is greater
	     */
	    Long.prototype.compare = function (other) {
	        if (!Long.isLong(other))
	            other = Long.fromValue(other);
	        if (this.eq(other))
	            return 0;
	        var thisNeg = this.isNegative(), otherNeg = other.isNegative();
	        if (thisNeg && !otherNeg)
	            return -1;
	        if (!thisNeg && otherNeg)
	            return 1;
	        // At this point the sign bits are the same
	        if (!this.unsigned)
	            return this.sub(other).isNegative() ? -1 : 1;
	        // Both are positive if at least one is unsigned
	        return other.high >>> 0 > this.high >>> 0 ||
	            (other.high === this.high && other.low >>> 0 > this.low >>> 0)
	            ? -1
	            : 1;
	    };
	    /** This is an alias of {@link Long.compare} */
	    Long.prototype.comp = function (other) {
	        return this.compare(other);
	    };
	    /**
	     * Returns this Long divided by the specified. The result is signed if this Long is signed or unsigned if this Long is unsigned.
	     * @returns Quotient
	     */
	    Long.prototype.divide = function (divisor) {
	        if (!Long.isLong(divisor))
	            divisor = Long.fromValue(divisor);
	        if (divisor.isZero())
	            throw Error('division by zero');
	        // use wasm support if present
	        if (wasm) {
	            // guard against signed division overflow: the largest
	            // negative number / -1 would be 1 larger than the largest
	            // positive number, due to two's complement.
	            if (!this.unsigned &&
	                this.high === -0x80000000 &&
	                divisor.low === -1 &&
	                divisor.high === -1) {
	                // be consistent with non-wasm code path
	                return this;
	            }
	            var low = (this.unsigned ? wasm.div_u : wasm.div_s)(this.low, this.high, divisor.low, divisor.high);
	            return Long.fromBits(low, wasm.get_high(), this.unsigned);
	        }
	        if (this.isZero())
	            return this.unsigned ? Long.UZERO : Long.ZERO;
	        var approx, rem, res;
	        if (!this.unsigned) {
	            // This section is only relevant for signed longs and is derived from the
	            // closure library as a whole.
	            if (this.eq(Long.MIN_VALUE)) {
	                if (divisor.eq(Long.ONE) || divisor.eq(Long.NEG_ONE))
	                    return Long.MIN_VALUE;
	                // recall that -MIN_VALUE == MIN_VALUE
	                else if (divisor.eq(Long.MIN_VALUE))
	                    return Long.ONE;
	                else {
	                    // At this point, we have |other| >= 2, so |this/other| < |MIN_VALUE|.
	                    var halfThis = this.shr(1);
	                    approx = halfThis.div(divisor).shl(1);
	                    if (approx.eq(Long.ZERO)) {
	                        return divisor.isNegative() ? Long.ONE : Long.NEG_ONE;
	                    }
	                    else {
	                        rem = this.sub(divisor.mul(approx));
	                        res = approx.add(rem.div(divisor));
	                        return res;
	                    }
	                }
	            }
	            else if (divisor.eq(Long.MIN_VALUE))
	                return this.unsigned ? Long.UZERO : Long.ZERO;
	            if (this.isNegative()) {
	                if (divisor.isNegative())
	                    return this.neg().div(divisor.neg());
	                return this.neg().div(divisor).neg();
	            }
	            else if (divisor.isNegative())
	                return this.div(divisor.neg()).neg();
	            res = Long.ZERO;
	        }
	        else {
	            // The algorithm below has not been made for unsigned longs. It's therefore
	            // required to take special care of the MSB prior to running it.
	            if (!divisor.unsigned)
	                divisor = divisor.toUnsigned();
	            if (divisor.gt(this))
	                return Long.UZERO;
	            if (divisor.gt(this.shru(1)))
	                // 15 >>> 1 = 7 ; with divisor = 8 ; true
	                return Long.UONE;
	            res = Long.UZERO;
	        }
	        // Repeat the following until the remainder is less than other:  find a
	        // floating-point that approximates remainder / other *from below*, add this
	        // into the result, and subtract it from the remainder.  It is critical that
	        // the approximate value is less than or equal to the real value so that the
	        // remainder never becomes negative.
	        rem = this;
	        while (rem.gte(divisor)) {
	            // Approximate the result of division. This may be a little greater or
	            // smaller than the actual value.
	            approx = Math.max(1, Math.floor(rem.toNumber() / divisor.toNumber()));
	            // We will tweak the approximate result by changing it in the 48-th digit or
	            // the smallest non-fractional digit, whichever is larger.
	            var log2 = Math.ceil(Math.log(approx) / Math.LN2);
	            var delta = log2 <= 48 ? 1 : Math.pow(2, log2 - 48);
	            // Decrease the approximation until it is smaller than the remainder.  Note
	            // that if it is too large, the product overflows and is negative.
	            var approxRes = Long.fromNumber(approx);
	            var approxRem = approxRes.mul(divisor);
	            while (approxRem.isNegative() || approxRem.gt(rem)) {
	                approx -= delta;
	                approxRes = Long.fromNumber(approx, this.unsigned);
	                approxRem = approxRes.mul(divisor);
	            }
	            // We know the answer can't be zero... and actually, zero would cause
	            // infinite recursion since we would make no progress.
	            if (approxRes.isZero())
	                approxRes = Long.ONE;
	            res = res.add(approxRes);
	            rem = rem.sub(approxRem);
	        }
	        return res;
	    };
	    /**This is an alias of {@link Long.divide} */
	    Long.prototype.div = function (divisor) {
	        return this.divide(divisor);
	    };
	    /**
	     * Tests if this Long's value equals the specified's.
	     * @param other - Other value
	     */
	    Long.prototype.equals = function (other) {
	        if (!Long.isLong(other))
	            other = Long.fromValue(other);
	        if (this.unsigned !== other.unsigned && this.high >>> 31 === 1 && other.high >>> 31 === 1)
	            return false;
	        return this.high === other.high && this.low === other.low;
	    };
	    /** This is an alias of {@link Long.equals} */
	    Long.prototype.eq = function (other) {
	        return this.equals(other);
	    };
	    /** Gets the high 32 bits as a signed integer. */
	    Long.prototype.getHighBits = function () {
	        return this.high;
	    };
	    /** Gets the high 32 bits as an unsigned integer. */
	    Long.prototype.getHighBitsUnsigned = function () {
	        return this.high >>> 0;
	    };
	    /** Gets the low 32 bits as a signed integer. */
	    Long.prototype.getLowBits = function () {
	        return this.low;
	    };
	    /** Gets the low 32 bits as an unsigned integer. */
	    Long.prototype.getLowBitsUnsigned = function () {
	        return this.low >>> 0;
	    };
	    /** Gets the number of bits needed to represent the absolute value of this Long. */
	    Long.prototype.getNumBitsAbs = function () {
	        if (this.isNegative()) {
	            // Unsigned Longs are never negative
	            return this.eq(Long.MIN_VALUE) ? 64 : this.neg().getNumBitsAbs();
	        }
	        var val = this.high !== 0 ? this.high : this.low;
	        var bit;
	        for (bit = 31; bit > 0; bit--)
	            if ((val & (1 << bit)) !== 0)
	                break;
	        return this.high !== 0 ? bit + 33 : bit + 1;
	    };
	    /** Tests if this Long's value is greater than the specified's. */
	    Long.prototype.greaterThan = function (other) {
	        return this.comp(other) > 0;
	    };
	    /** This is an alias of {@link Long.greaterThan} */
	    Long.prototype.gt = function (other) {
	        return this.greaterThan(other);
	    };
	    /** Tests if this Long's value is greater than or equal the specified's. */
	    Long.prototype.greaterThanOrEqual = function (other) {
	        return this.comp(other) >= 0;
	    };
	    /** This is an alias of {@link Long.greaterThanOrEqual} */
	    Long.prototype.gte = function (other) {
	        return this.greaterThanOrEqual(other);
	    };
	    /** This is an alias of {@link Long.greaterThanOrEqual} */
	    Long.prototype.ge = function (other) {
	        return this.greaterThanOrEqual(other);
	    };
	    /** Tests if this Long's value is even. */
	    Long.prototype.isEven = function () {
	        return (this.low & 1) === 0;
	    };
	    /** Tests if this Long's value is negative. */
	    Long.prototype.isNegative = function () {
	        return !this.unsigned && this.high < 0;
	    };
	    /** Tests if this Long's value is odd. */
	    Long.prototype.isOdd = function () {
	        return (this.low & 1) === 1;
	    };
	    /** Tests if this Long's value is positive. */
	    Long.prototype.isPositive = function () {
	        return this.unsigned || this.high >= 0;
	    };
	    /** Tests if this Long's value equals zero. */
	    Long.prototype.isZero = function () {
	        return this.high === 0 && this.low === 0;
	    };
	    /** Tests if this Long's value is less than the specified's. */
	    Long.prototype.lessThan = function (other) {
	        return this.comp(other) < 0;
	    };
	    /** This is an alias of {@link Long#lessThan}. */
	    Long.prototype.lt = function (other) {
	        return this.lessThan(other);
	    };
	    /** Tests if this Long's value is less than or equal the specified's. */
	    Long.prototype.lessThanOrEqual = function (other) {
	        return this.comp(other) <= 0;
	    };
	    /** This is an alias of {@link Long.lessThanOrEqual} */
	    Long.prototype.lte = function (other) {
	        return this.lessThanOrEqual(other);
	    };
	    /** Returns this Long modulo the specified. */
	    Long.prototype.modulo = function (divisor) {
	        if (!Long.isLong(divisor))
	            divisor = Long.fromValue(divisor);
	        // use wasm support if present
	        if (wasm) {
	            var low = (this.unsigned ? wasm.rem_u : wasm.rem_s)(this.low, this.high, divisor.low, divisor.high);
	            return Long.fromBits(low, wasm.get_high(), this.unsigned);
	        }
	        return this.sub(this.div(divisor).mul(divisor));
	    };
	    /** This is an alias of {@link Long.modulo} */
	    Long.prototype.mod = function (divisor) {
	        return this.modulo(divisor);
	    };
	    /** This is an alias of {@link Long.modulo} */
	    Long.prototype.rem = function (divisor) {
	        return this.modulo(divisor);
	    };
	    /**
	     * Returns the product of this and the specified Long.
	     * @param multiplier - Multiplier
	     * @returns Product
	     */
	    Long.prototype.multiply = function (multiplier) {
	        if (this.isZero())
	            return Long.ZERO;
	        if (!Long.isLong(multiplier))
	            multiplier = Long.fromValue(multiplier);
	        // use wasm support if present
	        if (wasm) {
	            var low = wasm.mul(this.low, this.high, multiplier.low, multiplier.high);
	            return Long.fromBits(low, wasm.get_high(), this.unsigned);
	        }
	        if (multiplier.isZero())
	            return Long.ZERO;
	        if (this.eq(Long.MIN_VALUE))
	            return multiplier.isOdd() ? Long.MIN_VALUE : Long.ZERO;
	        if (multiplier.eq(Long.MIN_VALUE))
	            return this.isOdd() ? Long.MIN_VALUE : Long.ZERO;
	        if (this.isNegative()) {
	            if (multiplier.isNegative())
	                return this.neg().mul(multiplier.neg());
	            else
	                return this.neg().mul(multiplier).neg();
	        }
	        else if (multiplier.isNegative())
	            return this.mul(multiplier.neg()).neg();
	        // If both longs are small, use float multiplication
	        if (this.lt(Long.TWO_PWR_24) && multiplier.lt(Long.TWO_PWR_24))
	            return Long.fromNumber(this.toNumber() * multiplier.toNumber(), this.unsigned);
	        // Divide each long into 4 chunks of 16 bits, and then add up 4x4 products.
	        // We can skip products that would overflow.
	        var a48 = this.high >>> 16;
	        var a32 = this.high & 0xffff;
	        var a16 = this.low >>> 16;
	        var a00 = this.low & 0xffff;
	        var b48 = multiplier.high >>> 16;
	        var b32 = multiplier.high & 0xffff;
	        var b16 = multiplier.low >>> 16;
	        var b00 = multiplier.low & 0xffff;
	        var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
	        c00 += a00 * b00;
	        c16 += c00 >>> 16;
	        c00 &= 0xffff;
	        c16 += a16 * b00;
	        c32 += c16 >>> 16;
	        c16 &= 0xffff;
	        c16 += a00 * b16;
	        c32 += c16 >>> 16;
	        c16 &= 0xffff;
	        c32 += a32 * b00;
	        c48 += c32 >>> 16;
	        c32 &= 0xffff;
	        c32 += a16 * b16;
	        c48 += c32 >>> 16;
	        c32 &= 0xffff;
	        c32 += a00 * b32;
	        c48 += c32 >>> 16;
	        c32 &= 0xffff;
	        c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
	        c48 &= 0xffff;
	        return Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32, this.unsigned);
	    };
	    /** This is an alias of {@link Long.multiply} */
	    Long.prototype.mul = function (multiplier) {
	        return this.multiply(multiplier);
	    };
	    /** Returns the Negation of this Long's value. */
	    Long.prototype.negate = function () {
	        if (!this.unsigned && this.eq(Long.MIN_VALUE))
	            return Long.MIN_VALUE;
	        return this.not().add(Long.ONE);
	    };
	    /** This is an alias of {@link Long.negate} */
	    Long.prototype.neg = function () {
	        return this.negate();
	    };
	    /** Returns the bitwise NOT of this Long. */
	    Long.prototype.not = function () {
	        return Long.fromBits(~this.low, ~this.high, this.unsigned);
	    };
	    /** Tests if this Long's value differs from the specified's. */
	    Long.prototype.notEquals = function (other) {
	        return !this.equals(other);
	    };
	    /** This is an alias of {@link Long.notEquals} */
	    Long.prototype.neq = function (other) {
	        return this.notEquals(other);
	    };
	    /** This is an alias of {@link Long.notEquals} */
	    Long.prototype.ne = function (other) {
	        return this.notEquals(other);
	    };
	    /**
	     * Returns the bitwise OR of this Long and the specified.
	     */
	    Long.prototype.or = function (other) {
	        if (!Long.isLong(other))
	            other = Long.fromValue(other);
	        return Long.fromBits(this.low | other.low, this.high | other.high, this.unsigned);
	    };
	    /**
	     * Returns this Long with bits shifted to the left by the given amount.
	     * @param numBits - Number of bits
	     * @returns Shifted Long
	     */
	    Long.prototype.shiftLeft = function (numBits) {
	        if (Long.isLong(numBits))
	            numBits = numBits.toInt();
	        if ((numBits &= 63) === 0)
	            return this;
	        else if (numBits < 32)
	            return Long.fromBits(this.low << numBits, (this.high << numBits) | (this.low >>> (32 - numBits)), this.unsigned);
	        else
	            return Long.fromBits(0, this.low << (numBits - 32), this.unsigned);
	    };
	    /** This is an alias of {@link Long.shiftLeft} */
	    Long.prototype.shl = function (numBits) {
	        return this.shiftLeft(numBits);
	    };
	    /**
	     * Returns this Long with bits arithmetically shifted to the right by the given amount.
	     * @param numBits - Number of bits
	     * @returns Shifted Long
	     */
	    Long.prototype.shiftRight = function (numBits) {
	        if (Long.isLong(numBits))
	            numBits = numBits.toInt();
	        if ((numBits &= 63) === 0)
	            return this;
	        else if (numBits < 32)
	            return Long.fromBits((this.low >>> numBits) | (this.high << (32 - numBits)), this.high >> numBits, this.unsigned);
	        else
	            return Long.fromBits(this.high >> (numBits - 32), this.high >= 0 ? 0 : -1, this.unsigned);
	    };
	    /** This is an alias of {@link Long.shiftRight} */
	    Long.prototype.shr = function (numBits) {
	        return this.shiftRight(numBits);
	    };
	    /**
	     * Returns this Long with bits logically shifted to the right by the given amount.
	     * @param numBits - Number of bits
	     * @returns Shifted Long
	     */
	    Long.prototype.shiftRightUnsigned = function (numBits) {
	        if (Long.isLong(numBits))
	            numBits = numBits.toInt();
	        numBits &= 63;
	        if (numBits === 0)
	            return this;
	        else {
	            var high = this.high;
	            if (numBits < 32) {
	                var low = this.low;
	                return Long.fromBits((low >>> numBits) | (high << (32 - numBits)), high >>> numBits, this.unsigned);
	            }
	            else if (numBits === 32)
	                return Long.fromBits(high, 0, this.unsigned);
	            else
	                return Long.fromBits(high >>> (numBits - 32), 0, this.unsigned);
	        }
	    };
	    /** This is an alias of {@link Long.shiftRightUnsigned} */
	    Long.prototype.shr_u = function (numBits) {
	        return this.shiftRightUnsigned(numBits);
	    };
	    /** This is an alias of {@link Long.shiftRightUnsigned} */
	    Long.prototype.shru = function (numBits) {
	        return this.shiftRightUnsigned(numBits);
	    };
	    /**
	     * Returns the difference of this and the specified Long.
	     * @param subtrahend - Subtrahend
	     * @returns Difference
	     */
	    Long.prototype.subtract = function (subtrahend) {
	        if (!Long.isLong(subtrahend))
	            subtrahend = Long.fromValue(subtrahend);
	        return this.add(subtrahend.neg());
	    };
	    /** This is an alias of {@link Long.subtract} */
	    Long.prototype.sub = function (subtrahend) {
	        return this.subtract(subtrahend);
	    };
	    /** Converts the Long to a 32 bit integer, assuming it is a 32 bit integer. */
	    Long.prototype.toInt = function () {
	        return this.unsigned ? this.low >>> 0 : this.low;
	    };
	    /** Converts the Long to a the nearest floating-point representation of this value (double, 53 bit mantissa). */
	    Long.prototype.toNumber = function () {
	        if (this.unsigned)
	            return (this.high >>> 0) * TWO_PWR_32_DBL + (this.low >>> 0);
	        return this.high * TWO_PWR_32_DBL + (this.low >>> 0);
	    };
	    /** Converts the Long to a BigInt (arbitrary precision). */
	    Long.prototype.toBigInt = function () {
	        return BigInt(this.toString());
	    };
	    /**
	     * Converts this Long to its byte representation.
	     * @param le - Whether little or big endian, defaults to big endian
	     * @returns Byte representation
	     */
	    Long.prototype.toBytes = function (le) {
	        return le ? this.toBytesLE() : this.toBytesBE();
	    };
	    /**
	     * Converts this Long to its little endian byte representation.
	     * @returns Little endian byte representation
	     */
	    Long.prototype.toBytesLE = function () {
	        var hi = this.high, lo = this.low;
	        return [
	            lo & 0xff,
	            (lo >>> 8) & 0xff,
	            (lo >>> 16) & 0xff,
	            lo >>> 24,
	            hi & 0xff,
	            (hi >>> 8) & 0xff,
	            (hi >>> 16) & 0xff,
	            hi >>> 24
	        ];
	    };
	    /**
	     * Converts this Long to its big endian byte representation.
	     * @returns Big endian byte representation
	     */
	    Long.prototype.toBytesBE = function () {
	        var hi = this.high, lo = this.low;
	        return [
	            hi >>> 24,
	            (hi >>> 16) & 0xff,
	            (hi >>> 8) & 0xff,
	            hi & 0xff,
	            lo >>> 24,
	            (lo >>> 16) & 0xff,
	            (lo >>> 8) & 0xff,
	            lo & 0xff
	        ];
	    };
	    /**
	     * Converts this Long to signed.
	     */
	    Long.prototype.toSigned = function () {
	        if (!this.unsigned)
	            return this;
	        return Long.fromBits(this.low, this.high, false);
	    };
	    /**
	     * Converts the Long to a string written in the specified radix.
	     * @param radix - Radix (2-36), defaults to 10
	     * @throws RangeError If `radix` is out of range
	     */
	    Long.prototype.toString = function (radix) {
	        radix = radix || 10;
	        if (radix < 2 || 36 < radix)
	            throw RangeError('radix');
	        if (this.isZero())
	            return '0';
	        if (this.isNegative()) {
	            // Unsigned Longs are never negative
	            if (this.eq(Long.MIN_VALUE)) {
	                // We need to change the Long value before it can be negated, so we remove
	                // the bottom-most digit in this base and then recurse to do the rest.
	                var radixLong = Long.fromNumber(radix), div = this.div(radixLong), rem1 = div.mul(radixLong).sub(this);
	                return div.toString(radix) + rem1.toInt().toString(radix);
	            }
	            else
	                return '-' + this.neg().toString(radix);
	        }
	        // Do several (6) digits each time through the loop, so as to
	        // minimize the calls to the very expensive emulated div.
	        var radixToPower = Long.fromNumber(Math.pow(radix, 6), this.unsigned);
	        // eslint-disable-next-line @typescript-eslint/no-this-alias
	        var rem = this;
	        var result = '';
	        // eslint-disable-next-line no-constant-condition
	        while (true) {
	            var remDiv = rem.div(radixToPower);
	            var intval = rem.sub(remDiv.mul(radixToPower)).toInt() >>> 0;
	            var digits = intval.toString(radix);
	            rem = remDiv;
	            if (rem.isZero()) {
	                return digits + result;
	            }
	            else {
	                while (digits.length < 6)
	                    digits = '0' + digits;
	                result = '' + digits + result;
	            }
	        }
	    };
	    /** Converts this Long to unsigned. */
	    Long.prototype.toUnsigned = function () {
	        if (this.unsigned)
	            return this;
	        return Long.fromBits(this.low, this.high, true);
	    };
	    /** Returns the bitwise XOR of this Long and the given one. */
	    Long.prototype.xor = function (other) {
	        if (!Long.isLong(other))
	            other = Long.fromValue(other);
	        return Long.fromBits(this.low ^ other.low, this.high ^ other.high, this.unsigned);
	    };
	    /** This is an alias of {@link Long.isZero} */
	    Long.prototype.eqz = function () {
	        return this.isZero();
	    };
	    /** This is an alias of {@link Long.lessThanOrEqual} */
	    Long.prototype.le = function (other) {
	        return this.lessThanOrEqual(other);
	    };
	    /*
	     ****************************************************************
	     *                  BSON SPECIFIC ADDITIONS                     *
	     ****************************************************************
	     */
	    Long.prototype.toExtendedJSON = function (options) {
	        if (options && options.relaxed)
	            return this.toNumber();
	        return { $numberLong: this.toString() };
	    };
	    Long.fromExtendedJSON = function (doc, options) {
	        var result = Long.fromString(doc.$numberLong);
	        return options && options.relaxed ? result.toNumber() : result;
	    };
	    /** @internal */
	    Long.prototype[Symbol.for('nodejs.util.inspect.custom')] = function () {
	        return this.inspect();
	    };
	    Long.prototype.inspect = function () {
	        return "new Long(\"" + this.toString() + "\"" + (this.unsigned ? ', true' : '') + ")";
	    };
	    Long.TWO_PWR_24 = Long.fromInt(TWO_PWR_24_DBL);
	    /** Maximum unsigned value. */
	    Long.MAX_UNSIGNED_VALUE = Long.fromBits(0xffffffff | 0, 0xffffffff | 0, true);
	    /** Signed zero */
	    Long.ZERO = Long.fromInt(0);
	    /** Unsigned zero. */
	    Long.UZERO = Long.fromInt(0, true);
	    /** Signed one. */
	    Long.ONE = Long.fromInt(1);
	    /** Unsigned one. */
	    Long.UONE = Long.fromInt(1, true);
	    /** Signed negative one. */
	    Long.NEG_ONE = Long.fromInt(-1);
	    /** Maximum signed value. */
	    Long.MAX_VALUE = Long.fromBits(0xffffffff | 0, 0x7fffffff | 0, false);
	    /** Minimum signed value. */
	    Long.MIN_VALUE = Long.fromBits(0, 0x80000000 | 0, false);
	    return Long;
	}());
	Object.defineProperty(Long.prototype, '__isLong__', { value: true });
	Object.defineProperty(Long.prototype, '_bsontype', { value: 'Long' });

	var PARSE_STRING_REGEXP = /^(\+|-)?(\d+|(\d*\.\d*))?(E|e)?([-+])?(\d+)?$/;
	var PARSE_INF_REGEXP = /^(\+|-)?(Infinity|inf)$/i;
	var PARSE_NAN_REGEXP = /^(\+|-)?NaN$/i;
	var EXPONENT_MAX = 6111;
	var EXPONENT_MIN = -6176;
	var EXPONENT_BIAS = 6176;
	var MAX_DIGITS = 34;
	// Nan value bits as 32 bit values (due to lack of longs)
	var NAN_BUFFER = [
	    0x7c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
	].reverse();
	// Infinity value bits 32 bit values (due to lack of longs)
	var INF_NEGATIVE_BUFFER = [
	    0xf8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
	].reverse();
	var INF_POSITIVE_BUFFER = [
	    0x78, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
	].reverse();
	var EXPONENT_REGEX = /^([-+])?(\d+)?$/;
	// Extract least significant 5 bits
	var COMBINATION_MASK = 0x1f;
	// Extract least significant 14 bits
	var EXPONENT_MASK = 0x3fff;
	// Value of combination field for Inf
	var COMBINATION_INFINITY = 30;
	// Value of combination field for NaN
	var COMBINATION_NAN = 31;
	// Detect if the value is a digit
	function isDigit(value) {
	    return !isNaN(parseInt(value, 10));
	}
	// Divide two uint128 values
	function divideu128(value) {
	    var DIVISOR = Long.fromNumber(1000 * 1000 * 1000);
	    var _rem = Long.fromNumber(0);
	    if (!value.parts[0] && !value.parts[1] && !value.parts[2] && !value.parts[3]) {
	        return { quotient: value, rem: _rem };
	    }
	    for (var i = 0; i <= 3; i++) {
	        // Adjust remainder to match value of next dividend
	        _rem = _rem.shiftLeft(32);
	        // Add the divided to _rem
	        _rem = _rem.add(new Long(value.parts[i], 0));
	        value.parts[i] = _rem.div(DIVISOR).low;
	        _rem = _rem.modulo(DIVISOR);
	    }
	    return { quotient: value, rem: _rem };
	}
	// Multiply two Long values and return the 128 bit value
	function multiply64x2(left, right) {
	    if (!left && !right) {
	        return { high: Long.fromNumber(0), low: Long.fromNumber(0) };
	    }
	    var leftHigh = left.shiftRightUnsigned(32);
	    var leftLow = new Long(left.getLowBits(), 0);
	    var rightHigh = right.shiftRightUnsigned(32);
	    var rightLow = new Long(right.getLowBits(), 0);
	    var productHigh = leftHigh.multiply(rightHigh);
	    var productMid = leftHigh.multiply(rightLow);
	    var productMid2 = leftLow.multiply(rightHigh);
	    var productLow = leftLow.multiply(rightLow);
	    productHigh = productHigh.add(productMid.shiftRightUnsigned(32));
	    productMid = new Long(productMid.getLowBits(), 0)
	        .add(productMid2)
	        .add(productLow.shiftRightUnsigned(32));
	    productHigh = productHigh.add(productMid.shiftRightUnsigned(32));
	    productLow = productMid.shiftLeft(32).add(new Long(productLow.getLowBits(), 0));
	    // Return the 128 bit result
	    return { high: productHigh, low: productLow };
	}
	function lessThan(left, right) {
	    // Make values unsigned
	    var uhleft = left.high >>> 0;
	    var uhright = right.high >>> 0;
	    // Compare high bits first
	    if (uhleft < uhright) {
	        return true;
	    }
	    else if (uhleft === uhright) {
	        var ulleft = left.low >>> 0;
	        var ulright = right.low >>> 0;
	        if (ulleft < ulright)
	            return true;
	    }
	    return false;
	}
	function invalidErr(string, message) {
	    throw new TypeError("\"" + string + "\" is not a valid Decimal128 string - " + message);
	}
	/**
	 * A class representation of the BSON Decimal128 type.
	 * @public
	 */
	var Decimal128 = /** @class */ (function () {
	    /**
	     * @param bytes - a buffer containing the raw Decimal128 bytes in little endian order,
	     *                or a string representation as returned by .toString()
	     */
	    function Decimal128(bytes) {
	        if (!(this instanceof Decimal128))
	            return new Decimal128(bytes);
	        if (typeof bytes === 'string') {
	            this.bytes = Decimal128.fromString(bytes).bytes;
	        }
	        else {
	            this.bytes = bytes;
	        }
	    }
	    /**
	     * Create a Decimal128 instance from a string representation
	     *
	     * @param representation - a numeric string representation.
	     */
	    Decimal128.fromString = function (representation) {
	        // Parse state tracking
	        var isNegative = false;
	        var sawRadix = false;
	        var foundNonZero = false;
	        // Total number of significant digits (no leading or trailing zero)
	        var significantDigits = 0;
	        // Total number of significand digits read
	        var nDigitsRead = 0;
	        // Total number of digits (no leading zeros)
	        var nDigits = 0;
	        // The number of the digits after radix
	        var radixPosition = 0;
	        // The index of the first non-zero in *str*
	        var firstNonZero = 0;
	        // Digits Array
	        var digits = [0];
	        // The number of digits in digits
	        var nDigitsStored = 0;
	        // Insertion pointer for digits
	        var digitsInsert = 0;
	        // The index of the first non-zero digit
	        var firstDigit = 0;
	        // The index of the last digit
	        var lastDigit = 0;
	        // Exponent
	        var exponent = 0;
	        // loop index over array
	        var i = 0;
	        // The high 17 digits of the significand
	        var significandHigh = new Long(0, 0);
	        // The low 17 digits of the significand
	        var significandLow = new Long(0, 0);
	        // The biased exponent
	        var biasedExponent = 0;
	        // Read index
	        var index = 0;
	        // Naively prevent against REDOS attacks.
	        // TODO: implementing a custom parsing for this, or refactoring the regex would yield
	        //       further gains.
	        if (representation.length >= 7000) {
	            throw new TypeError('' + representation + ' not a valid Decimal128 string');
	        }
	        // Results
	        var stringMatch = representation.match(PARSE_STRING_REGEXP);
	        var infMatch = representation.match(PARSE_INF_REGEXP);
	        var nanMatch = representation.match(PARSE_NAN_REGEXP);
	        // Validate the string
	        if ((!stringMatch && !infMatch && !nanMatch) || representation.length === 0) {
	            throw new TypeError('' + representation + ' not a valid Decimal128 string');
	        }
	        if (stringMatch) {
	            // full_match = stringMatch[0]
	            // sign = stringMatch[1]
	            var unsignedNumber = stringMatch[2];
	            // stringMatch[3] is undefined if a whole number (ex "1", 12")
	            // but defined if a number w/ decimal in it (ex "1.0, 12.2")
	            var e = stringMatch[4];
	            var expSign = stringMatch[5];
	            var expNumber = stringMatch[6];
	            // they provided e, but didn't give an exponent number. for ex "1e"
	            if (e && expNumber === undefined)
	                invalidErr(representation, 'missing exponent power');
	            // they provided e, but didn't give a number before it. for ex "e1"
	            if (e && unsignedNumber === undefined)
	                invalidErr(representation, 'missing exponent base');
	            if (e === undefined && (expSign || expNumber)) {
	                invalidErr(representation, 'missing e before exponent');
	            }
	        }
	        // Get the negative or positive sign
	        if (representation[index] === '+' || representation[index] === '-') {
	            isNegative = representation[index++] === '-';
	        }
	        // Check if user passed Infinity or NaN
	        if (!isDigit(representation[index]) && representation[index] !== '.') {
	            if (representation[index] === 'i' || representation[index] === 'I') {
	                return new Decimal128(buffer_1.from(isNegative ? INF_NEGATIVE_BUFFER : INF_POSITIVE_BUFFER));
	            }
	            else if (representation[index] === 'N') {
	                return new Decimal128(buffer_1.from(NAN_BUFFER));
	            }
	        }
	        // Read all the digits
	        while (isDigit(representation[index]) || representation[index] === '.') {
	            if (representation[index] === '.') {
	                if (sawRadix)
	                    invalidErr(representation, 'contains multiple periods');
	                sawRadix = true;
	                index = index + 1;
	                continue;
	            }
	            if (nDigitsStored < 34) {
	                if (representation[index] !== '0' || foundNonZero) {
	                    if (!foundNonZero) {
	                        firstNonZero = nDigitsRead;
	                    }
	                    foundNonZero = true;
	                    // Only store 34 digits
	                    digits[digitsInsert++] = parseInt(representation[index], 10);
	                    nDigitsStored = nDigitsStored + 1;
	                }
	            }
	            if (foundNonZero)
	                nDigits = nDigits + 1;
	            if (sawRadix)
	                radixPosition = radixPosition + 1;
	            nDigitsRead = nDigitsRead + 1;
	            index = index + 1;
	        }
	        if (sawRadix && !nDigitsRead)
	            throw new TypeError('' + representation + ' not a valid Decimal128 string');
	        // Read exponent if exists
	        if (representation[index] === 'e' || representation[index] === 'E') {
	            // Read exponent digits
	            var match = representation.substr(++index).match(EXPONENT_REGEX);
	            // No digits read
	            if (!match || !match[2])
	                return new Decimal128(buffer_1.from(NAN_BUFFER));
	            // Get exponent
	            exponent = parseInt(match[0], 10);
	            // Adjust the index
	            index = index + match[0].length;
	        }
	        // Return not a number
	        if (representation[index])
	            return new Decimal128(buffer_1.from(NAN_BUFFER));
	        // Done reading input
	        // Find first non-zero digit in digits
	        firstDigit = 0;
	        if (!nDigitsStored) {
	            firstDigit = 0;
	            lastDigit = 0;
	            digits[0] = 0;
	            nDigits = 1;
	            nDigitsStored = 1;
	            significantDigits = 0;
	        }
	        else {
	            lastDigit = nDigitsStored - 1;
	            significantDigits = nDigits;
	            if (significantDigits !== 1) {
	                while (representation[firstNonZero + significantDigits - 1] === '0') {
	                    significantDigits = significantDigits - 1;
	                }
	            }
	        }
	        // Normalization of exponent
	        // Correct exponent based on radix position, and shift significand as needed
	        // to represent user input
	        // Overflow prevention
	        if (exponent <= radixPosition && radixPosition - exponent > 1 << 14) {
	            exponent = EXPONENT_MIN;
	        }
	        else {
	            exponent = exponent - radixPosition;
	        }
	        // Attempt to normalize the exponent
	        while (exponent > EXPONENT_MAX) {
	            // Shift exponent to significand and decrease
	            lastDigit = lastDigit + 1;
	            if (lastDigit - firstDigit > MAX_DIGITS) {
	                // Check if we have a zero then just hard clamp, otherwise fail
	                var digitsString = digits.join('');
	                if (digitsString.match(/^0+$/)) {
	                    exponent = EXPONENT_MAX;
	                    break;
	                }
	                invalidErr(representation, 'overflow');
	            }
	            exponent = exponent - 1;
	        }
	        while (exponent < EXPONENT_MIN || nDigitsStored < nDigits) {
	            // Shift last digit. can only do this if < significant digits than # stored.
	            if (lastDigit === 0 && significantDigits < nDigitsStored) {
	                exponent = EXPONENT_MIN;
	                significantDigits = 0;
	                break;
	            }
	            if (nDigitsStored < nDigits) {
	                // adjust to match digits not stored
	                nDigits = nDigits - 1;
	            }
	            else {
	                // adjust to round
	                lastDigit = lastDigit - 1;
	            }
	            if (exponent < EXPONENT_MAX) {
	                exponent = exponent + 1;
	            }
	            else {
	                // Check if we have a zero then just hard clamp, otherwise fail
	                var digitsString = digits.join('');
	                if (digitsString.match(/^0+$/)) {
	                    exponent = EXPONENT_MAX;
	                    break;
	                }
	                invalidErr(representation, 'overflow');
	            }
	        }
	        // Round
	        // We've normalized the exponent, but might still need to round.
	        if (lastDigit - firstDigit + 1 < significantDigits) {
	            var endOfString = nDigitsRead;
	            // If we have seen a radix point, 'string' is 1 longer than we have
	            // documented with ndigits_read, so inc the position of the first nonzero
	            // digit and the position that digits are read to.
	            if (sawRadix) {
	                firstNonZero = firstNonZero + 1;
	                endOfString = endOfString + 1;
	            }
	            // if negative, we need to increment again to account for - sign at start.
	            if (isNegative) {
	                firstNonZero = firstNonZero + 1;
	                endOfString = endOfString + 1;
	            }
	            var roundDigit = parseInt(representation[firstNonZero + lastDigit + 1], 10);
	            var roundBit = 0;
	            if (roundDigit >= 5) {
	                roundBit = 1;
	                if (roundDigit === 5) {
	                    roundBit = digits[lastDigit] % 2 === 1 ? 1 : 0;
	                    for (i = firstNonZero + lastDigit + 2; i < endOfString; i++) {
	                        if (parseInt(representation[i], 10)) {
	                            roundBit = 1;
	                            break;
	                        }
	                    }
	                }
	            }
	            if (roundBit) {
	                var dIdx = lastDigit;
	                for (; dIdx >= 0; dIdx--) {
	                    if (++digits[dIdx] > 9) {
	                        digits[dIdx] = 0;
	                        // overflowed most significant digit
	                        if (dIdx === 0) {
	                            if (exponent < EXPONENT_MAX) {
	                                exponent = exponent + 1;
	                                digits[dIdx] = 1;
	                            }
	                            else {
	                                return new Decimal128(buffer_1.from(isNegative ? INF_NEGATIVE_BUFFER : INF_POSITIVE_BUFFER));
	                            }
	                        }
	                    }
	                }
	            }
	        }
	        // Encode significand
	        // The high 17 digits of the significand
	        significandHigh = Long.fromNumber(0);
	        // The low 17 digits of the significand
	        significandLow = Long.fromNumber(0);
	        // read a zero
	        if (significantDigits === 0) {
	            significandHigh = Long.fromNumber(0);
	            significandLow = Long.fromNumber(0);
	        }
	        else if (lastDigit - firstDigit < 17) {
	            var dIdx = firstDigit;
	            significandLow = Long.fromNumber(digits[dIdx++]);
	            significandHigh = new Long(0, 0);
	            for (; dIdx <= lastDigit; dIdx++) {
	                significandLow = significandLow.multiply(Long.fromNumber(10));
	                significandLow = significandLow.add(Long.fromNumber(digits[dIdx]));
	            }
	        }
	        else {
	            var dIdx = firstDigit;
	            significandHigh = Long.fromNumber(digits[dIdx++]);
	            for (; dIdx <= lastDigit - 17; dIdx++) {
	                significandHigh = significandHigh.multiply(Long.fromNumber(10));
	                significandHigh = significandHigh.add(Long.fromNumber(digits[dIdx]));
	            }
	            significandLow = Long.fromNumber(digits[dIdx++]);
	            for (; dIdx <= lastDigit; dIdx++) {
	                significandLow = significandLow.multiply(Long.fromNumber(10));
	                significandLow = significandLow.add(Long.fromNumber(digits[dIdx]));
	            }
	        }
	        var significand = multiply64x2(significandHigh, Long.fromString('100000000000000000'));
	        significand.low = significand.low.add(significandLow);
	        if (lessThan(significand.low, significandLow)) {
	            significand.high = significand.high.add(Long.fromNumber(1));
	        }
	        // Biased exponent
	        biasedExponent = exponent + EXPONENT_BIAS;
	        var dec = { low: Long.fromNumber(0), high: Long.fromNumber(0) };
	        // Encode combination, exponent, and significand.
	        if (significand.high.shiftRightUnsigned(49).and(Long.fromNumber(1)).equals(Long.fromNumber(1))) {
	            // Encode '11' into bits 1 to 3
	            dec.high = dec.high.or(Long.fromNumber(0x3).shiftLeft(61));
	            dec.high = dec.high.or(Long.fromNumber(biasedExponent).and(Long.fromNumber(0x3fff).shiftLeft(47)));
	            dec.high = dec.high.or(significand.high.and(Long.fromNumber(0x7fffffffffff)));
	        }
	        else {
	            dec.high = dec.high.or(Long.fromNumber(biasedExponent & 0x3fff).shiftLeft(49));
	            dec.high = dec.high.or(significand.high.and(Long.fromNumber(0x1ffffffffffff)));
	        }
	        dec.low = significand.low;
	        // Encode sign
	        if (isNegative) {
	            dec.high = dec.high.or(Long.fromString('9223372036854775808'));
	        }
	        // Encode into a buffer
	        var buffer = buffer_1.alloc(16);
	        index = 0;
	        // Encode the low 64 bits of the decimal
	        // Encode low bits
	        buffer[index++] = dec.low.low & 0xff;
	        buffer[index++] = (dec.low.low >> 8) & 0xff;
	        buffer[index++] = (dec.low.low >> 16) & 0xff;
	        buffer[index++] = (dec.low.low >> 24) & 0xff;
	        // Encode high bits
	        buffer[index++] = dec.low.high & 0xff;
	        buffer[index++] = (dec.low.high >> 8) & 0xff;
	        buffer[index++] = (dec.low.high >> 16) & 0xff;
	        buffer[index++] = (dec.low.high >> 24) & 0xff;
	        // Encode the high 64 bits of the decimal
	        // Encode low bits
	        buffer[index++] = dec.high.low & 0xff;
	        buffer[index++] = (dec.high.low >> 8) & 0xff;
	        buffer[index++] = (dec.high.low >> 16) & 0xff;
	        buffer[index++] = (dec.high.low >> 24) & 0xff;
	        // Encode high bits
	        buffer[index++] = dec.high.high & 0xff;
	        buffer[index++] = (dec.high.high >> 8) & 0xff;
	        buffer[index++] = (dec.high.high >> 16) & 0xff;
	        buffer[index++] = (dec.high.high >> 24) & 0xff;
	        // Return the new Decimal128
	        return new Decimal128(buffer);
	    };
	    /** Create a string representation of the raw Decimal128 value */
	    Decimal128.prototype.toString = function () {
	        // Note: bits in this routine are referred to starting at 0,
	        // from the sign bit, towards the coefficient.
	        // decoded biased exponent (14 bits)
	        var biased_exponent;
	        // the number of significand digits
	        var significand_digits = 0;
	        // the base-10 digits in the significand
	        var significand = new Array(36);
	        for (var i = 0; i < significand.length; i++)
	            significand[i] = 0;
	        // read pointer into significand
	        var index = 0;
	        // true if the number is zero
	        var is_zero = false;
	        // the most significant significand bits (50-46)
	        var significand_msb;
	        // temporary storage for significand decoding
	        var significand128 = { parts: [0, 0, 0, 0] };
	        // indexing variables
	        var j, k;
	        // Output string
	        var string = [];
	        // Unpack index
	        index = 0;
	        // Buffer reference
	        var buffer = this.bytes;
	        // Unpack the low 64bits into a long
	        // bits 96 - 127
	        var low = buffer[index++] | (buffer[index++] << 8) | (buffer[index++] << 16) | (buffer[index++] << 24);
	        // bits 64 - 95
	        var midl = buffer[index++] | (buffer[index++] << 8) | (buffer[index++] << 16) | (buffer[index++] << 24);
	        // Unpack the high 64bits into a long
	        // bits 32 - 63
	        var midh = buffer[index++] | (buffer[index++] << 8) | (buffer[index++] << 16) | (buffer[index++] << 24);
	        // bits 0 - 31
	        var high = buffer[index++] | (buffer[index++] << 8) | (buffer[index++] << 16) | (buffer[index++] << 24);
	        // Unpack index
	        index = 0;
	        // Create the state of the decimal
	        var dec = {
	            low: new Long(low, midl),
	            high: new Long(midh, high)
	        };
	        if (dec.high.lessThan(Long.ZERO)) {
	            string.push('-');
	        }
	        // Decode combination field and exponent
	        // bits 1 - 5
	        var combination = (high >> 26) & COMBINATION_MASK;
	        if (combination >> 3 === 3) {
	            // Check for 'special' values
	            if (combination === COMBINATION_INFINITY) {
	                return string.join('') + 'Infinity';
	            }
	            else if (combination === COMBINATION_NAN) {
	                return 'NaN';
	            }
	            else {
	                biased_exponent = (high >> 15) & EXPONENT_MASK;
	                significand_msb = 0x08 + ((high >> 14) & 0x01);
	            }
	        }
	        else {
	            significand_msb = (high >> 14) & 0x07;
	            biased_exponent = (high >> 17) & EXPONENT_MASK;
	        }
	        // unbiased exponent
	        var exponent = biased_exponent - EXPONENT_BIAS;
	        // Create string of significand digits
	        // Convert the 114-bit binary number represented by
	        // (significand_high, significand_low) to at most 34 decimal
	        // digits through modulo and division.
	        significand128.parts[0] = (high & 0x3fff) + ((significand_msb & 0xf) << 14);
	        significand128.parts[1] = midh;
	        significand128.parts[2] = midl;
	        significand128.parts[3] = low;
	        if (significand128.parts[0] === 0 &&
	            significand128.parts[1] === 0 &&
	            significand128.parts[2] === 0 &&
	            significand128.parts[3] === 0) {
	            is_zero = true;
	        }
	        else {
	            for (k = 3; k >= 0; k--) {
	                var least_digits = 0;
	                // Perform the divide
	                var result = divideu128(significand128);
	                significand128 = result.quotient;
	                least_digits = result.rem.low;
	                // We now have the 9 least significant digits (in base 2).
	                // Convert and output to string.
	                if (!least_digits)
	                    continue;
	                for (j = 8; j >= 0; j--) {
	                    // significand[k * 9 + j] = Math.round(least_digits % 10);
	                    significand[k * 9 + j] = least_digits % 10;
	                    // least_digits = Math.round(least_digits / 10);
	                    least_digits = Math.floor(least_digits / 10);
	                }
	            }
	        }
	        // Output format options:
	        // Scientific - [-]d.dddE(+/-)dd or [-]dE(+/-)dd
	        // Regular    - ddd.ddd
	        if (is_zero) {
	            significand_digits = 1;
	            significand[index] = 0;
	        }
	        else {
	            significand_digits = 36;
	            while (!significand[index]) {
	                significand_digits = significand_digits - 1;
	                index = index + 1;
	            }
	        }
	        // the exponent if scientific notation is used
	        var scientific_exponent = significand_digits - 1 + exponent;
	        // The scientific exponent checks are dictated by the string conversion
	        // specification and are somewhat arbitrary cutoffs.
	        //
	        // We must check exponent > 0, because if this is the case, the number
	        // has trailing zeros.  However, we *cannot* output these trailing zeros,
	        // because doing so would change the precision of the value, and would
	        // change stored data if the string converted number is round tripped.
	        if (scientific_exponent >= 34 || scientific_exponent <= -7 || exponent > 0) {
	            // Scientific format
	            // if there are too many significant digits, we should just be treating numbers
	            // as + or - 0 and using the non-scientific exponent (this is for the "invalid
	            // representation should be treated as 0/-0" spec cases in decimal128-1.json)
	            if (significand_digits > 34) {
	                string.push("" + 0);
	                if (exponent > 0)
	                    string.push('E+' + exponent);
	                else if (exponent < 0)
	                    string.push('E' + exponent);
	                return string.join('');
	            }
	            string.push("" + significand[index++]);
	            significand_digits = significand_digits - 1;
	            if (significand_digits) {
	                string.push('.');
	            }
	            for (var i = 0; i < significand_digits; i++) {
	                string.push("" + significand[index++]);
	            }
	            // Exponent
	            string.push('E');
	            if (scientific_exponent > 0) {
	                string.push('+' + scientific_exponent);
	            }
	            else {
	                string.push("" + scientific_exponent);
	            }
	        }
	        else {
	            // Regular format with no decimal place
	            if (exponent >= 0) {
	                for (var i = 0; i < significand_digits; i++) {
	                    string.push("" + significand[index++]);
	                }
	            }
	            else {
	                var radix_position = significand_digits + exponent;
	                // non-zero digits before radix
	                if (radix_position > 0) {
	                    for (var i = 0; i < radix_position; i++) {
	                        string.push("" + significand[index++]);
	                    }
	                }
	                else {
	                    string.push('0');
	                }
	                string.push('.');
	                // add leading zeros after radix
	                while (radix_position++ < 0) {
	                    string.push('0');
	                }
	                for (var i = 0; i < significand_digits - Math.max(radix_position - 1, 0); i++) {
	                    string.push("" + significand[index++]);
	                }
	            }
	        }
	        return string.join('');
	    };
	    Decimal128.prototype.toJSON = function () {
	        return { $numberDecimal: this.toString() };
	    };
	    /** @internal */
	    Decimal128.prototype.toExtendedJSON = function () {
	        return { $numberDecimal: this.toString() };
	    };
	    /** @internal */
	    Decimal128.fromExtendedJSON = function (doc) {
	        return Decimal128.fromString(doc.$numberDecimal);
	    };
	    /** @internal */
	    Decimal128.prototype[Symbol.for('nodejs.util.inspect.custom')] = function () {
	        return this.inspect();
	    };
	    Decimal128.prototype.inspect = function () {
	        return "new Decimal128(\"" + this.toString() + "\")";
	    };
	    return Decimal128;
	}());
	Object.defineProperty(Decimal128.prototype, '_bsontype', { value: 'Decimal128' });

	/**
	 * A class representation of the BSON Double type.
	 * @public
	 */
	var Double = /** @class */ (function () {
	    /**
	     * Create a Double type
	     *
	     * @param value - the number we want to represent as a double.
	     */
	    function Double(value) {
	        if (!(this instanceof Double))
	            return new Double(value);
	        if (value instanceof Number) {
	            value = value.valueOf();
	        }
	        this.value = +value;
	    }
	    /**
	     * Access the number value.
	     *
	     * @returns returns the wrapped double number.
	     */
	    Double.prototype.valueOf = function () {
	        return this.value;
	    };
	    /** @internal */
	    Double.prototype.toJSON = function () {
	        return this.value;
	    };
	    /** @internal */
	    Double.prototype.toExtendedJSON = function (options) {
	        if (options && (options.legacy || (options.relaxed && isFinite(this.value)))) {
	            return this.value;
	        }
	        // NOTE: JavaScript has +0 and -0, apparently to model limit calculations. If a user
	        // explicitly provided `-0` then we need to ensure the sign makes it into the output
	        if (Object.is(Math.sign(this.value), -0)) {
	            return { $numberDouble: "-" + this.value.toFixed(1) };
	        }
	        var $numberDouble;
	        if (Number.isInteger(this.value)) {
	            $numberDouble = this.value.toFixed(1);
	            if ($numberDouble.length >= 13) {
	                $numberDouble = this.value.toExponential(13).toUpperCase();
	            }
	        }
	        else {
	            $numberDouble = this.value.toString();
	        }
	        return { $numberDouble: $numberDouble };
	    };
	    /** @internal */
	    Double.fromExtendedJSON = function (doc, options) {
	        var doubleValue = parseFloat(doc.$numberDouble);
	        return options && options.relaxed ? doubleValue : new Double(doubleValue);
	    };
	    /** @internal */
	    Double.prototype[Symbol.for('nodejs.util.inspect.custom')] = function () {
	        return this.inspect();
	    };
	    Double.prototype.inspect = function () {
	        var eJSON = this.toExtendedJSON();
	        return "new Double(" + eJSON.$numberDouble + ")";
	    };
	    return Double;
	}());
	Object.defineProperty(Double.prototype, '_bsontype', { value: 'Double' });

	/**
	 * A class representation of a BSON Int32 type.
	 * @public
	 */
	var Int32 = /** @class */ (function () {
	    /**
	     * Create an Int32 type
	     *
	     * @param value - the number we want to represent as an int32.
	     */
	    function Int32(value) {
	        if (!(this instanceof Int32))
	            return new Int32(value);
	        if (value instanceof Number) {
	            value = value.valueOf();
	        }
	        this.value = +value;
	    }
	    /**
	     * Access the number value.
	     *
	     * @returns returns the wrapped int32 number.
	     */
	    Int32.prototype.valueOf = function () {
	        return this.value;
	    };
	    /** @internal */
	    Int32.prototype.toJSON = function () {
	        return this.value;
	    };
	    /** @internal */
	    Int32.prototype.toExtendedJSON = function (options) {
	        if (options && (options.relaxed || options.legacy))
	            return this.value;
	        return { $numberInt: this.value.toString() };
	    };
	    /** @internal */
	    Int32.fromExtendedJSON = function (doc, options) {
	        return options && options.relaxed ? parseInt(doc.$numberInt, 10) : new Int32(doc.$numberInt);
	    };
	    /** @internal */
	    Int32.prototype[Symbol.for('nodejs.util.inspect.custom')] = function () {
	        return this.inspect();
	    };
	    Int32.prototype.inspect = function () {
	        return "new Int32(" + this.valueOf() + ")";
	    };
	    return Int32;
	}());
	Object.defineProperty(Int32.prototype, '_bsontype', { value: 'Int32' });

	/**
	 * A class representation of the BSON MaxKey type.
	 * @public
	 */
	var MaxKey = /** @class */ (function () {
	    function MaxKey() {
	        if (!(this instanceof MaxKey))
	            return new MaxKey();
	    }
	    /** @internal */
	    MaxKey.prototype.toExtendedJSON = function () {
	        return { $maxKey: 1 };
	    };
	    /** @internal */
	    MaxKey.fromExtendedJSON = function () {
	        return new MaxKey();
	    };
	    /** @internal */
	    MaxKey.prototype[Symbol.for('nodejs.util.inspect.custom')] = function () {
	        return this.inspect();
	    };
	    MaxKey.prototype.inspect = function () {
	        return 'new MaxKey()';
	    };
	    return MaxKey;
	}());
	Object.defineProperty(MaxKey.prototype, '_bsontype', { value: 'MaxKey' });

	/**
	 * A class representation of the BSON MinKey type.
	 * @public
	 */
	var MinKey = /** @class */ (function () {
	    function MinKey() {
	        if (!(this instanceof MinKey))
	            return new MinKey();
	    }
	    /** @internal */
	    MinKey.prototype.toExtendedJSON = function () {
	        return { $minKey: 1 };
	    };
	    /** @internal */
	    MinKey.fromExtendedJSON = function () {
	        return new MinKey();
	    };
	    /** @internal */
	    MinKey.prototype[Symbol.for('nodejs.util.inspect.custom')] = function () {
	        return this.inspect();
	    };
	    MinKey.prototype.inspect = function () {
	        return 'new MinKey()';
	    };
	    return MinKey;
	}());
	Object.defineProperty(MinKey.prototype, '_bsontype', { value: 'MinKey' });

	// Regular expression that checks for hex value
	var checkForHexRegExp = new RegExp('^[0-9a-fA-F]{24}$');
	// Unique sequence for the current process (initialized on first use)
	var PROCESS_UNIQUE = null;
	var kId = Symbol('id');
	/**
	 * A class representation of the BSON ObjectId type.
	 * @public
	 */
	var ObjectId = /** @class */ (function () {
	    /**
	     * Create an ObjectId type
	     *
	     * @param id - Can be a 24 character hex string, 12 byte binary Buffer, or a number.
	     */
	    function ObjectId(id) {
	        if (!(this instanceof ObjectId))
	            return new ObjectId(id);
	        // Duck-typing to support ObjectId from different npm packages
	        if (id instanceof ObjectId) {
	            this[kId] = id.id;
	            this.__id = id.__id;
	        }
	        if (typeof id === 'object' && id && 'id' in id) {
	            if ('toHexString' in id && typeof id.toHexString === 'function') {
	                this[kId] = buffer_1.from(id.toHexString(), 'hex');
	            }
	            else {
	                this[kId] = typeof id.id === 'string' ? buffer_1.from(id.id) : id.id;
	            }
	        }
	        // The most common use case (blank id, new objectId instance)
	        if (id == null || typeof id === 'number') {
	            // Generate a new id
	            this[kId] = ObjectId.generate(typeof id === 'number' ? id : undefined);
	            // If we are caching the hex string
	            if (ObjectId.cacheHexString) {
	                this.__id = this.id.toString('hex');
	            }
	        }
	        if (ArrayBuffer.isView(id) && id.byteLength === 12) {
	            this[kId] = ensureBuffer(id);
	        }
	        if (typeof id === 'string') {
	            if (id.length === 12) {
	                var bytes = buffer_1.from(id);
	                if (bytes.byteLength === 12) {
	                    this[kId] = bytes;
	                }
	            }
	            else if (id.length === 24 && checkForHexRegExp.test(id)) {
	                this[kId] = buffer_1.from(id, 'hex');
	            }
	            else {
	                throw new TypeError('Argument passed in must be a Buffer or string of 12 bytes or a string of 24 hex characters');
	            }
	        }
	        if (ObjectId.cacheHexString) {
	            this.__id = this.id.toString('hex');
	        }
	    }
	    Object.defineProperty(ObjectId.prototype, "id", {
	        /**
	         * The ObjectId bytes
	         * @readonly
	         */
	        get: function () {
	            return this[kId];
	        },
	        set: function (value) {
	            this[kId] = value;
	            if (ObjectId.cacheHexString) {
	                this.__id = value.toString('hex');
	            }
	        },
	        enumerable: false,
	        configurable: true
	    });
	    Object.defineProperty(ObjectId.prototype, "generationTime", {
	        /**
	         * The generation time of this ObjectId instance
	         * @deprecated Please use getTimestamp / createFromTime which returns an int32 epoch
	         */
	        get: function () {
	            return this.id.readInt32BE(0);
	        },
	        set: function (value) {
	            // Encode time into first 4 bytes
	            this.id.writeUInt32BE(value, 0);
	        },
	        enumerable: false,
	        configurable: true
	    });
	    /** Returns the ObjectId id as a 24 character hex string representation */
	    ObjectId.prototype.toHexString = function () {
	        if (ObjectId.cacheHexString && this.__id) {
	            return this.__id;
	        }
	        var hexString = this.id.toString('hex');
	        if (ObjectId.cacheHexString && !this.__id) {
	            this.__id = hexString;
	        }
	        return hexString;
	    };
	    /**
	     * Update the ObjectId index
	     * @privateRemarks
	     * Used in generating new ObjectId's on the driver
	     * @internal
	     */
	    ObjectId.getInc = function () {
	        return (ObjectId.index = (ObjectId.index + 1) % 0xffffff);
	    };
	    /**
	     * Generate a 12 byte id buffer used in ObjectId's
	     *
	     * @param time - pass in a second based timestamp.
	     */
	    ObjectId.generate = function (time) {
	        if ('number' !== typeof time) {
	            time = ~~(Date.now() / 1000);
	        }
	        var inc = ObjectId.getInc();
	        var buffer = buffer_1.alloc(12);
	        // 4-byte timestamp
	        buffer.writeUInt32BE(time, 0);
	        // set PROCESS_UNIQUE if yet not initialized
	        if (PROCESS_UNIQUE === null) {
	            PROCESS_UNIQUE = randomBytes(5);
	        }
	        // 5-byte process unique
	        buffer[4] = PROCESS_UNIQUE[0];
	        buffer[5] = PROCESS_UNIQUE[1];
	        buffer[6] = PROCESS_UNIQUE[2];
	        buffer[7] = PROCESS_UNIQUE[3];
	        buffer[8] = PROCESS_UNIQUE[4];
	        // 3-byte counter
	        buffer[11] = inc & 0xff;
	        buffer[10] = (inc >> 8) & 0xff;
	        buffer[9] = (inc >> 16) & 0xff;
	        return buffer;
	    };
	    /**
	     * Converts the id into a 24 character hex string for printing
	     *
	     * @param format - The Buffer toString format parameter.
	     * @internal
	     */
	    ObjectId.prototype.toString = function (format) {
	        // Is the id a buffer then use the buffer toString method to return the format
	        if (format)
	            return this.id.toString(format);
	        return this.toHexString();
	    };
	    /**
	     * Converts to its JSON the 24 character hex string representation.
	     * @internal
	     */
	    ObjectId.prototype.toJSON = function () {
	        return this.toHexString();
	    };
	    /**
	     * Compares the equality of this ObjectId with `otherID`.
	     *
	     * @param otherId - ObjectId instance to compare against.
	     */
	    ObjectId.prototype.equals = function (otherId) {
	        if (otherId === undefined || otherId === null) {
	            return false;
	        }
	        if (otherId instanceof ObjectId) {
	            return this.toString() === otherId.toString();
	        }
	        if (typeof otherId === 'string' &&
	            ObjectId.isValid(otherId) &&
	            otherId.length === 12 &&
	            isUint8Array(this.id)) {
	            return otherId === buffer_1.prototype.toString.call(this.id, 'latin1');
	        }
	        if (typeof otherId === 'string' && ObjectId.isValid(otherId) && otherId.length === 24) {
	            return otherId.toLowerCase() === this.toHexString();
	        }
	        if (typeof otherId === 'string' && ObjectId.isValid(otherId) && otherId.length === 12) {
	            return buffer_1.from(otherId).equals(this.id);
	        }
	        if (typeof otherId === 'object' &&
	            'toHexString' in otherId &&
	            typeof otherId.toHexString === 'function') {
	            return otherId.toHexString() === this.toHexString();
	        }
	        return false;
	    };
	    /** Returns the generation date (accurate up to the second) that this ID was generated. */
	    ObjectId.prototype.getTimestamp = function () {
	        var timestamp = new Date();
	        var time = this.id.readUInt32BE(0);
	        timestamp.setTime(Math.floor(time) * 1000);
	        return timestamp;
	    };
	    /** @internal */
	    ObjectId.createPk = function () {
	        return new ObjectId();
	    };
	    /**
	     * Creates an ObjectId from a second based number, with the rest of the ObjectId zeroed out. Used for comparisons or sorting the ObjectId.
	     *
	     * @param time - an integer number representing a number of seconds.
	     */
	    ObjectId.createFromTime = function (time) {
	        var buffer = buffer_1.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
	        // Encode time into first 4 bytes
	        buffer.writeUInt32BE(time, 0);
	        // Return the new objectId
	        return new ObjectId(buffer);
	    };
	    /**
	     * Creates an ObjectId from a hex string representation of an ObjectId.
	     *
	     * @param hexString - create a ObjectId from a passed in 24 character hexstring.
	     */
	    ObjectId.createFromHexString = function (hexString) {
	        // Throw an error if it's not a valid setup
	        if (typeof hexString === 'undefined' || (hexString != null && hexString.length !== 24)) {
	            throw new TypeError('Argument passed in must be a single String of 12 bytes or a string of 24 hex characters');
	        }
	        return new ObjectId(buffer_1.from(hexString, 'hex'));
	    };
	    /**
	     * Checks if a value is a valid bson ObjectId
	     *
	     * @param id - ObjectId instance to validate.
	     */
	    ObjectId.isValid = function (id) {
	        if (id == null)
	            return false;
	        if (typeof id === 'number') {
	            return true;
	        }
	        if (typeof id === 'string') {
	            return id.length === 12 || (id.length === 24 && checkForHexRegExp.test(id));
	        }
	        if (id instanceof ObjectId) {
	            return true;
	        }
	        if (isUint8Array(id) && id.length === 12) {
	            return true;
	        }
	        // Duck-Typing detection of ObjectId like objects
	        if (typeof id === 'object' && 'toHexString' in id && typeof id.toHexString === 'function') {
	            if (typeof id.id === 'string') {
	                return id.id.length === 12;
	            }
	            return id.toHexString().length === 24 && checkForHexRegExp.test(id.id.toString('hex'));
	        }
	        return false;
	    };
	    /** @internal */
	    ObjectId.prototype.toExtendedJSON = function () {
	        if (this.toHexString)
	            return { $oid: this.toHexString() };
	        return { $oid: this.toString('hex') };
	    };
	    /** @internal */
	    ObjectId.fromExtendedJSON = function (doc) {
	        return new ObjectId(doc.$oid);
	    };
	    /**
	     * Converts to a string representation of this Id.
	     *
	     * @returns return the 24 character hex string representation.
	     * @internal
	     */
	    ObjectId.prototype[Symbol.for('nodejs.util.inspect.custom')] = function () {
	        return this.inspect();
	    };
	    ObjectId.prototype.inspect = function () {
	        return "new ObjectId(\"" + this.toHexString() + "\")";
	    };
	    /** @internal */
	    ObjectId.index = ~~(Math.random() * 0xffffff);
	    return ObjectId;
	}());
	// Deprecated methods
	Object.defineProperty(ObjectId.prototype, 'generate', {
	    value: deprecate(function (time) { return ObjectId.generate(time); }, 'Please use the static `ObjectId.generate(time)` instead')
	});
	Object.defineProperty(ObjectId.prototype, 'getInc', {
	    value: deprecate(function () { return ObjectId.getInc(); }, 'Please use the static `ObjectId.getInc()` instead')
	});
	Object.defineProperty(ObjectId.prototype, 'get_inc', {
	    value: deprecate(function () { return ObjectId.getInc(); }, 'Please use the static `ObjectId.getInc()` instead')
	});
	Object.defineProperty(ObjectId, 'get_inc', {
	    value: deprecate(function () { return ObjectId.getInc(); }, 'Please use the static `ObjectId.getInc()` instead')
	});
	Object.defineProperty(ObjectId.prototype, '_bsontype', { value: 'ObjectID' });

	function alphabetize(str) {
	    return str.split('').sort().join('');
	}
	/**
	 * A class representation of the BSON RegExp type.
	 * @public
	 */
	var BSONRegExp = /** @class */ (function () {
	    /**
	     * @param pattern - The regular expression pattern to match
	     * @param options - The regular expression options
	     */
	    function BSONRegExp(pattern, options) {
	        if (!(this instanceof BSONRegExp))
	            return new BSONRegExp(pattern, options);
	        this.pattern = pattern;
	        this.options = alphabetize(options !== null && options !== void 0 ? options : '');
	        // Validate options
	        for (var i = 0; i < this.options.length; i++) {
	            if (!(this.options[i] === 'i' ||
	                this.options[i] === 'm' ||
	                this.options[i] === 'x' ||
	                this.options[i] === 'l' ||
	                this.options[i] === 's' ||
	                this.options[i] === 'u')) {
	                throw new Error("The regular expression option [" + this.options[i] + "] is not supported");
	            }
	        }
	    }
	    BSONRegExp.parseOptions = function (options) {
	        return options ? options.split('').sort().join('') : '';
	    };
	    /** @internal */
	    BSONRegExp.prototype.toExtendedJSON = function (options) {
	        options = options || {};
	        if (options.legacy) {
	            return { $regex: this.pattern, $options: this.options };
	        }
	        return { $regularExpression: { pattern: this.pattern, options: this.options } };
	    };
	    /** @internal */
	    BSONRegExp.fromExtendedJSON = function (doc) {
	        if ('$regex' in doc) {
	            if (typeof doc.$regex !== 'string') {
	                // This is for $regex query operators that have extended json values.
	                if (doc.$regex._bsontype === 'BSONRegExp') {
	                    return doc;
	                }
	            }
	            else {
	                return new BSONRegExp(doc.$regex, BSONRegExp.parseOptions(doc.$options));
	            }
	        }
	        if ('$regularExpression' in doc) {
	            return new BSONRegExp(doc.$regularExpression.pattern, BSONRegExp.parseOptions(doc.$regularExpression.options));
	        }
	        throw new TypeError("Unexpected BSONRegExp EJSON object form: " + JSON.stringify(doc));
	    };
	    return BSONRegExp;
	}());
	Object.defineProperty(BSONRegExp.prototype, '_bsontype', { value: 'BSONRegExp' });

	/**
	 * A class representation of the BSON Symbol type.
	 * @public
	 */
	var BSONSymbol = /** @class */ (function () {
	    /**
	     * @param value - the string representing the symbol.
	     */
	    function BSONSymbol(value) {
	        if (!(this instanceof BSONSymbol))
	            return new BSONSymbol(value);
	        this.value = value;
	    }
	    /** Access the wrapped string value. */
	    BSONSymbol.prototype.valueOf = function () {
	        return this.value;
	    };
	    /** @internal */
	    BSONSymbol.prototype.toString = function () {
	        return this.value;
	    };
	    /** @internal */
	    BSONSymbol.prototype.inspect = function () {
	        return "new BSONSymbol(\"" + this.value + "\")";
	    };
	    /** @internal */
	    BSONSymbol.prototype.toJSON = function () {
	        return this.value;
	    };
	    /** @internal */
	    BSONSymbol.prototype.toExtendedJSON = function () {
	        return { $symbol: this.value };
	    };
	    /** @internal */
	    BSONSymbol.fromExtendedJSON = function (doc) {
	        return new BSONSymbol(doc.$symbol);
	    };
	    /** @internal */
	    BSONSymbol.prototype[Symbol.for('nodejs.util.inspect.custom')] = function () {
	        return this.inspect();
	    };
	    return BSONSymbol;
	}());
	Object.defineProperty(BSONSymbol.prototype, '_bsontype', { value: 'Symbol' });

	/*! *****************************************************************************
	Copyright (c) Microsoft Corporation.

	Permission to use, copy, modify, and/or distribute this software for any
	purpose with or without fee is hereby granted.

	THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
	REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
	AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
	INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
	LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
	OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
	PERFORMANCE OF THIS SOFTWARE.
	***************************************************************************** */

	/* global Reflect, Promise */
	var _extendStatics = function extendStatics(d, b) {
	  _extendStatics = Object.setPrototypeOf || {
	    __proto__: []
	  } instanceof Array && function (d, b) {
	    d.__proto__ = b;
	  } || function (d, b) {
	    for (var p in b) {
	      if (b.hasOwnProperty(p)) d[p] = b[p];
	    }
	  };

	  return _extendStatics(d, b);
	};

	function __extends(d, b) {
	  _extendStatics(d, b);

	  function __() {
	    this.constructor = d;
	  }

	  d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	}

	/** @public */
	var LongWithoutOverridesClass = Long;
	/** @public */
	var Timestamp = /** @class */ (function (_super) {
	    __extends(Timestamp, _super);
	    function Timestamp(low, high) {
	        var _this = this;
	        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
	        ///@ts-expect-error
	        if (!(_this instanceof Timestamp))
	            return new Timestamp(low, high);
	        if (Long.isLong(low)) {
	            _this = _super.call(this, low.low, low.high, true) || this;
	        }
	        else if (isObjectLike$1(low) && typeof low.t !== 'undefined' && typeof low.i !== 'undefined') {
	            _this = _super.call(this, low.i, low.t, true) || this;
	        }
	        else {
	            _this = _super.call(this, low, high, true) || this;
	        }
	        Object.defineProperty(_this, '_bsontype', {
	            value: 'Timestamp',
	            writable: false,
	            configurable: false,
	            enumerable: false
	        });
	        return _this;
	    }
	    Timestamp.prototype.toJSON = function () {
	        return {
	            $timestamp: this.toString()
	        };
	    };
	    /** Returns a Timestamp represented by the given (32-bit) integer value. */
	    Timestamp.fromInt = function (value) {
	        return new Timestamp(Long.fromInt(value, true));
	    };
	    /** Returns a Timestamp representing the given number value, provided that it is a finite number. Otherwise, zero is returned. */
	    Timestamp.fromNumber = function (value) {
	        return new Timestamp(Long.fromNumber(value, true));
	    };
	    /**
	     * Returns a Timestamp for the given high and low bits. Each is assumed to use 32 bits.
	     *
	     * @param lowBits - the low 32-bits.
	     * @param highBits - the high 32-bits.
	     */
	    Timestamp.fromBits = function (lowBits, highBits) {
	        return new Timestamp(lowBits, highBits);
	    };
	    /**
	     * Returns a Timestamp from the given string, optionally using the given radix.
	     *
	     * @param str - the textual representation of the Timestamp.
	     * @param optRadix - the radix in which the text is written.
	     */
	    Timestamp.fromString = function (str, optRadix) {
	        return new Timestamp(Long.fromString(str, true, optRadix));
	    };
	    /** @internal */
	    Timestamp.prototype.toExtendedJSON = function () {
	        return { $timestamp: { t: this.high >>> 0, i: this.low >>> 0 } };
	    };
	    /** @internal */
	    Timestamp.fromExtendedJSON = function (doc) {
	        return new Timestamp(doc.$timestamp);
	    };
	    /** @internal */
	    Timestamp.prototype[Symbol.for('nodejs.util.inspect.custom')] = function () {
	        return this.inspect();
	    };
	    Timestamp.prototype.inspect = function () {
	        return "new Timestamp({ t: " + this.getHighBits() + ", i: " + this.getLowBits() + " })";
	    };
	    Timestamp.MAX_VALUE = Long.MAX_UNSIGNED_VALUE;
	    return Timestamp;
	}(LongWithoutOverridesClass));

	function isBSONType(value) {
	    return (isObjectLike$1(value) && Reflect.has(value, '_bsontype') && typeof value._bsontype === 'string');
	}
	// INT32 boundaries
	var BSON_INT32_MAX$1 = 0x7fffffff;
	var BSON_INT32_MIN$1 = -0x80000000;
	// INT64 boundaries
	var BSON_INT64_MAX$1 = 0x7fffffffffffffff;
	var BSON_INT64_MIN$1 = -0x8000000000000000;
	// all the types where we don't need to do any special processing and can just pass the EJSON
	//straight to type.fromExtendedJSON
	var keysToCodecs = {
	    $oid: ObjectId,
	    $binary: Binary,
	    $uuid: Binary,
	    $symbol: BSONSymbol,
	    $numberInt: Int32,
	    $numberDecimal: Decimal128,
	    $numberDouble: Double,
	    $numberLong: Long,
	    $minKey: MinKey,
	    $maxKey: MaxKey,
	    $regex: BSONRegExp,
	    $regularExpression: BSONRegExp,
	    $timestamp: Timestamp
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function deserializeValue(value, options) {
	    if (options === void 0) { options = {}; }
	    if (typeof value === 'number') {
	        if (options.relaxed || options.legacy) {
	            return value;
	        }
	        // if it's an integer, should interpret as smallest BSON integer
	        // that can represent it exactly. (if out of range, interpret as double.)
	        if (Math.floor(value) === value) {
	            if (value >= BSON_INT32_MIN$1 && value <= BSON_INT32_MAX$1)
	                return new Int32(value);
	            if (value >= BSON_INT64_MIN$1 && value <= BSON_INT64_MAX$1)
	                return Long.fromNumber(value);
	        }
	        // If the number is a non-integer or out of integer range, should interpret as BSON Double.
	        return new Double(value);
	    }
	    // from here on out we're looking for bson types, so bail if its not an object
	    if (value == null || typeof value !== 'object')
	        return value;
	    // upgrade deprecated undefined to null
	    if (value.$undefined)
	        return null;
	    var keys = Object.keys(value).filter(function (k) { return k.startsWith('$') && value[k] != null; });
	    for (var i = 0; i < keys.length; i++) {
	        var c = keysToCodecs[keys[i]];
	        if (c)
	            return c.fromExtendedJSON(value, options);
	    }
	    if (value.$date != null) {
	        var d = value.$date;
	        var date = new Date();
	        if (options.legacy) {
	            if (typeof d === 'number')
	                date.setTime(d);
	            else if (typeof d === 'string')
	                date.setTime(Date.parse(d));
	        }
	        else {
	            if (typeof d === 'string')
	                date.setTime(Date.parse(d));
	            else if (Long.isLong(d))
	                date.setTime(d.toNumber());
	            else if (typeof d === 'number' && options.relaxed)
	                date.setTime(d);
	        }
	        return date;
	    }
	    if (value.$code != null) {
	        var copy = Object.assign({}, value);
	        if (value.$scope) {
	            copy.$scope = deserializeValue(value.$scope);
	        }
	        return Code.fromExtendedJSON(value);
	    }
	    if (isDBRefLike(value) || value.$dbPointer) {
	        var v = value.$ref ? value : value.$dbPointer;
	        // we run into this in a "degenerate EJSON" case (with $id and $ref order flipped)
	        // because of the order JSON.parse goes through the document
	        if (v instanceof DBRef)
	            return v;
	        var dollarKeys = Object.keys(v).filter(function (k) { return k.startsWith('$'); });
	        var valid_1 = true;
	        dollarKeys.forEach(function (k) {
	            if (['$ref', '$id', '$db'].indexOf(k) === -1)
	                valid_1 = false;
	        });
	        // only make DBRef if $ keys are all valid
	        if (valid_1)
	            return DBRef.fromExtendedJSON(v);
	    }
	    return value;
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function serializeArray(array, options) {
	    return array.map(function (v, index) {
	        options.seenObjects.push({ propertyName: "index " + index, obj: null });
	        try {
	            return serializeValue(v, options);
	        }
	        finally {
	            options.seenObjects.pop();
	        }
	    });
	}
	function getISOString(date) {
	    var isoStr = date.toISOString();
	    // we should only show milliseconds in timestamp if they're non-zero
	    return date.getUTCMilliseconds() !== 0 ? isoStr : isoStr.slice(0, -5) + 'Z';
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function serializeValue(value, options) {
	    if ((typeof value === 'object' || typeof value === 'function') && value !== null) {
	        var index = options.seenObjects.findIndex(function (entry) { return entry.obj === value; });
	        if (index !== -1) {
	            var props = options.seenObjects.map(function (entry) { return entry.propertyName; });
	            var leadingPart = props
	                .slice(0, index)
	                .map(function (prop) { return prop + " -> "; })
	                .join('');
	            var alreadySeen = props[index];
	            var circularPart = ' -> ' +
	                props
	                    .slice(index + 1, props.length - 1)
	                    .map(function (prop) { return prop + " -> "; })
	                    .join('');
	            var current = props[props.length - 1];
	            var leadingSpace = ' '.repeat(leadingPart.length + alreadySeen.length / 2);
	            var dashes = '-'.repeat(circularPart.length + (alreadySeen.length + current.length) / 2 - 1);
	            throw new TypeError('Converting circular structure to EJSON:\n' +
	                ("    " + leadingPart + alreadySeen + circularPart + current + "\n") +
	                ("    " + leadingSpace + "\\" + dashes + "/"));
	        }
	        options.seenObjects[options.seenObjects.length - 1].obj = value;
	    }
	    if (Array.isArray(value))
	        return serializeArray(value, options);
	    if (value === undefined)
	        return null;
	    if (value instanceof Date || isDate(value)) {
	        var dateNum = value.getTime(), 
	        // is it in year range 1970-9999?
	        inRange = dateNum > -1 && dateNum < 253402318800000;
	        if (options.legacy) {
	            return options.relaxed && inRange
	                ? { $date: value.getTime() }
	                : { $date: getISOString(value) };
	        }
	        return options.relaxed && inRange
	            ? { $date: getISOString(value) }
	            : { $date: { $numberLong: value.getTime().toString() } };
	    }
	    if (typeof value === 'number' && (!options.relaxed || !isFinite(value))) {
	        // it's an integer
	        if (Math.floor(value) === value) {
	            var int32Range = value >= BSON_INT32_MIN$1 && value <= BSON_INT32_MAX$1, int64Range = value >= BSON_INT64_MIN$1 && value <= BSON_INT64_MAX$1;
	            // interpret as being of the smallest BSON integer type that can represent the number exactly
	            if (int32Range)
	                return { $numberInt: value.toString() };
	            if (int64Range)
	                return { $numberLong: value.toString() };
	        }
	        return { $numberDouble: value.toString() };
	    }
	    if (value instanceof RegExp || isRegExp(value)) {
	        var flags = value.flags;
	        if (flags === undefined) {
	            var match = value.toString().match(/[gimuy]*$/);
	            if (match) {
	                flags = match[0];
	            }
	        }
	        var rx = new BSONRegExp(value.source, flags);
	        return rx.toExtendedJSON(options);
	    }
	    if (value != null && typeof value === 'object')
	        return serializeDocument(value, options);
	    return value;
	}
	var BSON_TYPE_MAPPINGS = {
	    Binary: function (o) { return new Binary(o.value(), o.sub_type); },
	    Code: function (o) { return new Code(o.code, o.scope); },
	    DBRef: function (o) { return new DBRef(o.collection || o.namespace, o.oid, o.db, o.fields); },
	    Decimal128: function (o) { return new Decimal128(o.bytes); },
	    Double: function (o) { return new Double(o.value); },
	    Int32: function (o) { return new Int32(o.value); },
	    Long: function (o) {
	        return Long.fromBits(
	        // underscore variants for 1.x backwards compatibility
	        o.low != null ? o.low : o.low_, o.low != null ? o.high : o.high_, o.low != null ? o.unsigned : o.unsigned_);
	    },
	    MaxKey: function () { return new MaxKey(); },
	    MinKey: function () { return new MinKey(); },
	    ObjectID: function (o) { return new ObjectId(o); },
	    ObjectId: function (o) { return new ObjectId(o); },
	    BSONRegExp: function (o) { return new BSONRegExp(o.pattern, o.options); },
	    Symbol: function (o) { return new BSONSymbol(o.value); },
	    Timestamp: function (o) { return Timestamp.fromBits(o.low, o.high); }
	};
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function serializeDocument(doc, options) {
	    if (doc == null || typeof doc !== 'object')
	        throw new Error('not an object instance');
	    var bsontype = doc._bsontype;
	    if (typeof bsontype === 'undefined') {
	        // It's a regular object. Recursively serialize its property values.
	        var _doc = {};
	        for (var name in doc) {
	            options.seenObjects.push({ propertyName: name, obj: null });
	            try {
	                _doc[name] = serializeValue(doc[name], options);
	            }
	            finally {
	                options.seenObjects.pop();
	            }
	        }
	        return _doc;
	    }
	    else if (isBSONType(doc)) {
	        // the "document" is really just a BSON type object
	        // eslint-disable-next-line @typescript-eslint/no-explicit-any
	        var outDoc = doc;
	        if (typeof outDoc.toExtendedJSON !== 'function') {
	            // There's no EJSON serialization function on the object. It's probably an
	            // object created by a previous version of this library (or another library)
	            // that's duck-typing objects to look like they were generated by this library).
	            // Copy the object into this library's version of that type.
	            var mapper = BSON_TYPE_MAPPINGS[doc._bsontype];
	            if (!mapper) {
	                throw new TypeError('Unrecognized or invalid _bsontype: ' + doc._bsontype);
	            }
	            outDoc = mapper(outDoc);
	        }
	        // Two BSON types may have nested objects that may need to be serialized too
	        if (bsontype === 'Code' && outDoc.scope) {
	            outDoc = new Code(outDoc.code, serializeValue(outDoc.scope, options));
	        }
	        else if (bsontype === 'DBRef' && outDoc.oid) {
	            outDoc = new DBRef(serializeValue(outDoc.collection, options), serializeValue(outDoc.oid, options), serializeValue(outDoc.db, options), serializeValue(outDoc.fields, options));
	        }
	        return outDoc.toExtendedJSON(options);
	    }
	    else {
	        throw new Error('_bsontype must be a string, but was: ' + typeof bsontype);
	    }
	}
	/**
	 * EJSON parse / stringify API
	 * @public
	 */
	// the namespace here is used to emulate `export * as EJSON from '...'`
	// which as of now (sept 2020) api-extractor does not support
	// eslint-disable-next-line @typescript-eslint/no-namespace
	var EJSON;
	(function (EJSON) {
	    /**
	     * Parse an Extended JSON string, constructing the JavaScript value or object described by that
	     * string.
	     *
	     * @example
	     * ```js
	     * const { EJSON } = require('bson');
	     * const text = '{ "int32": { "$numberInt": "10" } }';
	     *
	     * // prints { int32: { [String: '10'] _bsontype: 'Int32', value: '10' } }
	     * console.log(EJSON.parse(text, { relaxed: false }));
	     *
	     * // prints { int32: 10 }
	     * console.log(EJSON.parse(text));
	     * ```
	     */
	    function parse(text, options) {
	        var finalOptions = Object.assign({}, { relaxed: true, legacy: false }, options);
	        // relaxed implies not strict
	        if (typeof finalOptions.relaxed === 'boolean')
	            finalOptions.strict = !finalOptions.relaxed;
	        if (typeof finalOptions.strict === 'boolean')
	            finalOptions.relaxed = !finalOptions.strict;
	        return JSON.parse(text, function (_key, value) { return deserializeValue(value, finalOptions); });
	    }
	    EJSON.parse = parse;
	    /**
	     * Converts a BSON document to an Extended JSON string, optionally replacing values if a replacer
	     * function is specified or optionally including only the specified properties if a replacer array
	     * is specified.
	     *
	     * @param value - The value to convert to extended JSON
	     * @param replacer - A function that alters the behavior of the stringification process, or an array of String and Number objects that serve as a whitelist for selecting/filtering the properties of the value object to be included in the JSON string. If this value is null or not provided, all properties of the object are included in the resulting JSON string
	     * @param space - A String or Number object that's used to insert white space into the output JSON string for readability purposes.
	     * @param options - Optional settings
	     *
	     * @example
	     * ```js
	     * const { EJSON } = require('bson');
	     * const Int32 = require('mongodb').Int32;
	     * const doc = { int32: new Int32(10) };
	     *
	     * // prints '{"int32":{"$numberInt":"10"}}'
	     * console.log(EJSON.stringify(doc, { relaxed: false }));
	     *
	     * // prints '{"int32":10}'
	     * console.log(EJSON.stringify(doc));
	     * ```
	     */
	    function stringify(value, 
	    // eslint-disable-next-line @typescript-eslint/no-explicit-any
	    replacer, space, options) {
	        if (space != null && typeof space === 'object') {
	            options = space;
	            space = 0;
	        }
	        if (replacer != null && typeof replacer === 'object' && !Array.isArray(replacer)) {
	            options = replacer;
	            replacer = undefined;
	            space = 0;
	        }
	        var serializeOptions = Object.assign({ relaxed: true, legacy: false }, options, {
	            seenObjects: [{ propertyName: '(root)', obj: null }]
	        });
	        var doc = serializeValue(value, serializeOptions);
	        return JSON.stringify(doc, replacer, space);
	    }
	    EJSON.stringify = stringify;
	    /**
	     * Serializes an object to an Extended JSON string, and reparse it as a JavaScript object.
	     *
	     * @param value - The object to serialize
	     * @param options - Optional settings passed to the `stringify` function
	     */
	    function serialize(value, options) {
	        options = options || {};
	        return JSON.parse(stringify(value, options));
	    }
	    EJSON.serialize = serialize;
	    /**
	     * Deserializes an Extended JSON object into a plain JavaScript object with native/BSON types
	     *
	     * @param ejson - The Extended JSON object to deserialize
	     * @param options - Optional settings passed to the parse method
	     */
	    function deserialize(ejson, options) {
	        options = options || {};
	        return parse(JSON.stringify(ejson), options);
	    }
	    EJSON.deserialize = deserialize;
	})(EJSON || (EJSON = {}));

	/* eslint-disable @typescript-eslint/no-explicit-any */
	/** @public */
	var bsonMap;
	var bsonGlobal = getGlobal();
	if (bsonGlobal.Map) {
	    bsonMap = bsonGlobal.Map;
	}
	else {
	    // We will return a polyfill
	    bsonMap = /** @class */ (function () {
	        function Map(array) {
	            if (array === void 0) { array = []; }
	            this._keys = [];
	            this._values = {};
	            for (var i = 0; i < array.length; i++) {
	                if (array[i] == null)
	                    continue; // skip null and undefined
	                var entry = array[i];
	                var key = entry[0];
	                var value = entry[1];
	                // Add the key to the list of keys in order
	                this._keys.push(key);
	                // Add the key and value to the values dictionary with a point
	                // to the location in the ordered keys list
	                this._values[key] = { v: value, i: this._keys.length - 1 };
	            }
	        }
	        Map.prototype.clear = function () {
	            this._keys = [];
	            this._values = {};
	        };
	        Map.prototype.delete = function (key) {
	            var value = this._values[key];
	            if (value == null)
	                return false;
	            // Delete entry
	            delete this._values[key];
	            // Remove the key from the ordered keys list
	            this._keys.splice(value.i, 1);
	            return true;
	        };
	        Map.prototype.entries = function () {
	            var _this = this;
	            var index = 0;
	            return {
	                next: function () {
	                    var key = _this._keys[index++];
	                    return {
	                        value: key !== undefined ? [key, _this._values[key].v] : undefined,
	                        done: key !== undefined ? false : true
	                    };
	                }
	            };
	        };
	        Map.prototype.forEach = function (callback, self) {
	            self = self || this;
	            for (var i = 0; i < this._keys.length; i++) {
	                var key = this._keys[i];
	                // Call the forEach callback
	                callback.call(self, this._values[key].v, key, self);
	            }
	        };
	        Map.prototype.get = function (key) {
	            return this._values[key] ? this._values[key].v : undefined;
	        };
	        Map.prototype.has = function (key) {
	            return this._values[key] != null;
	        };
	        Map.prototype.keys = function () {
	            var _this = this;
	            var index = 0;
	            return {
	                next: function () {
	                    var key = _this._keys[index++];
	                    return {
	                        value: key !== undefined ? key : undefined,
	                        done: key !== undefined ? false : true
	                    };
	                }
	            };
	        };
	        Map.prototype.set = function (key, value) {
	            if (this._values[key]) {
	                this._values[key].v = value;
	                return this;
	            }
	            // Add the key to the list of keys in order
	            this._keys.push(key);
	            // Add the key and value to the values dictionary with a point
	            // to the location in the ordered keys list
	            this._values[key] = { v: value, i: this._keys.length - 1 };
	            return this;
	        };
	        Map.prototype.values = function () {
	            var _this = this;
	            var index = 0;
	            return {
	                next: function () {
	                    var key = _this._keys[index++];
	                    return {
	                        value: key !== undefined ? _this._values[key].v : undefined,
	                        done: key !== undefined ? false : true
	                    };
	                }
	            };
	        };
	        Object.defineProperty(Map.prototype, "size", {
	            get: function () {
	                return this._keys.length;
	            },
	            enumerable: false,
	            configurable: true
	        });
	        return Map;
	    }());
	}
	/**
	 * Any integer up to 2^53 can be precisely represented by a double.
	 * @internal
	 */
	var JS_INT_MAX = Math.pow(2, 53);
	/**
	 * Any integer down to -2^53 can be precisely represented by a double.
	 * @internal
	 */
	var JS_INT_MIN = -Math.pow(2, 53);

	// Internal long versions
	var JS_INT_MAX_LONG = Long.fromNumber(JS_INT_MAX);
	var JS_INT_MIN_LONG = Long.fromNumber(JS_INT_MIN);

	/** @internal */
	// Default Max Size
	var MAXSIZE = 1024 * 1024 * 17;
	// Current Internal Temporary Serialization Buffer
	var buffer = buffer_1.alloc(MAXSIZE);

	var RoundContestant = /** @class */ (function () {
	    function RoundContestant(contestant, dto) {
	        this.Enabled = ko$1.observable(false);
	        this.EaselNumber = ko$1.observable();
	        this.IsWinner = ko$1.observable(0);
	        this.EnableAuction = ko$1.observable(0);
	        this.Disabled = ko$1.observable();
	        this.Detail = contestant;
	        this._id = dto ? dto._id : new ObjectId().toHexString();
	        if (dto) {
	            this.Enabled(dto.Enabled || false);
	            this.EaselNumber(dto.EaselNumber);
	            this.IsWinner(dto.IsWinner);
	            this.EnableAuction(dto.EnableAuction);
	        }
	        this.Disabled(this.Detail && this.Detail.Name().length === 0);
	        contestant.RegisterRoundContestantObj(this);
	    }
	    RoundContestant.prototype.ToDTO = function () {
	        return {
	            _id: this._id,
	            Detail: this.Detail.ToDTO(),
	            Enabled: this.Enabled(),
	            EaselNumber: this.EaselNumber(),
	            IsWinner: this.IsWinner(),
	            EnableAuction: this.EnableAuction()
	        };
	    };
	    return RoundContestant;
	}());

	var Round = /** @class */ (function () {
	    function Round(dto, AvailableContestants) {
	        var _this = this;
	        this.AvailableContestants = AvailableContestants;
	        this.Contestants = ko.observableArray([]);
	        this.VideoUrl = ko.observable();
	        this.Visible = ko.observable(false);
	        this._id = dto._id;
	        this.RoundNumber = dto.RoundNumber;
	        this.VideoUrl(dto.VideoUrl);
	        this.Contestants(AvailableContestants().map(function (ac) {
	            var roundContestant = dto.Contestants.find(function (rc) { return rc.Detail && rc.Detail._id == ac._id; });
	            if (roundContestant) {
	                return new RoundContestant(ac, roundContestant);
	            }
	            else {
	                return new RoundContestant(ac);
	            }
	        }));
	        AvailableContestants.subscribe(function (available) {
	            if (available) {
	                _this.Contestants(available.map(function (ac) {
	                    var roundContestant = _this.Contestants().find(function (rc) { return rc.Detail === ac; });
	                    if (roundContestant) {
	                        return roundContestant;
	                    }
	                    else {
	                        return new RoundContestant(ac);
	                    }
	                }));
	            }
	        });
	    }
	    Round.prototype.ToggleVisible = function () {
	        this.Visible(!this.Visible());
	    };
	    Round.prototype.ToDTO = function () {
	        var contestants = this.Contestants();
	        var filteredContestants = [];
	        for (var i = 0; i < contestants.length; i++) {
	            if (!contestants[i].Disabled()) {
	                filteredContestants.push(contestants[i]);
	            }
	        }
	        return {
	            _id: this._id,
	            RoundNumber: this.RoundNumber,
	            Contestants: filteredContestants.map(function (c) { return c.ToDTO(); }),
	            VideoUrl: this.VideoUrl()
	        };
	    };
	    return Round;
	}());

	var BusyTracker = /** @class */ (function () {
	    function BusyTracker() {
	        this._tasks = ko.observableArray();
	        this._operations = ko.observableArray();
	        this.ConfigureDependentObservables();
	    }
	    BusyTracker.prototype.ConfigureDependentObservables = function () {
	        var _this = this;
	        this.Busy = ko.computed({
	            owner: this,
	            read: function () {
	                return _this._tasks().length + _this._operations().length > 0;
	            }
	        });
	    };
	    BusyTracker.prototype.AddTask = function (task) {
	        /// <param name="task" type="String">
	        /// Identifies the task being performed that is keeping the tracker busy
	        /// </param>
	        if (!this._tasks().contains(task)) {
	            this._tasks.push(task);
	        }
	    };
	    BusyTracker.prototype.AddOperations = function (operations) {
	        var _this = this;
	        /// <param name="operations" type="Array">
	        /// </param>
	        operations.forEach(function (operation) {
	            _this.AddOperation(operation);
	        });
	    };
	    BusyTracker.prototype.AddOperation = function (operation) {
	        return __awaiter(this, void 0, Promise, function () {
	            var existingOperation;
	            var _this = this;
	            return __generator(this, function (_a) {
	                existingOperation = ko.utils.arrayFirst(this._operations(), function (listOperation) {
	                    return listOperation === operation;
	                }, this);
	                if (existingOperation == null) {
	                    this._operations.push(operation);
	                    operation.then(function () {
	                        _this._operations.remove(operation);
	                    }).catch(function (e) {
	                        console.error(e);
	                        _this._operations.remove(operation);
	                    });
	                }
	                return [2 /*return*/, operation];
	            });
	        });
	    };
	    BusyTracker.prototype.TaskComplete = function (task) {
	        /// <param name="task" type="String">
	        /// </param>
	        if (this._tasks().contains(task)) {
	            this._tasks.remove(task);
	        }
	    };
	    BusyTracker.prototype.ClearTasks = function () {
	        this._tasks.removeAll();
	    };
	    BusyTracker.prototype.HasTask = function (taskName) {
	        /// <param name="taskName" type="String">
	        /// </param>
	        /// <returns type="Boolean"></returns>
	        return this._tasks().contains(taskName);
	    };
	    return BusyTracker;
	}());

	var Artist = /** @class */ (function () {
	    function Artist(Artist, Parent, vm, IsNew) {
	        this.LoadingTracker = new BusyTracker();
	        this.Name = ko.observable();
	        this.EntryId = ko.observable();
	        this.Email = ko.observable();
	        this.Website = ko.observable();
	        this.City = ko.observable();
	        this.VoterProfile = ko.observable();
	        this.PhoneNumber = ko.observable();
	        this.SaveMessage = ko.observable();
	        this.SaveMessageCss = ko.observable();
	        this.IsNew = false;
	        this.Vm = vm;
	        this.Parent = Parent;
	        this.Name(Artist.Name);
	        this.ArtistId = Artist._id;
	        this.EntryId(Artist.EntryId);
	        this.Email(Artist.Email);
	        this.Website(Artist.Website);
	        this.City(Artist.City);
	        this.PhoneNumber(Artist.PhoneNumber);
	        this.IsNew = IsNew;
	        if (Artist.Registration) {
	            this.VoterProfile(Artist.Registration.Hash.toString());
	        }
	    }
	    Artist.prototype.Save = function () {
	        return __awaiter(this, void 0, void 0, function () {
	            var e_1;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        if (this.IsNew) {
	                            return [2 /*return*/, this.Add()];
	                        }
	                        _a.label = 1;
	                    case 1:
	                        _a.trys.push([1, 3, , 4]);
	                        return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(
	                            // @ts-ignore
	                            mp + "/api/artist/" + this.ArtistId, 'PUT', this.ToDTO()))];
	                    case 2:
	                        _a.sent();
	                        this.SaveMessage("Contestant Updated");
	                        this.SaveMessageCss('alert-success');
	                        return [3 /*break*/, 4];
	                    case 3:
	                        e_1 = _a.sent();
	                        console.error('error', e_1);
	                        this.SaveMessage(e_1 && e_1.Message || e_1.message || 'An error occurred');
	                        this.SaveMessageCss('alert-danger');
	                        this.Parent.Vm.SelectedArtist(this);
	                        return [3 /*break*/, 4];
	                    case 4: return [2 /*return*/];
	                }
	            });
	        });
	    };
	    Artist.prototype.Add = function () {
	        return __awaiter(this, void 0, void 0, function () {
	            var result, contestantObj, i, roundContestant, e_2;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        _a.trys.push([0, 2, , 3]);
	                        return [4 /*yield*/, this.LoadingTracker.AddOperation(Request("api/artist", 'POST', this.ToDTO()))];
	                    case 1:
	                        result = _a.sent();
	                        this.SaveMessage("Contestant Added");
	                        this.SaveMessageCss('alert-success');
	                        this.ArtistId = result.Data._id;
	                        if (this.Vm.Editor()) {
	                            contestantObj = new Contestant(result.Data, true);
	                            this.Vm.Editor().Contestants().push(contestantObj);
	                            this.Vm.Editor().Contestants.notifySubscribers();
	                            for (i = 0; i < this.Vm.Editor().Rounds().length; i++) {
	                                roundContestant = new RoundContestant(contestantObj);
	                                this.Vm.Editor().Rounds()[i].Contestants.push(roundContestant);
	                                this.Vm.Editor().Rounds()[i].Contestants.notifySubscribers();
	                            }
	                            this.Vm.Editor().Rounds.notifySubscribers();
	                        }
	                        this.IsNew = false;
	                        return [3 /*break*/, 3];
	                    case 2:
	                        e_2 = _a.sent();
	                        console.error('error', e_2);
	                        this.SaveMessage(e_2 && e_2.Message || e_2.message || 'An error occurred');
	                        this.SaveMessageCss('alert-danger');
	                        this.Parent.Vm.SelectedArtist(this);
	                        return [3 /*break*/, 3];
	                    case 3: return [2 /*return*/];
	                }
	            });
	        });
	    };
	    Artist.prototype.ToDTO = function () {
	        return {
	            Name: this.Name(),
	            EntryId: this.EntryId(),
	            Email: this.Email(),
	            Website: this.Website(),
	            City: this.City(),
	            PhoneNumber: this.PhoneNumber()
	        };
	    };
	    Artist.prototype.Edit = function () {
	        this.Vm.SelectedArtist(this);
	        this.Vm.OpenPopup(true);
	    };
	    return Artist;
	}());

	var EventEditor = /** @class */ (function () {
	    function EventEditor(dto, _closeCallback) {
	        var _this = this;
	        this._closeCallback = _closeCallback;
	        this.Name = ko.observable();
	        this.PhoneNumber = ko.observable();
	        this.RegistrationMessage = ko.observable();
	        this.Enabled = ko.observable(true);
	        this.CurrentRound = ko.observable();
	        this.ShowArchiveMessage = ko.observable(false);
	        this.IsNew = ko.observable(false);
	        this.Contestants = ko.observableArray();
	        this.Rounds = ko.observableArray();
	        this.ReportLinks = ko.observableArray();
	        this.VoteByLink = ko.observable();
	        this.Currencies = ko.observableArray();
	        this.selectedPhoneNumberId = ko.observable();
	        this.selectedPhoneNumber = ko.observable();
	        this.saveError = ko.observable();
	        this.Description = ko.observable();
	        this.SendLinkToGuests = ko.observable();
	        this.EmailRegistration = ko.observable();
	        this.Country = ko.observable();
	        this.City = ko.observable();
	        this.Currency = ko.observable();
	        this.selectedCountryId = ko.observable();
	        this.selectedCityId = ko.observable();
	        this.Timezone = ko.observable();
	        this.selectedTimezoneId = ko.observable();
	        this.selectedCurrencyId = ko.observable();
	        this.EventStartDateTime = ko.observable();
	        this.EventEndDateTime = ko.observable();
	        this.TicketLink = ko.observable();
	        this.Venue = ko.observable();
	        this.Price = ko.observable();
	        this.ShowInApp = ko.observable();
	        this.EnableAuction = ko.observable();
	        this.ArtWidthHeight = ko.observable();
	        this.AuctionDescription = ko.observable();
	        this.AuctionStartBid = ko.observable();
	        this.MinBidIncrement = ko.observable();
	        this.AuctionNotice = ko.observable();
	        this.AdminControlInAuctionPage = ko.observable(true);
	        this.Tax = ko.observable(0);
	        this.RegisterAtSMSVote = ko.observable();
	        this.SendAuctionLinkToGuests = ko.observable();
	        this.SponsorLogo = ko.observable();
	        this.SponsorText = ko.observable();
	        this.IsFileReadInProgress = ko.observable(false);
	        this.SearchText = ko.observable();
	        this.Options = ko.observableArray();
	        this.selectedValue = ko.observable('');
	        this.SlackChannel = ko.observable('');
	        this.VideoStream = ko.observable('');
	        this.LiveStream = ko.observable('');
	        this.AuctionCloseRoundDelay = ko.observable();
	        this.AuctionCloseStartsAt = ko.observable();
	        this._id = dto._id;
	        this.EID = dto.EID;
	        this.Name(dto.Name);
	        this.Enabled(dto.Enabled);
	        this.Contestants(dto.Contestants.map(function (c) { return new Contestant(c, true); }));
	        this.Rounds(dto.Rounds.map(function (r) { return new Round(r, _this.Contestants); }));
	        this.RegistrationMessage(dto.RegistrationConfirmationMessage);
	        this.VoteByLink(dto.VoteByLink);
	        this.SendLinkToGuests(dto.SendLinkToGuests);
	        this.EmailRegistration(dto.EmailRegistration);
	        this.ReportLinks(dto.ReportLinks || []);
	        this.DisplayContestants = ko.computed(function () { return _this.Contestants().map(function (c) { return c.Name; }).join(', '); });
	        this.TicketLink(dto.TicketLink);
	        this.Venue(dto.Venue);
	        this.Price(dto.Price);
	        this.ShowInApp(dto.ShowInApp);
	        this.AdminControlInAuctionPage(dto.AdminControlInAuctionPage);
	        this.Tax(dto.Tax);
	        // @ts-ignore
	        this.PhoneNumbers = phoneNumberDict; // coming from html
	        // @ts-ignore
	        this.Countries = countriesDict; // coming from html
	        // @ts-ignore
	        this.Cities = citiesDict; // coming from html
	        var currencyLabels = [];
	        for (var i = 0; i < this.Countries.length; i++) {
	            if (currencyLabels.indexOf(this.Countries[i].currency_label) === -1) {
	                this.Currencies().push(this.Countries[i]);
	                currencyLabels.push(this.Countries[i].currency_label);
	            }
	        }
	        // @ts-ignore
	        this.Timezones = timezonesDict; // coming from html
	        this.EventStartDateTime(dto.EventStartDateTime);
	        this.EventEndDateTime(dto.EventEndDateTime);
	        this.AuctionCloseStartsAt(dto.AuctionCloseStartsAt);
	        this.PhoneNumber(dto.PhoneNumber);
	        var selectedNumberObj = this.PhoneNumbers.filter(function (r) {
	            return r.phone === _this.PhoneNumber();
	        })[0];
	        if (selectedNumberObj) {
	            this.selectedPhoneNumberId(selectedNumberObj._id);
	            this.selectedPhoneNumber(selectedNumberObj.phone);
	        }
	        this.Description(dto.Description);
	        // save default value
	        this.selectedCountryId(dto.Country);
	        this.selectedCityId(dto.City);
	        this.selectedCurrencyId(dto.Currency);
	        this.Currency(dto.Currency);
	        this.Country(dto.Country);
	        this.City(dto.City);
	        this.selectedTimezoneId(dto.TimeZone);
	        this.Timezone(dto.TimeZone);
	        this.EnableAuction(dto.EnableAuction);
	        this.RegisterAtSMSVote(dto.RegisterAtSMSVote);
	        this.SendAuctionLinkToGuests(dto.SendAuctionLinkToGuests);
	        this.ArtWidthHeight(dto.ArtWidthHeight);
	        this.AuctionDescription(dto.AuctionDescription);
	        this.AuctionStartBid(dto.AuctionStartBid);
	        this.MinBidIncrement(dto.MinBidIncrement);
	        this.AuctionNotice(dto.AuctionNotice);
	        this.SponsorLogo(dto.SponsorLogo);
	        this.SponsorText(dto.SponsorText);
	        this.SlackChannel(dto.SlackChannel);
	        this.LiveStream(dto.LiveStream);
	        this.VideoStream(dto.VideoStream);
	        this.AuctionCloseRoundDelay(dto.AuctionCloseRoundDelay);
	        this.selectedCityId.subscribe(function (cityId) {
	            // save the value  of select.
	            _this.City(cityId);
	        });
	        this.selectedCountryId.subscribe(function (countryId) {
	            // save the value  of select.
	            _this.Country(countryId);
	        });
	        this.selectedCurrencyId.subscribe(function (countryId) {
	            // save the value  of select.
	            _this.Currency(countryId);
	        });
	        this.selectedTimezoneId.subscribe(function (timezoneId) {
	            // save the value  of select.
	            _this.Timezone(timezoneId);
	        });
	        // @ts-ignore
	        jQuery(document).ready(function () {
	            // @ts-ignore
	            jQuery('#inputStartDateTime').datetimepicker({
	                format: 'm/d/Y h:i A',
	                timeFormat: 'h:i A',
	                defaultTime: '19:00'
	            });
	            // @ts-ignore
	            jQuery('#inputEndDateTime').datetimepicker({
	                format: 'm/d/Y h:i A',
	                defaultTime: '21:00'
	            });
	            // @ts-ignore
	            jQuery('#inputAuctionCloseStartsAt').datetimepicker({
	                format: 'm/d/Y h:i A',
	                // defaultTime: '21:00',
	                value: _this.AuctionCloseStartsAt()
	            });
	        });
	    }
	    EventEditor.prototype.artistAutoCompleteCallback = function (request, response) {
	        var _this = this;
	        Request(mp + "/api/artist/auto-suggest/?q=" + request.term, 'GET').then(function (r) {
	            _this.Options([]);
	            for (var i = 0; i < r.Data.Contestants.length; i++) {
	                var entryId = r.Data.Contestants[i].EntryId ? " (" + r.Data.Contestants[i].EntryId + ")" : '';
	                _this.Options.push({
	                    label: "" + r.Data.Contestants[i].Name + entryId,
	                    value: r.Data.Contestants[i]._id,
	                    contestant: r.Data.Contestants[i]
	                });
	            }
	            response(_this.Options());
	        }).catch(function (e) {
	            console.error('auto suggest api call', e);
	            response(_this.Options());
	        });
	    };
	    /*
	    // TODO temp
	    async getPhoneNumbers() {
	        console.log('ddd', this.Options().map((p) => {return {label: p.name, value: p.id}; }));
	        try {
	            const result = await Request<OperationResult>(`api/event/h`, 'DELETE');
	        } catch (e) {

	        }
	        return this.Options().map((p) => {return {name: p.name, id: p.id}; });
	    }

	    selectPhoneNumber(event: any, ui: { item: { name: any; }; }) {
	        console.log('ui', ui);
	        this.selectedValue(ui.item.name);
	    }*/
	    EventEditor.prototype.ToDTO = function () {
	        var _this = this;
	        var phone = this.PhoneNumbers.filter(function (r) {
	            return r._id === _this.selectedPhoneNumberId();
	        })[0];
	        var sponsorLogo;
	        if (this.SponsorLogo() && !this.SponsorLogo()._id) {
	            sponsorLogo = {
	                _id: '',
	                Name: '',
	                Size: 0,
	                Url: this.SponsorLogo().Url,
	                Type: 'Original',
	                FileType: 'photo'
	            };
	        }
	        return {
	            LiveStream: this.LiveStream(),
	            VideoStream: this.VideoStream(),
	            _id: this._id,
	            EID: this.EID,
	            Name: this.Name(),
	            Enabled: this.Enabled(),
	            Contestants: this.Contestants().map(function (c) { return c.ToDTO(); }),
	            PhoneNumber: phone && phone.phone,
	            Rounds: this.Rounds().map(function (r) { return r.ToDTO(); }),
	            CurrentRound: this.CurrentRound() && this.CurrentRound().ToDTO(),
	            RegistrationConfirmationMessage: this.RegistrationMessage(),
	            ReportLinks: this.ReportLinks().map(function (r) {
	                return { link: r.link, label: r.label };
	            }),
	            Logs: [],
	            RegistrationsVoteFactor: [],
	            VoteByLink: this.VoteByLink(),
	            // PhoneNumbers: [],
	            Description: this.Description(),
	            SendLinkToGuests: this.SendLinkToGuests(),
	            EmailRegistration: this.EmailRegistration(),
	            Country: this.Country(),
	            City: this.City(),
	            TimeZone: this.Timezone(),
	            EventStartDateTime: this.EventStartDateTime(),
	            EventEndDateTime: this.EventEndDateTime(),
	            TicketLink: this.TicketLink(),
	            Price: this.Price(),
	            Venue: this.Venue(),
	            ShowInApp: this.ShowInApp(),
	            Currency: this.Currency(),
	            ArtWidthHeight: this.ArtWidthHeight(),
	            AuctionDescription: this.AuctionDescription(),
	            AuctionStartBid: this.AuctionStartBid(),
	            MinBidIncrement: this.MinBidIncrement(),
	            AuctionNotice: this.AuctionNotice(),
	            EnableAuction: this.EnableAuction(),
	            AdminControlInAuctionPage: this.AdminControlInAuctionPage(),
	            Tax: this.Tax(),
	            RegisterAtSMSVote: this.RegisterAtSMSVote(),
	            SendAuctionLinkToGuests: this.SendAuctionLinkToGuests(),
	            SponsorLogo: sponsorLogo,
	            SponsorText: this.SponsorText(),
	            SlackChannel: this.SlackChannel(),
	            AuctionCloseRoundDelay: this.AuctionCloseRoundDelay(),
	            AuctionCloseStartsAt: this.AuctionCloseStartsAt()
	        };
	    };
	    EventEditor.prototype.AddContestant = function (Vm) {
	        // this.AddArtist(Vm);
	        var contestantObj = {
	            EntryId: 0,
	            Name: '',
	            _id: new ObjectId().toHexString(),
	            oldId: undefined
	        };
	        this.Contestants.push(new Contestant(contestantObj, false));
	    };
	    EventEditor.prototype.AddArtist = function (Vm) {
	        var ArtistObj = new Artist({
	            ChildContestants: [],
	            City: undefined,
	            CityText: '',
	            Email: '',
	            EntryId: undefined,
	            IsDuplicate: false,
	            Name: '',
	            PhoneNumber: '',
	            Website: '',
	            _id: undefined
	        }, Vm.Artists(), Vm, true);
	        // this.Artists().push(ArtistObj);
	        ArtistObj.Edit();
	    };
	    EventEditor.prototype.DeleteContestant = function (contestant) {
	        this.Contestants.remove(contestant);
	    };
	    EventEditor.prototype.AddRound = function () {
	        this.Rounds.push(new Round({
	            _id: new ObjectId().toHexString(),
	            RoundNumber: this.Rounds().length + 1,
	            Contestants: [],
	            VideoUrl: ''
	        }, this.Contestants));
	        // collapse ignored because it comes from the bootstrap
	        try {
	            // @ts-ignore
	            $('#roundsPanel').collapse('show');
	            // @ts-ignore
	            var lastRound = $('#roundsPanel table:last');
	            if (lastRound && lastRound[0]) {
	                // @ts-ignore
	                $('html, body').animate({
	                    // @ts-ignore
	                    scrollTop: $(lastRound[0]).offset().top
	                }, 500);
	            }
	        }
	        catch (e) {
	            console.error(e);
	        }
	    };
	    EventEditor.prototype.DeleteRound = function (round) {
	        this.Rounds.remove(round);
	    };
	    EventEditor.prototype.SetCurrentRound = function (round) {
	        this.CurrentRound(round);
	    };
	    EventEditor.prototype.Save = function () {
	        return __awaiter(this, void 0, void 0, function () {
	            var dto, easelRoundCon, i, roundNo, j, uniqId, result, e_1;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        while (this.IsFileReadInProgress() === true) {
	                            console.log('reading file');
	                        }
	                        dto = this.ToDTO();
	                        _a.label = 1;
	                    case 1:
	                        _a.trys.push([1, 3, , 4]);
	                        easelRoundCon = [];
	                        for (i = 0; i < dto.Rounds.length; i++) {
	                            roundNo = dto.Rounds[i].RoundNumber;
	                            for (j = 0; j < dto.Rounds[i].Contestants.length; j++) {
	                                uniqId = roundNo + "-c" + dto.Rounds[i].Contestants[j].EaselNumber;
	                                if (dto.Rounds[i].Contestants[j].Enabled) {
	                                    if (easelRoundCon.indexOf(uniqId) === -1) {
	                                        easelRoundCon.push(uniqId);
	                                    }
	                                    else {
	                                        throw new Error("Duplicate Easel Number " + dto.Rounds[i].Contestants[j].EaselNumber + " assigned in the round " + roundNo);
	                                    }
	                                    easelRoundCon.push(roundNo + "-c" + dto.Rounds[i].Contestants[j].EaselNumber);
	                                }
	                            }
	                        } // Validation end
	                        return [4 /*yield*/, Request(mp + '/api/event', 'POST', dto)];
	                    case 2:
	                        result = _a.sent();
	                        if (result.Success) {
	                            window.location.reload();
	                        }
	                        return [3 /*break*/, 4];
	                    case 3:
	                        e_1 = _a.sent();
	                        this.saveError(e_1 && (e_1.message || e_1.Message) || e_1.toString());
	                        setTimeout(this.saveError.bind(null, ''), 4000);
	                        return [3 /*break*/, 4];
	                    case 4: return [2 /*return*/];
	                }
	            });
	        });
	    };
	    EventEditor.prototype.Archive = function () {
	        this.ShowArchiveMessage(true);
	    };
	    EventEditor.prototype.ArchiveCancel = function () {
	        this.ShowArchiveMessage(false);
	    };
	    EventEditor.prototype.ArchiveConfirm = function () {
	        return __awaiter(this, void 0, void 0, function () {
	            var result;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0: return [4 /*yield*/, Request(mp + ("/api/event/" + this._id), 'DELETE')];
	                    case 1:
	                        result = _a.sent();
	                        if (result.Success) {
	                            window.location.reload();
	                        }
	                        return [2 /*return*/];
	                }
	            });
	        });
	    };
	    EventEditor.prototype.Cancel = function () {
	        this._closeCallback();
	    };
	    EventEditor.prototype.toggleHandle = function (vm, e) {
	        // @ts-ignore
	        $(e.target).find('i').toggleClass('glyphicon-plus glyphicon-minus');
	    };
	    EventEditor.prototype.handleArtistForm = function (form) {
	        return false;
	    };
	    EventEditor.prototype.fileUpload = function (vm, e) {
	        e.preventDefault();
	        var file = e.target.files[0];
	        var reader = new FileReader();
	        var me = this;
	        reader.onloadend = function (onloadend_e) {
	            // base 64 file
	            var result = reader.result;
	            me.SponsorLogo({
	                _id: '',
	                Name: '',
	                Size: 0,
	                Url: result.toString(),
	                Type: 'Original',
	                FileType: 'photo'
	            });
	            me.IsFileReadInProgress(false);
	        };
	        reader.onabort = function () {
	            me.IsFileReadInProgress(false);
	            alert('Upload aborted');
	        };
	        reader.onerror = function (e) {
	            me.IsFileReadInProgress(false);
	            var message = '';
	            switch (e.target.error.code) {
	                case e.target.error.NOT_FOUND_ERR:
	                    message = 'File not found!';
	                    break;
	                case e.target.error.NOT_READABLE_ERR:
	                    message = 'File not readable!';
	                    break;
	                case e.target.error.ABORT_ERR:
	                    message = 'Read operation was aborted!';
	                    break;
	                case e.target.error.SECURITY_ERR:
	                    message = 'File is in a locked state!';
	                    break;
	                case e.target.error.ENCODING_ERR:
	                    message = 'The file is too long to encode in a "data://" URL.';
	                    break;
	                default:
	                    message = 'Read error.';
	            }
	            alert(message);
	        };
	        if (file) {
	            this.IsFileReadInProgress(true);
	            reader.readAsDataURL(file);
	        }
	        else {
	            alert('no file');
	        }
	    };
	    return EventEditor;
	}());

	var EventSummary = /** @class */ (function () {
	    function EventSummary(dto) {
	        var _this = this;
	        this.Rounds = ko.observable();
	        this.CurrentRound = ko.observable();
	        this.CurrentRoundUpdater = new BusyTracker();
	        this.LoadEvent(dto);
	        this.NextRoundNumber = ko.computed(function () {
	            var rounds = _this.Rounds()
	                .filter(function (r) { return !r.IsFinished; });
	            if (rounds.length > 0) {
	                return rounds.map(function (r) { return r.RoundNumber; })
	                    .reduce(function (prev, cur) {
	                    return prev < cur ? prev : cur;
	                });
	            }
	            else {
	                return 0;
	            }
	        });
	        this.IncrementRoundText = ko.computed(function () {
	            if (_this.CurrentRound()) {
	                return "End Round " + _this.CurrentRound().RoundNumber;
	            }
	            else if (_this.Rounds().some(function (r) { return !r.IsFinished; })) {
	                var rounds = _this.Rounds()
	                    .filter(function (r) { return !r.IsFinished; });
	                if (rounds.length > 0) {
	                    var nextRound = rounds.map(function (r) { return r.RoundNumber; })
	                        .reduce(function (prev, cur) {
	                        return prev < cur ? prev : cur;
	                    });
	                    if (nextRound != 0) {
	                        return "Begin Round " + nextRound;
	                    }
	                }
	            }
	            else {
	                return "Finished!";
	            }
	        });
	        this.IncrementRoundCSS = ko.computed(function () {
	            if (_this.CurrentRound()) {
	                return "btn-danger";
	            }
	            else if (_this.Rounds().some(function (r) { return !r.IsFinished; })) {
	                var rounds = _this.Rounds()
	                    .filter(function (r) { return !r.IsFinished; });
	                if (rounds.length > 0) {
	                    var nextRound = rounds.map(function (r) { return r.RoundNumber; })
	                        .reduce(function (prev, cur) {
	                        return prev < cur ? prev : cur;
	                    });
	                    if (nextRound != 0) {
	                        return "btn-success";
	                    }
	                }
	            }
	            else {
	                return "btn-default";
	            }
	        });
	    }
	    EventSummary.prototype.LoadEvent = function (dto) {
	        this._id = dto._id;
	        this.Name = dto.Name;
	        this.Enabled = dto.Enabled;
	        this.PhoneNumber = dto.PhoneNumber;
	        // this.Contestants = dto.Contestants;
	        this.Rounds(dto.Rounds);
	        this.CurrentRound(dto.CurrentRound);
	        this.countryFlag = dto.countryFlag;
	    };
	    EventSummary.prototype.IncrementRound = function () {
	        return __awaiter(this, void 0, Promise, function () {
	            var result;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0: return [4 /*yield*/, this.CurrentRoundUpdater.AddOperation(Request(mp + ("/api/event/" + this._id + "/incrementround"), 'POST'))];
	                    case 1:
	                        result = _a.sent();
	                        if (result.Success) {
	                            this.LoadEvent(result.Data);
	                        }
	                        return [2 /*return*/];
	                }
	            });
	        });
	    };
	    return EventSummary;
	}());

	var Promotion = /** @class */ (function () {
	    function Promotion(VM) {
	        var _this = this;
	        this.filterRegisterIds = ko.observableArray([]);
	        this.Message = ko.observable('');
	        this.ErrorMessage = ko.observable();
	        this.displayMessage = ko.observable();
	        this.events = ko.observableArray([]);
	        this.eventPhoneNumbers = ko.observableArray([]);
	        this.LoadingTracker = new BusyTracker();
	        this.bids = ko.observable();
	        this.voteCount = ko.observable();
	        this.timelogs = ko.observable();
	        this.notificationBySMS = ko.observable();
	        this.notificationByiOS = ko.observable();
	        this.notificationByAndroid = ko.observable();
	        this.phoneNumber = ko.observable();
	        this.message = ko.observable();
	        this.smsRegType = ko.observable(false);
	        this.appRegType = ko.observable(false);
	        this.PhoneValues = ko.observableArray([]);
	        this.selectedPhone = ko.computed(function () {
	            return ko.utils.arrayMap(_this.PhoneValues(), function (val) {
	                return val;
	                // @ts-ignore
	            }, _this);
	        });
	        this.filterGuestCount = ko.observable();
	        this.promotionLogsData = ko.observable();
	        this.promotionMessageLogsData = ko.observable();
	        this.promotionMessagesVoteData = ko.observable();
	        this.filterBids = ko.observable();
	        this.searchEvents = ko.observable();
	        this.registrationIDs = ko.observable([]); // IF BID is 0, then use this
	        this.deviceCount = ko.observable();
	        this.VM = VM;
	        // this.reloadData();
	        // this.bids(0);
	        this.notificationBySMS.subscribe(function (n) { return __awaiter(_this, void 0, void 0, function () {
	            return __generator(this, function (_a) {
	                this.deviceCount('0');
	                return [2 /*return*/];
	            });
	        }); });
	        this.notificationByiOS.subscribe(function (n) { return __awaiter(_this, void 0, void 0, function () {
	            return __generator(this, function (_a) {
	                this.deviceCount('0');
	                return [2 /*return*/];
	            });
	        }); });
	        this.notificationByAndroid.subscribe(function (n) { return __awaiter(_this, void 0, void 0, function () {
	            return __generator(this, function (_a) {
	                this.deviceCount('0');
	                return [2 /*return*/];
	            });
	        }); });
	    }
	    Promotion.prototype.LoadEvent = function (dto) {
	        this.id = dto._id;
	        this.title = dto.title;
	        this.EID = dto.EID;
	    };
	    Promotion.prototype.LoadPhoneNumber = function (dto) {
	        this.Phone = dto.phone;
	        this.Label = dto.label;
	    };
	    Promotion.prototype.LoadPromotionLogData = function (dto) {
	        this.id = dto._id;
	        this.counts = dto.count;
	        this.email = dto.email;
	        this.nickname = dto.nickname;
	        this.phoneNumber(dto.phonenumber);
	    };
	    Promotion.prototype.LoadEventDropdown = function (EventName) {
	        return __awaiter(this, void 0, Promise, function () {
	            var dtos;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0: return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(mp + '/api/promotion/event-list?eventName=' + EventName, 'GET'))];
	                    case 1:
	                        dtos = _a.sent();
	                        this.events(dtos);
	                        // @ts-ignore
	                        jQuery(document).ready(function () {
	                            // @ts-ignore
	                            jQuery('.search-box-sel-all').SumoSelect({ csvDispCount: 3, selectAll: true, search: true, searchText: 'Enter here.', okCancelInMulti: true });
	                        });
	                        return [2 /*return*/];
	                }
	            });
	        });
	    };
	    Promotion.prototype.LoadEventPhoneNumber = function () {
	        return __awaiter(this, void 0, Promise, function () {
	            var dtos;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0: return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(mp + '/api/promotion-phonenumber', 'GET'))];
	                    case 1:
	                        dtos = _a.sent();
	                        this.eventPhoneNumbers(dtos);
	                        return [2 /*return*/];
	                }
	            });
	        });
	    };
	    Promotion.prototype.LoadPromotionLogs = function () {
	        return __awaiter(this, void 0, Promise, function () {
	            var dtos;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0: return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(mp + '/api/promotion/logs', 'GET'))];
	                    case 1:
	                        dtos = _a.sent();
	                        this.promotionLogsData(dtos);
	                        return [2 /*return*/];
	                }
	            });
	        });
	    };
	    Promotion.prototype.LoadPromotionMessageLogs = function () {
	        return __awaiter(this, void 0, Promise, function () {
	            var dtos;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0: return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(mp + '/api/promotion/message-logs', 'GET'))];
	                    case 1:
	                        dtos = _a.sent();
	                        this.promotionMessageLogsData(dtos);
	                        return [2 /*return*/];
	                }
	            });
	        });
	    };
	    Promotion.prototype.LoadPromotionTopVotesLogs = function () {
	        return __awaiter(this, void 0, Promise, function () {
	            var dtos;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0: return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(mp + '/api/promotion/top-vote', 'GET'))];
	                    case 1:
	                        dtos = _a.sent();
	                        this.promotionMessagesVoteData(dtos);
	                        return [2 /*return*/];
	                }
	            });
	        });
	    };
	    Promotion.prototype.savePromotionForm = function () {
	        return __awaiter(this, void 0, Promise, function () {
	            var guestCount, i, dt, data, result, notificationResult;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        if (!(this.filterGuestCount() && typeof this.filterGuestCount() !== 'undefined')) return [3 /*break*/, 5];
	                        guestCount = JSON.parse(JSON.stringify(this.filterGuestCount()));
	                        if (!(this.VM.multipleSelectedOptionValues().length > 0 && guestCount.guestcount > 0)) return [3 /*break*/, 3];
	                        i = void 0;
	                        dt = [];
	                        for (i = 0; i < this.VM.multipleSelectedOptionValues().length; i++) {
	                            data = {
	                                'events': this.VM.multipleSelectedOptionValues()[i].id,
	                                'Phonenumber': this.selectedPhone()[0],
	                                'sms': (this.notificationBySMS()) ? true : false,
	                                'ios': (this.notificationByiOS()) ? true : false,
	                                'android': (this.notificationByAndroid()) ? true : false,
	                                'message': this.Message(),
	                                'registrationIds': this.filterRegisterIds() ? this.filterRegisterIds() : [],
	                                'dt': (this.filterBids()) ? this.filterBids() : [],
	                            };
	                            dt.push(data);
	                        }
	                        return [4 /*yield*/, Request(mp + '/api/promotion/save', 'POST', dt)];
	                    case 1:
	                        result = _a.sent();
	                        return [4 /*yield*/, this.sendNotfications(this.filterRegisterIds())];
	                    case 2:
	                        notificationResult = _a.sent();
	                        // return notificationResult;
	                        if (result.Success) {
	                            //
	                            alert('Notification sent ');
	                            // window.location.reload();
	                            // this.displayMessage('Notification Send Successfully');
	                            // this.flash('success', { msg: 'Success! You are logged in.' });
	                        }
	                        else {
	                            this.displayMessage('An Error occurred');
	                        }
	                        return [3 /*break*/, 4];
	                    case 3:
	                        alert('Select Valid Events Or no guest available');
	                        _a.label = 4;
	                    case 4: return [3 /*break*/, 6];
	                    case 5:
	                        alert('Select Valid Events Or Click on Refresh Result ');
	                        _a.label = 6;
	                    case 6: return [2 /*return*/];
	                }
	            });
	        });
	    };
	    Promotion.prototype.getGuestCount = function (data) {
	        return __awaiter(this, void 0, void 0, function () {
	            var result;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        if (!(data.length > 0)) return [3 /*break*/, 2];
	                        return [4 /*yield*/, Request(mp + '/api/promotion/guest-count', 'POST', data)];
	                    case 1:
	                        result = _a.sent();
	                        if (result.Success) {
	                            /*let res = JSON.parse(JSON.stringify(result));
	                            res = JSON.parse(JSON.stringify(res));*/
	                            this.registrationIDs(result.registerationIDs);
	                            return [2 /*return*/, result];
	                        }
	                        else {
	                            this.ErrorMessage('An Error occurred');
	                        }
	                        return [3 /*break*/, 3];
	                    case 2: return [2 /*return*/, { Success: false, guest: 0 }];
	                    case 3: return [2 /*return*/];
	                }
	            });
	        });
	    };
	    Promotion.prototype.getFilterGuestCount = function (data) {
	        return __awaiter(this, void 0, void 0, function () {
	            var bd, voteCount, tm, dt, result;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        if (!(data.length > 0)) return [3 /*break*/, 2];
	                        bd = '0';
	                        if (this.bids() && typeof this.bids() !== 'undefined') {
	                            bd = this.bids();
	                        }
	                        voteCount = '0';
	                        if (this.voteCount() && typeof this.voteCount() !== 'undefined') {
	                            voteCount = this.voteCount();
	                        }
	                        tm = '0';
	                        if (this.timelogs() && typeof this.timelogs() !== 'undefined') {
	                            tm = this.timelogs();
	                        }
	                        dt = {
	                            'data': data,
	                            'bids': bd,
	                            'timelogs': tm,
	                            'sms-reg': this.smsRegType(),
	                            'app-reg': this.appRegType(),
	                            'voteCount': voteCount
	                        };
	                        this.filterBids('');
	                        this.filterRegisterIds([]);
	                        return [4 /*yield*/, Request(mp + '/api/promotion/filter-guest-count', 'POST', dt)];
	                    case 1:
	                        result = _a.sent();
	                        this.filterGuestCount(result);
	                        if (result.Success) {
	                            result = JSON.parse(JSON.stringify(result));
	                            result = JSON.parse(JSON.stringify(result));
	                            this.filterBids(result.guest);
	                            // console.log('Here ===>>>', result);
	                            this.filterRegisterIds([]);
	                            this.filterRegisterIds(result.registrationids);
	                            // console.log('filterRegisterIds ===>>>', this.filterRegisterIds);
	                        }
	                        else {
	                            this.ErrorMessage('An Error occurred');
	                        }
	                        return [3 /*break*/, 3];
	                    case 2:
	                        alert('Please select Events');
	                        _a.label = 3;
	                    case 3: return [2 /*return*/];
	                }
	            });
	        });
	    };
	    Promotion.prototype.sendNotfications = function (registrationIDs) {
	        return __awaiter(this, void 0, void 0, function () {
	            var dt, result;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        if (!(registrationIDs.length > 0)) return [3 /*break*/, 2];
	                        dt = {
	                            registrationIDs: registrationIDs,
	                            'sms': (this.notificationBySMS()) ? true : false,
	                            'ios': (this.notificationByiOS()) ? true : false,
	                            'android': (this.notificationByAndroid()) ? true : false,
	                            'Phonenumber': this.selectedPhone()[0],
	                            'message': this.Message(),
	                        };
	                        return [4 /*yield*/, Request(mp + '/api/promotion/send-notification', 'POST', dt)];
	                    case 1:
	                        result = _a.sent();
	                        return [3 /*break*/, 3];
	                    case 2:
	                        alert({ Success: false, guest: 0 });
	                        _a.label = 3;
	                    case 3: return [2 /*return*/];
	                }
	            });
	        });
	    };
	    Promotion.prototype.getDeviceCount = function () {
	        return __awaiter(this, void 0, void 0, function () {
	            var registrationIDs;
	            return __generator(this, function (_a) {
	                registrationIDs = this.filterRegisterIds();
	                return [2 /*return*/];
	            });
	        });
	    };
	    return Promotion;
	}());

	var Artists = /** @class */ (function () {
	    function Artists(vm) {
	        var _this = this;
	        this.LoadingTracker = new BusyTracker();
	        this.Artists = ko.observableArray();
	        this.SearchText = ko.observable();
	        this.ActivePageNumber = ko.observable(1);
	        this.PageNumbers = ko.observableArray();
	        // used in view
	        this.PrevPageCss = ko.computed(function () {
	            if (_this.ActivePageNumber() === _this.PageNumbers().length) {
	                return 'disabled';
	            }
	            else if (_this.ActivePageNumber() === 1) {
	                return 'disabled';
	            }
	            return '';
	        });
	        // used in view
	        this.NextPageCss = ko.computed(function () {
	            if (_this.ActivePageNumber() === _this.PageNumbers().length) {
	                return 'disabled';
	            }
	            return '';
	        });
	        this.Limit = 10;
	        this.Vm = vm;
	    }
	    Artists.prototype.Search = function () {
	        return __awaiter(this, void 0, void 0, function () {
	            var searchResult, i, contestant, count, limit, numPages, j, e_1;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        _a.trys.push([0, 2, , 3]);
	                        return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(mp + "/api/artist/search", 'POST', {
	                                searchTerm: this.SearchText(),
	                                sortCol: '_id',
	                                sortOrder: -1,
	                                page: this.ActivePageNumber(),
	                                limit: this.Limit
	                            }))];
	                    case 1:
	                        searchResult = _a.sent();
	                        this.Artists([]);
	                        for (i = 0; i < searchResult.Data.Contestants.length; i++) {
	                            contestant = searchResult.Data.Contestants[i];
	                            this.Artists.push(new Artist(contestant, this, this.Vm));
	                        }
	                        this.PageNumbers([]);
	                        count = searchResult.Data.Count;
	                        limit = this.Limit;
	                        numPages = Math.ceil(count / limit);
	                        for (j = 1; j <= numPages; j++) {
	                            this.PageNumbers().push(j);
	                        }
	                        this.PageNumbers.notifySubscribers();
	                        return [3 /*break*/, 3];
	                    case 2:
	                        e_1 = _a.sent();
	                        // TODO implement alert
	                        console.error(e_1);
	                        return [3 /*break*/, 3];
	                    case 3: return [2 /*return*/];
	                }
	            });
	        });
	    };
	    // used in view
	    Artists.prototype.ChangePage = function (pageNo) {
	        return __awaiter(this, void 0, void 0, function () {
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        this.ActivePageNumber(pageNo);
	                        return [4 /*yield*/, this.Search()];
	                    case 1:
	                        _a.sent();
	                        return [2 /*return*/];
	                }
	            });
	        });
	    };
	    // used in view
	    Artists.prototype.GoToPrevious = function () {
	        return __awaiter(this, void 0, void 0, function () {
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        if (!(this.ActivePageNumber() !== 1)) return [3 /*break*/, 2];
	                        return [4 /*yield*/, this.ChangePage(this.ActivePageNumber() - 1)];
	                    case 1:
	                        _a.sent();
	                        _a.label = 2;
	                    case 2: return [2 /*return*/];
	                }
	            });
	        });
	    };
	    // used in view
	    Artists.prototype.GoToNext = function () {
	        return __awaiter(this, void 0, void 0, function () {
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        if (!(this.ActivePageNumber() !== this.PageNumbers().length)) return [3 /*break*/, 2];
	                        return [4 /*yield*/, this.ChangePage(this.ActivePageNumber() + 1)];
	                    case 1:
	                        _a.sent();
	                        _a.label = 2;
	                    case 2: return [2 /*return*/];
	                }
	            });
	        });
	    };
	    Artists.prototype.AddArtist = function () {
	        var ArtistObj = new Artist({
	            ChildContestants: [],
	            City: undefined,
	            CityText: "",
	            Email: "",
	            EntryId: undefined,
	            IsDuplicate: false,
	            Name: "",
	            PhoneNumber: "",
	            Website: "",
	            _id: undefined
	        }, this, this.Vm, true);
	        // this.Artists().push(ArtistObj);
	        ArtistObj.Edit();
	    };
	    return Artists;
	}());

	var ArtistProduct = /** @class */ (function () {
	    function ArtistProduct(Vm, Buy, Parent, dto, index) {
	        var _this = this;
	        this.Options = ko.observableArray();
	        this.ProductId = ko.observable('');
	        this.ProductName = ko.observable('');
	        this.Confirmation = ko.observable('');
	        this.ReadOnly = ko.observable(true);
	        this._id = ko.observable('');
	        if (dto.ProductId.length === 0) {
	            this.ReadOnly(false);
	        }
	        this.ProductId(dto.ProductId);
	        this.ProductName(dto.Name);
	        this.Confirmation(dto.Confirmation);
	        this.Parent = Parent;
	        this._id(dto._id);
	        // @ts-ignore
	        this.ProductId.subscribeChanged(function (newValue, oldValue) {
	            _this.ReadOnly(true);
	            if (_this.Parent.ArtistName().length > 0 && _this.ProductId().length > 0 && _this.Parent._id()) {
	                _this.SaveProduct();
	            }
	        });
	        // @ts-ignore
	        this.Confirmation.subscribeChanged(function (newValue, oldValue) {
	            _this.ReadOnly(true);
	            _this.SaveProduct();
	        });
	        // @ts-ignore
	        this.Parent.ArtistId.subscribeChanged(function (newValue, oldValue) {
	            _this.ReadOnly(true);
	            _this.SaveProduct();
	        });
	        this.index = index;
	        this.Buy = Buy;
	    }
	    ArtistProduct.prototype.SetSelected = function (dto) {
	        if (dto && dto.contestant) {
	            this.Parent.ArtistName(dto.contestant.Name);
	            this.Parent._id(dto.contestant._id);
	            this.ReadOnly(true);
	            this.Parent.ArtistId(dto.contestant.EntryId);
	        }
	    };
	    ArtistProduct.prototype.Edit = function () {
	        this.ReadOnly(false);
	    };
	    ArtistProduct.prototype.SaveProduct = function () {
	        var _this = this;
	        // TODO logic to group by artists
	        if (!(this.Parent.ArtistName().length > 0 && this.ProductId().length > 0 && this.Parent._id())) {
	            return;
	        }
	        Request(mp + "/api/artist/save-product", 'POST', {
	            ProductId: this.ProductId(),
	            Confirmation: this.Confirmation(),
	            ContestantId: this.Parent._id()
	        }).then(function (r) {
	            _this.Parent._id(r.Data.Product.Contestant);
	            _this._id(r.Data.Product._id);
	            _this.ProductName(r.Data.Product.Name || 'Product not found');
	        }).catch(function (e) {
	            console.error(e);
	        });
	    };
	    ArtistProduct.prototype.UpdateArtistInfo = function () { };
	    ArtistProduct.prototype.artistAutoCompleteCallback = function (request, response) {
	        var _this = this;
	        Request(mp + "/api/artist/auto-suggest/?q=" + request.term, 'GET').then(function (r) {
	            _this.Options([]);
	            for (var i = 0; i < r.Data.Contestants.length; i++) {
	                var entryId = r.Data.Contestants[i].EntryId ? " (" + r.Data.Contestants[i].EntryId + ")" : '';
	                _this.Options.push({
	                    label: "" + r.Data.Contestants[i].Name + entryId,
	                    value: r.Data.Contestants[i]._id,
	                    contestant: r.Data.Contestants[i]
	                });
	            }
	            response(_this.Options());
	        }).catch(function (e) {
	            console.error('auto suggest api call', e);
	            response(_this.Options());
	        });
	    };
	    ArtistProduct.prototype.Refresh = function () {
	        if (!this._id()) {
	            alert('Product is not saved in db yet');
	            return;
	        }
	        // @ts-ignore
	        Request(mp + "/api/artist/product/" + this._id(), 'PATCH', {}).then(function () {
	            alert('Cache Refreshed');
	        }).catch(function (e) {
	            console.error(e);
	            alert('Error occurred while refreshing cache');
	        });
	    };
	    ArtistProduct.prototype.Remove = function () {
	        var _this = this;
	        if (!this._id()) {
	            this.Buy.RemoveProduct(this.index);
	            return;
	        }
	        // @ts-ignore
	        Request(mp + "/api/artist/product/" + this._id(), 'DELETE', {}).then(function () {
	            _this.Buy.RemoveProduct(_this.index);
	            alert('Product removed');
	        }).catch(function (e) {
	            console.error(e);
	            alert('Error occurred while deleting product');
	        });
	    };
	    return ArtistProduct;
	}());

	var Contestant$1 = /** @class */ (function () {
	    function Contestant(Vm, Parent, dto) {
	        var _this = this;
	        this.ArtistId = ko.observable();
	        this.ArtistName = ko.observable('');
	        this._id = ko.observable();
	        this.ArtistId(dto.EntryId);
	        this.ArtistName(dto.Name);
	        dto.WooProducts.forEach(function (el) {
	            Parent.Products().push(new ArtistProduct(Vm, Parent, _this, el, Parent.Products().length));
	        });
	        Parent.Products.notifySubscribers();
	        this.Parent = Parent;
	        this._id(dto._id);
	    }
	    return Contestant;
	}());

	var Buy = /** @class */ (function () {
	    function Buy(vm) {
	        var _this = this;
	        this.Contestants = ko.observableArray([]);
	        this.Visible = ko.observable(false);
	        this.ActivePageNumber = ko.observable(0);
	        this.PageNumbers = ko.observableArray();
	        // used in view
	        this.PrevPageCss = ko.computed(function () {
	            if (_this.ActivePageNumber() === _this.PageNumbers().length) {
	                return 'disabled';
	            }
	            else if (_this.ActivePageNumber() === 1) {
	                return 'disabled';
	            }
	            return '';
	        });
	        // used in view
	        this.NextPageCss = ko.computed(function () {
	            if (_this.ActivePageNumber() === _this.PageNumbers().length) {
	                return 'disabled';
	            }
	            return '';
	        });
	        this.Limit = 20;
	        this.Products = ko.observableArray([]);
	        this.Vm = vm;
	    }
	    Buy.prototype.ResetData = function () {
	        this.Contestants([]);
	        this.Products([]);
	        this.ActivePageNumber(0);
	    };
	    Buy.prototype.LoadPaginatedData = function () {
	        return __awaiter(this, void 0, void 0, function () {
	            var result, i, product, e_1;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        if (!this.Visible()) {
	                            return [2 /*return*/];
	                        }
	                        this.ActivePageNumber(this.ActivePageNumber() + 1);
	                        _a.label = 1;
	                    case 1:
	                        _a.trys.push([1, 3, , 4]);
	                        return [4 /*yield*/, this.Vm.LoadingTracker.AddOperation(Request(mp + '/api/woo-commerce-artist-list', 'POST', {
	                                sortCol: '_id',
	                                sortOrder: -1,
	                                page: this.ActivePageNumber(),
	                                limit: this.Limit
	                            }))];
	                    case 2:
	                        result = _a.sent();
	                        if (Array.isArray(result.Data.Products)) {
	                            for (i = 0; i < result.Data.Products.length; i++) {
	                                product = result.Data.Products[i];
	                                product.Contestant.WooProducts = [product];
	                                // TODO logic to group by artists
	                                this.Contestants.push(new Contestant$1(this.Vm, this, product.Contestant));
	                            }
	                            if (result.Data.Products.length === 0) {
	                                this.ActivePageNumber(this.ActivePageNumber() - 1);
	                            }
	                        }
	                        else {
	                            this.ActivePageNumber(this.ActivePageNumber() - 1);
	                        }
	                        this.Vm.Loading(false);
	                        return [3 /*break*/, 4];
	                    case 3:
	                        e_1 = _a.sent();
	                        console.error(e_1);
	                        this.Vm.Loading(false);
	                        return [3 /*break*/, 4];
	                    case 4: return [2 /*return*/];
	                }
	            });
	        });
	    };
	    Buy.prototype.AddProduct = function () {
	        var productId = this.Products().length - 1;
	        var contestantId = this.Contestants().length - 1;
	        this.Contestants().push(new Contestant$1(this.Vm, this, {
	            _id: contestantId,
	            Name: '',
	            WooProducts: [{
	                    _id: '',
	                    ArtistId: '',
	                    ProductId: '',
	                    Confirmation: '',
	                }],
	            CityText: '',
	            Email: '',
	            Website: '',
	            EntryId: 0,
	            PhoneNumber: '',
	            City: {
	                _id: '',
	                Name: '',
	                createdAt: new Date(),
	                updatedAt: new Date(),
	                Country: '',
	                RegionCode: '',
	                Region: '',
	                CountryCode: ''
	            },
	            ChildContestants: [],
	            IsDuplicate: false
	        }));
	    };
	    Buy.prototype.RemoveProduct = function (productIndex) {
	        this.Products.splice(productIndex, 1);
	        for (var i = 0; i < this.Products().length; i++) {
	            this.Products()[i].index = i;
	        }
	        this.Products.notifySubscribers();
	    };
	    return Buy;
	}());

	var Stats = /** @class */ (function () {
	    function Stats(dto) {
	        this.LoadingTracker = new BusyTracker();
	        this.Name = ko.observable();
	        this.Registered = ko.observable();
	        this.Door = ko.observable();
	        this.Online = ko.observable();
	        this.EventId = ko.observable();
	        this.EventId(dto.EventId);
	        this.Name(dto.Name);
	        this.Registered(dto.Registered);
	        this.Door(dto.Door);
	        this.Online(dto.Online);
	        this.EventId(dto.EventId);
	    }
	    return Stats;
	}());

	var month = [
	    'Jan',
	    'Feb',
	    'Mar',
	    'Apr',
	    'May',
	    'June',
	    'Jul',
	    'Aug',
	    'Sep',
	    'Oct',
	    'Nov',
	    'Dec'
	];
	var PaymentStatus = /** @class */ (function () {
	    function PaymentStatus(paymentStatus, PaymentStatusOptions) {
	        this.LotId = ko$1.observable('');
	        this.ArtistName = ko$1.observable('');
	        this.ArtistId = ko$1.observable('');
	        this.Bids = ko$1.observableArray();
	        this.EventName = ko$1.observable('');
	        this.ArtId = ko$1.observable('');
	        this.CurrencySymbol = ko$1.observable('');
	        this.ArtistPayRecentStatus = ko$1.observable();
	        this.BuyerPayRecentStatus = ko$1.observable();
	        this.Image = ko$1.observable();
	        this.BuyerPayRecentDate = ko$1.observable();
	        this.ArtistPayRecentDate = ko$1.observable();
	        this.FormattedBuyerPayRecentDate = ko$1.observable();
	        this.FormattedArtistPayRecentDate = ko$1.observable();
	        this.BuyerPayRecentUser = ko$1.observable();
	        this.ArtistPayRecentUser = ko$1.observable();
	        this.selectedBuyerPayRecentStatus = ko$1.observable();
	        this.selectedArtistPayRecentStatus = ko$1.observable();
	        this.PaymentStatusOptions = ko$1.observableArray([]);
	        this.LoadingTracker = new BusyTracker();
	        this.LotId(paymentStatus.LotId);
	        this.ArtistName(paymentStatus.ArtistName);
	        this.ArtistId(paymentStatus.ArtistId);
	        var bids = paymentStatus.Bids.sort(function (a, b) {
	            return a.Amount - b.Amount;
	        }).slice(0, 3);
	        this.Bids(bids);
	        this.EventName(paymentStatus.EventName);
	        this.ArtId(paymentStatus.ArtId);
	        this.ArtistPayRecentStatus(paymentStatus.ArtistPayRecentStatus);
	        this.BuyerPayRecentStatus(paymentStatus.BuyerPayRecentStatus);
	        this.Image(paymentStatus.Image);
	        this.PaymentStatusOptions(PaymentStatusOptions);
	        this.BuyerPayRecentDate(paymentStatus.BuyerPayRecentDate);
	        this.ArtistPayRecentDate(paymentStatus.ArtistPayRecentDate);
	        if (this.BuyerPayRecentDate()) {
	            this.FormattedBuyerPayRecentDate(this._formatDate(this.BuyerPayRecentDate().toString()));
	        }
	        if (this.ArtistPayRecentDate()) {
	            this.FormattedArtistPayRecentDate(this._formatDate(this.ArtistPayRecentDate().toString()));
	        }
	        this.BuyerPayRecentUser(paymentStatus.BuyerPayRecentUser);
	        this.ArtistPayRecentUser(paymentStatus.ArtistPayRecentUser);
	        this.selectedArtistPayRecentStatus(paymentStatus.ArtistPayRecentStatus && paymentStatus.ArtistPayRecentStatus._id);
	        this.selectedBuyerPayRecentStatus(paymentStatus.BuyerPayRecentStatus && paymentStatus.BuyerPayRecentStatus._id);
	        this.CurrencySymbol(paymentStatus.CurrencySymbol);
	    }
	    // used in view
	    PaymentStatus.prototype.markArtistPaid = function (VM) {
	        return __awaiter(this, void 0, void 0, function () {
	            var result, e_1;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        VM.Loading(true);
	                        _a.label = 1;
	                    case 1:
	                        _a.trys.push([1, 3, , 4]);
	                        return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(
	                            // @ts-ignore
	                            mp + '/api/auction/mark-artist-paid', 'POST', {
	                                LotId: this.LotId(),
	                                ArtistPayRecentStatus: this.selectedArtistPayRecentStatus(),
	                                ArtistId: this.ArtistId()
	                            }))];
	                    case 2:
	                        result = _a.sent();
	                        this.ArtistPayRecentDate(result.Data.ArtistPayRecentDate);
	                        this.ArtistPayRecentUser(result.Data.ArtistPayRecentUser);
	                        return [3 /*break*/, 4];
	                    case 3:
	                        e_1 = _a.sent();
	                        console.error(e_1);
	                        return [3 /*break*/, 4];
	                    case 4:
	                        VM.Loading(false);
	                        return [2 /*return*/];
	                }
	            });
	        });
	    };
	    // used in view
	    PaymentStatus.prototype.markBuyerPaid = function (VM) {
	        return __awaiter(this, void 0, void 0, function () {
	            var result, e_2;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        VM.Loading(true);
	                        _a.label = 1;
	                    case 1:
	                        _a.trys.push([1, 3, , 4]);
	                        return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(
	                            // @ts-ignore
	                            mp + '/api/auction/mark-buyer-paid', 'POST', {
	                                LotId: this.LotId(),
	                                BuyerPayRecentStatus: this.selectedBuyerPayRecentStatus()
	                            }))];
	                    case 2:
	                        result = _a.sent();
	                        this.BuyerPayRecentDate(result.Data.BuyerPayRecentDate);
	                        this.BuyerPayRecentUser(result.Data.BuyerPayRecentUser);
	                        return [3 /*break*/, 4];
	                    case 3:
	                        e_2 = _a.sent();
	                        console.error(e_2);
	                        return [3 /*break*/, 4];
	                    case 4:
	                        VM.Loading(false);
	                        return [2 /*return*/];
	                }
	            });
	        });
	    };
	    PaymentStatus.prototype._formatDate = function (dateStr) {
	        var dateObj = new Date(dateStr);
	        var hours = this._pad(dateObj.getHours());
	        var minutes = this._pad(dateObj.getMinutes());
	        var date = this._pad(dateObj.getDate());
	        var year = dateObj.getFullYear();
	        var shortMonth = month[dateObj.getMonth()];
	        // 13:23 Nov 19 2019
	        return hours + ":" + minutes + " " + shortMonth + " " + date + " " + year;
	    };
	    PaymentStatus.prototype._pad = function (n) {
	        return n < 10 ? '0' + n : n;
	    };
	    return PaymentStatus;
	}());

	var AuctionList = /** @class */ (function () {
	    function AuctionList(VM) {
	        var _this = this;
	        this.Message = ko$1.observable('');
	        this.events = ko$1.observableArray([]);
	        this.SelectedAuctionEvents = ko$1.observableArray([]);
	        this.LoadingTracker = new BusyTracker();
	        this.PaymentStatuses = ko$1.observableArray();
	        this.PaymentStatusOptions = ko$1.observableArray([]);
	        // used in view
	        this.selectedAuctionEventText = ko$1.computed(function () {
	            return ko$1.utils.arrayMap(_this.SelectedAuctionEvents(), function (val) {
	                return {
	                    title: val.title,
	                    id: val.eventId
	                };
	            });
	        });
	        this.SelectedAuctionEventIds = ko$1.computed(function () {
	            return ko$1.utils.arrayMap(_this.SelectedAuctionEvents(), function (val) {
	                return val.eventId;
	            });
	        });
	        this.VM = VM;
	    }
	    AuctionList.prototype.LoadPaymentStatusOptions = function () {
	        return __awaiter(this, void 0, void 0, function () {
	            var result, e_1;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        _a.trys.push([0, 2, , 3]);
	                        return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(mp + '/api/auction/list/payment-status-options', 'GET'))];
	                    case 1:
	                        result = _a.sent();
	                        this.PaymentStatusOptions(result.Data);
	                        return [3 /*break*/, 3];
	                    case 2:
	                        e_1 = _a.sent();
	                        console.error(e_1);
	                        return [3 /*break*/, 3];
	                    case 3: return [2 /*return*/];
	                }
	            });
	        });
	    };
	    AuctionList.prototype.LoadEventDropdown = function (events) {
	        this.events(events);
	        // @ts-ignore
	        jQuery(document).ready(function () {
	            // @ts-ignore
	            jQuery('.search-box-auction-event').SumoSelect({
	                csvDispCount: 3,
	                selectAll: true,
	                search: true,
	                searchText: 'Enter here.',
	                okCancelInMulti: true
	            });
	        });
	        this.SelectedAuctionEventIds.subscribe(this.fetchLots.bind(this));
	    };
	    AuctionList.prototype.fetchLots = function () {
	        return __awaiter(this, void 0, void 0, function () {
	            var result, paymentStatuses, e_2;
	            var _this = this;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        if (this.SelectedAuctionEventIds().length === 0) {
	                            return [2 /*return*/];
	                        }
	                        this.VM.Loading(true);
	                        _a.label = 1;
	                    case 1:
	                        _a.trys.push([1, 3, , 4]);
	                        return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(mp + '/api/auction/payment-status', 'POST', {
	                                eventIds: this.SelectedAuctionEventIds()
	                            }))];
	                    case 2:
	                        result = _a.sent();
	                        if (Array.isArray(result.Data)) {
	                            paymentStatuses = result.Data.map(function (e) {
	                                return new PaymentStatus(e, _this.PaymentStatusOptions());
	                            });
	                            this.PaymentStatuses(paymentStatuses);
	                        }
	                        else {
	                            this.PaymentStatuses([]);
	                        }
	                        return [3 /*break*/, 4];
	                    case 3:
	                        e_2 = _a.sent();
	                        // TODO
	                        console.error(e_2);
	                        return [3 /*break*/, 4];
	                    case 4:
	                        this.VM.Loading(false);
	                        return [2 /*return*/];
	                }
	            });
	        });
	    };
	    return AuctionList;
	}());

	var HomeScreenViewModel = /** @class */ (function () {
	    function HomeScreenViewModel() {
	        var _this = this;
	        this.ActiveEvents = ko$1.observableArray();
	        this.ArchivedEvents = ko$1.observableArray();
	        this.Stats = ko$1.observableArray([]);
	        this.Promotion = ko$1.observable();
	        this.Auction = ko$1.observable();
	        this.Artists = ko$1.observable();
	        this.PromotionLogs = ko$1.observable();
	        this.Buy = ko$1.observable();
	        this.Editor = ko$1.observable();
	        this.OpenPopup = ko$1.observable();
	        this.SelectedArtist = ko$1.observable();
	        this.Cities = ko$1.observableArray();
	        this.LoadingTracker = new BusyTracker();
	        this.selectedEvent = ko$1.observable();
	        this.multipleSelectedOptionValues = ko$1.observableArray([]);
	        // used in view
	        this.selectedText = ko$1.computed(function () {
	            return ko$1.utils.arrayMap(_this.multipleSelectedOptionValues(), function (val) {
	                return {
	                    title: val.title,
	                    id: val.id
	                };
	            });
	        });
	        this.guestCount = ko$1.observable();
	        this.Loading = ko$1.observable();
	        var promotion = new Promotion(this);
	        var auctionObj = new AuctionList(this);
	        var buyObj = new Buy(this);
	        this.Promotion(promotion);
	        this.Auction(auctionObj);
	        this.PromotionLogs(promotion);
	        this.Loading(true);
	        this.Artists(new Artists(this));
	        this.Buy(buyObj);
	        // @ts-ignore
	        this.Cities(citiesDict);
	        this.LoadActiveEvents().then(function () {
	            return Promise.all([
	                // this.LoadArchivedEvents(),
	                // this.LoadStats(),
	                promotion.LoadEventDropdown(''),
	                promotion.LoadEventPhoneNumber(),
	                promotion.LoadPromotionLogs(),
	                promotion.LoadPromotionMessageLogs(),
	                promotion.LoadPromotionTopVotesLogs(),
	                auctionObj.LoadPaymentStatusOptions()
	            ]);
	        }).then(function () {
	            _this.Auction().LoadEventDropdown(promotion.events());
	            _this.Loading(false);
	        }).catch(function (e) {
	            _this.Loading(false);
	            console.error(e);
	        });
	        this.multipleSelectedOptionValues.subscribe(function () { return __awaiter(_this, void 0, void 0, function () {
	            var res;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0: return [4 /*yield*/, this.Promotion().getGuestCount(this.multipleSelectedOptionValues())];
	                    case 1:
	                        res = _a.sent();
	                        this.guestCount(res);
	                        return [2 /*return*/];
	                }
	            });
	        }); });
	    }
	    HomeScreenViewModel.prototype.AddNew = function () {
	        var _this = this;
	        this.Editor(new EventEditor({
	            LiveStream: '',
	            VideoStream: '',
	            _id: new ObjectId().toHexString(),
	            Name: '',
	            Enabled: true,
	            Contestants: [],
	            PhoneNumber: '',
	            Rounds: [],
	            CurrentRound: null,
	            RegistrationConfirmationMessage: '',
	            ReportLinks: [],
	            Logs: [],
	            RegistrationsVoteFactor: [],
	            VoteByLink: false,
	            Description: '',
	            SendLinkToGuests: false,
	            EmailRegistration: false,
	            Country: null,
	            EventStartDateTime: '',
	            EventEndDateTime: '',
	            TimeZone: null,
	            TicketLink: '',
	            Venue: '',
	            Price: '',
	            EID: '',
	            ShowInApp: true,
	            Currency: null,
	            ArtWidthHeight: '',
	            AuctionDescription: '',
	            AuctionStartBid: 50,
	            MinBidIncrement: 10,
	            AuctionNotice: '',
	            AdminControlInAuctionPage: true,
	            RegisterAtSMSVote: false,
	            SendAuctionLinkToGuests: false,
	            EnableAuction: true,
	            Tax: 0,
	            SponsorText: '',
	            AuctionCloseRoundDelay: 0,
	            AuctionCloseStartsAt: new Date()
	        }, function (result) {
	            if (result) {
	                _this.LoadActiveEvents().then(function () {
	                    return _this.LoadArchivedEvents();
	                }).catch(function (e) {
	                    console.error(e);
	                });
	            }
	            _this.Editor(null);
	        }));
	        this.Editor().IsNew(true);
	    };
	    HomeScreenViewModel.prototype.Edit = function (eventId) {
	        return __awaiter(this, void 0, void 0, function () {
	            var event;
	            var _this = this;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0: return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(mp + ("/api/event/" + eventId), 'GET'))];
	                    case 1:
	                        event = _a.sent();
	                        this.Editor(new EventEditor(event, function (result) {
	                            if (result) {
	                                _this.LoadActiveEvents().then(function () {
	                                    /*return Promise.all([
	                                        this.LoadArchivedEvents(),
	                                        this.LoadStats()
	                                    ]);*/
	                                    console.log('active events refreshed');
	                                })
	                                    .catch(function (e) {
	                                    console.error(e);
	                                });
	                            }
	                            _this.Editor(null);
	                        }));
	                        return [2 /*return*/];
	                }
	            });
	        });
	    };
	    HomeScreenViewModel.prototype.Delete = function (event) {
	        return __awaiter(this, void 0, void 0, function () {
	            var result;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0: return [4 /*yield*/, Request(mp + ("/api/event/" + event._id), 'DELETE')];
	                    case 1:
	                        result = _a.sent();
	                        if (result.Success) {
	                            this.ActiveEvents.remove(event);
	                            this.ArchivedEvents.remove(event);
	                        }
	                        return [2 /*return*/];
	                }
	            });
	        });
	    };
	    HomeScreenViewModel.prototype.LoadActiveEvents = function () {
	        return __awaiter(this, void 0, Promise, function () {
	            var dtos, e_1;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        this.Loading(true);
	                        _a.label = 1;
	                    case 1:
	                        _a.trys.push([1, 3, , 4]);
	                        return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(mp + '/api/events?enabled=1', 'GET'))];
	                    case 2:
	                        dtos = _a.sent();
	                        if (Array.isArray(dtos)) {
	                            this.ActiveEvents(dtos.map(function (e) { return new EventSummary(e); }));
	                        }
	                        else {
	                            this.ActiveEvents([]);
	                        }
	                        return [3 /*break*/, 4];
	                    case 3:
	                        e_1 = _a.sent();
	                        console.error(e_1);
	                        return [3 /*break*/, 4];
	                    case 4:
	                        this.Loading(false);
	                        return [2 /*return*/];
	                }
	            });
	        });
	    };
	    HomeScreenViewModel.prototype.LoadArchivedEvents = function () {
	        return __awaiter(this, void 0, Promise, function () {
	            var dtos, e_2;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        this.Loading(true);
	                        _a.label = 1;
	                    case 1:
	                        _a.trys.push([1, 3, , 4]);
	                        return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(mp + '/api/events?enabled=0', 'GET'))];
	                    case 2:
	                        dtos = _a.sent();
	                        if (Array.isArray(dtos)) {
	                            this.ArchivedEvents(dtos.map(function (e) { return new EventSummary(e); }));
	                        }
	                        else {
	                            this.ArchivedEvents([]);
	                        }
	                        this.Loading(false);
	                        return [3 /*break*/, 4];
	                    case 3:
	                        e_2 = _a.sent();
	                        console.error(e_2);
	                        this.Loading(false);
	                        return [3 /*break*/, 4];
	                    case 4: return [2 /*return*/];
	                }
	            });
	        });
	    };
	    HomeScreenViewModel.prototype.LoadStats = function () {
	        return __awaiter(this, void 0, Promise, function () {
	            var stats, e_3;
	            return __generator(this, function (_a) {
	                switch (_a.label) {
	                    case 0:
	                        this.Loading(true);
	                        _a.label = 1;
	                    case 1:
	                        _a.trys.push([1, 3, , 4]);
	                        return [4 /*yield*/, this.LoadingTracker.AddOperation(Request(mp + '/api/events-stats', 'GET'))];
	                    case 2:
	                        stats = _a.sent();
	                        if (Array.isArray(stats.Data))
	                            this.Stats(stats.Data.map(function (e) { return new Stats(e); }));
	                        this.Loading(false);
	                        return [3 /*break*/, 4];
	                    case 3:
	                        e_3 = _a.sent();
	                        console.error(e_3);
	                        this.Loading(false);
	                        return [3 /*break*/, 4];
	                    case 4: return [2 /*return*/];
	                }
	            });
	        });
	    };
	    HomeScreenViewModel.prototype.LoadBuyData = function () {
	        return __awaiter(this, void 0, Promise, function () {
	            return __generator(this, function (_a) {
	                this.Buy().ResetData();
	                this.Buy().Visible(true);
	                return [2 /*return*/, this.Buy().LoadPaginatedData()];
	            });
	        });
	    };
	    return HomeScreenViewModel;
	}());

	/// <reference path='../Common/ArrayExtensions.ts'/>
	var vm = new HomeScreenViewModel();
	var koRoot = document.getElementById('koroot');
	var ENTER_KEY = 13;
	// a custom binding to handle the enter key (could go in a separate library)
	ko$1.bindingHandlers.enterKey = {
	    init: function (element, valueAccessor, allBindingsAccessor, data, context) {
	        // wrap the handler with a check for the enter key
	        var wrappedHandler = function (data, event) {
	            if (event.keyCode === ENTER_KEY) {
	                valueAccessor() && valueAccessor().call(this, data, event);
	            }
	        };
	        // create a valueAccessor with the options that we would want to pass to the event binding
	        var newValueAccessor = function () {
	            return {
	                keyup: wrappedHandler
	            };
	        };
	        // call the real event binding's init function
	        ko$1.bindingHandlers.event.init(element, newValueAccessor, allBindingsAccessor, data, context);
	    }
	};
	ko$1.bindingHandlers.modal = {
	    init: function (element, valueAccessor) {
	        // @ts-ignore
	        $(element).modal({
	            show: false
	        });
	        var value = valueAccessor();
	        if (ko$1.isObservable(value)) {
	            $(element).on('hidden.bs.modal', function () {
	                value(false);
	            });
	        }
	    },
	    update: function (element, valueAccessor) {
	        var value = valueAccessor();
	        if (ko$1.utils.unwrapObservable(value)) {
	            // @ts-ignore
	            $(element).modal('show');
	        }
	        else {
	            // @ts-ignore
	            $(element).modal('hide');
	            $('.modal-backdrop').remove();
	        }
	    }
	};
	/*
	ko.bindingHandlers.combobox = new ComboBoxBinding();
	if (ko.expressionRewriting._twoWayBindings) {
	    ko.expressionRewriting._twoWayBindings.comboboxValue = true;
	}

	ko.bindingHandlers.__cb__flexibleTemplate = {
	    init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
	        const options = ko.utils.unwrapObservable(valueAccessor());
	        renderTemplate(element, options.template, options.data, bindingContext);

	        return { controlsDescendantBindings: true };
	    }
	};

	ko.bindingHandlers.__cb__clickedIn = {
	    init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
	        const target = valueAccessor();
	        console.log('target', target);
	        let clickedIn = false;
	        // @ts-ignore //TODO once it works find out what's wrong
	        ko.utils.registerEventHandler(document, 'click', function (e: MouseEvent) {
	            if (!clickedIn) {
	                target(e.target == element);
	            }

	            clickedIn = false;
	        });

	        ko.utils.registerEventHandler(element.parentNode || element.parentElement, 'click', function (e) {
	            clickedIn = true;
	        });
	    }
	};*/
	ko$1.bindingHandlers.ko_autocomplete = {
	    init: function (element, params) {
	        // @ts-ignore
	        $(element).autocomplete(params());
	    },
	    update: function (element, params) {
	        // @ts-ignore
	        $(element).autocomplete('option', 'source', params().source);
	    }
	};
	ko$1.bindingHandlers.autoComplete = {
	    // Only using init event because the Jquery.UI.AutoComplete widget will take care of the update callbacks
	    init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
	        var settings = valueAccessor();
	        var selectedOption = settings.selected;
	        var options = settings.options;
	        var updateElementValueWithLabel = function (event, ui) {
	            // Stop the default behavior
	            event.preventDefault();
	            // Update the value of the html element with the label
	            // of the activated option in the list (ui.item)
	            if (ui.item) {
	                $(element).val(ui.item.label);
	            }
	            // Update our SelectedOption observable
	            if (typeof ui.item !== 'undefined') {
	                // ui.item - label|value|...
	                selectedOption(ui.item);
	            }
	        };
	        // @ts-ignore
	        $(element).autocomplete({
	            source: options,
	            select: function (event, ui) {
	                updateElementValueWithLabel(event, ui);
	            },
	            /*focus: function (event: MouseEvent, ui: { item: { label: string | number | string[]; }; }) {
	                updateElementValueWithLabel(event, ui);
	            },*/
	            change: function (event, ui) {
	                updateElementValueWithLabel(event, ui);
	            }
	        });
	    }
	};
	/**
	 * BINDINGS
	 */
	// @ts-ignore
	ko$1.subscribable.fn.subscribeChanged = function (callback) {
	    var savedValue = this.peek();
	    return this.subscribe(function (latestValue) {
	        var oldValue = savedValue;
	        savedValue = latestValue;
	        callback(latestValue, oldValue);
	    });
	};
	ko$1.bindingHandlers['infiniteScroll'] = infiniteScrollBindingHandler;
	ko$1.applyBindings(vm, koRoot);

}(ko, jQuery));
