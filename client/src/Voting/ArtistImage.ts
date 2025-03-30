import { ArtistImageClientDto } from './ArtistInterface';
import * as ko from 'knockout';
import { BusyTracker } from '../Utils/BusyTracker';
import { Request } from '../Utils/GatewayFunctions';
import { DataOperationResult } from '../../../shared/OperationResult';
import { MediaSpecDTO } from '../../../shared/ArtistImageDTO';
import RequestQueueDTO from '../../../shared/RequestQueueDTO';
import VotingScreenViewModel from './VotingScreenViewModel';

export class ArtistImage {

    public rawImage: KnockoutObservable<string> = ko.observable<string>();
    public serverUrl: KnockoutObservable<string> = ko.observable<string>();
    public uploading: KnockoutObservable<number> = ko.observable<number>(-1);
    public EaselNumber: number;
    public ArtistId: any;
    public RoundNumber: number;
    public EventId: any;
    public VoterHash: string;
    public busy: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public ImageUpdater: BusyTracker = new BusyTracker();
    public ImageCss: KnockoutObservable<string> = ko.observable<string>();
    public Thumbnail: KnockoutObservable<MediaSpecDTO> = ko.observable<MediaSpecDTO>();
    public Compressed: KnockoutObservable<MediaSpecDTO> = ko.observable<MediaSpecDTO>();
    public Original: KnockoutObservable<MediaSpecDTO> = ko.observable<MediaSpecDTO>();
    public IsNew: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public uploadCb: (rq: RequestQueueDTO) => void;
    public vm: VotingScreenViewModel;

    public constructor(dto: ArtistImageClientDto, ArtistId: any, EaselNumber: number, EventId: any, RoundNumber: number, VoterHash: string, isNew: boolean, vm: VotingScreenViewModel) {
        this.rawImage(dto.rawImage);
        this.uploading(dto.uploading);
        this.ArtistId = ArtistId;
        this.EaselNumber = EaselNumber;
        this.EventId = EventId;
        this.RoundNumber = RoundNumber;
        this.VoterHash = VoterHash;
        this.Thumbnail(dto.Thumbnail);
        this.Original(dto.Original);
        this.Compressed(dto.Compressed);
        this.IsNew(isNew);
        this.vm = vm;

        if (this.IsNew()) {
            this._sync().catch(e => {
                alert(`sync error ${e.message}`);
                console.error(e);
            });
        }
    }

    private async _sync() {
        const dto = this.ToDTO();
        const time = new Date().getTime();
        try {
            this.busy(true); // image is uploading
            this.busy.notifySubscribers();
            if (this.uploadCb) {
                this.uploadCb({
                    Progress: 0,
                    ImageId:  time
                });
            }

            const result = await  this.ImageUpdater.AddOperation(Request<DataOperationResult<ArtistImageClientDto>>(
                // @ts-ignore
                `${mp}/api/gallery/${this.EventId}/round/${this.RoundNumber}/artist/${this.ArtistId}/hash/${this.VoterHash}`,
                'PUT',
                dto,
                (percentage) => {
                    if (this.uploadCb) {
                        this.uploadCb({
                            Progress: percentage,
                            ImageId:  time
                        });
                    }
                }
            ));
            if (this.uploadCb) {
                this.uploadCb({
                    Progress: -1,
                    ImageId:  time
                });
            }
            this.busy(false); // voting done
            if (!result.Success) {
                this.ImageCss('btn-failed');
            } else {
                this.ImageCss('');
            }
            if (result.Success) {
                this.Thumbnail(result.Data.Thumbnail);
                this.Compressed(result.Data.Compressed);
                this.Original(result.Data.Original);
            }
        }
        catch (e) {
            alert(e && e.message || 'Upload failed due to click on external link');
            console.error('error in the image upload', e, e.message);
            // TODO notify parent for displaying error message
            if (this.uploadCb) {
                this.uploadCb({
                    Progress: -1,
                    ImageId:  time
                });
            }
        }
    }

    public ToDTO(): {
        rawImage: string
    } {
        return {
            rawImage: this.Original().url
        };
    }
}

export default ArtistImage;