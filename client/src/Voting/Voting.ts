import * as ko from 'knockout';
import VotingScreenViewModel from './VotingScreenViewModel';

const vm: VotingScreenViewModel = new VotingScreenViewModel();

ko.components.register('progress-bar', {
    viewModel: function(params: {progress: number, totalUploads: number}) {
        const that = this;
        // progress is a numeric value between 0 and 100
        that.progress = params.progress;
        that.totalUploads = params.totalUploads;

        that.progressPercentual = ko.computed(function() {
            return '' + Math.round(ko.utils.unwrapObservable(that.progress)) + '%';
        });
    },
    template:
        '<div class="progress" style="height: 22px; margin-bottom: 2px;">' +
            '<div class="progress-bar progress-bar-striped progress-bar-success active" data-bind="text: `Uploading - ${progressPercentual()}`, style:{width:progressPercentual()}, attr: {\'aria-valuenow\':progress}" style="height: 22px; background-color: #10CB00; min-width: 16em; line-height: 20px;" role="progressbar" aria-valuemin="0" aria-valuemax="100">' +
            '</div>' +
        '</div>'
});

ko.bindingHandlers.beforeUnloadText = {
    init: function(element, valueAccessor, allBindingsAccessor, viewModel) {
        if (window.onbeforeunload == null && !(navigator.userAgent.match(/iPad/i) || navigator.userAgent.match(/iPhone/i)) ) {
            // in ios this event is not supported
            window.onbeforeunload = function() {
                const value = valueAccessor();
                const promptText = ko.utils.unwrapObservable(value);
                if (typeof promptText == 'undefined' || promptText == null) {
                    // Return nothing.  This will cause the prompt not to appear
                } else {
                    if (promptText != null && typeof promptText != 'string') {
                        const err = 'Error: beforeUnloadText binding must be ' +
                            'against a string or string observable.  ' +
                            'Binding was done against a ' + typeof promptText;
                        console.error(err);
                        return err;
                    }
                    return promptText;
                }
            };

        } else {
            const err = 'onbeforeupload has already been set';
            console.error(err);
        }
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
        }
    }
};

const koRoot = document.getElementById('koroot');
ko.applyBindings(vm, koRoot);