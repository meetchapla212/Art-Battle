import EventDTO from './EventDTO';
import UserDTO from './UserDTO';

declare interface AnnouncementDto {
    _id: any;
    announcements: {
        event: EventDTO;
        createdBy: UserDTO;
    }[];
    firedTimes: number;
    message: String;
}

export default AnnouncementDto;