import EventDTO from './EventDTO';
import EventPhoneNumberInterface from './EventPhoneNumberDTO';

export declare interface PromotionLogsInterface {
    _id: any;
   event: string;
   lots: string;
   registration: string;
   phone: string;
   notifySMS: boolean;
   notifyiOS: boolean;
   notifyAndroid: boolean;
   Status: number;
   message: string;
   createdAt?: Date;
   updatedAt: Date;
}

export declare interface PromotionLogsDataInterface {
    _id: any;
   count: number;
   email: string;
   nickname: string;
   phonenumber: string;
}


export default PromotionLogsInterface;