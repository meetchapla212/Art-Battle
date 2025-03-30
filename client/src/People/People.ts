import * as ko from 'knockout';
import PeopleViewModel from './PeopleViewModel';
import { JWTAuth } from '../Utils/JWTAuth';


const auth = new JWTAuth();
// @ts-ignore token comes from global JS
auth.set(token);

const vm: PeopleViewModel = new PeopleViewModel(auth);

const koRoot = document.getElementById('koroot');
ko.bindingHandlers.modal = {
    init: function (element, valueAccessor) {
        // @ts-ignore
        $(element).modal({
            show: false,
            backdrop: 'static',
            keyboard: false
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
ko.applyBindings(vm, koRoot);