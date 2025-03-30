import * as mongoose from 'mongoose';

import { ContestantDTO } from '../../../shared/ContestantDTO';


export interface ContestantDocument extends ContestantDTO, mongoose.Document {}

export const ContestantSchema: mongoose.Schema = new mongoose.Schema({
    Name: { type: String},
    Registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', unique: true, sparse: true },
    CityText: { type: String},
    Email: { type: String, unique: true, sparse: true},
    Website: {type: String},
    EntryId:  { type: Number, unique: true, sparse: true},
    PhoneNumber:  { type: String, unique: true, sparse: true},
    City: { type: mongoose.Schema.Types.ObjectId, ref: 'City'},
    ChildContestants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contestant' }],
    IsDuplicate: {type: Boolean},
    Followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Registration', index: true }],
    FollowersCount: { type: Number, index: true },
    VotesCount: { type: Number, index: true},
    Score: { type: Number, index: true},
    Videos: [{type: String}],
    WooProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'artistwoocommerce'}]
}, { timestamps: true });

ContestantSchema.index({ Name: 'text', CityText: 'text', Email: 'text', EntryId: 'text', PhoneNumber: 'text' });
const ContestantModel = mongoose.model<ContestantDocument>('Contestant', ContestantSchema);
export default ContestantModel;