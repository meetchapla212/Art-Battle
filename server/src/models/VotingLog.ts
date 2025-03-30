import * as mongoose from 'mongoose';

import { VotingLogDTO } from '../../../shared/VotingLogDTO';


export interface VotingLogDocument extends VotingLogDTO, mongoose.Document {
    VoteFactor: number;
    VoteFactorInfo: {
        Type: String,
        Value: String
    };
}

export const VotingLogSchema: mongoose.Schema = new mongoose.Schema({
    PhoneNumber: String,
    EventName: String,
    ArtistName: String,
    Status: {type: String, index: true},
    RoundNumber: Number,
    EaselNumber: String,
    EventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event'},
    VoteFactorInfo: {
        Type: String,
        Value: String
    },
    VoteFactor: Number,
    PhoneHash: {type: String, index: true},
    DisplayPhone: String,
    VoteChannel: {
        Channel: String,
        Type: String
    },
    /*Follow/Following Start*/
    Registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration'},
    Contestant: { type: mongoose.Schema.Types.ObjectId, ref: 'Contestant'},
    Lot: { type: mongoose.Schema.Types.ObjectId, ref: 'Lot'}
    /*Follow/Following End*/
}, { timestamps: true });

const VotingLogModel = mongoose.model<VotingLogDocument>('VotingLog', VotingLogSchema);
export default VotingLogModel;