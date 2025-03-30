import { Computed, ObservableArray } from 'knockout';
import * as ko from 'knockout';
interface Page {
    pagingLinks?: number;
    pageSize?: number;
    paging?: boolean;
    index?: number;
    dropdownItemsArray?: any[];
    placeholder?: string;
}

export class PagingViewModel {
    public options: Page = {
        pageSize: 0
    };
    public currentPage: KnockoutObservable<number> = ko.observable<number>();
    public totalCount: KnockoutObservable<number> = ko.observable<number>();
    public dropdownItems: KnockoutObservableArray<any> = ko.observableArray<any>();
    public itemCount: Computed<number> = ko.computed( () => {
        return this.dropdownItems().length;
    });
    public currentFloor: Computed<number> = ko.computed( () => {
        return this.itemCount() === 0 ? 0 : (this.currentPage() * this.options.pageSize) + 1;
    });
    public currentRoof: Computed<number> = ko.computed( () => {
        return (this.currentPage() * this.options.pageSize) + this.itemCount();
    });
    public show: Computed<boolean> = ko.computed( () => {
        return this.options.paging && this.totalCount() > this.options.pageSize;
    });
    public pages: KnockoutObservableArray<Page> = ko.observableArray<Page>();
    public forceFocus: KnockoutObservable<boolean> = ko.observable<boolean>();
    public callback: (arg0: any) => void;
    constructor(options: Page, callback: (arg0: any) => void, dropdownItems: ObservableArray, forceFocus: boolean) {
        this.options = options;
        this.currentPage(0);
        this.totalCount.subscribe(this.update, this);
        this.callback = callback;
        this.forceFocus(forceFocus);
    }

    update(count: number) {
        const current = this.currentPage();
        const pages = [];
        const totalPageCount = Math.ceil(count / this.options.pageSize);
        const maxLinks = Math.min(this.options.pagingLinks, totalPageCount);

        let min = current - (maxLinks / 2);
        let max = current + (maxLinks / 2);

        if (min < 0) {
            max += Math.abs(min);
            min = 0;
        }

        if (max > totalPageCount) {
            min = min - (max - totalPageCount);
            max = totalPageCount;
        }

        for (let i = min; i < max; i++) {
            pages.push(this.createPage(i));
        }

        this.pages(pages);
    }
    createPage(index: number) {
        return {
            name: index + 1,
            index: index,
            isCurrent: ko.computed(function () {
                return index == this.currentPage();
            }, this)
        };
    }

    pageSelected(page: Page) {
        this.forceFocus();
        this.currentPage(page.index);
        this.callback(page.index);
        this.update(this.totalCount());
    }

    reset() {
        this.currentPage(0);
    }
}