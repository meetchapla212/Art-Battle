import { ArtistIndividualImage } from './RoundContestantDTO';

export interface ArtistListDTO {
    _id: any;
    Link: string;
    Name: string;
    Images: ArtistIndividualImage[];
}

export interface ArtistListV2 extends ArtistListDTO {
    FollowersCount: number;
    VotesCount: number;
    Score: number;
}