import { Request } from '../Utils/GatewayFunctions';
import { DataOperationResult } from '../../../shared/OperationResult';
import { ArtistImageClientDto } from '../Voting/ArtistInterface';
import { BusyTracker } from '../Utils/BusyTracker';
import { Upload } from './Upload';
import PeopleViewModel from './PeopleViewModel';
import * as ko from 'knockout';

class Video {
    public VideoUpdater: BusyTracker = new BusyTracker();
    public ArtistId: any;
    public Upload: Upload;
    public busy: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public VideoCss: KnockoutObservable<string> = ko.observable<string>('');
    public LoadingTracker: BusyTracker = new BusyTracker();
    constructor(vm: PeopleViewModel) {
        this.Upload = new Upload(vm.Registration.Artist._id, this.linkMedia.bind(this));

    }
    public ToDTO(): {
        rawVideo: string
    } {
        return {
            rawVideo: '' // TODO
        };
    }

    private async _uploadVideo(onProgress: (n: number) => void) {
        const time = new Date().getTime();
        return await this.VideoUpdater.AddOperation(Request<DataOperationResult<ArtistImageClientDto>>(
            // @ts-ignore
            `${mp}/api/artists/video-upload/${this.ArtistId}`,
            'POST',
            this.ToDTO(),
            onProgress
        ));
    }

    public async syncVideo() {
        const result = await this.Upload.syncFile(this._uploadVideo.bind(this), this.ToDTO());
        // @ts-ignore
        if (!result.Success) {
            this.VideoCss('btn-failed');
        } else {
            this.VideoCss('');
        }
    }

    public async linkMedia(fileName: string, uniqueId: string) {
        const me = this;
        const idObj = JSON.parse(uniqueId);
        idObj.outputFileName = fileName;
        // @ts-ignore
        const result = await this.LoadingTracker.AddOperation(Request<{mediaInEvent: ArtistImageClientDto}>(`${mp}/api/gallery/link-upload`, 'POST', idObj));
    }
}