import * as mongoose from 'mongoose';
import MediaDTO from '../../../shared/MediaDTO';


export interface MediaDocument extends MediaDTO, mongoose.Document {}

export const MediaSchema: mongoose.Schema = new mongoose.Schema({
    Name: String,
    Url: String,
    Dimension: {
        width: Number,
        height: Number
    },
    Size: Number,
    Thumbnails: [{ type: mongoose.Schema.Types.ObjectId, ref: this}],
    UploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration'},
    UploadStart: Date,
    UploadFinish: Date,
    CompressionStart: Date,
    CompressionFinish: Date,
    ResizeStart: Date,
    ResizeEnd: Date,
    Type: String,
    FileType: String
}, { timestamps: true });

const MediaModel = mongoose.model<MediaDocument>('Media', MediaSchema);
export default MediaModel;