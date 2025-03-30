import * as mongoose from 'mongoose';

import RegistrationDTO from '../../../shared/RegistrationDTO';
import ArtistAppsDTO from '../../../shared/ArtistAppsDTO';
import { artistAppsSchema } from './ArtistApps';

export interface RegistrationDocument extends RegistrationDTO, mongoose.Document {
    MessageBlocked: number;
}

export const RegistrationSchema: mongoose.Schema = new mongoose.Schema({
    FirstName: String,
    LastName: String,
    NickName: String,
    Email: { type: String, unique: true, sparse: true, index: true },
    PhoneNumber: { type: String, unique: true, sparse: true, index: true },
    Hash: { type: String, unique: true, sparse: true, index: true },
    DisplayPhone: { type: String},
    RegionCode: {type: String},
    VerificationCode: {type: Number},
    VerificationCodeExp: {type: Date},
    SelfRegistered: {type: Boolean},
    DeviceTokens: {type: Array},
    Preferences: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Preference'}],
    ArtBattleNews: {type: Boolean},
    NotificationEmails: {type: Boolean},
    LoyaltyOffers: {type: Boolean},
    AndroidDeviceTokens: {type: Array},
    ArtistProfile: artistAppsSchema,
    IsArtist: Boolean,
    MessageBlocked: {type: Number},
    lastPromoSentAt: Date,
    Location: {
        type: {
            type: String,
            enum: 'Point',
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        }
    },
    Artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Contestant'},
    RegisteredAt: {type: String, index: true}
});
RegistrationSchema.index({ Location: '2dsphere' });
const RegistrationModel = mongoose.model<RegistrationDocument>('Registration', RegistrationSchema);
export default RegistrationModel;