import * as mongoose from 'mongoose';
import LotDTO from '../../../shared/LotDTO';


export interface LotDocument extends LotDTO, mongoose.Document {}

const BidSchema: mongoose.Schema = new mongoose.Schema({
    Amount: {
        type: Number,
        index: true
    },
    Registration: {type: mongoose.Schema.Types.ObjectId, ref: 'Registration'},
    createdAt: Date,
    IpAddress: String
});
const ArtistPaidChangeLog: mongoose.Schema = new mongoose.Schema({
    Registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration'},
    User: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    createdAt: Date,
    PaidStatus: {type: mongoose.Schema.Types.ObjectId, ref: 'PaymentStatus'},
    Artist: {type: mongoose.Schema.Types.ObjectId, ref: 'Contestants'}
});
const BuyerPaidChangeLog: mongoose.Schema = new mongoose.Schema({
    Registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration'},
    User: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    createdAt: Date,
    PaidStatus: {type: mongoose.Schema.Types.ObjectId, ref: 'PaymentStatus'},
    Buyer: {type: mongoose.Schema.Types.ObjectId, ref: 'Registration'}
});

export const LotSchema: mongoose.Schema = new mongoose.Schema({
    ArtId: {type: String, unique: true, index: true},
    EaselNumber: Number,
    Event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event'},
    Round: Number,
    Bids: [BidSchema],
    Winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration'},
    WinningBidAmount: Number,
    Status: { type: Number, index: true},
    Description: {type: String},
    WidthAndHeight: {type: String},
    ArtistPayRecentStatus: {type: mongoose.Schema.Types.ObjectId, ref: 'PaymentStatus'},
    BuyerPayRecentStatus: {type: mongoose.Schema.Types.ObjectId, ref: 'PaymentStatus'},
    ArtistPayRecentDate: {type: Date},
    BuyerPayRecentDate: {type: Date},
    ArtistPaidChangeLog: [ArtistPaidChangeLog],
    BuyerPaidChangeLog: [BuyerPaidChangeLog],
    BuyerPayRecentRegistration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration'},
    BuyerPayRecentUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    ArtistPayRecentRegistration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration'},
    ArtistPayRecentUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    /*Follow/Following Start*/
    Contestant: { type: mongoose.Schema.Types.ObjectId, ref: 'Contestant', index: true},
    ArtistId: {type: Number, index: true}
    /*
    Images: [{
        'Original': {
            url: String,
            id: { type: mongoose.Schema.Types.ObjectId, ref: 'Media' }
        },
        'Thumbnail': {
            url: String,
            id: { type: mongoose.Schema.Types.ObjectId, ref: 'Media' }
        },
        'Compressed': {
            url: String,
            id: { type: mongoose.Schema.Types.ObjectId, ref: 'Media' }
        }
    }],
    Videos: [{
        'Original': {
            url: String,
            id: { type: mongoose.Schema.Types.ObjectId, ref: 'Media' }
        },
    }],
    Follow/Following End*/
}, { timestamps: true });

const LotModel = mongoose.model<LotDocument>('Lot', LotSchema);
export default LotModel;