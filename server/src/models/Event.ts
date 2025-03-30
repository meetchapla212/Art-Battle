import * as mongoose from 'mongoose';

import EventDTO from '../../../shared/EventDTO';
import { PreferenceSchema } from './Preference';
import RoundDTO from '../../../shared/RoundDTO';
import RoundContestantDTO, {
    ArtistIndividualImage, ArtistIndividualVideo,
    RegistrationVoteFactorDTO
} from '../../../shared/RoundContestantDTO';
import RegistrationDTO from '../../../shared/RegistrationDTO';
import LotDTO from '../../../shared/LotDTO';
import { ContestantDTO } from '../../../shared/ContestantDTO';
import { parseFromTimeZone } from 'date-fns-timezone';


export interface EventDocument extends EventDTO, mongoose.Document {
    hasVoted(phoneNumber: string, round?: RoundDTO): boolean | RoundContestantDTO;
    edit(dto: EventDTO): void;
}

const RoundContestantSchema: mongoose.Schema = new mongoose.Schema({
    Detail: { type: mongoose.Schema.Types.ObjectId, ref: 'Contestant'},
    Registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
    Enabled: Boolean,
    IsWinner: Number,
    EnableAuction: Number,
    EaselNumber: Number,
    VotesDetail: [{
        RegistrationId: String,
        VoteFactor: Number,
        PhoneNumber: String,
        VoteFactorInfo: {
            Type: String,
            Value: String
        },
        Hash: String
    }],
    Votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Registration'}],
    VoteByLink: Boolean,
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
    Lot: { type: mongoose.Schema.Types.ObjectId, ref: 'Lot'}
});

const RoundSchema: mongoose.Schema = new mongoose.Schema({
    RoundNumber: Number,
    Contestants: [RoundContestantSchema],
    IsFinished: { type: Boolean, default: false },
    VideoUrl: String
});

