import { ArtistIndividualImage } from './RoundContestantDTO';
import RequestQueueDTO from './RequestQueueDTO';
import { ArtistDto } from '../client/src/Voting/ArtistInterface';

export declare interface ImageUrlDTO {
    url: string;
    id: any;
}

declare interface ArtistImageDto {
    'Original': ImageUrlDTO;
    'Thumbnail'?: ImageUrlDTO;
    'Compressed'?: ImageUrlDTO;
    'Edited'?: ImageUrlDTO;
    'ArtId': string;
}

export declare interface MediaSpecDTO {
    url: string;
    id: any;
}

export default ArtistImageDto;

export interface IndividualArtistImages {
    EaselNumber: number;
    Name: string[];
    id: string;
    Images: ArtistIndividualImage[];
    IsWinner?: number;
    OriginalName: string[];
    EnableAuction: number;
    HasVoted?: boolean;
    ArtistId: string;
}

export interface ArtistsInImages {
    artists: ArtistDto[];
    hasImages: boolean;
}

export interface RoundArtistsInterface {
    EventId: any;
    EID: string;
    VoterHash?: string;
    RoundNumber: any;
    Artists: ArtistDto[];
    IsCurrentRound: boolean;
    HasOpenRound: boolean;
    IsActive?: boolean;
    uploadCb?: (rq: RequestQueueDTO) => void;
    HasImages: boolean;
    EnableAuction: boolean;
    HasVoted?: boolean;
}

export interface EventViewResponse {
    roundWiseImages: RoundArtistsInterface[];
    CurrentRoundNumber: Number;
}