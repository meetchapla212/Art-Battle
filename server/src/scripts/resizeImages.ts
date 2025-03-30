import loadApp from './bootstrap';
import MediaModel, { MediaDocument } from '../models/Media';
import fileType = require('file-type');
import * as sharp from 'sharp';
import EventModel from '../models/Event';
let mongoose: typeof import('mongoose');
const url = require('url');
const fs = require('fs-extra');
const path = require('path');
loadApp().then((obj) => {
    mongoose = obj.mongoose;
    return start();
}).then(() => {
    console.log('done');
    return mongoose.connection.close();
}).catch(e => {
    console.error(e);
    if (mongoose.connection) {
        return mongoose.connection.close();
    }
}).then(() => {
    console.log('closed db conn');
});

const sizeTypeMap: {[key: string]: {
        width: number;
        height?: number;
    }} = {
    Optimized: {
        width: 1366,
        // height: undefined, auto
    },
    Thumb: {
        width: 280,
        height: 440,
    },
};

async function start() {
    const events = await EventModel.find({});
    for (let i = 0; i < events.length; i++) {
        const rounds = events[i].Rounds;
        for (let j = 0; j < rounds.length; j++) {
            const contestants = rounds[j].Contestants;
            for (let k = 0; k < contestants.length; k++) {
                const contestant = contestants[k];
                const images = contestant.Images || [];
                for (let l = 0; l < images.length; l++) {
                    const image = images[l];
                    const compressedImagedId = image.Compressed.id;
                    const thumbnailImageId = image.Thumbnail.id;
                    const medias = await Promise.all([
                        MediaModel.findById(compressedImagedId),
                        MediaModel.findById(thumbnailImageId)
                    ]);
                   const modifiedMedias = await Promise.all([
                      optimizeMedia(medias[0]),
                      optimizeMedia(medias[1])
                   ]);
                   if (modifiedMedias[0]) {
                       image.Compressed.url = modifiedMedias[0].Url;
                   }
                    if (modifiedMedias[1]) {
                        image.Thumbnail.url = modifiedMedias[1].Url;
                    }
                }
            }
        }
        await events[i].save();
    }
}

async function optimizeMedia(media: MediaDocument) {
    if (!media) {
        return ;
    }
    const mediaUrl = media.Url;
    console.log(mediaUrl);
    const filePath = path.resolve(`${__dirname}/../public/${url.parse(mediaUrl).path}`);
    let imgBuffer;
    try {
        imgBuffer = await fs.readFile(filePath);
    }  catch (e) {
        console.error('unable to find file', filePath);
    }
    if (imgBuffer) {
        const fType = fileType(imgBuffer);
        const width = sizeTypeMap[media.Type.toString()].width;
        const height = sizeTypeMap[media.Type.toString()].height;
        if (fType.ext === 'png') {
            const newFilePath = filePath.replace('png', 'jpg');
            // 108, 170 -> 150 x 236
            const result = await sharp(imgBuffer).rotate().resize(width, height).jpeg({
                quality: 50,
                chromaSubsampling: '4:4:4',
                // trellisQuantisation: true,
            }).toFile(newFilePath);
            media.Url = media.Url.replace('png', 'jpg');
            await media.save();
            await fs.unlink(filePath);
            console.log('changed file format', newFilePath, result);
            return media;
        }
    }
}