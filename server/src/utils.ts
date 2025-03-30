export const smsify = function(str: string) {
  if (str.length <= 160) {
    return str;
  } else {
    return str.substr(0, 157) + '...';
  }
};

export const initcap = function(str: string) {
  return str.substring(0, 1).toUpperCase() + str.substring(1);
};

export const testint = function(str: string) {
  const intRegex = /^\d+$/;
  if (intRegex.test(str)) {
    return true;
  }
  return false;
};

export function IsPhoneNumber(str: string): boolean {
  return /1\d{10}/.test(str) || /^([2-9])(\d{9})/.test(str);
}

export function SanitizePhoneNumber(str: string): string {
    if (str.startsWith('+')) {
        str = str.replace(/D/g, '');
    }
    if (/^1\d{10}/.test(str)) {
        return str;
    } else {
        return `1${str}`;
    }
}

export function IsEmail(str: string): boolean {
    return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(str);
}
