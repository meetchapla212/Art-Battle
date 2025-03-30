import { BusyTracker } from '../Utils/BusyTracker';
import { Request } from '../Utils/GatewayFunctions';
import ContestantDTO from '../../../shared/ContestantDTO';
import * as ko from 'knockout';
import PeopleViewModel from './PeopleViewModel';

export default class VideoUrl {
    public VideoUpdater: BusyTracker = new BusyTracker();
    public ArtistId: any;
    public SaveMessage: KnockoutObservable<string> = ko.observable<string>();
    public SaveMessageCss: KnockoutObservable<string> = ko.observable<string>();
    public Url: KnockoutObservable<any> = ko.observable<string>();
    public Index: number = -1;
    public Vm: PeopleViewModel;

    constructor(Vm: PeopleViewModel, Url: string, Index: number) {
        this.Index = Index;
        this.Vm = Vm;
        this.Url(Url);
    }

    public async Save() {
        let method: 'GET' | 'PUT' | 'POST' | 'DELETE' = 'PUT';
        if (this.Index === -1) {
            method = 'POST';
        }
        try {
            await this.VideoUpdater.AddOperation(Request<ContestantDTO>(
                // @ts-ignore
                `${mp}/api/artist/add-video/${this.Vm.Registration.Artist._id}`, method, this.ToDTO()));
            this.SaveMessage(`Video Added`);
            this.SaveMessageCss('alert-success');
            this.Vm.VideoUrls().push(this);
            this.Vm.VideoUrls.notifySubscribers();
            this.Vm.OpenPopup(false);
        } catch (e) {
            console.error('error', e);
            this.SaveMessage(e && e.Message || e.message || 'An error occurred');
            this.SaveMessageCss('alert-danger');
            // this.Vm.OpenPopup(true);
        }
    }

    public ToDTO() {
        return {
            Index: this.Index,
            URL: this.Url()
        };
    }
}