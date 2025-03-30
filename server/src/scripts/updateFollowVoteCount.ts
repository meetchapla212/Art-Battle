import loadApp from './bootstrap';
import VotingLogModel, { VotingLogDocument } from '../models/VotingLog';
import ContestantModel from '../models/Contestant';
import EventModel from '../models/Event';
let mongoose: typeof import('mongoose');
loadApp().then((obj) => {
    mongoose = obj.mongoose;
    return start();
}).then(() => {
    console.log('done');
    return mongoose.connection.close();
}).catch(e =>{
    console.error(e);
    if (mongoose.connection) {
        return mongoose.connection.close();
    }
}).then(() => {
    console.log('closed db conn');
});

async function start() {
    await updateVoteCount();
    await updateFollowersCount();
}

async function updateVoteCount() {
    const votingLog = await VotingLogModel.find({
        Status: 'VOTE_ACCEPTED'
    });
    for (let i = 0; i < votingLog.length; i++) {
        const log = votingLog[i];
        if (log.Contestant) {
            const contestant = await ContestantModel.findById(log.Contestant);
            const initialVoteCount = contestant.VotesCount || 0;
            contestant.VotesCount = initialVoteCount + 1;
            await contestant.save();
        } else {
            const event = await EventModel.findById(log.EventId);
            for (let i = 0; i < event.Rounds.length; i++) {
                const round = event.Rounds[i];
                // @ts-ignore
                if (parseInt(round.RoundNumber) === parseInt(log.RoundNumber)) {
                    for (let j = 0; j < round.Contestants.length; j++) {
                        const contestant = round.Contestants[j];
                        // @ts-ignore
                        if (parseInt(contestant.EaselNumber) === parseInt(log.EaselNumber)) {
                            log.Contestant = contestant.Detail;
                            await log.save();
                            const contestantM = await ContestantModel.findById(contestant.Detail);
                            const initialVoteCount = contestantM.VotesCount || 0;
                            contestantM.VotesCount = initialVoteCount + 1;
                            await contestantM.save();
                            break;
                        }
                    }
                }
            }
        }
    }
}

async function updateFollowersCount() {
    const contestants = await ContestantModel.find();
    for (let i = 0; i < contestants.length; i++) {
        const contestant = contestants[i];
        contestant.FollowersCount = contestant.Followers && contestant.Followers.length || 0;
        contestant.Score = contestant.FollowersCount + contestant.VotesCount;
        await contestant.save();
    }
}