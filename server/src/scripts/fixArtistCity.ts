import loadApp from './bootstrap';
import ContestantModel from '../models/Contestant';

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
// @ts-ignore
import got = require('got');

async function start() {
    return processArtists();
}

async function processArtists(): Promise<any> {
   const contestants = await ContestantModel.find({$or: [{CityText: /.*undefined*/}, {CityText: /.*null*/}]});
   for (let i = 0; i < contestants.length; i++) {
       const contestant = contestants[i];
       if (contestant.CityText.includes('null')) {
           contestant.CityText = contestant.CityText.replace(/, null/g, '');
           await contestant.save();
       } else if (contestant.CityText.includes('undefined')) {
           contestant.CityText = contestant.CityText.replace(/, undefined/g, '');
           await contestant.save();
       }
   }
}