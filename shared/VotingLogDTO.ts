import RegistrationDTO from "./RegistrationDTO";
import ContestantDTO from "./ContestantDTO";
import LotDTO from "./LotDTO";

export declare interface VotingLogDTO {
    _id: any;
    PhoneNumber: string;
    EventName: string;
    ArtistName: string;
    Status: string;
    RoundNumber: number;
    EaselNumber: number;
    EventId: String;
    createdAt: Date;
    DisplayPhone: String;
    PhoneHash: String;
    VoteChannel: {
        Channel: String,
        Type: String
    };
    /*Follow/Following Start*/
    Registration: RegistrationDTO;
    Contestant: ContestantDTO;
    Lot: LotDTO;
    /*Follow/Following End*/
}

export default VotingLogDTO;