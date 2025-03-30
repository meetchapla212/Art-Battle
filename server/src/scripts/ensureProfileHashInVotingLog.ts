import mongoose from './bootstrap';
import EventModel, { EventDocument } from '../models/Event';
import ContestantModel from '../models/Contestant';
import logger from '../config/logger';



/* Forceful import */
logger.info(typeof mongoose, typeof ContestantModel);
/* Forceful import end */

import RegistrationModel  from '../models/Registration';
import VotingLogModel from '../models/VotingLog';
import PhoneNumber = libphonenumber.PhoneNumber;


async function start() {
    const votingLogs = await VotingLogModel.find({PhoneHash: {'$exists': false}}).sort({_id: -1});
    for (let i = 0; i < votingLogs.length; i++) {
        const registration = await RegistrationModel.findOne({
            PhoneNumber: votingLogs[i].PhoneNumber
        });
        if (registration) {
            votingLogs[i].PhoneHash = registration.Hash;
            votingLogs[i].DisplayPhone = `*******${registration.PhoneNumber.slice(-4)}`;
            await votingLogs[i].save();
        } else {
            logger.info(`No reg found for ${votingLogs[i].PhoneNumber}`);
        }
    }
}

start().then(() => {
    logger.info('fix done');
    process.exit(0);
}).catch(e => {
    logger.info(e);
});