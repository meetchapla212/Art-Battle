import { BusyTracker } from '../Utils/BusyTracker';
import { Request } from '../Utils/GatewayFunctions';
import { DataOperationResult } from '../../../shared/OperationResult';
import Artist from './Artist';
import * as ko from 'knockout';
import { RoundArtistsInterface } from '../../../shared/ArtistImageDTO';
import RequestQueueDTO from '../../../shared/RequestQueueDTO';
import VotingScreenViewModel from './VotingScreenViewModel';

export class Round {
    public LoadingTracker: BusyTracker = new BusyTracker();
    public VoterHash: KnockoutObservable<string> = ko.observable<string>();
    public vote: KnockoutObservable<string> = ko.observable<string>();
    public message: KnockoutObservable<string> = ko.observable<string>('');
    public success: KnockoutObservable<boolean> = ko.observable<boolean>(true);
    public busy: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public selectedEaselNumber: KnockoutObservable<number> = ko.observable<number>();
    public Artists: KnockoutObservableArray<Artist> = ko.observableArray<Artist>();
    public EventId: KnockoutObservable<any> = ko.observable<any>();
    public RoundNumber: KnockoutObservable<any> = ko.observable<any>();
    public IsActive: KnockoutObservable<boolean> = ko.observable<boolean>();
    public DisplayVoting: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public IsCurrentRound: KnockoutObservable<boolean> = ko.observable<boolean>();
    public HasOpenRound: KnockoutObservable<boolean> = ko.observable<boolean>();
    public RoundText: KnockoutObservable<string> = ko.observable<string>('');
    public uploadCb: (rq: RequestQueueDTO) => void;
    public RoundWiseImagesUpdater: BusyTracker = new BusyTracker();
    public Show: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public HasImages: KnockoutObservable<boolean> = ko.observable<boolean>(true);
    public EID: string;
    public vm: VotingScreenViewModel;

    public VotingCss: KnockoutReadonlyComputed<string> = ko.computed(() => {
        if (this.message().length === 0) {
            return 'btn-info';
        }
        else if (this.success()) {
            return 'btn-success';
        }
        else {
            return 'btn-danger';
        }
    });
    public VotingText: KnockoutReadonlyComputed<string> = ko.computed(() => {
        if ( this.message().length > 0 ) {
            if (this.success()) {
                return 'SENT!';
            }
            else {
                return 'Failed!';
            }
        }
        return 'VOTE';
    });

    public RoundCss: KnockoutReadonlyComputed<string> = ko.computed(() => {
        let css = '';
        if (this.IsCurrentRound()) {
            this.RoundText('VOTING OPEN');
            this.DisplayVoting(true);
            css += ' open';
        }  else {
            if (this.HasOpenRound()) {
                this.RoundText('OPEN soon');
                css += ' soon';
            } else {
                this.RoundText('Voting Closed');
                css += 'done';
            }
        }
        return css;
    });

    public RoundWrapperCss: KnockoutReadonlyComputed<string> = ko.computed(() => {
        if ( this.IsActive()) {
            return ' activeRound';
        } else {
            return '';
        }
    });

    public MessageCss: KnockoutReadonlyComputed<string> = ko.computed(() => {
        if ( this.message().length > 0 ) {
            if (this.success()) {
                return 'text-success inline';
            }
            else {
                return 'text-danger inline';
            }
        } else {
            return 'text-success';
        }
    });

    public VotingUpdater: BusyTracker = new BusyTracker();

    public constructor(obj: RoundArtistsInterface, vm: VotingScreenViewModel) {
        this.EventId(obj.EventId);
        this.VoterHash(obj.VoterHash);
        this.RoundNumber(obj.RoundNumber);
        for (let i = 0; i < obj.Artists.length; i++) {
            this.Artists.push(new Artist(obj.Artists[i], this.EventId(), this, this.VoterHash(), vm));
        }
        this.VoterHash(obj.VoterHash);
        this.IsCurrentRound(obj.IsCurrentRound);
        this.HasOpenRound(obj.HasOpenRound);
        this.IsActive(obj.IsActive);
        this.HasImages(obj.HasImages);
        this.vm = vm;
    }

    async handleVotingForm(form: HTMLFormElement) {
        if (form && this.selectedEaselNumber() !== undefined) {
            const hashInput = <HTMLInputElement>form.querySelector('input[name=hash]');
            const voteInput = <HTMLInputElement>form.querySelector('input[name=vote]');
            this.busy(true); // voting is going on
            this.busy.notifySubscribers();
            // @ts-ignore
            const result = await  this.VotingUpdater.AddOperation(Request<DataOperationResult<string>>(`${mp}/api/vote/${this.RoundNumber()}/${voteInput.value}/${hashInput.value}`, 'GET'));
            this.busy(false); // voting done
            this.message('<span>' + result.Data + '</span>');
            this.success(result.Success);
            this.busy.notifySubscribers();
            this.success.notifySubscribers();
            this.message.notifySubscribers();
        } else {
            this.message('Please select a picture to vote');
            this.success(false);
        }
    }

    clearButtonState() {
        this.busy(false);
        this.success(true);
        this.message('');
        this.busy.notifySubscribers();
        this.success.notifySubscribers();
        this.message.notifySubscribers();
    }

    setEaselNumber(easelNumber: number, target: EventTarget, vm: Artist) {
        this.selectedEaselNumber(easelNumber);
        $('.artist-container').removeClass('active');
        if (vm.Images().length > 0) {
            $(target).addClass('active');
        }
    }

    setStatus(isActive: boolean) {
        this.IsActive(isActive);
    }

    public async getArtistsWiseImages() {
        try {
            this.busy(true); // fetching artist images
            this.busy.notifySubscribers();
            const result = await this.RoundWiseImagesUpdater.AddOperation(Request<DataOperationResult<RoundArtistsInterface>>(
                // @ts-ignore
                `${mp}/api/gallery/${this.EventId()}/round/${this.RoundNumber()}`,
                'GET'
            ));
            this.busy(false); // voting done
            if (result.Success) {
                const artists = [];
                this.IsCurrentRound(result.Data.IsCurrentRound);
                this.HasOpenRound(result.Data.HasOpenRound);
                this.HasImages(result.Data.HasImages);
                for (let i = 0; i < result.Data.Artists.length; i++) {
                    artists.push(new Artist(result.Data.Artists[i], this.EventId(), this, this.VoterHash(), this.vm));
                }
                this.Artists(artists);
            }
        }
        catch (e) {
            console.error('error in fetching the images', e, e.message);
            // TODO notify parent for displaying error message
        }
    }
}

export default Round;