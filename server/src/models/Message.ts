import * as mongoose from 'mongoose';

import MessageDTO from '../../../shared/MessageDTO';

export interface MessageDocument extends MessageDTO, mongoose.Document {
}

export const MessageSchema: mongoose.Schema = new mongoose.Schema({
    Message: String,
    ServerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    ServerRegistration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration'},
    ServerNumber: String,
    ServerNumberDoc: { type: mongoose.Schema.Types.ObjectId, ref: 'EventPhoneNumber'},
    ClientPhoneNumber: String,
    ClientRegistration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration'},
    Status: {type: Number, index: true},
    Channel: String,
    CreatedAt: {type: Date, index: true}
}, { timestamps: true });

const PreferenceModel = mongoose.model<MessageDocument>('Message', MessageSchema);
export default PreferenceModel;