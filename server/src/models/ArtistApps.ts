import * as mongoose from 'mongoose';

import ArtistAppsDTO from '../../../shared/ArtistAppsDTO';
export interface ArtistAppsDocument extends ArtistAppsDTO, mongoose.Document {
}

export const artistAppsSchema = {
  'Name': String,
  'Email': String,
  'City': String,
  'Website': String,
  'PhoneNumber': String,
  'EntryId': String,
  'UserIP': String,
  'Processed': Boolean,
  'EntryDate': Date,
  'IpInfo': new mongoose.Schema({
    ip: String,
    type: String,
    continent_code: String,
    continent_name: String,
    country_code: String,
    country_name: String,
    region_code: String,
    region_name: String,
    city: String,
    zip: String,
    latitude: Number,
    longitude: Number,
    location: {
      geoname_id: Number,
      capital: String,
      languages: [{
        code: String,
        name: String,
        native: String,  }],
      country_flag: String,
      country_flag_emoji: String,
      country_flag_emoji_unicode: String,
      calling_code: String,
      is_eu: Boolean
    }
  })
};
export const ArtistAppsSchema: mongoose.Schema = new mongoose.Schema(artistAppsSchema);

const ArtistAppsModel = mongoose.model<ArtistAppsDocument>('artistapps', ArtistAppsSchema);
export default ArtistAppsModel;
