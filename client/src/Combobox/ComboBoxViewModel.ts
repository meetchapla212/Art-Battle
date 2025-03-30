import { PagingViewModel } from './PagingViewModel';
import { Observable, ObservableArray } from 'knockout';
import { ItemViewModel } from './ItemViewModel';
import * as ko from 'knockout';
export class ComboBoxViewModel {
    private options: any;
    private searchText: Observable<string> = ko.observable('');
    private placeholder: string;
    private readonly dataSource: any;
    private functionDataSource: any;
    private readonly selectedObservable: any;
    private dropdownVisible: Observable<boolean> = ko.observable<boolean>();
    private readonly dropdownItems: ObservableArray<any> = ko.observableArray<any>();
    private searchHasFocus: Observable<boolean> = ko.observable<boolean>();
    private paging: any;
    private currentActiveIndex: number;
    private rowTemplate: string;
    private readonly viewModel: any;
    private explicitSet: boolean;
    private searchTimeout: NodeJS.Timer;
    constructor(options: {[key: string]: any; }, viewModel: any, selectedObservable: { (): any; (): void; }) {
        this.options = options;
        this.searchText.subscribe(this.onSearch, this);
        this.placeholder = options.placeholder;
        this.viewModel = viewModel;
        this.dataSource = this.options.dataSource;
        this.functionDataSource = !ko.isObservable(this.dataSource) && typeof this.dataSource == 'function'
            ? this.dataSource
            : this.searchOnClientSide.bind(this);

        this.selectedObservable = selectedObservable;
        this.selectedObservable.subscribe(this.setSelectedText, this);

        if (selectedObservable() != null) {
            this.setSelectedText(selectedObservable());
        }

        this.dropdownItems(options.dropdownItemsArray);


        this.paging = new PagingViewModel(options, this.getData.bind(this), this.dropdownItems, this.forceFocus.bind(this));
        this.currentActiveIndex = 0;

        this.rowTemplate = options.rowTemplate.replace('$$valueMember&&', options.valueMember);
    }

    public onKeyPress(context: any, e: { keyCode: any; }) {
        switch (e.keyCode) {
            case 27:
                this.hideDropdown();
                return false;
            case 13:
                if (this.dropdownVisible()) {
                    this.selected(this.getCurrentActiveItem());
                } else {
                    this.forceShow();
                }
                return false;
            case 38:
                this.navigate(-1);
                return false;
            case 40:
                this.navigate(1);
                return false;
            default:
                return true;
        }
    }

    onSearch(value: string) {
        if (this.explicitSet || value.length < this.options.minimumSearchTextLength) {
            return;
        }

        this.resetDropdown();
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(this.getData.bind(this), this.options.keyPressSearchTimeout);
    }

    isThenable(object: { then: any; }) {
        return this.isObject(object) && typeof object.then === 'function';
    }

    isObject(value: { then: any; }) {
        return value === Object(value);
    }

    getData(page?: number) {
        const text = this.searchText();
        const callback = function(result: any) {
            if (this.searchText() == text) {
                this.getDataCallback(result);
            }
        }.bind(this);
        const options = {
            text: text,
            page: page ? page : 0,
            pageSize: this.options.pageSize,
            total: this.paging.totalCount(),
            callback: callback
        };
        const result = this.functionDataSource.call(this.viewModel, options);
        if (result) {
            delete options.callback;
            if (this.isThenable(result)) {
                result.then(callback);
            } else {
                callback(result);
            }
        }
    }

    getDataCallback(result: { data: any[]; total: any; }) {
        const arr = ko.utils.arrayMap(result.data, function (item) {
            return new ItemViewModel(item);
        });
        this.dropdownItems(arr);
        this.paging.totalCount(result.total);
        this.dropdownVisible(true);
        this.navigate(0);
    }

    forceFocus() {
        this.searchHasFocus(true);
    }

    resetDropdown() {
        this.currentActiveIndex = 0;
        this.paging.reset();
    }

    selected(item: { item: any; }) {
        this.forceFocus();
        this.selectedObservable(item.item);
        this.hideDropdown();
    }

    setSelectedText(item: { [x: string]: any; }) {
        this.explicitSet = true;
        this.searchText(this.getLabel(item));
        this.explicitSet = false;
    }

    hideDropdown() {
        this.dropdownVisible(false);
    }

    showDropdown() {
        this.dropdownVisible(true);
    }

    forceShow() {
        this.forceFocus();
        if (this.paging.itemCount() == 0) {
            this.getData();
        } else {
            this.showDropdown();
        }
    }

    navigate(direction: number) {
        if (this.dropdownItems().length > 0 && this.dropdownVisible()) {
            if (direction !== 0) {
                this.unnavigated(this.getCurrentActiveItem());
                this.currentActiveIndex += direction;
            }
            this.currentActiveIndex = this.currentActiveIndex < 0 ? 0 : this.currentActiveIndex;
            this.currentActiveIndex = this.currentActiveIndex >= this.paging.itemCount() ? this.paging.itemCount() - 1 : this.currentActiveIndex;
            this.navigated(this.getCurrentActiveItem());
        }
    }

    getCurrentActiveItem() {
        return this.dropdownItems()[this.currentActiveIndex];
    }

    navigated(item: { navigated: (arg0: boolean) => void; }) {
        // if (item)
            item.navigated(true);
    }

    unnavigated(item: { navigated: (arg0: boolean) => void; }) {
        item.navigated(false);
    }

    active(item: { active: (arg0: boolean) => void; }) {
        item.active(true);
    }

    inactive(item: { active: (arg0: boolean) => void; }) {
        item.active(false);
    }

    getLabel(item: { [x: string]: any; }) {
        return ko.utils.unwrapObservable(item ? item[this.options.valueMember] : null);
    }

    searchOnClientSide(options: { text: any; pageSize: number; page: number; }) {
        const lowerCaseText = (options.text || '').toLowerCase();
        const filtered = ko.utils.arrayFilter(ko.utils.unwrapObservable(this.dataSource), function (item: any) {
            return this.getLabel(item).toLowerCase().slice(0, lowerCaseText.length) === lowerCaseText;
        }.bind(this));
        return {
            total: filtered.length, // be sure of calculate length before splice
            data: filtered.splice(options.pageSize * options.page, options.pageSize)
        };
    }
}