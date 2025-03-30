/// <reference path='../Common/ArrayExtensions.ts'/>
/// <reference path='../Common/StringExtensions.ts'/>

import * as ko from 'knockout';
import 'knockout-punches';
import {
    infiniteScrollBindingHandler,
    // @ts-ignore
} from '@profiscience/knockout-contrib';
import HomeScreenViewModel from './HomeScreenViewModel';

const vm: HomeScreenViewModel = new HomeScreenViewModel();

const koRoot = document.getElementById('koroot');


const ENTER_KEY = 13;

// a custom binding to handle the enter key (could go in a separate library)
ko.bindingHandlers.enterKey = {
    init: function( element, valueAccessor, allBindingsAccessor, data, context ) {

        // wrap the handler with a check for the enter key
        const wrappedHandler = function( data: any, event: KeyboardEvent ) {
            if ( event.keyCode === ENTER_KEY ) {
                valueAccessor() && valueAccessor().call( this, data, event );
            }
        };

        // create a valueAccessor with the options that we would want to pass to the event binding
        const newValueAccessor = function() {
            return {
                keyup: wrappedHandler
            };
        };


        // call the real event binding's init function
        ko.bindingHandlers.event.init( element, newValueAccessor, allBindingsAccessor, data, context );
    }
};

ko.bindingHandlers.modal = {
    init: function (element, valueAccessor) {
        // @ts-ignore
        $(element).modal({
            show: false
        });
        const value = valueAccessor();
        if (ko.isObservable(value)) {
            $(element).on('hidden.bs.modal', function() {
                value(false);
            });
        }
    },
    update: function (element, valueAccessor) {
        const value = valueAccessor();
        if (ko.utils.unwrapObservable(value)) {
            // @ts-ignore
            $(element).modal('show');
        } else {
            // @ts-ignore
            $(element).modal('hide');
            $('.modal-backdrop').remove();
        }
    }
};

/*
ko.bindingHandlers.combobox = new ComboBoxBinding();
if (ko.expressionRewriting._twoWayBindings) {
    ko.expressionRewriting._twoWayBindings.comboboxValue = true;
}

ko.bindingHandlers.__cb__flexibleTemplate = {
    init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        const options = ko.utils.unwrapObservable(valueAccessor());
        renderTemplate(element, options.template, options.data, bindingContext);

        return { controlsDescendantBindings: true };
    }
};

ko.bindingHandlers.__cb__clickedIn = {
    init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        const target = valueAccessor();
        console.log('target', target);
        let clickedIn = false;
        // @ts-ignore //TODO once it works find out what's wrong
        ko.utils.registerEventHandler(document, 'click', function (e: MouseEvent) {
            if (!clickedIn) {
                target(e.target == element);
            }

            clickedIn = false;
        });

        ko.utils.registerEventHandler(element.parentNode || element.parentElement, 'click', function (e) {
            clickedIn = true;
        });
    }
};*/
ko.bindingHandlers.ko_autocomplete = {
    init: function(element, params) {
        // @ts-ignore
        $(element).autocomplete(params());
    },
    update: function(element, params) {
        // @ts-ignore
        $(element).autocomplete('option', 'source', params().source);
    }
};

ko.bindingHandlers.autoComplete = {
    // Only using init event because the Jquery.UI.AutoComplete widget will take care of the update callbacks
    init: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        const settings = valueAccessor();

        const selectedOption = settings.selected;
        const options = settings.options;
        const updateElementValueWithLabel = function (event: MouseEvent, ui: { item: { label: string | number | string[]; }; }) {
            // Stop the default behavior
            event.preventDefault();
            // Update the value of the html element with the label
            // of the activated option in the list (ui.item)
            if (ui.item) {
                $(element).val(ui.item.label);
            }

            // Update our SelectedOption observable
            if (typeof ui.item !== 'undefined') {
                // ui.item - label|value|...
                selectedOption(ui.item);
            }
        };

        // @ts-ignore
        $(element).autocomplete({
            source: options,
            select: function (event: MouseEvent, ui: { item: { label: string | number | string[]; }; }) {
                updateElementValueWithLabel(event, ui);
            },
            /*focus: function (event: MouseEvent, ui: { item: { label: string | number | string[]; }; }) {
                updateElementValueWithLabel(event, ui);
            },*/
            change: function (event: MouseEvent, ui: { item: { label: string | number | string[]; }; }) {
                updateElementValueWithLabel(event, ui);
            }
        });
    }
};

/**
 * BINDINGS
 */

// @ts-ignore
ko.subscribable.fn.subscribeChanged = function (callback) {
    let savedValue = this.peek();
    return this.subscribe(function (latestValue: any) {
        const oldValue = savedValue;
        savedValue = latestValue;
        callback(latestValue, oldValue);
    });
};

ko.bindingHandlers['infiniteScroll'] = infiniteScrollBindingHandler;
ko.applyBindings(vm, koRoot);


