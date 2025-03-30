import loadApp from './bootstrap';
import EventModel from '../models/Event';
let mongoose: typeof import('mongoose');
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
                    if (image.Compressed && image.Compressed.url)
                    image.Compressed.url = _replacePath(image.Compressed.url);
                    if (image.Thumbnail && image.Thumbnail.url)
                    image.Thumbnail.url = _replacePath(image.Thumbnail.url);
                    if (image.Original && image.Original.url)
                    image.Original.url = _replacePath(image.Original.url);
                    if (image.Edited && image.Edited.url)
                    image.Edited.url = _replacePath(image.Edited.url);
                }
                const videos = contestant.Videos;
                for (let l = 0; l < videos.length; l++) {
                    videos[l].Original.url = _replacePath(videos[l].Original.url);
                }
            }
        }
        await events[i].save();
    }
}

function _replacePath(url: string) {
    let URL = url.replace('a.artbattle.com', 'artb.art/vote-media');
    URL = URL.replace('vote.artbattle.com', 'artb.art/vote-media');
    return URL;
}