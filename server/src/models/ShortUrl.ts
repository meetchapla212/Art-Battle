import * as mongoose from 'mongoose';
import ShortUrlDTO from '../../../shared/ShortUrlDTO';


export interface ShortUrlDocument extends ShortUrlDTO, mongoose.Document {}

export const ShortUrlSchema: mongoose.Schema = new mongoose.Schema({
    URL: String,
    Hash: { type: String, unique: true, index: true},
}, { timestamps: true });

const ShortUrlModel = mongoose.model<ShortUrlDocument>('ShortUrl', ShortUrlSchema);
export default ShortUrlModel;