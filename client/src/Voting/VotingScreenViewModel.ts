import { BusyTracker } from '../Utils/BusyTracker';
import Artist from './Artist';
import RequestQueueDTO from '../../../shared/RequestQueueDTO';
import * as ko from 'knockout';
import { RoundArtistsInterface } from '../../../shared/ArtistImageDTO';
import Round from './Round';
// @ts-ignore
import Resumable from 'resumablejs';
import { Request } from '../Utils/GatewayFunctions';
import { ArtistImageClientDto } from './ArtistInterface';


export class VotingScreenViewModel {
    public LoadingTracker: BusyTracker = new BusyTracker();
    public hash: KnockoutObservable<string> = ko.observable<string>();
    public VoterHash: KnockoutObservable<string> = ko.observable<string>();
    public vote: KnockoutObservable<string> = ko.observable<string>();
    public success: KnockoutObservable<boolean> = ko.observable<boolean>(true);
    public busy: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public selectedEaselNumber: KnockoutObservable<number> = ko.observable<number>();
    public selectedArtistName: KnockoutObservable<string> = ko.observable<string>();
    public Artists: KnockoutObservableArray<Artist> = ko.observableArray<Artist>();
    public RoundWiseImages: KnockoutObservableArray<RoundArtistsInterface> = ko.observableArray<RoundArtistsInterface>();
    public RoundNumber: KnockoutObservable<any> = ko.observable<any>();
    public CurrentRoundNumber: KnockoutObservable<any> = ko.observable<any>();
    public percentage: KnockoutObservable<number> = ko.observable<number>(0);
    public RequestQueue: KnockoutObservableArray<RequestQueueDTO> = ko.observableArray<RequestQueueDTO>();
    public RequestArr: KnockoutObservableArray<number> = ko.observableArray<number>([]);
    public beforeUnloadPrompt: KnockoutObservable<string> = ko.observable<string>();
    // public totalUploads: KnockoutObservable<number> = ko.observable<number>(0);
    public Rounds: KnockoutObservableArray<Round> = ko.observableArray<Round>();
    public selectedContestantId: KnockoutObservable<string> = ko.observable<string>();
    public EID: string;
    public SelectedRound: KnockoutObservable<Round> = ko.observable<Round>();
    public uploadManager: Resumable;
    public eventId: KnockoutObservable<string> = ko.observable<string>();
    public uploadIndexMap: {[key: string]: number} = {};

    public VotingUpdater: BusyTracker = new BusyTracker();

