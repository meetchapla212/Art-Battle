import HomeScreenViewModel from './HomeScreenViewModel';
import { Request } from '../Utils/GatewayFunctions';
import Contestant from './Buy/Contestant';
import ArtistProduct from './Buy/ArtistProduct';
import { ArtistWooCommerceDTO } from '../../../shared/ArtistWooCommerceDTO';

export default class Buy {
    public Contestants: KnockoutObservableArray<Contestant> = ko.observableArray<Contestant>([]);
    public Vm: HomeScreenViewModel;
    public Visible: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public ActivePageNumber: KnockoutObservable<number> = ko.observable<number>(0);
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
    public Limit: number = 20;
    public Products: KnockoutObservableArray<ArtistProduct> = ko.observableArray<ArtistProduct>([]);

    constructor(vm: HomeScreenViewModel) {
        this.Vm = vm;
    }

    public ResetData() {
        this.Contestants([]);
        this.Products([]);
        this.ActivePageNumber(0);
    }

    public async LoadPaginatedData() {
        if (!this.Visible()) {
            return ;
        }
        this.ActivePageNumber(this.ActivePageNumber() + 1);
        // this.Vm.Loading(true);
        try {
            const result = await this.Vm.LoadingTracker.AddOperation(Request<{
                Data: {
                    Products: ArtistWooCommerceDTO[];
                    Count: number;
                },
                Success: boolean
                // @ts-ignore
            }>(mp + '/api/woo-commerce-artist-list', 'POST', {
                sortCol: '_id',
                sortOrder: -1,
                page: this.ActivePageNumber(),
                limit: this.Limit
            }));
            if (Array.isArray(result.Data.Products)) {
                for (let i = 0; i < result.Data.Products.length; i++) {
                    const product = result.Data.Products[i];
                    product.Contestant.WooProducts = [product];
                    // TODO logic to group by artists
                    this.Contestants.push(new Contestant(this.Vm, this, product.Contestant));
                }
                if (result.Data.Products.length === 0) {
                    this.ActivePageNumber(this.ActivePageNumber() - 1);
                }
            } else {
                this.ActivePageNumber(this.ActivePageNumber() - 1);
            }
            this.Vm.Loading(false);
        } catch (e) {
            console.error(e);
            this.Vm.Loading(false);
        }
    }

    public AddProduct() {
        const productId = this.Products().length - 1;
        const contestantId = this.Contestants().length  - 1;
        this.Contestants().push(new Contestant(this.Vm, this, {
            _id: contestantId,
            Name: '',
            WooProducts: [{
                _id: '',
                ArtistId: '',
                ProductId: '',
                Confirmation: '',
            }],
            CityText: '',
            Email: '',
            Website: '',
            EntryId: 0,
            PhoneNumber: '',
            City: {
                _id: '',
                Name: '',
                createdAt: new Date(),
                updatedAt: new Date(),
                Country: '',
                RegionCode: '',
                Region: '',
                CountryCode: ''
            },
            ChildContestants: [],
            IsDuplicate: false
        }));
    }

    public RemoveProduct(productIndex: number) {
        this.Products.splice(productIndex, 1);
        for (let i =  0; i < this.Products().length; i++) {
            this.Products()[i].index = i;
        }
        this.Products.notifySubscribers();
    }
}