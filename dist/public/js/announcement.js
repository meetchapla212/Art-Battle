(function (ko) {
    'use strict';

    var AnnouncementViewModel = /** @class */ (function () {
        function AnnouncementViewModel() {
            this.Message = ko.observable('');
            this.disableSubmit = ko.observable(false);
        }
        AnnouncementViewModel.prototype.messageClick = function (message) {
            this.Message(message);
        };
        AnnouncementViewModel.prototype.submitForm = function (form) {
            $(form).find('button').addClass('disabled');
            if (!this.disableSubmit()) {
                // submit is allowed
                this.disableSubmit(true);
                return true;
            }
            else {
                return false;
            }
        };
        return AnnouncementViewModel;
    }());

    /// <reference path='../Common/ArrayExtensions.ts'/>
    var koRoot = document.getElementById('koroot');
    var vm = new AnnouncementViewModel();
    ko.applyBindings(vm, koRoot);

}(ko));
