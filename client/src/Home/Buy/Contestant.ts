import ContestantDTO from '../../../../shared/ContestantDTO';
import ArtistProduct from './ArtistProduct';
import HomeScreenViewModel from '../HomeScreenViewModel';
import Buy from '../Buy';

class Contestant {
    public ArtistId: KnockoutObservable<number> = ko.observable<number>();
    public ArtistName: KnockoutObservable<string> = ko.observable<string>('');
    public Parent: Buy;
    public _id: KnockoutObservable<any> = ko.observable<any>();

    public constructor(Vm: HomeScreenViewModel, Parent: Buy, dto: ContestantDTO) {
        this.ArtistId(dto.EntryId);
        this.ArtistName(dto.Name);
        dto.WooProducts.forEach((el) => {
            Parent.Products().push(new ArtistProduct(Vm, Parent, this, el,  Parent.Products().length));
        });
        Parent.Products.notifySubscribers();
        this.Parent = Parent;
        this._id(dto._id);
    }
}

export default Contestant;