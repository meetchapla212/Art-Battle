/// <reference types="knockout" />
/// <reference types="ladda" />
/// <reference types="jquery" />
import * as ko from 'knockout';
ko.bindingHandlers.buttonbusy = {
    update: function(element: HTMLElement, valueAccessor: () => KnockoutObservable<boolean>, allBindings, viewModel, bindingContext) {
        const l = Ladda.create(element);
        const value = ko.unwrap(valueAccessor());
        value ? l.start() : l.stop();
    }
};