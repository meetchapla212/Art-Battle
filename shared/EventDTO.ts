import RegistrationDTO from './RegistrationDTO';
import { RoundDTO, RoundConfigDTO } from './RoundDTO';
import { EventContestantDTO } from './ContestantDTO';
import { RoundResultDTO } from './RoundContestantDTO';
import CountryDTO from './CountryDTO';
import TimezoneDTO from './TimezoneDTO';
import { PreferenceDocument } from '../server/src/models/Preference';
import MediaDTO from './MediaDTO';
import { CityDTO } from './CityDTO';

export declare interface  ReportLink {
    label: String;
    link: String;
}

export declare interface  Logs {
    Message: String;
    CreatedDate: Date;
}

export declare interface EventConfigDTO {
    _id: any;
    Name: string;
    EID: string;
    Enabled: boolean;
    Contestants: EventContestantDTO[];
    Rounds: RoundConfigDTO[];
    PhoneNumber?: string;
    CurrentRound: RoundConfigDTO;
    RegistrationConfirmationMessage: string;
    ReportLinks: ReportLink[];
    Logs: Logs[];
    RegistrationsVoteFactor: {
        RegistrationId: any,
        VoteFactor: number,
        VoteFactorInfo: {
            Type: String,
            Value: String
        },
        PhoneNumber: string
        Hash: String,
        VoteUrl: String,
        AuctionUrl: string,
        Email: string;
        RegionCode: string;
        From?: string;
        NickName?: string;
        Preferences?: PreferenceDocument[],
        Status: string;
    }[];
    VoteByLink: boolean;
    Description: string;
    SendLinkToGuests: boolean;
    SendAuctionLinkToGuests: boolean;
    EmailRegistration: boolean;
    Country: CountryDTO;
    EventStartDateTime: string;
    EventEndDateTime: string;
    TimeZone: TimezoneDTO;
    TimeZoneOffset?: string;
    TimeZoneICANN?: string;
    TicketLink: string;
    Venue: string;
    Price: string;
    ShowInApp: boolean;
    EnableAuction: boolean;
    RegisterAtSMSVote: boolean;
    Currency: CountryDTO;
    ArtWidthHeight: string;
    AuctionDescription: string;
    AuctionStartBid: number;
    MinBidIncrement: number;
    AuctionNotice: string;
    AdminControlInAuctionPage: boolean;
    Tax: number;
    SponsorLogo?: MediaDTO;
    SponsorText: string;
    SlackChannel?: string;
    City?: CityDTO;
    AuctionCloseStartsAt?: Date;
    LiveStream: string;
    VideoStream: string;
    AuctionCloseRoundDelay: number;
}

export declare interface EventDTO extends EventConfigDTO {
    Registrations: RegistrationDTO[];
    Contestants: EventContestantDTO[];
    Rounds: RoundDTO[];
    CurrentRound: RoundDTO;
}

export declare interface UserEventDTO extends EventDTO {
   VoteUrl?: string;
}

export declare interface Series {
    name: String;
    data: Number[][];
    type: String;
}

export declare interface EventResultDTO {
    Name: string;
    rounds: RoundResultDTO[];
    RegistrationCount: number;
    Logs: Logs[];
    // PastVoterCount: number;
    // NewVoterCount: number;
    // NewVoterPercentage: number;
    EID: string;
    EnableAuction: boolean;
    AuctionCloseStartsAt: Date;
    AutoCloseOn: boolean;
    AllUsers: number;
    DoorUsers: number;
    OnlineUsers: number;
    TopOnlineUsers: number;
}

export declare interface EventHomeDto {
    _id: any;
    Name: string;
    PhoneNumber: string;
    Rounds: RoundHomeDto[];
    CurrentRound: RoundHomeDto;
    Enabled: boolean;
    countryFlag: string;
}

export declare interface RoundHomeDto {
    RoundNumber: number;
    IsFinished: boolean;
}

export declare interface EventPromotionDTO {
    _id: any;
    Name: string;
    Tittle: string;
}
export default EventDTO;