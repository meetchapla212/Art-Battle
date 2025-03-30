import * as mongoose from 'mongoose';

import TimezoneDTO from '../../../shared/TimezoneDTO';

export interface TimezoneDocument extends TimezoneDTO, mongoose.Document {
}

export const TimezoneSchema: mongoose.Schema = new mongoose.Schema({
    country_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Country' },
    timeZoneLabel: String,
    icann_name: String
});

const TimezoneModel = mongoose.model<TimezoneDocument>('Timezone', TimezoneSchema);
export default TimezoneModel;