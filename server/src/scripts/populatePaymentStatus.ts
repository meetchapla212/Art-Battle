import loadApp from './bootstrap';
import PaymentStatusModel from "../models/PaymentStatus";
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
    return PaymentStatusModel.insertMany([
        {
            status: 'Paid Online',
            active: true
        },
        {
            status: 'Paid Cash',
            active: true
        },
        {
            status: 'Paid By Partner',
            active: true
        },
        {
            status: 'Paid Paypal',
            active: true
        }
    ])
}