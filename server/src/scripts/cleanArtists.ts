import loadApp from './bootstrap';
let mongoose: typeof import('mongoose');
loadApp().then((obj) => {
    mongoose = obj.mongoose;
    return start();
}).then(() => {
    console.log('done');
    return mongoose.connection.close();
}).catch(e => {
    console.error(e);
    if (mongoose.connection) {
        return mongoose.connection.close();
    }
}).then(() => {
    console.log('closed db conn');
});
// @ts-ignore
import got = require('got');
import RegistrationModel from '../models/Registration';
import ContestantModel from '../models/Contestant';
import EventModel from '../models/Event';

async function start() {
    return processArtists();
}

async function processArtists() {
    await Promise.all([cleanRegistrations(), cleanContestants()]);
}

async function cleanContestants() {
    const contestants = await ContestantModel.find({
        $or: [
            {
                EntryId: {
                    $exists: true
                }
            },
            {
                Email: {
                    $exists: true
                }
            },
            {
                PhoneNumber: {
                    $exists: true
                }
            },
            {
                Registration: {
                    $exists: true
                }
            }
        ]
    });
    console.log('contestants.length', contestants.length);
    for (let i = 0; i < contestants.length; i++) {
        const contestant = contestants[i];
        const event = await EventModel.findOne({Contestants: {$in: [contestant._id]}});
        if (!event) {
            console.log('removing contestant');
            await contestant.remove();
            console.log('removed contestant');
        } else {
            console.error(`skipping deletion of ${contestant._id} ${contestant.Name} because it exists in ${event.Name} ${event._id}`);
        }
    }
}

async function cleanRegistrations() {
    const registrations = await RegistrationModel.find({
        $or: [
            {
                ArtistProfile: {
                    $exists: true
                }
            },
            {
                IsArtist: true
            }
        ]
    });
    console.log('registrations.length', registrations.length);
    for (let i = 0; i < registrations.length; i++) {
        const registration = registrations[i];
        if (registration.ArtistProfile) {
            registration.ArtistProfile = undefined;
        }
        registration.IsArtist = false;
        console.log('de-linking registration', registration._id);
        await registration.save();
    }
}