import * as mongoose from 'mongoose';

import AnnouncementDto from '../../../shared/AnnouncementDto';

export interface AnnouncementDocument extends AnnouncementDto, mongoose.Document {
}

export const AnnouncementSchema: mongoose.Schema = new mongoose.Schema({
    announcements: [ {
        event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event'},
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    }],
    firedTimes: Number,
    message: String
}, { timestamps: true });

const AnnouncementModel = mongoose.model<AnnouncementDocument>('Announcement', AnnouncementSchema);
export default AnnouncementModel;