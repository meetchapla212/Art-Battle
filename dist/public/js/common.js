if (!Array.prototype.contains) {
    Array.prototype.contains = function (item) {
        return this.indexOf(item) >= 0;
    };
}
if (!Array.prototype.clear) {
    Array.prototype.clear = function () {
        this.length = 0;
    };
}
if (!Array.prototype.addRange) {
    Array.prototype.addRange = function (items) {
        this.push.apply(this, items);
    };
}
if (!Array.prototype.clone) {
    Array.prototype.clone = function () {
        if (this.length === 1) {
            return [this[0]];
        }
        else {
            return Array.apply(null, this);
        }
    };
}
if (!Array.prototype.find) {
    Array.prototype.find = function (predicate) {
        'use strict';
        if (this == null) {
            throw new TypeError('Array.prototype.find called on null or undefined');
        }
        if (typeof predicate !== 'function') {
            throw new TypeError('predicate must be a function');
        }
        const list = Object(this);
        const length = list.length >>> 0;
        const thisArg = arguments[1];
        let value = null;
        for (let i = 0; i < length; i++) {
            value = list[i];
            if (predicate.call(thisArg, value, i, list)) {
                return value;
            }
        }
        return undefined;
    };
}
if (!String.prototype.contains) {
    String.prototype.contains = function (str) {
        return this.indexOf(str) > -1;
    };
}
if (!String.prototype.compareTo) {
    String.prototype.compareTo = function (s, ignoreCase) {
        return String.compareTo(this, s, ignoreCase);
    };
}
if (!String.compareTo) {
    String.compareTo = function (s1, s2, ignoreCase) {
        if (ignoreCase) {
            if (s1) {
                s1 = s1.toUpperCase();
            }
            if (s2) {
                s2 = s2.toUpperCase();
            }
        }
        s1 = s1 || '';
        s2 = s2 || '';
        if (s1 == s2) {
            return 0;
        }
        if (s1 < s2) {
            return -1;
        }
        return 1;
    };
}
if (!String.prototype.startsWith) {
    String.prototype.startsWith = function (str) {
        return this.indexOf(str) == 0;
    };
}
if (!String.isNullOrEmpty) {
    String.isNullOrEmpty = function (s) {
        return !s || !s.length;
    };
}
if (!String.concat) {
    String.concat = function () {
        if (arguments.length === 2) {
            return arguments[0] + arguments[1];
        }
        return Array.prototype.join.call(arguments, '');
    };
}
function __format(format, values, useLocale) {
    const _formatRE = /(\{[^\}^\{]+\})/g;
    return format.replace(_formatRE, function (str, m) {
        const index = parseInt(m.substr(1));
        const value = values[index + 1];
        if ((value === null) || (value === undefined)) {
            return '';
        }
        if (value.format) {
            let formatSpec = null;
            const formatIndex = m.indexOf(':');
            if (formatIndex > 0) {
                formatSpec = m.substring(formatIndex + 1, m.length - 1);
            }
            return value.format(formatSpec);
        }
        else {
            return value.toString();
        }
    });
}

//# sourceMappingURL=common.js.map
