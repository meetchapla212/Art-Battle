import { EventContestantDTO } from '../../../shared/ContestantDTO';
import { EventHomeDto, RoundHomeDto } from '../../../shared/EventDTO';
import { Request } from '../Utils/GatewayFunctions';
import { DataOperationResult } from '../../../shared/OperationResult';
import { BusyTracker } from '../Utils/BusyTracker';

export class EventSummary {
    public _id: any;
    public Name: string;
    public Enabled: boolean;
    public PhoneNumber: string;
    public countryFlag: string;
    public Contestants: EventContestantDTO[];
    public Rounds: KnockoutObservable<RoundHomeDto[]> = ko.observable<RoundHomeDto[]>();
    public CurrentRound: KnockoutObservable<RoundHomeDto> = ko.observable<RoundHomeDto>();
    public IncrementRoundText: KnockoutReadonlyComputed<string>;
    public IncrementRoundCSS: KnockoutReadonlyComputed<string>;
    public NextRoundNumber: KnockoutReadonlyComputed<number>;

    public CurrentRoundUpdater: BusyTracker = new BusyTracker();

    public constructor(dto: EventHomeDto) {
        this.LoadEvent(dto);

        this.NextRoundNumber = ko.computed(() => {
            const rounds = this.Rounds()
                .filter(r => !r.IsFinished);
            if (rounds.length > 0) {
                return rounds.map(r => r.RoundNumber)
                    .reduce((prev, cur) => {
                        return prev < cur ? prev : cur;
                    });
            } else {
                return 0;
            }
        });

        this.IncrementRoundText = ko.computed(() => {
            if (this.CurrentRound()) {
                return `End Round ${this.CurrentRound().RoundNumber}`;
            }
            else if (this.Rounds().some(r => !r.IsFinished)) {
                const rounds = this.Rounds()
                    .filter(r => !r.IsFinished);

                if (rounds.length > 0) {
                    const nextRound = rounds.map(r => r.RoundNumber)
                        .reduce((prev, cur) => {
                            return prev < cur ? prev : cur;
                        });
                    if (nextRound != 0) {
                        return `Begin Round ${nextRound}`;
                    }
                }
            }
            else {
                return `Finished!`;
            }
        });

        this.IncrementRoundCSS = ko.computed(() => {
            if (this.CurrentRound()) {
                return `btn-danger`;
            }
            else if (this.Rounds().some(r => !r.IsFinished)) {
                const rounds = this.Rounds()
                    .filter(r => !r.IsFinished);

                if (rounds.length > 0) {
                    const nextRound = rounds.map(r => r.RoundNumber)
                        .reduce((prev, cur) => {
                            return prev < cur ? prev : cur;
                        });
                    if (nextRound != 0) {
                        return `btn-success`;
                    }
                }
            }
            else {
                return `btn-default`;
            }
        });
    }

    public LoadEvent(dto: EventHomeDto) {
        this._id = dto._id;
        this.Name = dto.Name;
        this.Enabled = dto.Enabled;
        this.PhoneNumber = dto.PhoneNumber;
        // this.Contestants = dto.Contestants;
        this.Rounds(dto.Rounds);

        this.CurrentRound(dto.CurrentRound);
        this.countryFlag = dto.countryFlag;
    }

    public async IncrementRound(): Promise<void> {
        // @ts-ignore
        const result = await this.CurrentRoundUpdater.AddOperation(Request<DataOperationResult<EventHomeDto>>(mp + `/api/event/${this._id}/incrementround`, 'POST'));
        if (result.Success) {
            this.LoadEvent(result.Data);
        }
    }
}

export default EventSummary;