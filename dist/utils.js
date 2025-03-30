"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsEmail = exports.SanitizePhoneNumber = exports.IsPhoneNumber = exports.testint = exports.initcap = exports.smsify = void 0;
exports.smsify = function (str) {
    if (str.length <= 160) {
        return str;
    }
    else {
        return str.substr(0, 157) + '...';
    }
};
exports.initcap = function (str) {
    return str.substring(0, 1).toUpperCase() + str.substring(1);
};
exports.testint = function (str) {
    const intRegex = /^\d+$/;
    if (intRegex.test(str)) {
        return true;
    }
    return false;
};
function IsPhoneNumber(str) {
    return /1\d{10}/.test(str) || /^([2-9])(\d{9})/.test(str);
}
exports.IsPhoneNumber = IsPhoneNumber;
function SanitizePhoneNumber(str) {
    if (str.startsWith('+')) {
        str = str.replace(/D/g, '');
    }
    if (/^1\d{10}/.test(str)) {
        return str;
    }
    else {
        return `1${str}`;
    }
}
exports.SanitizePhoneNumber = SanitizePhoneNumber;
function IsEmail(str) {
    return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(str);
}
exports.IsEmail = IsEmail;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInV0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFhLFFBQUEsTUFBTSxHQUFHLFVBQVMsR0FBVztJQUN4QyxJQUFJLEdBQUcsQ0FBQyxNQUFNLElBQUksR0FBRyxFQUFFO1FBQ3JCLE9BQU8sR0FBRyxDQUFDO0tBQ1o7U0FBTTtRQUNMLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDO0tBQ25DO0FBQ0gsQ0FBQyxDQUFDO0FBRVcsUUFBQSxPQUFPLEdBQUcsVUFBUyxHQUFXO0lBQ3pDLE9BQU8sR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5RCxDQUFDLENBQUM7QUFFVyxRQUFBLE9BQU8sR0FBRyxVQUFTLEdBQVc7SUFDekMsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDO0lBQ3pCLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRTtRQUN0QixPQUFPLElBQUksQ0FBQztLQUNiO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDLENBQUM7QUFFRixTQUFnQixhQUFhLENBQUMsR0FBVztJQUN2QyxPQUFPLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksaUJBQWlCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzVELENBQUM7QUFGRCxzQ0FFQztBQUVELFNBQWdCLG1CQUFtQixDQUFDLEdBQVc7SUFDM0MsSUFBSSxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQ3JCLEdBQUcsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztLQUMvQjtJQUNELElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRTtRQUN0QixPQUFPLEdBQUcsQ0FBQztLQUNkO1NBQU07UUFDSCxPQUFPLElBQUksR0FBRyxFQUFFLENBQUM7S0FDcEI7QUFDTCxDQUFDO0FBVEQsa0RBU0M7QUFFRCxTQUFnQixPQUFPLENBQUMsR0FBVztJQUMvQixPQUFPLHNJQUFzSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM1SixDQUFDO0FBRkQsMEJBRUMiLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgY29uc3Qgc21zaWZ5ID0gZnVuY3Rpb24oc3RyOiBzdHJpbmcpIHtcbiAgaWYgKHN0ci5sZW5ndGggPD0gMTYwKSB7XG4gICAgcmV0dXJuIHN0cjtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gc3RyLnN1YnN0cigwLCAxNTcpICsgJy4uLic7XG4gIH1cbn07XG5cbmV4cG9ydCBjb25zdCBpbml0Y2FwID0gZnVuY3Rpb24oc3RyOiBzdHJpbmcpIHtcbiAgcmV0dXJuIHN0ci5zdWJzdHJpbmcoMCwgMSkudG9VcHBlckNhc2UoKSArIHN0ci5zdWJzdHJpbmcoMSk7XG59O1xuXG5leHBvcnQgY29uc3QgdGVzdGludCA9IGZ1bmN0aW9uKHN0cjogc3RyaW5nKSB7XG4gIGNvbnN0IGludFJlZ2V4ID0gL15cXGQrJC87XG4gIGlmIChpbnRSZWdleC50ZXN0KHN0cikpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gSXNQaG9uZU51bWJlcihzdHI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gLzFcXGR7MTB9Ly50ZXN0KHN0cikgfHwgL14oWzItOV0pKFxcZHs5fSkvLnRlc3Qoc3RyKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFNhbml0aXplUGhvbmVOdW1iZXIoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGlmIChzdHIuc3RhcnRzV2l0aCgnKycpKSB7XG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9EL2csICcnKTtcbiAgICB9XG4gICAgaWYgKC9eMVxcZHsxMH0vLnRlc3Qoc3RyKSkge1xuICAgICAgICByZXR1cm4gc3RyO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBgMSR7c3RyfWA7XG4gICAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gSXNFbWFpbChzdHI6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiAvXlthLXpBLVowLTkuISMkJSYnKisvPT9eX2B7fH1+LV0rQFthLXpBLVowLTldKD86W2EtekEtWjAtOS1dezAsNjF9W2EtekEtWjAtOV0pPyg/OlxcLlthLXpBLVowLTldKD86W2EtekEtWjAtOS1dezAsNjF9W2EtekEtWjAtOV0pPykqJC8udGVzdChzdHIpO1xufVxuIl19
