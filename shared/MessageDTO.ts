import UserDTO from './UserDTO';
import RegistrationDTO from './RegistrationDTO';
import EventPhoneNumberDTO from './EventPhoneNumberDTO';

declare interface MessageDTO {
    _id: any;
    Message: string;
    ServerUser?: UserDTO;
    ServerRegistration?: RegistrationDTO;
    ServerNumber: string;
    ServerNumberDoc: EventPhoneNumberDTO;
    ClientPhoneNumber: string;
    ClientRegistration: RegistrationDTO;
    createdAt?: Date;
    updatedAt: Date;
    Status: number;
    Channel: string;
}

export default MessageDTO;