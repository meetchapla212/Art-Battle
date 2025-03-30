import * as mongoose from 'mongoose';

import CountryDTO from '../../../shared/CountryDTO';

export interface CountryDocument extends CountryDTO, mongoose.Document {
}

export const CountrySchema: mongoose.Schema = new mongoose.Schema({
    country_code: String,
    country_name: String,
    country_image: String,
    phone_code: String,
    currency_label: String,
    currency_symbol: String
});

const CountryModel = mongoose.model<CountryDocument>('Country', CountrySchema);
export default CountryModel;