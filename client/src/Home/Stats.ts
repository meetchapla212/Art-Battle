import { BusyTracker } from '../Utils/BusyTracker';
import { EventStatDTO } from '../../../shared/EventStatDTO';

export class Stats {
    public LoadingTracker: BusyTracker = new BusyTracker();
    public Name: KnockoutObservable<string> = ko.observable<string>();
    public Registered: KnockoutObservable<number> = ko.observable<number>();
    public Door: KnockoutObservable<number> = ko.observable<number>();
    public Online: KnockoutObservable<number> = ko.observable<number>();
    public EventId: KnockoutObservable<string> = ko.observable<string>();

    public constructor(dto: EventStatDTO) {
        this.EventId(dto.EventId);
        this.Name(dto.Name);
        this.Registered(dto.Registered);
        this.Door(dto.Door);
        this.Online(dto.Online);
        this.EventId(dto.EventId);
    }
}
export default Stats;