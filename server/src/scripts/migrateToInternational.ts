const uniqid = require('uniqid');
import mongoose from './bootstrap';
import EventModel from '../models/Event';
import ContestantModel from '../models/Contestant';

import { PhoneNumberUtil } from 'google-libphonenumber';
import PhoneNumber = libphonenumber.PhoneNumber;
import logger from '../config/logger';

const phoneUtil = PhoneNumberUtil.getInstance();


/* Forceful import */
logger.info(typeof mongoose, typeof ContestantModel);
/* Forceful import end */

import RegistrationModel, { RegistrationDocument } from '../models/Registration';
import VotingLogModel from '../models/VotingLog';
import RegistrationLogModel from '../models/RegistrationLog';


async function start() {
    const registrations = await RegistrationModel.find();
    for (let i = 0; i  < registrations.length; i++) {
        await updateRegistration(registrations[i]);
    }
}

async function updateRegistration(doc: RegistrationDocument) {
    const oldNumber = doc.PhoneNumber;
    if (doc.PhoneNumber && doc.PhoneNumber.length > 0
        && !doc.PhoneNumber.startsWith('+')) {
       doc.PhoneNumber = `+${oldNumber}`;
       logger.info(doc.PhoneNumber);
       try {
           doc.RegionCode = phoneUtil.getRegionCodeForNumber((phoneUtil.parse(doc.PhoneNumber)));
       }
       catch (e) {
           logger.info('Invalid number', doc.PhoneNumber);
           doc.RegionCode = 'US';
       }
       if (!doc.Hash) {
           doc.Hash = uniqid.time();
       }
       if (!doc.DisplayPhone) {
           doc.DisplayPhone = `*******${doc.PhoneNumber.slice(-4)}`;
       }
       logger.info('Registration updated');
       await doc.save();
       await Promise.all([
           _modifyRegLog(oldNumber, doc),
           _modifyVotingLog(oldNumber, doc),
           _modifyEventRegistrationVoteFactor(oldNumber, doc)
       ]);
    }
}

async function _modifyRegLog(oldNumber: string, newDoc: RegistrationDocument) {
    const result = await RegistrationLogModel.updateMany({
        PhoneNumber: oldNumber,
    }, {
        '$set': {
            PhoneNumber: newDoc.PhoneNumber,
            DisplayPhone: newDoc.DisplayPhone,
            PhoneNumberHash: newDoc.Hash
        }
    });
    logger.info('Registration log updated', result);
}

async function _modifyVotingLog(oldNumber: string, newDoc: RegistrationDocument) {
    const result = await VotingLogModel.updateMany({
        PhoneNumber: oldNumber,
    }, {
        '$set': {
            PhoneNumber: newDoc.PhoneNumber
        }
    });
    logger.info('Voting log updated', result);
}

async function _modifyEventRegistrationVoteFactor(oldNumber: string, newDoc: RegistrationDocument) {
    const events = await EventModel.find({'RegistrationsVoteFactor.RegistrationId': newDoc.id});
    logger.info('events.length', events.length);
    for (let i = 0; i < events.length; i++) {
        for (let j = 0; j < events[i].RegistrationsVoteFactor.length; j++) {
            if (events[i].RegistrationsVoteFactor[j].RegistrationId === newDoc.id) {
                events[i].RegistrationsVoteFactor[j].PhoneNumber = newDoc.PhoneNumber;
                events[i].RegistrationsVoteFactor[j].Hash = newDoc.Hash;
                break;
            }
        }
        await events[i].save();
    }
    logger.info('Matching events updated', events.length);
}

start().then(() => {
    logger.info('streaming done');
    // process.exit(0);
}).catch(e => {
    logger.info(e);
});