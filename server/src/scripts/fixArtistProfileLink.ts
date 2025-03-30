import loadApp from './bootstrap';
import LotModel, { LotDocument } from '../models/Lot';
import EventModel, { EventDocument } from '../models/Event';
import VotingLogModel, { VotingLogDocument } from '../models/VotingLog';
import RoundContestantDTO from '../../../shared/RoundContestantDTO';
import RoundDTO from '../../../shared/RoundDTO';
import RegistrationModel from '../models/Registration';
let incEid = 1;
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

async function start() {
    await updateLots();
    await updateVotingLogs();
}

async function updateLots() {
    const lots = await LotModel.find().populate('Event');
    for (let i = 0; i < lots.length; i++) {
        const lot = lots[i];
        const event = lot.Event;
        await processContestants(event, lot);
    }
}

async function updateVotingLogs() {
    const events = await EventModel.find().populate('Rounds.Contestants.Detail');
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        for (let j = 0; j < event.Rounds.length; j++) {
            const round = event.Rounds[j];
            for (let k = 0; k < round.Contestants.length; k++) {
                await MapLotAndContestant(round.Contestants[k], round, event);
                await findAndMapVotingLogs(round.Contestants[k], round, event);
            }
        }
        await event.save();
    }
}

async function processContestants(Event: EventDocument, Lot: LotDocument) {
    for (let i = 0; i < Event.Rounds.length; i++) {
        const round = Event.Rounds[i];
        for (let j = 0; j < round.Contestants.length; j++) {
            const contestant  = round.Contestants[j];
            if (!contestant.Lot) {
                contestant.Lot = Lot;
                await Event.save();
            }
            if (contestant.EaselNumber === Lot.EaselNumber && round.RoundNumber === Lot.Round) {
                Lot.Contestant = contestant.Detail;
                await Lot.save();
            }
        }
    }
}

async function findAndMapVotingLogs(contestant: RoundContestantDTO, round: RoundDTO, event: EventDocument) {
    const logs = await VotingLogModel.find({
        RoundNumber: round.RoundNumber,
        EventId: event._id,
        EaselNumber: contestant.EaselNumber
    });
    for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        if (log.PhoneNumber) {
            await MapVotingLogLotContestantRegistration(contestant, round, event, log);
        }
    }
}

async function MapVotingLogLotContestantRegistration(contestant: RoundContestantDTO, round: RoundDTO,
                                                     event: EventDocument, log: VotingLogDocument) {
    const registration = await RegistrationModel.findOne({PhoneNumber: log.PhoneNumber});
    if (registration) {
        log.Registration = registration;
        log.Contestant = contestant.Detail;
        log.Lot = contestant.Lot;
        await log.save();
    }
}

async function MapLotAndContestant(contestant: RoundContestantDTO, round: RoundDTO, event: EventDocument) {
    if (contestant.Enabled && contestant.EaselNumber > 0 && !contestant.Lot) {
        const Lot = await LotModel.findOne({
            EaselNumber: contestant.EaselNumber,
            Round: round.RoundNumber,
            Event: event._id
        });
        if (!Lot) {
            if (!event.EID) {
                event.EID = `AB-${incEid++}`;
                console.log('event.EID', event.EID);
            }
            const lotModel = new LotModel();
            lotModel.ArtId = `${event.EID}-${round.RoundNumber}-${contestant.EaselNumber}`;
            lotModel.EaselNumber = contestant.EaselNumber;
            lotModel.Event = event._id;
            lotModel.Round = round.RoundNumber;
            lotModel.Bids = [];
            lotModel.Status = 0;
            lotModel.Contestant = contestant.Detail;
            lotModel.ArtistId = contestant.Detail.EntryId;
            contestant.Lot = await lotModel.save();
        } else if (Lot) {
            contestant.Lot = Lot;
        }
    }
}