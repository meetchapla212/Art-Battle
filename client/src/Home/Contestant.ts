import * as ko from 'knockout';
import ContestantDTO, { EventContestantDTO, MinimalContestantDTO } from '../../../shared/ContestantDTO';
import RoundContestant from "./RoundContestant";


export class Contestant {
    public _id: string;
    public Name: KnockoutObservable<string> = ko.observable<string>('');
    public ReadOnly: KnockoutObservable<boolean> = ko.observable<boolean>();
    public EntryId: KnockoutObservable<number> = ko.observable<number>();
    public SelectedContestant: KnockoutObservable<Contestant> = ko.observable<Contestant>();
    public oldId: string;
    public RoundContestants: KnockoutObservableArray<RoundContestant> = ko.observableArray<RoundContestant>();
    /*
    public ChildContestants: ContestantDTO[];
    public City: CityDTO;
    public CityText: string;
    public Email: string;
    public IsDuplicate: boolean;
    public PhoneNumber: string;
    public Website: string;
     */

    public constructor(dto: MinimalContestantDTO, readonly: boolean) {
        this._id = dto._id;
        this.ReadOnly(readonly);
        this.Name(dto.Name);
        this.EntryId(dto.EntryId);
        /*this.ChildContestants = dto.ChildContestants;
        this.City = dto.City;
        this.CityText = dto.CityText;
        this.Email = dto.Email;
        this.IsDuplicate = dto.IsDuplicate;
        this.PhoneNumber = dto.PhoneNumber;
        this.Website = dto.Website;*/
    }

    public SetSelected(dto: {label: string; value: number; contestant: ContestantDTO}) {
        if (dto && dto.contestant) {
            this.Name(dto.contestant.Name);
            if (this._id !== dto.contestant._id) {
                this.oldId = this._id;
                this._id = dto.contestant._id;
                for (let i = 0; i < this.RoundContestants().length; i++) {
                    this.RoundContestants()[i].Disabled(false);
                }
            }
            this.ReadOnly(true);
            this.EntryId(dto.contestant.EntryId);
        }
    }

    public ToDTO(): EventContestantDTO {
        return {
            ChildContestants: [],
            City: undefined,
            CityText: '',
            Email: '',
            IsDuplicate: false,
            PhoneNumber: '',
            Website: '',
            EntryId: this.EntryId(),
            Name: this.Name(),
            _id: this._id,
            oldId: this.oldId,
        };
    }

    public Edit() {
        this.ReadOnly(false);
    }

    public RegisterRoundContestantObj(roundContestant: RoundContestant) {
        this.RoundContestants().push(roundContestant);
    }
}

export default Contestant;