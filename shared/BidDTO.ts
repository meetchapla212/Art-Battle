import RegistrationDTO from './RegistrationDTO';

export declare interface BidDTO {
    _id: any;
    Amount: number;
    Registration: RegistrationDTO;
    createdAt: Date;
    IpAddress: string;
}