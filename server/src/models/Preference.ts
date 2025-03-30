import * as mongoose from 'mongoose';

import PreferenceDTO from '../../../shared/PreferenceDto';

export interface PreferenceDocument extends PreferenceDTO, mongoose.Document {
}

export const PreferenceSchema: mongoose.Schema = new mongoose.Schema({
    Preference: String,
    Enabled: Boolean,
    Type: String
});

const PreferenceModel = mongoose.model<PreferenceDocument>('Preference', PreferenceSchema);
export default PreferenceModel;