import { BusyTracker } from '../Utils/BusyTracker';
import Artist from './Artist';
import RequestQueueDTO from '../../../shared/RequestQueueDTO';
import * as ko from 'knockout';
import { RoundArtistsInterface } from '../../../shared/ArtistImageDTO';
import Round from './Round';
// @ts-ignore
import ImageEditor from 'tui-image-editor';
import Theme from './theme';
import ArtistImage from './ArtistImage';

export class EditorViewModel {
    public LoadingTracker: BusyTracker = new BusyTracker();
    public success: KnockoutObservable<boolean> = ko.observable<boolean>(true);
    public busy: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public selectedEaselNumber: KnockoutObservable<number> = ko.observable<number>();
    public Artists: KnockoutObservableArray<Artist> = ko.observableArray<Artist>();
    public RoundWiseImages: KnockoutObservableArray<RoundArtistsInterface> = ko.observableArray<RoundArtistsInterface>();
    public RoundNumber: KnockoutObservable<any> = ko.observable<any>();
    public CurrentRoundNumber: KnockoutObservable<any> = ko.observable<any>();
    public percentage: KnockoutObservable<number> = ko.observable<number>(0);
    public RequestQueue: KnockoutObservableArray<RequestQueueDTO> = ko.observableArray<RequestQueueDTO>();
    public NumRequests: KnockoutObservable<number> = ko.observable<number>(0);
    public beforeUnloadPrompt: KnockoutObservable<string> = ko.observable<string>();
    public totalUploads: KnockoutObservable<number> = ko.observable<number>(0);
    public Rounds: KnockoutObservableArray<Round> = ko.observableArray<Round>();
    public selectedImage: KnockoutObservable<ArtistImage> = ko.observable<ArtistImage>();
    public SelectedRound: KnockoutObservable<Round> = ko.observable<Round>();
    public selectedArtId: KnockoutObservable<string> = ko.observable<string>();

    public VotingUpdater: BusyTracker = new BusyTracker();
    public ImageEditorInstance: ImageEditor;
    public showEditor: KnockoutObservable<boolean> = ko.observable<boolean>(false);

    public constructor() {
        // @ts-ignore
        this.RoundWiseImages(RoundWiseImages);
        // @ts-ignore
        this.CurrentRoundNumber(CurrentRoundNumber);

        for (let i = 0; i < this.RoundWiseImages().length; i++) {
            this.RoundWiseImages()[i].uploadCb = this.uploadCb.bind(this);
            const roundObj = new Round(this.RoundWiseImages()[i]);
            this.Rounds().push(roundObj);
            if (this.CurrentRoundNumber() === 0) {
                // expand all if current round is not there
                roundObj.Show(true);
            }
            if (this.RoundWiseImages()[i].RoundNumber === this.CurrentRoundNumber()) {
                roundObj.setStatus(true);
                roundObj.Show(true);
                this.SelectedRound(roundObj);
            }
        }
        /* html end */
        this.showEditor = ko.observable(false);
        this.ImageEditorInstance = new ImageEditor(document.querySelector('#tui-image-editor-container'), {
            includeUI: {
                theme: Theme, // or whiteTheme
                menuBarPosition: 'top'
            }
        });
    }

    uploadCb (rq: RequestQueueDTO) {
        let indexOfRq = -1;
        for (let i = 0; i < this.RequestQueue().length; i++) {
            if (this.RequestQueue()[i].ImageId === rq.ImageId) {
                indexOfRq = i;
                break;
            }
        }
        if (indexOfRq === -1) {
            indexOfRq = this.RequestQueue().length;
            this.RequestQueue()[indexOfRq] = rq;
            this.totalUploads(this.totalUploads() + 1);
        } else {
            this.RequestQueue()[indexOfRq] = rq;
        }
        this._updateProgress();
    }

    private _updateProgress() {
        let i = this.RequestQueue().length;
        let sumProgress = 0;
        let numUploads = 0;
        while (i--) {
            const rq = this.RequestQueue()[i];
            if (rq.Progress === -1) {
                // request is processed
                this.RequestQueue().splice(i, 1);
            } else {
                sumProgress = sumProgress + rq.Progress;
                numUploads++;
            }
        }
        if (numUploads === 0) {
            this.totalUploads(0);
            setTimeout(this.NumRequests, 2000, 0);
        }
        else {
            this.NumRequests(numUploads);
        }

        const pendingUploads: number = this.totalUploads() - numUploads;
        if (this.totalUploads() > 0) {
            this.percentage(((pendingUploads) / (this.totalUploads())) * 100 );
            // this.percentage(this.totalUploads());
            this.beforeUnloadPrompt = ko.observable(`Are you sure? Your ${numUploads} file(s) are uploading.`);
        } else {
            this.percentage(100);
            setTimeout(this.percentage, 2000, 0);
            this.beforeUnloadPrompt(null);
        }
    }

    public async changeRound(vm: Round) {
        this.SelectedRound(vm);
        // mark clicked round as active
        vm.Show(!vm.Show());
        for (let i = 0; i < this.Rounds().length; i++) {
            if (this.Rounds()[i].RoundNumber() !== vm.RoundNumber()) {
                // mark other rounds as inactive
                this.Rounds()[i].setStatus(false);
                // this.Rounds()[i].Show(!this.Rounds()[i].Show());
            }
        }
        await vm.getArtistsWiseImages();
    }

    public async initEditor(Image: ArtistImage) {
        this.showEditor(true);
        this.selectedArtId(Image.ArtistId);
        this.ImageEditorInstance.destroy();
        this.selectedImage(Image);
        this.ImageEditorInstance = new ImageEditor(document.querySelector('#tui-image-editor-container'), {
            includeUI: {
                theme: Theme, // or whiteTheme
                menuBarPosition: 'top',
                // images are being served from a server
                loadImage: {path: `${Image.Original().url.replace('vote.', 'a.')}?ts=${new Date().getTime()}`, name: Image.Original().url.split(/(\\|\/)/g).pop()}
            }
        });
    }

    public async saveImage() {
        const dataUrl = this.ImageEditorInstance.toDataURL({
            format: 'jpeg'
        });
        this.selectedImage().Original({
            url: dataUrl,
            id: ''
        });
        await this.selectedImage().sync();
    }
}

export default EditorViewModel;