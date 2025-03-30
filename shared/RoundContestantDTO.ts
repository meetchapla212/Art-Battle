import { ContestantDTO } from './ContestantDTO';
import RegistrationDTO from './RegistrationDTO';
import Contestant from '../client/src/VoteResults/Contestant';
import LotDTO from './LotDTO';
import ArtistImageDto, { ImageUrlDTO } from './ArtistImageDTO';
import { PreferenceDocument } from '../server/src/models/Preference';

export declare interface RoundContestantConfigDTO {
    _id: any;
    Detail: ContestantDTO;
    Enabled: boolean;
    EaselNumber: number;
    IsWinner: number;
    EnableAuction: number;
    LastBidPrice?: number;
}

export declare interface RegistrationVoteFactorDTO {
    RegistrationId: any;
    VoteFactor: number;
    PhoneNumber: string;
    VoteFactorInfo: {
        Type: String,
        Value: String
    };
    Hash: String;
    VoteUrl: String;
    AuctionUrl: string;
    Email: string;
    RegionCode: string;
    Status: string;
    From?: string;
    NickName?: string;
    Preferences?: PreferenceDocument[];
}

export declare interface RoundContestantDTO extends RoundContestantConfigDTO {
    Votes: RegistrationDTO[];
    VotesDetail: RegistrationVoteFactorDTO[];
    Images: ArtistIndividualImage[];
    Videos?: ArtistIndividualVideo[];
    Lot?: LotDTO;
    LastBidPrice?: number;
    ArtId?: string;
    Registration?: RegistrationDTO;
    BidCount?: number;
}

export declare interface ArtistIndividualImage {
    Edited?: {
        url: string;
        id: string;
    };
    'Original': {
        url: string;
        id: any;
    };
    'Thumbnail'?: {
        url: string;
        id: any;
    };
    'Compressed'?: {
        url: string;
        id: any;
    };
    'ArtId': string;
}

export declare interface ArtistIndividualVideo extends ArtistIndividualImage {}

export declare interface ArtistVideoDto {
    'Original': ImageUrlDTO;
    'ArtId': string;
}

export declare interface RoundContestantResultDto {
    _id: any;
    EaselNumber: number;
    Name: String;
    Votes: number;
    VotesDetail: RegistrationVoteFactorDTO[];
    Enabled: boolean;
    TotalVotes: number;
    IsWinner: number;
    EnableAuction: number;
    NumBids: number;
    TopBidAndTime: string;
    Lot?: LotDTO;
    LatestImage: ArtistImageDto;
    LatestVideo: ArtistVideoDto;
    Link: string;
    PeopleUrl?: string;
}

export declare interface RoundResultDTO {
    Experience: number;
    IsCurrentRound: Boolean;
    RoundNumber: Number;
    IsFinished: Boolean;
    VotesCast: number;
    Contestants: RoundContestantResultDto[];
    AuctionContestants: RoundContestantResultDto[];
    TotalVotes: number;
}

export declare interface RoundResultV2DTO {
    Experience: number;
    IsCurrentRound: Boolean;
    RoundNumber: Number;
    IsFinished: Boolean;
    VotesCast: number;
    TotalVotes: number;
    Contestants: Contestant[];
    AuctionContestants: Contestant[];
}

export default RoundContestantDTO;