import * as mongoose from 'mongoose';
import { ArtistWooCommerceDTO } from '../../../shared/ArtistWooCommerceDTO';

export interface ArtistWooCommerceDocument extends ArtistWooCommerceDTO, mongoose.Document {
}

export const artistWooCommerceSchema = {
    ArtistId: String,
    ProductId: {type: String, unique: true, index: true},
    Confirmation: String,
    createdAt: Date,
    updatedAt: Date,
    Description: String,
    Permalink: String,
    Name: String,
    Purchasable: Boolean,
    Images: [
        {
            'id': Number,
            'date_created': String,
            'date_created_gmt': String,
            'date_modified': String,
            'date_modified_gmt': String,
            'src': String,
            'name': String,
            'alt': String,
        }],
    Price: String,
    Contestant: { type: mongoose.Schema.Types.ObjectId, ref: 'Contestant'}
};
export const ArtistWooCommerceSchema: mongoose.Schema = new mongoose.Schema(artistWooCommerceSchema, { timestamps: true });

const ArtistWooCommerceModel = mongoose.model<ArtistWooCommerceDocument>('artistwoocommerce', ArtistWooCommerceSchema);
export default ArtistWooCommerceModel;