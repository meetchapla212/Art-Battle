import RegistrationLogModel from '../models/RegistrationLog';

import EventModel from '../models/Event';
import logger from '../config/logger';

/* Forceful import */
import mongoose from './bootstrap';
import ContestantModel from '../models/Contestant';
logger.info(typeof mongoose, typeof ContestantModel);
/* Forceful import end */

import RegistrationModel, { RegistrationDocument } from '../models/Registration';
import VotingLogModel from '../models/VotingLog';


function start() {
    return new Promise((resolve, reject) => {
        const regStream = RegistrationModel.find()
            .cursor();
        regStream
            .on('data', updateRegistration)
            .on('end', resolve)
            .on('error', reject);
    });
}

/**
 * @param doc
 * @return void
 */
async function updateRegistration(doc: RegistrationDocument) {
    const results = await Promise.all(
        [
            EventModel.find({
                'RegistrationsVoteFactor.PhoneNumber': doc.PhoneNumber
            }),
            RegistrationLogModel.updateMany( {
                'PhoneNumber': doc.PhoneNumber
            }, {
                'PhoneNumberHash': doc.Hash
            }),
            VotingLogModel.updateMany( {
                'PhoneNumber': doc.PhoneNumber
            }, {
                'PhoneHash': doc.Hash
            })
        ]
    );

    logger.info('updateResult', results[1], results[2]);

    const userEvents = results[0];

    logger.info('total events for the registration',  userEvents.length);
    for (let i = 0; i < userEvents.length; i++) {
        const eventDoc = userEvents[i];
        logger.info('total events in registration',  eventDoc.RegistrationsVoteFactor.length);
        for (let j = 0; j < eventDoc.RegistrationsVoteFactor.length; j++) {
            logger.info('phonenumber.comparison', eventDoc.RegistrationsVoteFactor[j].PhoneNumber === doc.PhoneNumber, eventDoc.RegistrationsVoteFactor[j].PhoneNumber, doc.PhoneNumber);
            if (eventDoc.RegistrationsVoteFactor[j].PhoneNumber === doc.PhoneNumber) {
                logger.info(`matching event for the registration found`);
                eventDoc.RegistrationsVoteFactor[j].Hash = doc.Hash;
                await eventDoc.save();
                logger.info(`saved the event`);
                break;
            }
        }
    }
}


start().then(() => {
    logger.info('streaming done');
    // process.exit(0);
}).catch(e => {
    logger.info(e);
});
