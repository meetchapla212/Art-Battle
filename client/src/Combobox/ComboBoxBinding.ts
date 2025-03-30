import { ComboBoxViewModel } from "./ComboBoxViewModel";
import * as ko from 'knockout';
import { BindingContext } from 'knockout';
import { stringTemplateSource } from './StringTemplateSource';

const comboboxTemplate = '<div data-bind="event: { keydown: onKeyPress }">\
        <input data-bind="value: searchText, valueUpdate: \'afterkeydown\', hasfocus: searchHasFocus, attr: { placeholder: placeholder }"></input><button type="button" class="btn btn-arrow" data-bind="click: forceShow, css: { open: dropdownVisible }"><span class="caret"></span></button>\
        <div class="dropdown-menu" data-bind="visible: dropdownVisible, __cb__clickedIn: dropdownVisible">\
            <!-- ko foreach: dropdownItems -->\
                <div data-bind="click: $parent.selected.bind($parent), event: { mouseover: $parent.active.bind($parent), mouseout: $parent.inactive.bind($parent) }, css: { active: navigated, highlighted: active },  __cb__flexibleTemplate: { template: $parent.rowTemplate, data: $data.item }"></div>\
            <!-- /ko -->\
            <div class="nav" data-bind="with: paging">\
                <p class="counter">Showing <span data-bind="text: currentFloor"></span>-<span data-bind="text: currentRoof"></span> of <span data-bind="text: totalCount"></span></p>\
                <div class="pagination"><ul data-bind="visible: show, foreach: pages"><li data-bind="click: $parent.pageSelected.bind($parent), text: name, disable: isCurrent, css: {current: isCurrent}"></li></ul></div>\
            </div>\
        </div>\
    </div>';
const rowTemplate = '<span data-bind="text: $$valueMember&&"></span>';
const defaultOptions: {[key: string]: any;} = {
    comboboxTemplate: comboboxTemplate,
    rowTemplate: rowTemplate,
    valueMember: "name",
    pageSize: 10,
    paging: true,
    pagingLinks: 4,
    keyPressSearchTimeout: 200,
    minimumSearchTextLength: 1
};
export class ComboBoxBinding {
    /*private PagingViewModel: PagingViewModel;
    private ItemViewModel: ItemViewModel;
    private ComboBoxViewModel: ComboBoxViewModel;*/
    constructor() {
        /*this.PagingViewModel = new PagingViewModel;
        this.ItemViewModel = ItemViewModel;
        this.ComboBoxViewModel = ComboBoxViewModel;*/
    }
    setDefaults(options: any) {
        ko.utils.extend(defaultOptions, options);
    }

    init(element: HTMLElement, valueAccessor: () => void, allBindingsAccessor: { (): { comboboxValue: any; }; (): { comboboxValue: any; }; (): { comboboxValue: any; }; }, viewModel: any, bindingContext: BindingContext) {
        const options: {[key: string]: string;} = ko.utils.unwrapObservable<any>(valueAccessor());
        for (const index in defaultOptions) {
            if (options[index] === undefined) {
                options[index] = defaultOptions[index];
            }

        }
        const me = this;
        const selectedIsObservable = ko.isObservable(allBindingsAccessor().comboboxValue);
        const selected = ko.computed({
            // @ts-ignore // TODO find solution
            read: function () {
                return ko.utils.unwrapObservable(allBindingsAccessor().comboboxValue);
            },
            write: function (value: any) {
                me.writeValueToProperty(allBindingsAccessor().comboboxValue, allBindingsAccessor, 'comboboxValue', value);
                if (!selectedIsObservable) selected.notifySubscribers(value);
            },
            disposeWhenNodeIsRemoved: element
        });

        const model = new ComboBoxViewModel(options, viewModel, selected);
        renderTemplate(element, options.comboboxTemplate, model, bindingContext);

        return { controlsDescendantBindings: true };
    }



    // TODO: remove this function when writeValueToProperty is made public by KO team
    writeValueToProperty(property: { (arg0: any): void; peek: () => void; }, allBindingsAccessor: () => { [x: string]: any; }, key: string | number, value: any, checkIfDifferent?: false) {
        if (!property || !ko.isObservable(property)) {
            const propWriters = allBindingsAccessor()['_ko_property_writers'];
            if (propWriters && propWriters[key])
                propWriters[key](value);
        } else if (ko.isWriteableObservable(property) && (!checkIfDifferent || property.peek() !== value)) {
            property(value);
        }
    }
}

export function renderTemplate(element: HTMLElement, template: string, data: any, bindingContext: BindingContext) {
    const engines: {[key: string] : Object} = {};
    const stringTemplateEngine = new ko.nativeTemplateEngine();
    stringTemplateEngine.makeTemplateSource = function (template) {
        return new stringTemplateSource(template);
    };
    let engine = engines[template];

    let success = false;
    do {
        try {
            ko.renderTemplate(template, bindingContext.createChildContext(data), engine, element, "replaceChildren");
            success = true;
            engines[template] = engine;
        } catch (err) {
            if (engine != null)
                throw "Template engine not found";

            engine = { templateEngine: stringTemplateEngine };
        }

    } while (!success)
}