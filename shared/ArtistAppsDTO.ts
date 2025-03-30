interface Language {
  code: string;
  name: string;
  native: string;
}

interface Location {
  geoname_id: number;
  capital: string;
  languages: Language[];
  country_flag: string;
  country_flag_emoji: string;
  country_flag_emoji_unicode: string;
  calling_code: string;
  is_eu: boolean;
}

export interface IpInfo {
  ip: string;
  type: string;
  continent_code: string;
  continent_name: string;
  country_code: string;
  country_name: string;
  region_code: string;
  region_name: string;
  city: string;
  zip: string;
  latitude: number;
  longitude: number;
  location: Location;
}

export interface ArtistAppsDTO {
  '_id': any;
  'Name': string;
  'Email': string;
  'City': string;
  'Website': string;
  'PhoneNumber': string;
  'EntryId': string;
  'Entry Id': string;
  'UserIP': string;
  'Your Name': string;
  'User IP': string;
  'Processed': boolean;
  'IpInfo'?: IpInfo;
  'EntryDate': Date;
}

export default ArtistAppsDTO;
