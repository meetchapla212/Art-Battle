import RoundContestantDTO from '../../../shared/RoundContestantDTO';
import { RoundConfigDTO } from '../../../shared/RoundDTO';
import Contestant from './Contestant';
import RoundContestant from './RoundContestant';

export class Round {
    public RoundNumber: number;
    public Contestants: KnockoutObservableArray<RoundContestant> = ko.observableArray([]);
    public VideoUrl: KnockoutObservable<string> = ko.observable<string>();

    public Visible: KnockoutObservable<boolean> = ko.observable<boolean>(false);

    private _id: string;

    public constructor(dto: RoundConfigDTO, public AvailableContestants: KnockoutObservableArray<Contestant>) {
        this._id = dto._id;
        this.RoundNumber = dto.RoundNumber;
        this.VideoUrl(dto.VideoUrl);
        this.Contestants(AvailableContestants().map(ac => {
            const roundContestant = dto.Contestants.find(rc => rc.Detail && rc.Detail._id == ac._id);
            if (roundContestant) {
                return new RoundContestant(ac, roundContestant);
            } else {
                return new RoundContestant(ac);
            }
        }));

        AvailableContestants.subscribe(available => {
            if (available) {
                this.Contestants(available.map(ac => {
                    const roundContestant = this.Contestants().find(rc => rc.Detail === ac);
                    if (roundContestant) {
                        return roundContestant;
                    } else {
                        return new RoundContestant(ac);
                    }
                }));
            }
        });
    }

    public ToggleVisible(): void {
        this.Visible(!this.Visible());
    }

    public ToDTO(): RoundConfigDTO {
        const contestants = this.Contestants();
        const filteredContestants = [];
        for (let i = 0; i < contestants.length; i++) {
            if (!contestants[i].Disabled()) {
                filteredContestants.push(contestants[i]);
            }
        }
        return {
            _id: this._id,
            RoundNumber: this.RoundNumber,
            Contestants: filteredContestants.map(c => c.ToDTO()),
            VideoUrl: this.VideoUrl()
        };
    }
}

export default Round;