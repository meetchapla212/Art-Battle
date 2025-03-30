import EventDTO, { UserEventDTO } from './EventDTO';
import RoundContestantDTO from './RoundContestantDTO';
import CountryDTO from './CountryDTO';

export interface TopEventDTO {
    _id: string;
    Name: string;
    EID: string;
    Rounds: {
        RoundNumber: number;
        Contestants: TopEventRoundContestantDTO[];
    }[];
}

export interface TopEventRoundContestantDTO extends RoundContestantDTO {
    AuctionStartBid?: number;
    MinBidIncrement?: number;
    AuctionNotice?: string;
    Currency?: CountryDTO;
    Country?: CountryDTO;
    BidCount?: number;
}

export interface EventsInAuction {
    eventsArr: UserEventDTO[];
    topEventIndex: number;
    topRoundIndex: number;
    topArtistIndex: number;
    topEventsArr: TopEventDTO[];
}