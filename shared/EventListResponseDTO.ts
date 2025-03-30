import ArtistImageDto from './ArtistImageDTO';
import MediaDTO from './MediaDTO';

export declare interface EventsInterface {
    title: String;
    flag: String;
    flagPng: String;
    statusText: String;
    statusColor: String;
    eventId: String;
    openVoting: boolean;
    openStatus: boolean;
    TicketLink: String;
    Venue: String;
    Price: String;
    Description: String;
    DataTimeRange: String;
    Votes: number;
    statusTextColor: String;
    EID: String;
    openAuctionCount?: number;
    winnerImage?: ArtistImageDto;
    winnerId?: any;
    winnerName?: string;
    sponsorLogo?: MediaDTO;
    EventNo?: number;
    sponsorText?: string;
    EnableAuction?: boolean;
    StreamUrl: string;
}

export declare interface EventList {
    label: String;
    items: EventsInterface[];
    topPlayerUrl: string;
}
