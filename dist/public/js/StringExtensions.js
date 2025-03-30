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

//# sourceMappingURL=StringExtensions.js.map
