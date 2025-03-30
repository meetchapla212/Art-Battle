 import * as mongoose from 'mongoose';

import { RegistrationLogDTO } from '../../../shared/RegistrationLogDTO';


export interface RegistrationLogDocument extends RegistrationLogDTO, mongoose.Document {
    VoteFactor: number;
    VoteFactorInfo: {
        Type: String,
        Value: String
    };
}

export const RegistrationLogSchema: mongoose.Schema = new mongoose.Schema({
    Name: String,
    EventName: String,
    FirstName: String,
    LastName: String,
    Email: String,
    PhoneNumber: String,
    AlreadyRegisteredForEvent: Boolean,
    NumberExists: Boolean,
    EventId: String,
    DisplayPhone: String,
    PhoneNumberHash: String,
    VoteFactor: Number,
    VoteFactorInfo: {
        Type: String,
        Value: String
    },
    VoteUrl: String,
    Status: String,
    RegisteredAt: String
}, { timestamps: true });
RegistrationLogSchema.index({EventId: 1, AlreadyRegisteredForEvent: 1});
RegistrationLogSchema.index({EventId: 1, AlreadyRegisteredForEvent: 1, RegisteredAt: 1});
const RegistrationLogModel = mongoose.model<RegistrationLogDocument>('RegistrationLog', RegistrationLogSchema);
export default RegistrationLogModel;