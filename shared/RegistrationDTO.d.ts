import { PreferenceDocument } from '../server/src/models/Preference';
import ArtistAppsDTO from './ArtistAppsDTO';
import ContestantDTO from './ContestantDTO';

declare interface RegistrationDTO {
    _id: any;
    FirstName: string;
    LastName: string;
    NickName?: string;
    Email: string;
    PhoneNumber: string;
    Hash: String;
    DisplayPhone: String;
    RegionCode: string;
    VerificationCode?: number;
    VerificationCodeExp?: Date;
    SelfRegistered?: boolean;
    DeviceTokens?: string[];
    Preferences: PreferenceDocument[];
    ArtBattleNews: boolean;
    NotificationEmails: boolean;
    LoyaltyOffers: boolean;
    AndroidDeviceTokens?: string[];
    ArtistProfile?: ArtistAppsDTO;
    IsArtist?: boolean;
    lastPromoSentAt?: Date;
    Location?: {
        coordinates: number[],
        type?: string;
    };
    Artist?: ContestantDTO;
    RegisteredAt: string;
}

export default RegistrationDTO;