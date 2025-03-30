import * as mongoose from 'mongoose';

import EventPhoneNumberDto from '../../../shared/EventPhoneNumberDTO';

export interface EventPhoneNumberDocument extends EventPhoneNumberDto, mongoose.Document {
    type: string;
    location: string;
    status: number;
}

export const EventPhoneNumberSchema: mongoose.Schema = new mongoose.Schema({
    phone: String,
    label: String,
    type: String,
    location: String,
    status: Number,
    RegionCode: String
}, { timestamps: true });

const EventPhoneNumberModel = mongoose.model<EventPhoneNumberDocument>('EventPhoneNumber', EventPhoneNumberSchema);
export default EventPhoneNumberModel;