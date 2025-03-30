interface String {
    startsWith(str: string): boolean;
    compareTo(s: string, ignoreCase: boolean): number;
    contains(str: string): boolean;
}

interface StringConstructor {
    isNullOrEmpty(s: string): boolean;
    concat(...strings: string[]): string;
    format(format: string, ...values: any[]): string;
    compareTo(str1: string, str2: string, ignoreCase: boolean): number;
    contains(str: string): boolean;
}

if (!String.prototype.contains) {
    String.prototype.contains = function (str: string) {
        return this.indexOf(str) > -1;
    };
}

if (!String.prototype.compareTo) {
    String.prototype.compareTo = function (s: string, ignoreCase: boolean) {
        return String.compareTo(this, s, ignoreCase);
    };
}

if (!String.compareTo) {
    String.compareTo = function (s1: string, s2: string, ignoreCase: boolean) {
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
    String.prototype.startsWith = function (str: string): boolean {
        return this.indexOf(str) == 0;
    };
}

if (!String.isNullOrEmpty) {
    String.isNullOrEmpty = function (s: string): boolean {
        return !s || !s.length;
    };
}

if (!String.concat) {
    String.concat = function (): string {
        if (arguments.length === 2) {
            return arguments[0] + arguments[1];
        }
        return Array.prototype.join.call(arguments, '');
    };
}

function __format(format: string, values: IArguments, useLocale: boolean): string {
    const  _formatRE: RegExp = /(\{[^\}^\{]+\})/g;

    return format.replace(_formatRE,
        function (str, m) {
            const  index = parseInt(m.substr(1));
            const  value = values[index + 1];
            if ((value === null) || (value === undefined)) {
                return '';
            }
            if (value.format) {
                let  formatSpec: string = null;
                const  formatIndex = m.indexOf(':');
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