import ArtistImageDTO from '../../../shared/ArtistImageDTO';

export declare interface ArtistDto {
    Images: ArtistImageClientDto[];
    Name: string[];
    OriginalName: string[];
    EaselNumber: number;
    id: any;
    IsWinner: number;
    EnableAuction: number;
}

export declare interface ArtistImageClientDto extends ArtistImageDTO {
    rawImage?: string;
    serverUrl?: string;
    uploading?: number;
}[];