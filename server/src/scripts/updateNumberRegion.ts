import loadApp from './bootstrap';
import EventPhoneNumberModel from '../models/EventPhoneNumber';
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
    return populate();
}

async function populate(): Promise<any> {
    return Promise.all([

        EventPhoneNumberModel.update({_id: '5cc3ee8ff97780032099f797'}, {$set: {RegionCode: 'GB'}}),
        EventPhoneNumberModel.update({_id: '5cc3eebe649eeb032012d59e'}, {$set: {RegionCode: 'GB'}}),
        EventPhoneNumberModel.update({_id: '5cc548a1b51acb3ae85ea2c6'}, {$set: {RegionCode: 'CA'}}),
        EventPhoneNumberModel.update({_id: '5cc548d8b51acb3ae85ea2c7'}, {$set: {RegionCode: 'CA'}}),
        EventPhoneNumberModel.update({_id: '5cc54901b51acb3ae85ea2c8'}, {$set: {RegionCode: 'US'}}),
        EventPhoneNumberModel.update({_id: '5cc54935b51acb3ae85ea2c9'}, {$set: {RegionCode: 'US'}}),
        EventPhoneNumberModel.update({_id: '5cc549b6b51acb3ae85ea2cb'}, {$set: {RegionCode: 'NL'}}),
        EventPhoneNumberModel.update({_id: '5cc549efb51acb3ae85ea2cc'}, {$set: {RegionCode: 'CA'}}),
        EventPhoneNumberModel.update({_id: '5cc54a16b51acb3ae85ea2cd'}, {$set: {RegionCode: 'CA'}}),
        EventPhoneNumberModel.update({_id: '5cc54a3bb51acb3ae85ea2ce'}, {$set: {RegionCode: 'CA'}}),
        EventPhoneNumberModel.update({_id: '5cc54a66b51acb3ae85ea2cf'}, {$set: {RegionCode: 'CA'}}),
        EventPhoneNumberModel.update({_id: '5cc54a8db51acb3ae85ea2d0'}, {$set: {RegionCode: 'AU'}}),
        EventPhoneNumberModel.update({_id: '5cc54ab8b51acb3ae85ea2d1'}, {$set: {RegionCode: 'CA'}}),
        EventPhoneNumberModel.update({_id: '5cc54accb51acb3ae85ea2d2'}, {$set: {RegionCode: 'CA'}}),
        EventPhoneNumberModel.update({_id: '5da6d6cd7603561adbfcf128'}, {$set: {RegionCode: 'US'}}),
        EventPhoneNumberModel.update({_id: '5dc321aedabe31534f3339e8'}, {$set: {RegionCode: 'US'}}),
    ]);
}