import ContestantDTO from './ContestantDTO';

export declare interface ArtistWooCommerceDTO {
    _id: any;
    ArtistId: string;
    ProductId: string;
    Confirmation: string;
    createdAt?: Date;
    updatedAt?: Date;
    Description?: string;
    Permalink?: string;
    Name?: string;
    Purchasable?: boolean;
    Images?: [{
        'id': number;
        'date_created': string;
        'date_created_gmt': string;
        'date_modified': string;
        'date_modified_gmt': string;
        'src': string;
        'name': string;
        'alt': string;
    }];
    Price?: string;
    Contestant?: ContestantDTO;
}

export declare interface ArtistProductCacheDTO {
    _id: any;
    Name: string;
    Products: {[key: string]: ArtistWooCommerceDTO};
}