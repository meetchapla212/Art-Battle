export declare interface RegistrationLogDTO {
    _id: any;
    event_id: string;
    EventName: string;
    FirstName: string;
    LastName: string;
    Email: string;
    PhoneNumber: string;
    AlreadyRegisteredForEvent: Boolean;
    NumberExists: Boolean;
    EventId: String;
    createdAt: Date;
    PhoneNumberHash: String;
    DisplayPhone: String;
    VoteUrl: String;
    AuctionUrl: string;
    Status: string;
    RegisteredAt: string;
}

export default RegistrationLogDTO;