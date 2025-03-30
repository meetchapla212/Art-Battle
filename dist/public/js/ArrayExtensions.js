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

//# sourceMappingURL=ArrayExtensions.js.map
