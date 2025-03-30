"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiCastIgnoreErr = exports.MultiCast = void 0;
const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(__dirname, `../data/fcm/${process.env.FCM_JSON}`));
const logger_1 = require("../config/logger");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://artbattle-de43f.firebaseio.com'
});
const Messaging = admin.messaging();
async function MultiCast(Obj) {
    const { DeviceTokens, link, title, message, priority, analyticsLabel } = Obj;
    console.log('android multicast called', DeviceTokens.length);
    let tempDevTokens = [];
    const res = [];
    let j = 0;
    for (let i = 0; i < DeviceTokens.length; i++) {
        if (j < 100) {
            tempDevTokens.push(DeviceTokens[i]);
        }
        if (j === 100 || DeviceTokens.length < 100) {
            // Batch of 100
            j = 0;
            logger_1.default.info('sending FCM Android push length' + tempDevTokens.length + JSON.stringify(tempDevTokens));
            const response = await Messaging.sendMulticast({
                tokens: tempDevTokens,
                data: {
                    url: `${link}`,
                    title: title
                },
                android: {
                    data: {
                        url: `${link}`,
                        title: title,
                        body: message
                    },
                    priority: priority,
                    notification: {
                        clickAction: '.MainActivity',
                        title: title,
                        body: message
                    }
                },
                notification: {
                    title: title,
                    body: message
                },
                fcmOptions: {
                    analyticsLabel: analyticsLabel
                }
            }, parseInt(process.env.ENABLE_PUSH) === 0);
            res.push(response);
            tempDevTokens = [];
        }
        j++;
    }
    return res;
}
exports.MultiCast = MultiCast;
async function MultiCastIgnoreErr(Obj) {
    try {
        return await MultiCast(Obj);
    }
    catch (e) {
        logger_1.default.error(e);
    }
}
exports.MultiCastIgnoreErr = MultiCastIgnoreErr;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QzlCO0lBQUMsT0FBTyxDQUFDLEVBQUU7UUFDUixnQkFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUNuQjtBQUNMLENBQUM7QUFiRCxnREFhQyIsImZpbGUiOiJjb21tb24vRkNNLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgYWRtaW4gZnJvbSAnZmlyZWJhc2UtYWRtaW4nO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmNvbnN0IHNlcnZpY2VBY2NvdW50ID0gcmVxdWlyZShwYXRoLmpvaW4oX19kaXJuYW1lLCBgLi4vZGF0YS9mY20vJHtwcm9jZXNzLmVudi5GQ01fSlNPTn1gKSk7XG5pbXBvcnQgbG9nZ2VyIGZyb20gJy4uL2NvbmZpZy9sb2dnZXInO1xuXG5hZG1pbi5pbml0aWFsaXplQXBwKHtcbiAgICBjcmVkZW50aWFsOiBhZG1pbi5jcmVkZW50aWFsLmNlcnQoc2VydmljZUFjY291bnQpLFxuICAgIGRhdGFiYXNlVVJMOiAnaHR0cHM6Ly9hcnRiYXR0bGUtZGU0M2YuZmlyZWJhc2Vpby5jb20nXG59KTtcblxuY29uc3QgTWVzc2FnaW5nID0gYWRtaW4ubWVzc2FnaW5nKCk7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBNdWx0aUNhc3QoT2JqOiB7XG4gICAgRGV2aWNlVG9rZW5zOiBzdHJpbmdbXTtcbiAgICBsaW5rOiBzdHJpbmc7XG4gICAgdGl0bGU6IHN0cmluZztcbiAgICBtZXNzYWdlOiBzdHJpbmc7XG4gICAgcHJpb3JpdHk6ICgnaGlnaCd8J25vcm1hbCcpO1xuICAgIGFuYWx5dGljc0xhYmVsOiBzdHJpbmc7XG59KSB7XG4gICAgY29uc3Qge0RldmljZVRva2VucywgbGluaywgdGl0bGUsIG1lc3NhZ2UsIHByaW9yaXR5LCBhbmFseXRpY3NMYWJlbH0gPSBPYmo7XG4gICAgY29uc29sZS5sb2coJ2FuZHJvaWQgbXVsdGljYXN0IGNhbGxlZCcsIERldmljZVRva2Vucy5sZW5ndGgpO1xuICAgIGxldCB0ZW1wRGV2VG9rZW5zID0gW107XG4gICAgY29uc3QgcmVzID0gW107XG4gICAgbGV0IGogPSAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgRGV2aWNlVG9rZW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChqIDwgMTAwKSB7XG4gICAgICAgICAgICB0ZW1wRGV2VG9rZW5zLnB1c2goRGV2aWNlVG9rZW5zW2ldKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaiA9PT0gMTAwIHx8IERldmljZVRva2Vucy5sZW5ndGggPCAxMDApIHtcbiAgICAgICAgICAgIC8vIEJhdGNoIG9mIDEwMFxuICAgICAgICAgICAgaiA9IDA7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbygnc2VuZGluZyBGQ00gQW5kcm9pZCBwdXNoIGxlbmd0aCcgKyB0ZW1wRGV2VG9rZW5zLmxlbmd0aCArIEpTT04uc3RyaW5naWZ5KHRlbXBEZXZUb2tlbnMpKTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgTWVzc2FnaW5nLnNlbmRNdWx0aWNhc3Qoe1xuICAgICAgICAgICAgICAgIHRva2VuczogdGVtcERldlRva2VucyxcbiAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIHVybDogYCR7bGlua31gLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogdGl0bGVcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGFuZHJvaWQ6IHtcbiAgICAgICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICAgICAgdXJsOiBgJHtsaW5rfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogdGl0bGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBib2R5OiBtZXNzYWdlXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHByaW9yaXR5OiBwcmlvcml0eSxcbiAgICAgICAgICAgICAgICAgICAgbm90aWZpY2F0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjbGlja0FjdGlvbiA6ICcuTWFpbkFjdGl2aXR5JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiB0aXRsZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJvZHk6IG1lc3NhZ2VcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgbm90aWZpY2F0aW9uOiB7XG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiB0aXRsZSxcbiAgICAgICAgICAgICAgICAgICAgYm9keTogbWVzc2FnZVxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZmNtT3B0aW9uczoge1xuICAgICAgICAgICAgICAgICAgICBhbmFseXRpY3NMYWJlbDogYW5hbHl0aWNzTGFiZWxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LCBwYXJzZUludChwcm9jZXNzLmVudi5FTkFCTEVfUFVTSCkgPT09IDApO1xuICAgICAgICAgICAgcmVzLnB1c2gocmVzcG9uc2UpO1xuICAgICAgICAgICAgdGVtcERldlRva2VucyA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGorKztcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIE11bHRpQ2FzdElnbm9yZUVycihPYmo6IHtcbiAgICBEZXZpY2VUb2tlbnM6IHN0cmluZ1tdO1xuICAgIGxpbms6IHN0cmluZztcbiAgICB0aXRsZTogc3RyaW5nO1xuICAgIG1lc3NhZ2U6IHN0cmluZztcbiAgICBwcmlvcml0eTogKCdoaWdoJ3wnbm9ybWFsJyk7XG4gICAgYW5hbHl0aWNzTGFiZWw6IHN0cmluZztcbn0pIHtcbiAgICB0cnkge1xuICAgICAgIHJldHVybiBhd2FpdCBNdWx0aUNhc3QoT2JqKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcihlKTtcbiAgICB9XG59Il19
