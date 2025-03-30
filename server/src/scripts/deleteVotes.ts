import loadApp from './bootstrap';
import VotingLogModel from '../models/VotingLog';
import EventModel from '../models/Event';
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
    return deleteVotes();
}

async function deleteVotes(): Promise<any> {
    const event = await EventModel.findOne({
        _id: '5e861378f97603aaca9bdde4'
    });
    const query = {EventId: '5e861378f97603aaca9bdde4', Status: 'VOTE_ACCEPTED', createdAt: {$lte: '2020-04-03T01:04:37.715+00:00'}};
    const votingLogs = await VotingLogModel.find(query);
    const voterIds: {[key: string]: string[]} = {};
    for (let i = 0; i < votingLogs.length; i++) {
        const log = votingLogs[i];
        const key = `${log.RoundNumber}-${log.EaselNumber}`;
        if (!voterIds[key]) {
            voterIds[key] = [];
        }
        voterIds[key].push(log.Registration.toString());
    }
    let totalDeleteVoteCount = 0;
    let totalDeleteVoteDetailCount = 0;
    for (let i = 0; i  < event.Rounds.length; i++) {
        const contestants = event.Rounds[i].Contestants;
        for (let j = 0; j < contestants.length; j++) {
            const contestant = contestants[j];
            const toKeepVotes = [];
            for (let k = 0; k < contestant.Votes.length; k++) {
                if (Array.isArray(voterIds[`${event.Rounds[i].RoundNumber}-${contestant.EaselNumber}`])
                    && voterIds[`${event.Rounds[i].RoundNumber}-${contestant.EaselNumber}`].indexOf(contestant.Votes[k].toString()) > -1) {
                    // DELETE
                    totalDeleteVoteCount ++;
                } else {
                    toKeepVotes.push(contestant.Votes[k]);
                }
            }
            contestant.Votes = JSON.parse(JSON.stringify(toKeepVotes));
            const toKeepVoteDetails = [];
            for (let k = 0; k < contestant.VotesDetail.length; k++) {
                if (Array.isArray(voterIds[`${event.Rounds[i].RoundNumber}-${contestant.EaselNumber}`])
                    && voterIds[`${event.Rounds[i].RoundNumber}-${contestant.EaselNumber}`].indexOf(contestant.VotesDetail[k].RegistrationId.toString()) > -1) {
                    // DELETE
                    totalDeleteVoteDetailCount ++;
                } else {
                    toKeepVoteDetails.push(contestant.VotesDetail[k]);
                }
            }
            contestant.VotesDetail = JSON.parse(JSON.stringify(toKeepVoteDetails));
        }
    }
    await event.save();
    await VotingLogModel.deleteMany(query);
    console.log('totalDeleteVoteCount', totalDeleteVoteCount);
    console.log('totalDeleteVoteDetailCount', totalDeleteVoteDetailCount);
    console.log('delete voting logs', votingLogs.length);
}