import { PreferenceDocument } from '../server/src/models/Preference';

declare interface CommonRegistrationDto {
    RegistrationId: string;
    _id: any;
    FirstName: string;
    LastName: string;
    Email: string;
    PhoneNumber: string;
    Hash: String;
    DisplayPhone: String;
    VoteUrl: String;
    PeopleUrl?: String;
    AlreadyRegistered: boolean;
    VoteFactor: number;
    ErrorMessage: string;
    RegionCode: string;
    RegionImage: string;
    Preferences: PreferenceDocument[];
    NickName: string;
    Status: string;
    HasVoted: number;
    VoteCount: number[];
    ArtBattleNews: boolean;
    NotificationEmails: boolean;
    LoyaltyOffers: boolean;
}

export default CommonRegistrationDto;