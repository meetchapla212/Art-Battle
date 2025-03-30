import * as ko from 'knockout';
import RegisteredVoterList from './RegisteredVoterList';
import RegistrationEditor from './RegistrationEditor';
import CommonRegistrationDto from '../../../shared/CommonRegistrationDto';
import Registrant from './Registrant';

interface SubmittedPhoneDto {
    phone: string;
    AlertText: string;
    AlertClass: string;
    store: boolean;
}

export class RegistrationScreenViewModel {
    public EventId: string = location.pathname.split('/')[3];

    public RegisteredVoters: RegisteredVoterList;
    public RegistrationEditor: KnockoutObservable<RegistrationEditor> = ko.observable<RegistrationEditor>();
    public SubmittedNumbers: KnockoutObservableArray<SubmittedPhoneDto> = ko.observableArray<SubmittedPhoneDto>();

    public AlertClass: KnockoutObservable<string> = ko.observable<string>();
    public AlertText: KnockoutObservable<string> = ko.observable<string>();

    public constructor() {
        this.RegisteredVoters = new RegisteredVoterList(this.EventId, this.OnVoterSelected.bind(this));
        this.ResetEditor();
    }

    public OnRegistrationSubmitted(dto: CommonRegistrationDto) {
        let store: boolean = false;
        if (dto.ErrorMessage && dto.ErrorMessage.length > 0) {
            this.AlertText(dto.ErrorMessage);
            this.AlertClass('alert-danger');
        }
        else if (dto.AlreadyRegistered) {
            this.AlertClass('alert-warning');
            this.AlertText(`${dto.NickName || dto.PhoneNumber || dto.Email} was already registered`);
        } else if (dto.VoteFactor > 1 && dto.userVoteFactor && dto.userVoteFactor.Status !== 'Artist') {
            this.AlertClass('alert-info');
            this.AlertText(`Welcome back ${dto.NickName || dto.PhoneNumber || dto.Email}`);
            store = true;
        } else if (dto.userVoteFactor && dto.userVoteFactor.Status === 'Artist') {
            this.AlertClass('alert alert-pink');
            this.AlertText(`Welcome artist ${dto.NickName || dto.PhoneNumber || dto.Email}`);
            store = true;
        } else {
            this.AlertClass('alert-success');
            this.AlertText(`${dto.NickName || dto.PhoneNumber || dto.Email} was successfully registered!`);
            store = true;
        }

        dto.PhoneNumber = dto.NickName || dto.PhoneNumber || dto.Email;
        const phoneObj: SubmittedPhoneDto = {
            phone: dto.PhoneNumber,
            AlertText: this.AlertText(),
            AlertClass: this.AlertClass(),
            store: store
        };
        if (store) {
            this.RegisteredVoters.UpdateRegistration({
                    RegionImage: dto.RegionImage,
                    PhoneNumber: dto.PhoneNumber,
                    VoteFactor: dto.VoteFactor,
                    VoteUrl: dto.VoteUrl,
                    PeopleUrl: dto.PeopleUrl,
                    Hash: dto.Hash,
                    Email: dto.Email,
                    Preferences: dto.Preferences,
                    NickName: dto.NickName,
                    Status: dto.Status,
                    Id: dto.RegistrationId,
                    HasVoted: dto.HasVoted,
                    VoteCount: dto.VoteCount,
                    userVoteFactor: dto.userVoteFactor
                }
            );
        }
        this.SubmittedNumbers.push(phoneObj);

        setTimeout(() => {
            this.SubmittedNumbers.remove(phoneObj);
        }, 7000);
        this.ResetEditor();
    }

    public OnVoterSelected(dto: Registrant) {
        this.ResetEditor();
        this.RegistrationEditor().Load(dto);
    }

    private ResetEditor() {
        this.RegistrationEditor(new RegistrationEditor(this.EventId, this.OnRegistrationSubmitted.bind(this), this.ResetEditor.bind(this)));
    }
}

export default RegistrationScreenViewModel;