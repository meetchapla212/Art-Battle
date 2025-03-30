import * as ko from 'knockout';
import { BusyTracker } from '../Utils/BusyTracker';
import { Request } from '../Utils/GatewayFunctions';
import { DataOperationResult } from '../../../shared/OperationResult';
import { EventList } from '../../../shared/EventListResponseDTO';
import { EventView } from './EventView';
import { JWTAuth } from '../Utils/JWTAuth';

export class EventListViewModel {
    public busy: KnockoutObservable<boolean> = ko.observable<boolean>(false);

    public EventListUpdater: BusyTracker = new BusyTracker();

    public EventListView: KnockoutObservableArray<EventView> = ko.observableArray<EventView>();

    public ErrorMessage: KnockoutObservable<string> = ko.observable<string>();

    public Loading: KnockoutObservable<boolean> = ko.observable<boolean>(true);

    // From iOS: await ko.contextFor(document.getElementById('koroot')).$data.Auth().set('token')
    public Auth: KnockoutObservable<JWTAuth> = ko.observable<JWTAuth>();
    public EventId: KnockoutObservable<any> = ko.observable<any>();
    public VoterHash: KnockoutObservable<string> = ko.observable<string>();
    // @ts-ignore comes from webview
    public PhoneHash: KnockoutObservable<string> = ko.observable<string>(phoneHash);
    // used in view
    public showMessageAlert: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public TopPlayerUrl: KnockoutObservable<string> = ko.observable<string>('');
    public constructor(auth: JWTAuth) {
        this.Auth(auth);
        // @ts-ignore
        this.EventId(eventId); // coming from html
        // @ts-ignore
        this.VoterHash(hash); // coming from html
        this.showMessageAlert(!this.EventId() || this.EventId().length === 0);
        const me = this;
        if (!this.EventId()) {
            if (!window.history.state || (window.history.state && window.history.state.page !== 'eventList')) {
                window.history.pushState({
                    page: 'eventList'
                }, 'Event List', '/event/eventList');
            }
        }
        window.addEventListener('popstate', function (event) {
            setTimeout(() => {
                if (history.state && history.state.page === 'eventList') {
                    me.EventId('');
                    me._populateEventList().catch((e) => console.error(e));
                } else if (history.state && history.state.id) {
                    me.EventId(history.state.id);
                    me._populateEventList().catch((e) => console.error(e));
                }
            }, 0);
        }, false);
        this._populateEventList().catch(e => {
            if (e) {
                console.error(e);
            } else {
                console.error('error in e');
            }
        }).then(() => {
            this.Loading(false);
        });
    }

    private async _populateEventList() {
        this.Loading(true);
        this.EventListView([]);
        // @ts-ignore
        const result = await  this.EventListUpdater.AddOperation(Request<DataOperationResult<EventList[]>>(`${mp}/api/eventList?Timezone=${Intl.DateTimeFormat().resolvedOptions().timeZone}&eventId=${this.EventId()}`, 'GET', null, null, await this.Auth().get()));
        if (result.Success) {
            for (let i = 0; i < result.Data.length; i++) {
                this.TopPlayerUrl(result.Data[i].topPlayerUrl);
                for (let j = 0; j < result.Data[i].items.length; j++) {
                    const eventView = new EventView(result.Data[i].items[j], this.Auth(), this);
                    if (eventView.eventId == this.EventId()) {
                        await eventView.handleEventView(this);
                        await eventView.show(true);
                        this.EventListView([eventView]);
                        break;
                    } else {
                        eventView.show(false);
                        eventView.Expanded(eventView.Expanded().toLowerCase().replace('expanded', ''));
                        this.EventListView.push(eventView);
                    }
                }
            }
        } else {
            this.ErrorMessage('An Error occurred');
        }
        this.Loading(false);
    }

    public async makeOthersActive(roundNumber: number, eventId: string) {
        const promises: any[] = [];
        for (let j = 0; j < this.EventListView().length; j++) {
            const event = this.EventListView()[j];
            const rounds = this.EventListView()[j].Rounds();
            for (let i = 0; i < rounds.length; i++) {
                if (eventId === event.eventId && rounds[i].RoundNumber === roundNumber) {
                    rounds[i].Active('active');
                } else {
                    rounds[i].Active('');
                }
            }
        }
        try {
            await Promise.all(promises);
        } catch (e) {
            console.error('error in getting auction detail');
        }
    }

    public manageEventVisibility(eventId: string) {
        this.Loading(true);
        for (let j = 0; j < this.EventListView().length; j++) {
            const event = this.EventListView()[j];
            if (event.eventId !== eventId) {
                event.Expanded('');
                event.show(false);
            } else {
                event.show(true);
                this.EventListView([event]); // show only this event in UI
                this.EventId(event.eventId);
                if (!this.VoterHash() && (!window.history.state || (window.history.state && window.history.state.page !== 'event-detail'))) {
                    window.history.pushState({
                        id: eventId,
                        page: 'event-detail'
                    }, 'Event Detail', `/event/${event.eventId}/detail`);
                } else {
                    console.log('page exists in history already');
                }
            }
        }
        this.Loading(false);
    }
}
export default EventListViewModel;