import Artist from './Artist';
import HomeScreenViewModel from './HomeScreenViewModel';
import { BusyTracker } from '../Utils/BusyTracker';
import { Request } from '../Utils/GatewayFunctions';
import ContestantDTO from '../../../shared/ContestantDTO';
import { DataOperationResult } from '../../../shared/OperationResult';
import { CityDTO } from '../../../shared/CityDTO';

export default class Artists {
    public LoadingTracker: BusyTracker = new BusyTracker();
    public Artists: KnockoutObservableArray<Artist> = ko.observableArray<Artist>();
    public Vm: HomeScreenViewModel;
    public SearchText: KnockoutObservable<string> = ko.observable<string>();
    public ActivePageNumber: KnockoutObservable<number> = ko.observable<number>(1);
    public PageNumbers: KnockoutObservableArray<number> = ko.observableArray<number>();

    // used in view
    public PrevPageCss: KnockoutReadonlyComputed<string> = ko.computed(() => {
        if (this.ActivePageNumber() === this.PageNumbers().length) {
            return 'disabled';
        } else if (this.ActivePageNumber() === 1) {
            return 'disabled';
        }
        return '';
    });

    // used in view
    public NextPageCss: KnockoutReadonlyComputed<string> = ko.computed(() => {
        if (this.ActivePageNumber() === this.PageNumbers().length) {
            return 'disabled';
        }
        return '';
    });
    public Limit: number = 10;

    public constructor(vm: HomeScreenViewModel) {
        this.Vm = vm;
    }
    public async Search() {
        try {
            const searchResult = await this.LoadingTracker.AddOperation(Request<DataOperationResult<{
                Contestants: ContestantDTO[];
                Count: number;
                // @ts-ignore
            }>>(`${mp}/api/artist/search`, 'POST', {
                searchTerm: this.SearchText(),
                sortCol: '_id',
                sortOrder: -1,
                page: this.ActivePageNumber(),
                limit: this.Limit
            }));
            this.Artists([]);
            for (let i = 0; i < searchResult.Data.Contestants.length; i++) {
                const contestant = searchResult.Data.Contestants[i];
                this.Artists.push(new Artist(contestant, this, this.Vm));
            }
            this.PageNumbers([]);
            const count = searchResult.Data.Count;
            const limit = this.Limit;
            const numPages = Math.ceil(count / limit);
            for (let j = 1; j <= numPages; j++) {
                this.PageNumbers().push(j);
            }
            this.PageNumbers.notifySubscribers();
        } catch (e) {
            // TODO implement alert
            console.error(e);
        }
    }

    // used in view
    public async ChangePage(pageNo: number) {
        this.ActivePageNumber(pageNo);
        await this.Search();
    }

    // used in view
    public async GoToPrevious() {
        if (this.ActivePageNumber() !== 1)
            await this.ChangePage(this.ActivePageNumber() - 1);
    }

    // used in view
    public async GoToNext() {
        if (this.ActivePageNumber() !== this.PageNumbers().length)
            await this.ChangePage(this.ActivePageNumber() + 1);
    }

    public AddArtist() {
        const ArtistObj = new Artist({
            ChildContestants: [],
            City: undefined,
            CityText: "",
            Email: "",
            EntryId: undefined,
            IsDuplicate: false,
            Name: "",
            PhoneNumber: "",
            Website: "",
            _id: undefined
        }, this, this.Vm, true);
        // this.Artists().push(ArtistObj);
        ArtistObj.Edit();
    }
}