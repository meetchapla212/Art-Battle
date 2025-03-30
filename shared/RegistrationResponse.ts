import { RegistrationVoteFactorDTO } from './RoundContestantDTO';

export interface RegistrationResponseDTO extends RegistrationVoteFactorDTO {
    AlreadyRegistered: Boolean;
    RegisteredInMultipleActiveEvent: Number;
    Email: string;
    RegionCode: string;
    RegionImage: String;
    RegionImagePng: String;
    VerificationCode?: number;
    VerificationCodeExp?: Date;
    ServerPhoneNumber?: String;
    NickName: string;
    Verified: boolean;
    JWT?: String;
    userVoteFactor?: RegistrationVoteFactorDTO;
    From?: string;
}