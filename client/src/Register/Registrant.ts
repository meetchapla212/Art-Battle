import * as ko from 'knockout';
import { BusyTracker } from '../Utils/BusyTracker';
import { Request } from '../Utils/GatewayFunctions';
import { DataOperationResult } from '../../../shared/OperationResult';
import { RegistrationsResponse, RegistrationStatusResponse } from '../../../shared/RegistrationsReponse';
import { States, StateColors } from '../../../server/src/common/States';

export class Registrant {

    public StatusUpdater: BusyTracker = new BusyTracker();
    // Online / photo / multi / 1.5x / 2x / 5x / admin
    public LastStateIndex: KnockoutObservable<number> = ko.observable<number>();
    // Default is actual if Status property is empty for a registrant
    public Status: KnockoutObservable<string> = ko.observable<string>();
    public StatusMessage: KnockoutObservable<string> = ko.observable<string>();
    public StatusCss: KnockoutObservable<string> = ko.observable<string>();
    public StatusColor: KnockoutObservable<string> = ko.observable<string>('');
    public Id: String = '';
    public EventId: string = '';
    public PhoneNumber: KnockoutObservable<String> = ko.observable<String>('');
    public Email: KnockoutObservable<String> = ko.observable<String>('');
    public NickName: KnockoutObservable<String> = ko.observable<String>('');
    public RegionImage: String = '';
    public Hash: String = '';
    public VoteFactor: Number;
    public DisplayPhone: KnockoutReadonlyComputed<String> =  ko.computed(() => {
        return this.NickName() || this.PhoneNumber() || this.Email();
    });
    public States = States;
    public VoteUrl: String = '';
    public PeopleUrl: String = '';
    public HasVoted: KnockoutObservable<number> = ko.observable<number>();
    public VoteCount: KnockoutObservableArray<number> = ko.observableArray<number>();

    public constructor(dto: RegistrationsResponse, eventId: string) {
        const status = dto.userVoteFactor && dto.userVoteFactor.Status || dto.Status;
        const lastStateIndex = this.States.indexOf(status);
        this.VoteFactor = dto.VoteFactor;
        if (lastStateIndex === -1) {
            this.Status(dto.VoteFactor.toString());
            this.StatusCss('btn-default');
        } else {
            this.Status(status);
            this.StatusCss('btn-default');
            this.StatusColor(StateColors[lastStateIndex]);
        }
        this.StatusMessage('<span>' + this.Status() + '</span>');
        this.LastStateIndex(lastStateIndex);
        this.Id = dto.Id;
        this.EventId = eventId;
        this.PhoneNumber(dto.PhoneNumber);
        this.Email(dto.Email);
        this.NickName(dto.NickName);
        this.RegionImage = dto.RegionImage;
        this.Hash = dto.Hash;
        this.VoteUrl = dto.VoteUrl;
        this.PeopleUrl = dto.PeopleUrl;
        this.DisplayPhone();
        this.HasVoted(dto.HasVoted);
        this.VoteCount(dto.VoteCount);
    }

    async handleStatusChange(vm: Registrant, e: MouseEvent) {
        try {
            e.preventDefault();
            e.stopPropagation();
            let newIndex = this.LastStateIndex() + 1;
            if (newIndex === this.States.length) {
                // End of the cycle
                newIndex = -1;
            }
            // @ts-ignore
            const result = await this.StatusUpdater.AddOperation(Request<DataOperationResult<RegistrationStatusResponse>>(`${mp}/api/registration/status/${this.EventId}/${this.Id}/${newIndex}`, 'PUT'));
            if (result.Success) {
                // this.StatusCss('btn-success');
                this.LastStateIndex(result.Data.StatusIndex);
                this.Status(result.Data.Status);
                if ( result.Data.StatusIndex === -1 ) {
                    this.StatusColor('');
                } else {
                    this.StatusColor(StateColors[this.LastStateIndex()]);
                }
                this.StatusMessage('<span>' + this.Status() + '</span>');
                // this.StatusCss('btn-default');
            } else {
                console.error('error in api call');
                this.StatusCss('btn-danger');
                this.StatusMessage('<span>Error</span>');
            }
        } catch (e) {
            console.error(e);
            this.StatusCss('btn-danger');
            this.StatusMessage('<span>Error</span>');
        }
    }
}

export default Registrant;