import CountryDTO from './CountryDTO';
import { RoundArtistsInterface } from './ArtistImageDTO';

export interface ArtistProfileDTO {
    AdminNotes: string;
    AdminBio: string;
    Name: string;
    ParsedName: {
        firstName: string;
        lastName: string;
    };
    CityText: string;
    ArtistInEvents: {
        EventId: any;
        EID: string;
        Country: CountryDTO;
        Name: string;
        roundWiseImages: RoundArtistsInterface[];
        UserVoteHash?: string;
        EventStartDateTime: string;
    }[];
    IsFollowing: boolean;
    Bio: string;
    Instagram: string;
    Images: string[];
    Website: string;
    FollowersCount: number;
    Score: number;
    WooProducts: WooProduct[];
}

export interface WooProduct {
    description: string;
    permalink: string;
    name: string;
    purchasable: boolean;
    images: {
        src: string;
        name: string;
    }[];
    price: string;
}