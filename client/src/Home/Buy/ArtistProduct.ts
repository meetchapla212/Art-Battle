import { ArtistWooCommerceDTO } from '../../../../shared/ArtistWooCommerceDTO';
import HomeScreenViewModel from '../HomeScreenViewModel';
import Contestant from './Contestant';
import Buy from '../Buy';
import { Request } from '../../Utils/GatewayFunctions';
import { DataOperationResult } from '../../../../shared/OperationResult';
import ContestantDTO from '../../../../shared/ContestantDTO';

class ArtistProduct {
    public Options: KnockoutObservableArray<{label: string; value: number; contestant: ContestantDTO }> = ko.observableArray<{label: string; value: number; contestant: ContestantDTO; }>();
    public ProductId: KnockoutObservable<string> = ko.observable<string>('');
    public ProductName: KnockoutObservable<string> = ko.observable<string>('');
    public Confirmation: KnockoutObservable<string> = ko.observable<string>('');
    public ReadOnly: KnockoutObservable<boolean> = ko.observable<boolean>(true);
    public Parent: Contestant;
    public _id: KnockoutObservable<string> = ko.observable<string>('');
    public index: number;
    public Buy: Buy;
    public constructor(Vm: HomeScreenViewModel, Buy: Buy, Parent: Contestant, dto: ArtistWooCommerceDTO, index: number) {
        if (dto.ProductId.length === 0) {
            this.ReadOnly(false);
        }
        this.ProductId(dto.ProductId);
        this.ProductName(dto.Name);
        this.Confirmation(dto.Confirmation);
        this.Parent = Parent;
        this._id(dto._id);
        // @ts-ignore
        this.ProductId.subscribeChanged((newValue, oldValue) => {
            this.ReadOnly(true);
            if (this.Parent.ArtistName().length > 0 && this.ProductId().length > 0 && this.Parent._id()) {
                this.SaveProduct();
            }
        });
        // @ts-ignore
        this.Confirmation.subscribeChanged((newValue, oldValue) => {
            this.ReadOnly(true);
            this.SaveProduct();
        });

        // @ts-ignore
        this.Parent.ArtistId.subscribeChanged((newValue, oldValue) => {
            this.ReadOnly(true);
            this.SaveProduct();
        });
        this.index = index;
        this.Buy = Buy;
    }

    public SetSelected(dto: {label: string; value: number; contestant: ContestantDTO}) {
        if (dto && dto.contestant) {
            this.Parent.ArtistName(dto.contestant.Name);
            this.Parent._id(dto.contestant._id);
            this.ReadOnly(true);
            this.Parent.ArtistId(dto.contestant.EntryId);
        }
    }

    public Edit() {
        this.ReadOnly(false);
    }

    public SaveProduct() {
        // TODO logic to group by artists
        if (!(this.Parent.ArtistName().length > 0 && this.ProductId().length > 0 && this.Parent._id())) {
            return;
        }
        Request<DataOperationResult<{
            Product: ArtistWooCommerceDTO;
            // @ts-ignore
        }>>(`${mp}/api/artist/save-product`, 'POST', {
            ProductId: this.ProductId(),
            Confirmation: this.Confirmation(),
            ContestantId: this.Parent._id()
    }).then((r) => {
        this.Parent._id(r.Data.Product.Contestant);
        this._id(r.Data.Product._id);
        this.ProductName(r.Data.Product.Name || 'Product not found');
        }).catch(e => {
            console.error(e);
        });
    }

    public UpdateArtistInfo() {}

    public artistAutoCompleteCallback(request: {term: string}, response: (options: { label: string; value: number }[]) => { data: string }) {
        Request<DataOperationResult<{
            Contestants: ContestantDTO[];
            // @ts-ignore
        }>>(`${mp}/api/artist/auto-suggest/?q=${request.term}`, 'GET').then((r) => {
            this.Options([]);
            for (let i = 0; i < r.Data.Contestants.length; i++) {
                const entryId = r.Data.Contestants[i].EntryId ? ` (${r.Data.Contestants[i].EntryId})` : '';
                this.Options.push({
                    label: `${r.Data.Contestants[i].Name}${entryId}`,
                    value: r.Data.Contestants[i]._id,
                    contestant: r.Data.Contestants[i]
                });
            }
            response(this.Options());
        }).catch(e => {
            console.error('auto suggest api call', e);
            response(this.Options());
        });
    }

    public Refresh() {
        if (!this._id()) {
            alert('Product is not saved in db yet');
            return;
        }
        // @ts-ignore
        Request<DataOperationResult<string>>(`${mp}/api/artist/product/${this._id()}`, 'PATCH', {}).then(() => {
            alert('Cache Refreshed');
        }).catch(e => {
            console.error(e);
            alert('Error occurred while refreshing cache');
        });
    }

    public Remove() {
        if (!this._id()) {
            this.Buy.RemoveProduct(this.index);
            return;
        }
        // @ts-ignore
        Request<DataOperationResult<string>>(`${mp}/api/artist/product/${this._id()}`, 'DELETE', {}).then(() => {
            this.Buy.RemoveProduct(this.index);
            alert('Product removed');
        }).catch(e => {
            console.error(e);
            alert('Error occurred while deleting product');
        });
    }

}
export default ArtistProduct;