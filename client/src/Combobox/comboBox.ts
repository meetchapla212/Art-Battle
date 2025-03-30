import { ComboBoxBinding, renderTemplate } from './ComboBoxBinding';

(function () {
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
    };
} ());