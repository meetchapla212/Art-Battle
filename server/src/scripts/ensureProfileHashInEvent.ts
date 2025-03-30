import mongoose from './bootstrap';
import EventModel, { EventDocument } from '../models/Event';
import ContestantModel from '../models/Contestant';
import logger from '../config/logger';

/* Forceful import */
logger.info(typeof mongoose, typeof ContestantModel);
/* Forceful import end */

import RegistrationModel  from '../models/Registration';
import VotingLogModel from '../models/VotingLog';


async function start() {
    const events = await EventModel.find({
        'Enabled': true
    }).sort({_id: -1});
    for (let i = 0; i  < events.length; i++) {
        await updateEvent(events[i]);
    }
}

async function updateEvent(doc: EventDocument) {
    for (let i = 0; i < doc.RegistrationsVoteFactor.length; i++) {
        const regFactor = doc.RegistrationsVoteFactor[i];
        const regDoc = await RegistrationModel.findById(regFactor.RegistrationId);
        regFactor.Hash = regDoc.Hash;
        await VotingLogModel.updateMany({
            'PhoneNumber': regFactor.PhoneNumber,
        }, {
            '$set': {
                'PhoneHash': regFactor.Hash,
                'DisplayPhone': `*******${regFactor.PhoneNumber.slice(-4)}`
            }
        }).exec();
    }
    await doc.save();
}

start().then(() => {
    logger.info('fix done');
    process.exit(0);
}).catch(e => {
    logger.info(e);
});