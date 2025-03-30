import RegistrationDTO from './RegistrationDTO';
import { CityDTO } from './CityDTO';
import CountryDTO from './CountryDTO';
import { RoundArtistsInterface } from './ArtistImageDTO';
import { ArtistWooCommerceDTO } from './ArtistWooCommerceDTO';

export interface MinimalContestantDTO {
    oldId?: string;
    _id: string;
    Name: string;
    EntryId: number;
}

export declare interface ContestantDTO extends MinimalContestantDTO {
    _id: any;
    Name: string;
    Registration?: RegistrationDTO;
    CityText: string;
    Email: string;
    Website: string;
    EntryId: number;
    PhoneNumber: string;
    City: CityDTO;
    ChildContestants: ContestantDTO[];
    IsDuplicate: boolean;
    Followers?: RegistrationDTO[];
    FollowersCount?: number;
    VotesCount?: number;
    Score?: number;
    Videos?: string[];
    WooProducts?: ArtistWooCommerceDTO[];
}

export declare interface EventContestantDTO extends ContestantDTO {
}

export declare interface ArtistProfileResponseDto {
    Name: string;
    ParsedName: {
        firstName: string;
        lastName: string;
    };
    CityText: string;
    EntryId: number;
    ArtistInEvents: ArtistInEvent[];
    IsFollowing: boolean;
}

export declare interface ArtistInEvent {
    EventId: any;
    EID: string;
    Country: CountryDTO;
    Name: string;
    roundWiseImages: RoundArtistsInterface[];
    UserVoteHash?: string;
    EventStartDateTime: string;
}
export default ContestantDTO;
