import * as ko from 'knockout';
import EventListViewModel from './EventListViewModel';
import { JWTAuth } from '../Utils/JWTAuth';


const auth = new JWTAuth();
// @ts-ignore token comes from global JS
auth.set(token);

const vm: EventListViewModel = new EventListViewModel(auth);

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

ko.bindingHandlers.jwPlayer = {
    init: function(element, valueAccessor, allBindingsAccessor) {
        const videoUrl = ko.utils.unwrapObservable(valueAccessor());
        const allBindings = allBindingsAccessor();

        const videoSources = [];
        if (videoUrl) {
            videoSources.push(
                {
                    file: videoUrl
                }
            );
        }
        // @ts-ignore
        const options = {
            playlist: [{
                // image: allBindings.posterUrl(),
                sources: videoSources
            }],
            // height: 450,
            // width: 800,
        };
        // @ts-ignore
        jwplayer(allBindings.playerId).setup(options);
    },

    update: function(element, valueAccessor, allBindingsAccessor) {
        const videoUrl = ko.utils.unwrapObservable(valueAccessor());
        const allBindings = allBindingsAccessor();

        const videoSources = [];
        if (videoUrl) {
            videoSources.push(
                {
                    file: videoUrl
                }
            );
        }


        const playlist = [{
            // image: allBindings.posterUrl(),
            sources: videoSources
        }];
        /*
        // @ts-ignore
        jwplayer(allBindings.playerId).onReady(function() {
            // @ts-ignore
            jwplayer(allBindings.playerId).load(playlist);
        });

         */
    }
};

const koRoot = document.getElementById('koroot');
ko.applyBindings(vm, koRoot);