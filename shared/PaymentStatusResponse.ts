import { BidDTO } from './BidDTO';
import { ArtistIndividualImage } from './RoundContestantDTO';
import PaymentStatusDTO from './PaymentStatusDTO';

export interface PaymentStatusResponse {
    LotId: string;
    ArtistName: string;
    ArtistId: string;
    Bids: BidDTO[];
    EventName: string;
    ArtId: string;
    ArtistPayRecentStatus: PaymentStatusDTO;
    BuyerPayRecentStatus: PaymentStatusDTO;
    Image: ArtistIndividualImage;
    BuyerPayRecentDate: Date;
    ArtistPayRecentDate: Date;
    BuyerPayRecentUser: string;
    ArtistPayRecentUser: string;
    CurrencySymbol: string;
}

export interface BuyerPaidResponse {
    BuyerPayRecentDate: Date;
    BuyerPayRecentUser: string;
}

export interface ArtistPaidResponse {
    ArtistPayRecentDate: Date;
    ArtistPayRecentUser: string;
}