export class ItemViewModel {
    private item: any;
    public navigated: KnockoutObservable<any> = ko.observable<any>();
    public active: KnockoutObservable<any> = ko.observable<any>();
    public constructor(item: any) {
        this.item = item;
    }
}