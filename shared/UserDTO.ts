export declare interface AuthToken {
    accessToken: string;
    kind: string;
  }

export declare interface UserProfileDTO {
    name: string;
    gender: string;
    location: string;
    website: string;
    picture: string;
}

export declare interface UserDTO {
    email: string;
    password: string;
    passwordResetToken: string;
    passwordResetExpires: Date;

    isAdmin: boolean;

    facebook: string;
    tokens: AuthToken[];

    profile: UserProfileDTO;
}

export default UserDTO;