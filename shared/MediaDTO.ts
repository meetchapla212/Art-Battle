import RegistrationDTO from './RegistrationDTO';

declare interface MediaDTO {
    _id: any;
    Name: String;
    Url: string;
    Dimension?: {
        width: number,
        height: number
    };
    Size: Number;
    Thumbnails?: MediaDTO[];
    UploadedBy?: RegistrationDTO;
    UploadStart?: Date;
    UploadFinish?: Date;
    CompressionStart?: Date;
    CompressionFinish?: Date;
    ResizeStart?: Date;
    ResizeEnd?: Date;
    Type: String;
    Optimized?: MediaDTO;
    FileType: String;
}

export default MediaDTO;