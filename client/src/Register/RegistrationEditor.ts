import RegistrationDTO from '../../../shared/RegistrationDTO';
import { Request } from '../Utils/GatewayFunctions';
import { DataOperationResult } from '../../../shared/OperationResult';

import { ObjectId } from 'bson';
import CommonRegistrationDto from '../../../shared/CommonRegistrationDto';
import * as ko from 'knockout';
import { BusyTracker } from '../Utils/BusyTracker';
import { PreferenceDocument } from '../../../server/src/models/Preference';
import Registrant from './Registrant';

export class RegistrationEditor {
    public _id: string;
    public FirstName: KnockoutObservable<string> = ko.observable<string>();
    public LastName: KnockoutObservable<string> = ko.observable<string>();
    public Email: KnockoutObservable<string> = ko.observable<string>();

    public PhoneNumber: KnockoutObservable<string> = ko.observable<string>();
    public IsPhoneNumberValid: KnockoutObservable<boolean> = ko.observable<boolean>(true);

    public Saving: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public Hash: KnockoutObservable<string> = ko.observable<string>();
    public DisplayPhone: KnockoutObservable<string> = ko.observable<string>();
    public VoteUrl: KnockoutObservable<string> = ko.observable<string>();

    public busy: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public RegistrationCss: KnockoutObservable<string> = ko.observable<string>();
    public RegistrationText: KnockoutObservable<string> = ko.observable<string>('Submit');
    public RegionImage: KnockoutObservable<string> = ko.observable<string>('');
    public RegistrationUpdater: BusyTracker = new BusyTracker();
    public Preferences: KnockoutObservable<PreferenceDocument[]> = ko.observable<PreferenceDocument[]>();
    public NickName: KnockoutObservable<string> = ko.observable<string>();

    public constructor(public EventId: string,
        private _submitCallback: (dto: RegistrationDTO) => void,
        private _resetCallback: () => void ) {
    }

    public ToDTO(): CommonRegistrationDto {
        return {
            _id: this._id || new ObjectId().toHexString(),
            FirstName: '',
            LastName: '',
            Email: '',
            PhoneNumber: this.PhoneNumber(),
            Hash: '',
            DisplayPhone: '',
            VoteUrl: '',
            AlreadyRegistered: true,
            VoteFactor: 0,
            ErrorMessage: '',
            RegionCode: '',
            RegionImage: '',
            Preferences: [],
            NickName: '', // no need from here
            Status: '',
            RegistrationId: this._id || new ObjectId().toHexString(),
            HasVoted: 0,
            VoteCount: [],
            ArtBattleNews: false,
            NotificationEmails: false,
            LoyaltyOffers: false
        };
    }

    public Load(dto: Registrant): void {
        this.Email((dto.Email() && dto.Email().toString()) || '');
        this.PhoneNumber((dto.PhoneNumber() && dto.PhoneNumber().toString()) || '');
        this.NickName((dto.NickName() && dto.NickName().toString()) || '');
    }

    public async Save(): Promise<void> {
        const dto = this.ToDTO();
        try {
            this.busy(true); // voting is going on
            this.busy.notifySubscribers();
            // @ts-ignore
            const result = await  this.RegistrationUpdater.AddOperation(Request<DataOperationResult<RegistrationDTO>>(`${mp}/api/event/${this.EventId}/register`, 'PUT', dto));
            this.busy(false); // voting done
            if (!result.Success) {
                this.RegistrationCss('btn-failed');
                this.RegistrationText('Failed');
            } else {
                this.RegistrationCss('btn-success');
                this.RegistrationText('Registered');
            }
            if (result.Success) {
                this._id = result.Data._id;
                this._submitCallback(result.Data);
            }
        }
        catch (e) {
            console.error('error in the registration', e, e.message);
            if ((e.code && e.code === 'mul_act_event') || (e.message && e.message.length > 0)) {
                dto.ErrorMessage = e.message;
                this._submitCallback(dto);
            } else {
                dto.ErrorMessage = 'Internal server error';
                this._submitCallback(dto);
            }
        }
    }

    public Reset(): void {
        this._resetCallback();
    }
}

export default RegistrationEditor;