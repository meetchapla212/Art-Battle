import { ArtistIndividualImage } from './RoundContestantDTO';
import { BidDTO } from './BidDTO';

export interface LotResponseInterface {
    _id: any;
    ArtistName: string;
    UserName: string;
    SelectArtIndex: number;
    Arts: ArtistIndividualImage[];
    TopNBids: BidDTO[];
    Status: number;
    EventName: string;
    isAdmin: boolean;
    Description: string;
    WidthAndHeight: string;
    CurrencySymbol: string;
    TotalBids: number;
}