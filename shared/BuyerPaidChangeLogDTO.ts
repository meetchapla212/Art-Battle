import RegistrationDTO from './RegistrationDTO';
import UserDTO from './UserDTO';
import PaymentStatusDTO from './PaymentStatusDTO';

declare interface BuyerPaidChangeLogDTO {
    Registration?: RegistrationDTO;
    User?: UserDTO;
    createdAt: Date;
    PaidStatus: PaymentStatusDTO;
    Buyer: RegistrationDTO;
}

export default BuyerPaidChangeLogDTO;