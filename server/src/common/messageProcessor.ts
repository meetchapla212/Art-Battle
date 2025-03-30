import { Response } from 'express';
import { default as MessageSchema } from '../models/Message';
import RegistrationModel from '../models/Registration';
import logger from '../config/logger';
import EventModel from '../models/Event';
import { postPeopleMessageToSlack } from './Slack';
export const processMessage = async (body: string, from: string, to: string, res: Response) => {

    // FETCH USERID
    // INSERTION
    const userData = await RegistrationModel.find({'PhoneNumber': from}).select([
        '_id', 'NickName', 'FirstName', 'PhoneNumber'
     ]);
    if (userData[0]) {
        if (body.trim().toLowerCase() === 'stop') {
            // auto block user
            userData[0].MessageBlocked = 1;
            await userData[0].save();
        }
        const MessageObj = new MessageSchema();
        MessageObj.Message = body;
        // MessageObj.ServerUser = userData[0]._id;
        // MessageObj.ServerRegistration = userData[0]._id;
        MessageObj.ServerNumber = to;
        MessageObj.ServerNumberDoc = userData[0]._id;
        MessageObj.ClientPhoneNumber = from;
        MessageObj.ClientRegistration = userData[0]._id;
        MessageObj.Status = 0; // Receive from USER
        MessageObj.Channel = 'SMS'
        const savedMessage = await MessageObj.save();
        let lastEventTitle = '';
        const event = await EventModel.findOne({
            Registrations: userData[0]._id
        }).sort({_id: -1});
        if (event) {
            lastEventTitle = `last event ${event.Name}`;
        }

        // return res.send(`<Response><Sms>We have received your message, we will get back to you soon</Sms></Response>`);
        res.send(`<Response>We have received your message, we will get back to you soon</Response>`);
        postPeopleMessageToSlack({
            'text': `\`\`\` ${body} \`\`\`
from ${userData[0].NickName || userData[0].FirstName || userData[0].PhoneNumber} - <${process.env.SITE_URL}/p/${userData[0].PhoneNumber}|reply to ${to}> ${lastEventTitle}`,
            'mrkdwn': true
        }).catch(() => logger.info('people message slack call failed ', body));
    } else {
        postPeopleMessageToSlack({
            'text': `\`${body}\` /n This came from unregistered number ${from}`,
            mrkdwn: true
        }).catch(() => logger.info('people message slack call failed ', body));
    }
};