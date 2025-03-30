import { generate } from 'shortid';
import ShortUrlModel from '../models/ShortUrl';

export class ShortUrlGenerator {
    async generateAndSaveUrl(url: string) {
        const urlHash = generate();
        const shortUrlModel = new ShortUrlModel({
            URL: url,
            Hash: urlHash
        });
        return await shortUrlModel.save();
    }

    async getOriginalUrl(urlHash: string) {
        return ShortUrlModel.findOne({
            Hash: urlHash
        });
    }
}