import * as apn from 'apn';
import * as path from 'path';
import logger from '../config/logger';

let service = {};
try {
    service = new apn.Provider({
        token: {
            key: path.join(__dirname, `../data/apns/${process.env.APNS_TOKEN_KEY}`),
            keyId: process.env.APNS_TOKEN_KEY_ID,
            teamId: process.env.APNS_TEAM_ID
        },
        production: process.env.APNS_ENV && process.env.APNS_ENV === 'prod'
    });
} catch (e) {
    logger.info(e);
}

async function sendNotification(tokens: String[], text: string, title: string, payload?: any) {
    const note = new apn.Notification();
    note.payload = payload;
    // @ts-ignore
    note.body = text;

    note.topic = 'com.dev.artbattle';

    logger.info(`Sending: ${JSON.stringify(note)} to ${tokens}`);
    // @ts-ignore
    const result = await service.send(note, tokens);
        logger.info(`sent: ${result.sent.length}`);
        logger.info(`failed: ${result.failed.length}`);
        logger.info(result.failed);
    return result.failed;
}

export async function sendNotificationIgnoreErr(tokens: String[], text: string, title: string, payload?: any) {
    try {
        return await sendNotification(tokens, text, title, payload);
    } catch (e) {
        logger.info(`${e.message} ${e.stack}`);
    }
}

export default sendNotification;