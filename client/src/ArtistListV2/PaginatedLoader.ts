export class PaginatedLoader {
    public FullList: any[];
    public DisplayList: KnockoutObservableArray<any> = ko.observableArray<any>();
    public MoreText: KnockoutObservable<string> = ko.observable<string>();
    public CurrentPage = 0;
    public Step = 10;
    public TotalPages = 1;
    public ListLength = 0;
    public Direction = 1; // 1 = more, 0 = less

    constructor(FullList: any[]) {
        console.log('FullList', FullList);
        this.FullList = FullList;
        this.ListLength = FullList.length;
        if (this.ListLength > 10) {
            this.CurrentPage++;
            this.TotalPages = Math.ceil(this.ListLength / this.Step);
            this.handleStart();
            this.updateDisplayList();
            console.log('this.ListLength / this.Step', this.ListLength / this.Step, this.TotalPages);
        }
    }

    // used in view
    public navigate() {
        if (this.Direction === 1) {
            this.CurrentPage++;
            this.updateDisplayList();
            this.handleEnd();
        } else {
            this.CurrentPage--;
            this.updateDisplayList();
            this.handleStart();
        }
    }

    public handleEnd() {
        if (this.TotalPages === this.CurrentPage) {
            this.MoreText('Less');
            this.Direction = 0;
        }
    }

    public updateDisplayList() {
        console.log('this.CurrentPage', this.CurrentPage, this.Direction, this.Step, this.Step * ( (this.CurrentPage - 1) + this.Direction));
        this.DisplayList(this.FullList.slice(0, this.Step * ( (this.CurrentPage - 1) + 1)));
        this.DisplayList.notifySubscribers();
    }

    public handleStart() {
        if (this.CurrentPage === 1) {
            this.Direction = 1;
            this.MoreText('More');
        }
    }
}