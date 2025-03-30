import * as ko from 'knockout';
import { RoundContestantConfigDTO } from '../../../shared/RoundContestantDTO';
import { ObjectId } from 'bson';
import { Contestant } from './Contestant';

export class RoundContestant {

    public _id: string;

    public Detail: Contestant;
    public Enabled: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public EaselNumber: KnockoutObservable<number> = ko.observable<number>();
    public IsWinner: KnockoutObservable<number> = ko.observable<number>(0);
    public EnableAuction: KnockoutObservable<number> = ko.observable<number>(0);
    public Disabled: KnockoutObservable<boolean> = ko.observable<boolean>();

    public constructor(contestant: Contestant, dto?: RoundContestantConfigDTO) {
        this.Detail = contestant;
        this._id = dto ? dto._id : new ObjectId().toHexString();
        if (dto) {
            this.Enabled(dto.Enabled || false);
            this.EaselNumber(dto.EaselNumber);
            this.IsWinner(dto.IsWinner);
            this.EnableAuction(dto.EnableAuction);
        }
        this.Disabled(this.Detail && this.Detail.Name().length === 0);
        contestant.RegisterRoundContestantObj(this);
    }

    public ToDTO(): RoundContestantConfigDTO {
        return {
            _id: this._id,
            Detail: this.Detail.ToDTO(),
            Enabled: this.Enabled(),
            EaselNumber: this.EaselNumber(),
            IsWinner: this.IsWinner(),
            EnableAuction: this.EnableAuction()
        };
    }
}

export default RoundContestant;