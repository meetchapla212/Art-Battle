import RegistrationDTO from './RegistrationDTO';
import UserDTO from './UserDTO';
import PaymentStatusDTO from './PaymentStatusDTO';
import ContestantDTO from './ContestantDTO';

declare interface ArtistPaidChangeLogDTO {
    Registration?: RegistrationDTO;
    User?: UserDTO;
    createdAt: Date;
    PaidStatus: PaymentStatusDTO;
    Artist: ContestantDTO;
}

export default ArtistPaidChangeLogDTO;