(function () {
    'use strict';

    function deepRedirectToNative(Event) {
        var obj = {
            eventId: Event.eventId,
            flag: Event.flag,
            flagPng: Event.flagPng,
            openStatus: Event.openStatus,
            openVoting: Event.openVoting,
            statusColor: '',
            statusText: Event.statusText,
            statusTextColor: '',
            title: Event.title,
            Votes: 0,
        };
        // @ts-ignore
        if (typeof Android !== 'undefined' && Android !== null) {
            // @ts-ignore
            Android.openRegistration(obj);
        }
        else {
            window.location.href = "ios::closepayment::" + JSON.stringify(obj);
        }
    }

    deepRedirectToNative({
        eventId: '',
        flag: '',
        flagPng: '',
        openStatus: true,
        openVoting: true,
        statusText: 'open',
        title: ''
    });

}());
