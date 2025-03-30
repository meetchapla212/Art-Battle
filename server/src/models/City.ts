import * as mongoose from 'mongoose';
import { CityDTO } from '../../../shared/CityDTO';


export interface CityDocument extends CityDTO, mongoose.Document {}

export const CitySchema: mongoose.Schema = new mongoose.Schema({
    Name: String,
    Country: String,
    CountryCode: String,
    RegionCode: String,
    Region: String
}, { timestamps: true });

CitySchema.index({Name: 1, Country: 1, Region: 1}, {unique: true});

const CityModel = mongoose.model<CityDocument>('City', CitySchema);
export default CityModel;