const RegistrationVoterSchema: mongoose.Schema = new mongoose.Schema({
    RegistrationId: {type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
    VoteFactor: Number,
    PhoneNumber: String,
    VoteFactorInfo: {
        Type: String,
        Value: String
    },
    Hash: String,
    VoteUrl: String,
    Email: String,
    RegionCode: String,
    From: String,
    NickName: String,
    Preferences: [PreferenceSchema],
    Status: String,
    AuctionLink: String,
    AuctionUrl: String
});

const EventSchema: mongoose.Schema = new mongoose.Schema({
    Name: { type: String, unique: true, index: true },
    EID: { type: String, unique: true, sparse: true, index: true},
    Description: { type: String },
    Contestants: [{type: mongoose.Schema.Types.ObjectId, ref: 'Contestant'}],
    Rounds: [RoundSchema],
    PhoneNumber: String,
    Registrations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Registration' }],
    CurrentRound: RoundSchema,
    Enabled: {type: Boolean, index: true},
    RegistrationConfirmationMessage: String,
    Logs: [{
        Message: String,
        CreatedDate: Date
    }],
    RegistrationsVoteFactor: [RegistrationVoterSchema],
    VoteByLink: Boolean,
    SendLinkToGuests: Boolean,
    EmailRegistration: Boolean,
    Country: {type: mongoose.Schema.Types.ObjectId, ref: 'Country' },
    EventStartDateTime: {type: Date, index: true},
    EventEndDateTime: Date,
    TimeZone: {type: mongoose.Schema.Types.ObjectId, ref: 'Timezone' },
    TimeZoneOffset: String,
    TimeZoneICANN: String,
    TicketLink: String,
    Price: String,
    Venue: String,
    ShowInApp: { type: Boolean, index: true},
    Currency: {type: mongoose.Schema.Types.ObjectId, ref: 'Country' },
    ArtWidthHeight: String,
    AuctionDescription: String,
    AuctionStartBid: Number,
    MinBidIncrement: Number,
    AuctionNotice: String,
    EnableAuction: Boolean,
    Tax: Number,
    AdminControlInAuctionPage: Boolean,
    RegisterAtSMSVote: Boolean,
    SponsorLogo: {type: mongoose.Schema.Types.ObjectId, ref: 'Media' },
    SponsorText: String,
    SendAuctionLinkToGuests: Boolean,
    City: { type: mongoose.Schema.Types.ObjectId, ref: 'City' },
    SlackChannel: String,
    AuctionCloseStartsAt: Date,
    VideoStream: String,
    LiveStream: String,
    AuctionCloseRoundDelay: Number
}, { timestamps: true });

EventSchema.methods.hasVoted = function(phoneNumber: string, selectedRound?: RoundDTO): RoundContestantDTO | boolean {
    const thisEvent = (<EventDocument>this);
    const checkVotedInRound = (round: RoundDTO) => {
        for (let i = 0; i < round.Contestants.length; i++) {
            const contestant = round.Contestants[i];
            for (let j = 0; j < contestant.Votes.length; j++) {
                const voter = contestant.Votes[j];
                if (voter.PhoneNumber === phoneNumber || voter.Email === phoneNumber) {
                    return contestant;
                }
            }
        }
        return false;
    };
    if (selectedRound) {
        return checkVotedInRound(selectedRound);
    } else {
        return checkVotedInRound(thisEvent.CurrentRound);
    }
};

EventSchema.methods.edit = function(dto: EventDTO): void {
    const thisEvent = (<EventDocument>this);
    const auctionStartTime = parseFromTimeZone(dto.AuctionCloseStartsAt.toString(), 'M/D/Y HH:mm A', { timeZone: dto.TimeZoneICANN });
    dto.AuctionCloseStartsAt = auctionStartTime;
    thisEvent.Name = dto.Name;
    thisEvent.EID = dto.EID;
    thisEvent.Description = dto.Description;
    thisEvent.PhoneNumber = dto.PhoneNumber && dto.PhoneNumber.trim(); // phone number is optional
    thisEvent.Contestants = dto.Contestants;
    thisEvent.Country = dto.Country;
    thisEvent.EventStartDateTime = dto.EventStartDateTime;
    thisEvent.AuctionCloseStartsAt = dto.AuctionCloseStartsAt;
    thisEvent.EventEndDateTime = dto.EventEndDateTime;
    thisEvent.TimeZone = dto.TimeZone;
    thisEvent.TimeZoneOffset = dto.TimeZoneOffset;
    thisEvent.RegistrationConfirmationMessage = dto.RegistrationConfirmationMessage;
    thisEvent.Enabled = dto.Enabled;
    thisEvent.VoteByLink = dto.VoteByLink;
    thisEvent.SendLinkToGuests = dto.SendLinkToGuests;
    thisEvent.EmailRegistration = dto.EmailRegistration;
    thisEvent.TimeZoneICANN = dto.TimeZoneICANN;
    thisEvent.TicketLink = dto.TicketLink;
    thisEvent.Venue = dto.Venue;
    thisEvent.Price = dto.Price;
    thisEvent.ShowInApp = dto.ShowInApp;
    thisEvent.Currency = dto.Currency;
    thisEvent.ArtWidthHeight = dto.ArtWidthHeight;
    thisEvent.AuctionDescription = dto.AuctionDescription;
    thisEvent.AuctionStartBid = dto.AuctionStartBid;
    thisEvent.MinBidIncrement = dto.MinBidIncrement;
    thisEvent.AuctionNotice = dto.AuctionNotice;
    thisEvent.EnableAuction = dto.EnableAuction;
    thisEvent.AdminControlInAuctionPage = dto.AdminControlInAuctionPage;
    thisEvent.RegisterAtSMSVote = dto.RegisterAtSMSVote;
    thisEvent.Tax = dto.Tax;
    thisEvent.SendAuctionLinkToGuests = dto.SendAuctionLinkToGuests;
    thisEvent.SponsorText = dto.SponsorText;
    thisEvent.LiveStream = dto.LiveStream;
    thisEvent.VideoStream = dto.VideoStream;
    thisEvent.AuctionCloseRoundDelay = dto.AuctionCloseRoundDelay;
    if (dto.SponsorLogo) {
        thisEvent.SponsorLogo = dto.SponsorLogo;
    }
    thisEvent.City = dto.City;
    thisEvent.SlackChannel = dto.SlackChannel;

    const roundIds = dto.Rounds.map(r => r._id);
    thisEvent.Rounds = thisEvent.Rounds.filter(r => roundIds.contains((<any>r).id));
    thisEvent.Rounds.forEach(r => {
        r.Contestants = updateRound(dto, r);
    });

    const currentRound = thisEvent.CurrentRound;
    if (currentRound) {
        currentRound.Contestants = updateRound(dto, currentRound);
    }

    const existingEventIds = thisEvent.Rounds.map(r => (<any>r).id);
    const newRounds = dto.Rounds.filter(rdto => !existingEventIds.contains(rdto._id));
    thisEvent.Rounds.addRange(newRounds);
};

function updateRound(dto: EventDTO, r: RoundDTO) {
    const roundDto = dto.Rounds.find(x => x._id == (<any>r).id); // new
    // add video URL in round
    r.VideoUrl = roundDto.VideoUrl;
    const newContestantMap: {[key: string]: RoundContestantDTO} = {};
    const oldContestantMap: {[key: string]: RoundContestantDTO} = {};
    for (let i = 0; i < roundDto.Contestants.length; i++ ) {
        // iterate on new contestants
        newContestantMap[roundDto.Contestants[i].Detail._id.toString()] = roundDto.Contestants[i];
    }
    const toRemoveExistingIndexes: number[] = [];
    for (let j = 0; j < r.Contestants.length; j++) {
        // iterate on old contestant
        oldContestantMap[r.Contestants[j].Detail._id.toString()] = r.Contestants[j];
        const contestantDto = newContestantMap[r.Contestants[j].Detail._id.toString()];
        if (contestantDto) {
            // assign new easel number to existing
            r.Contestants[j].EaselNumber = contestantDto.EaselNumber;
            // assign new enable/disable status to existing
            r.Contestants[j].Enabled = contestantDto.Enabled;
            // assign Lot
            r.Contestants[j].Lot = contestantDto.Lot;
        } else {
            // these elements removed/replaced in new update
            toRemoveExistingIndexes.push(j);
        }
    }

    const toRemoveNewIndexes: number[] = [];
    for (let i = 0; i < roundDto.Contestants.length; i++ ) {
        // iterate on new contestants
        if (roundDto.Contestants[i].Detail.oldId && roundDto.Contestants[i].Detail.oldId.length > 0
            && oldContestantMap[roundDto.Contestants[i].Detail.oldId.toString()]
        ) {
            const oldContestant = oldContestantMap[roundDto.Contestants[i].Detail.oldId.toString()];
            // copy data of old contestant here
            roundDto.Contestants[i].EaselNumber = oldContestant.EaselNumber;
            roundDto.Contestants[i].EnableAuction = oldContestant.EnableAuction;
            roundDto.Contestants[i].IsWinner = oldContestant.IsWinner;
            roundDto.Contestants[i].LastBidPrice = oldContestant.LastBidPrice;
            roundDto.Contestants[i].Votes = oldContestant.Votes;
            roundDto.Contestants[i].VotesDetail = oldContestant.VotesDetail;
            roundDto.Contestants[i].Images = oldContestant.Images;
            roundDto.Contestants[i].Videos = oldContestant.Videos;
            roundDto.Contestants[i].Lot = oldContestant.Lot;
            roundDto.Contestants[i].Registration = oldContestant.Registration;
        }
        if (oldContestantMap[roundDto.Contestants[i].Detail._id.toString()]) {
            // this contestant already exists in array, no need to add again
            toRemoveNewIndexes.push(i);
        }
    }
    // filter existing contestants
    r.Contestants = r.Contestants.filter((c, index) => {return toRemoveExistingIndexes.indexOf(index) === -1; });
    // filter new contestants
    const newContestants = roundDto.Contestants.filter((c, index) => {return toRemoveNewIndexes.indexOf(index) === -1; });
    // add new contestants
    r.Contestants.addRange(newContestants);
    return r.Contestants;
}

const EventModel = mongoose.model<EventDocument>('Event', EventSchema);
export default EventModel;