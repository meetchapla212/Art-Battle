import { post } from 'request';
import logger from '../config/logger';

interface SlackPayload {
   text: string;
   mrkdwn?: boolean;
}

export const postToSlack = async (payload: SlackPayload) => {
   return await _post(payload, process.env.SLACK_CHANNEL_WEBHOOK);
};

export const postToSlackBid = async (payload: SlackPayload) => {
   return await _post(payload, process.env.SLACK_BIDS_CHANNEL_WEBHOOK);
};

export const postToSlackSMSFlood = async (payload: SlackPayload) => {
   if ( process.env.SLACK_CHANNEL_SMS_FLOOD && process.env.SLACK_CHANNEL_SMS_FLOOD_ENABLE === '1')  {
      return await _post(payload, process.env.SLACK_CHANNEL_SMS_FLOOD);
   }
};

export const postPeopleMessageToSlack = async (payload: SlackPayload) => {
   return await _post(payload, process.env.SLACK_PEOPLE_CHANNEL_WEBHOOK);
};

const _post = (payload: SlackPayload, hook: string) => {
   return new Promise((resolve) => {
      post(hook, {
         body: JSON.stringify(payload)
      }, (err, response, body) => {
         if (err) {
            logger.info(err);
         }
         if (response) {
            logger.info(`slack response status code ${response.statusCode}`);
            logger.info(`slack response body ${body}`);
         }
         resolve();
      });
   });
};

export default postToSlack;