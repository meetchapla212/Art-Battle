import { PreferenceDocument } from '../server/src/models/Preference';
import { RegistrationVoteFactorDTO } from './RoundContestantDTO';

export interface RegistrationsResponse {
    RegionImage: String;
    PhoneNumber: string;
    VoteFactor: Number;
    VoteUrl: String;
    PeopleUrl: String;
    Hash: String;
    Email: String;
    NickName: String;
    Preferences: PreferenceDocument[];
    Status: string;
    Id: String;
    HasVoted: number;
    VoteCount: number[];
    userVoteFactor?: RegistrationVoteFactorDTO;
}

export interface RegistrationStatusResponse {
    StatusIndex: number;
    Status: string;
}