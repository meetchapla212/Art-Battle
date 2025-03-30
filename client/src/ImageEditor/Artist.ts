import { ArtistDto } from './ArtistInterface';
import ArtistImage from './ArtistImage';
import RequestQueueDTO from '../../../shared/RequestQueueDTO';

export class Artist {
    public Images: KnockoutObservableArray<ArtistImage> = ko.observableArray<ArtistImage>();
    public Name: string[];
    public EaselNumber: number;
    public id: any;
    public EventId: any;
    public RoundNumber: number;
    public uploadCb: (rq: RequestQueueDTO) => void;
    public showDialog: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public EID: string;

    public constructor(dto: ArtistDto, EventId: any, RoundNumber: number, uploadCb: (rq: RequestQueueDTO) => void) {
        this.Name = dto.Name;
        this.EaselNumber = dto.EaselNumber;
        this.id = dto.id;
        this.EventId = EventId;
        this.RoundNumber = RoundNumber;
        this.uploadCb = uploadCb;
        for (let i = 0; i < dto.Images.length; i++) {
            this.Images().unshift(new ArtistImage(dto.Images[i], this.id, this.EaselNumber, this.EventId, this.RoundNumber, false, uploadCb, i));
        }
        this.showDialog = ko.observable(false);
        // @ts-ignore comes from html
        this.EID = EID;
    }

    public fileUpload(Artist: Artist, e: Event) {
        e.preventDefault();
        const file    = (<HTMLInputElement>e.target).files[0];
        const reader  = new FileReader();
        const me = this;
        reader.onloadend = function (onloadend_e) {
            // base 64 file
            const result = reader.result;
            const artistImage = new ArtistImage({
                ArtId: `${me.EID}-${me.RoundNumber}-${me.EaselNumber}`,
                Thumbnail: {
                    url: result.toString(),
                    id: ''
                },
                Original: {
                    url: result.toString(),
                    id: ''
                },
                Compressed: {
                    url: result.toString(),
                    id: ''
                }
            }, me.id, me.EaselNumber, me.EventId, me.RoundNumber, true, me.uploadCb, 0);
            Artist.Images.unshift(artistImage);
        };

        reader.onabort = function () {
            alert('Upload aborted');
        };

        interface CustomErrorEvent extends ErrorEvent {
            code: number;
            NOT_FOUND_ERR: number;
            NOT_READABLE_ERR: number;
            ABORT_ERR: number;
            SECURITY_ERR: number;
            ENCODING_ERR: number;
        }
        interface CustomEventTarget extends EventTarget {
            error: CustomErrorEvent;
        }
        interface CustomErrorEvent extends ProgressEvent {
            target: CustomEventTarget;
        }
        reader.onerror = function (e: CustomErrorEvent) {
            let message = '';
            switch (e.target.error.code) {
                case e.target.error.NOT_FOUND_ERR:
                    message = 'File not found!';
                    break;
                case e.target.error.NOT_READABLE_ERR:
                    message = 'File not readable!';
                    break;

                case e.target.error.ABORT_ERR:
                    message = 'Read operation was aborted!';
                    break;

                case e.target.error.SECURITY_ERR:
                    message = 'File is in a locked state!';
                    break;

                case e.target.error.ENCODING_ERR:
                    message = 'The file is too long to encode in a "data://" URL.';
                    break;
                default:
                    message = 'Read error.';
            }
            alert(message);
        };

        if (file) {
            reader.readAsDataURL(file);
        } else {
            alert('no file');
        }
    }
}

export default Artist;