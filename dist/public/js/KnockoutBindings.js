/// <reference types="knockout" />
/// <reference types="ladda" />
ko.bindingHandlers.buttonbusy = {
    update: function (element, valueAccessor, allBindings, viewModel, bindingContext) {
        const l = Ladda.create(element);
        const value = ko.unwrap(valueAccessor());
        value ? l.start() : l.stop();
    }
};

//# sourceMappingURL=KnockoutBindings.js.map