    public constructor() {
        /* coming from html */
        // @ts-ignore
        this.VoterHash(VoterHash);
        // @ts-ignore
        this.CurrentRoundNumber(CurrentRoundNumber);
        // @ts-ignore
        this.EID = EID;
        /* html end */
        this.uploadManager = new Resumable(
            {
                // @ts-ignore
                target: mp + '/api/gallery/upload',
                // simultaneousUploads: 1,
                generateUniqueIdentifier: this.generateId.bind(this),
                chunkSize: 1024 * 512
            }
        );
        const me = this;
        // Handle file add event
        this.uploadManager.on('fileAdded', function(file: any) {
            file.index = 0;
            const newIndex = me.RequestArr().push(0);
            me.uploadIndexMap[file.file.uniqueIdentifier] = newIndex - 1;
            // me.totalUploads(me.totalUploads() + files.length);
            me.uploadManager.upload();
        });
        this.uploadManager.on('fileProgress', function(file: any) {
            const progress = file.progress();
            me.RequestArr()[me.uploadIndexMap[file.file.uniqueIdentifier]] = Math.floor(progress * 100);
            me.RequestArr(me.RequestArr());
            // me.percentage(Math.floor((file.progress() / (me.totalUploads())) * 100));
            // Handle progress for both the file and the overall upload
            // $('.resumable-file-'+file.uniqueIdentifier+' .resumable-file-progress').html(Math.floor(file.progress()*100) + '%');
            // $('.progress-bar').css({width:Math.floor(r.progress()*100) + '%'});
        });
        this.uploadManager.on('fileSuccess', function(file: any, messageStr: string) {
            // Reflect that the file upload has completed
            const message: {status: string; outputFileName: string} = JSON.parse(messageStr);
            me.uploadManager.removeFile(file);
            const fileName = message.outputFileName;
            me.linkMedia(fileName, file.file.uniqueIdentifier).then(() => {
                me._updateProgress(file.file.uniqueIdentifier);
            }).catch((e) => {
                console.error(e);
                me._updateProgress(file.file.uniqueIdentifier);
            });
        });
        this.uploadManager.on('fileError', function(file: any, message: any) {
            alert(message);
            me._updateProgress(file.file.uniqueIdentifier);
            // Reflect that the file upload has resulted in error
            // $('.resumable-file-'+file.uniqueIdentifier+' .resumable-file-progress').html('(file could not be uploaded: '+message+')');
        });
        this.uploadManager.on('pause', function() {
            // Show resume, hide pause
            // console.log('pause');
        });
        this.uploadManager.on('complete', function() {
            // Hide pause/resume when the upload has completed
            console.log('complete');
            // me.RequestArr([]);
        });
        this.uploadManager.on('cancel', function() {
            console.log('cancel');
            // $('.resumable-file-progress').html('canceled');
        });
        this.uploadManager.on('uploadStart', function() {
            console.log('uploadStart');
            // Show pause, hide resume
            // $('.resumable-progress .progress-resume-link').hide();
            // $('.resumable-progress .progress-pause-link').show();
        });
        // @ts-ignore
        this.RoundWiseImages(RoundWiseImages);
        for (let i = 0; i < this.RoundWiseImages().length; i++) {
            // this.RoundWiseImages()[i].uploadCb = this.uploadCb && this.uploadCb.bind(this);
            this.RoundWiseImages()[i].VoterHash = this.VoterHash();
            const roundObj = new Round(this.RoundWiseImages()[i], this);
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
    }

    async generateId(file: any) {
        // @ts-ignore
        const baseId = `${eventName.replace(/[\W_]+/g, '')}-${this.SelectedRound().RoundNumber()}-${this.selectedEaselNumber()}-${this.selectedArtistName()}`;
        const baseIdObj = {
            // @ts-ignore
            roundNumber: this.SelectedRound().RoundNumber(),
            easelNumber: this.selectedEaselNumber(),
            EID: this.EID,
            prefixId: baseId,
            hash: this.VoterHash(),
            eventId: this.eventId(),
            contestantId: this.selectedContestantId(),
            fileType: file.type
        };
        // @ts-ignore
        const result = await this.LoadingTracker.AddOperation(Request(`${mp}/api/gallery/getMediaId/${this.VoterHash()}`, 'POST', baseIdObj));
        return JSON.stringify(result);
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

    public async linkMedia(fileName: string, uniqueId: string) {
        const me = this;
        const idObj = JSON.parse(uniqueId);
        idObj.outputFileName = fileName;
        // @ts-ignore
        const result = await this.LoadingTracker.AddOperation(Request<{mediaInEvent: ArtistImageClientDto}>(`${mp}/api/gallery/link-upload`, 'POST', idObj));
        for (let i = 0; i < me.Rounds().length; i++) {
            if (me.Rounds()[i].RoundNumber() === idObj.roundNumber) {
                for (let j = 0; j < me.Rounds()[i].Artists().length; j++) {
                    const artist = me.Rounds()[i].Artists()[j];
                    if (artist.id === idObj.contestantId) {
                        artist.AddMedia(result.mediaInEvent);
                        break;
                    }
                }
                break;
            }
        }
    }

    private _updateProgress(identifier: string) {
        const me = this;
        const reqArr = me.RequestArr();
        reqArr.splice(me.uploadIndexMap[identifier], 1);
        me.RequestArr(reqArr);
        Object.keys(me.uploadIndexMap).forEach(key => {
            me.uploadIndexMap[key] = me.RequestArr().indexOf(me.uploadIndexMap[key]);
        });
    }
}

export default VotingScreenViewModel;