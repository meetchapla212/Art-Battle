import RegistrationDTO from './RegistrationDTO';
import { BidDTO } from './BidDTO';
import ArtistPaidChangeLogDTO from './ArtistPaidChangeLogDTO';
import PaymentStatusDTO from './PaymentStatusDTO';
import BuyerPaidChangeLogDTO from './BuyerPaidChangeLogDTO';
import UserDTO from './UserDTO';
import ContestantDTO from './ContestantDTO';
import { EventDocument } from '../server/src/models/Event';

declare interface LotDTO {
    _id: any;
   ArtId: string;
   EaselNumber: number;
   Event: EventDocument;
   Round: Number;
   Bids: BidDTO[];
   Winner?: RegistrationDTO;
   WinningBidAmount?: number;
   Status: number;
   updatedAt?: string;
   Description: string;
   WidthAndHeight: string;
   ArtistPayRecentStatus?: PaymentStatusDTO;
   BuyerPayRecentStatus?: PaymentStatusDTO;
   ArtistPayRecentDate?: Date;
   BuyerPayRecentDate?: Date;
   ArtistPaidChangeLog?: ArtistPaidChangeLogDTO[];
   BuyerPaidChangeLog?: BuyerPaidChangeLogDTO[];
   BuyerPayRecentRegistration: RegistrationDTO;
   BuyerPayRecentUser: UserDTO;
   ArtistPayRecentRegistration: RegistrationDTO;
   ArtistPayRecentUser: UserDTO;
   /*Follow/Following Start
   Images: ArtistIndividualImage[];
   Videos: ArtistIndividualVideo[];
   Follow/Following End*/
   Contestant: ContestantDTO;
   ArtistId: number;
}

export default LotDTO;