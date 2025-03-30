import ArtistImageDTO, { ImageUrlDTO } from '../../../shared/ArtistImageDTO';
import { ArtistVideoDto } from '../../../shared/RoundContestantDTO';

export declare interface ArtistDto {
    Images: ArtistImageClientDto[];
    Videos: ArtistVideoClientDto[];
    Combined: ArtistCombinedClientDto[];
    Name: string[];
    OriginalName: string[];
    EaselNumber: number;
    ArtistId: any;
    id: any;
    IsWinner: number;
    EnableAuction: number;
}

export declare interface ArtistImageClientDto extends ArtistImageDTO {
    rawImage?: string;
    serverUrl?: string;
    uploading?: number;
}

export declare interface ArtistVideoClientDto extends ArtistVideoDto {}

export declare interface ArtistCombinedClientDto extends ArtistVideoDto, ArtistImageDTO {
    'FileType'?: string;
}