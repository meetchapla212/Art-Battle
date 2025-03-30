import * as admin from 'firebase-admin';
import * as path from 'path';
const serviceAccount = require(path.join(__dirname, `../data/fcm/${process.env.FCM_JSON}`));
import logger from '../config/logger';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://artbattle-de43f.firebaseio.com'
});

const Messaging = admin.messaging();

export async function MultiCast(Obj: {
    DeviceTokens: string[];
    link: string;
    title: string;
    message: string;
    priority: ('high'|'normal');
    analyticsLabel: string;
}) {
    const {DeviceTokens, link, title, message, priority, analyticsLabel} = Obj;
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
            logger.info('sending FCM Android push length' + tempDevTokens.length + JSON.stringify(tempDevTokens));
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
                        clickAction : '.MainActivity',
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

export async function MultiCastIgnoreErr(Obj: {
    DeviceTokens: string[];
    link: string;
    title: string;
    message: string;
    priority: ('high'|'normal');
    analyticsLabel: string;
}) {
    try {
       return await MultiCast(Obj);
    } catch (e) {
        logger.error(e);
    }
}