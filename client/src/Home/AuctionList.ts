import * as ko from 'knockout';
import { EventsDropDownInterface } from '../../../shared/EventDropDownDTO';

import HomeScreenViewModel from './HomeScreenViewModel';
import { Request } from '../Utils/GatewayFunctions';
import { BusyTracker } from '../Utils/BusyTracker';
import { PaymentStatusResponse } from '../../../shared/PaymentStatusResponse';
import { PaymentStatus } from './Auction/PaymentStatus';
import PaymentStatusDTO from '../../../shared/PaymentStatusDTO';
import { DataOperationResult } from '../../../shared/OperationResult';


export class AuctionList {
    public Message: KnockoutObservable<string> = ko.observable<string>('');
    public events: KnockoutObservableArray<EventsDropDownInterface> = ko.observableArray<EventsDropDownInterface>([]);
    public VM: HomeScreenViewModel;
    public SelectedAuctionEvents: KnockoutObservableArray<EventsDropDownInterface> = ko.observableArray<EventsDropDownInterface>([]);
    public LoadingTracker: BusyTracker = new BusyTracker();
    public PaymentStatuses: KnockoutObservableArray<PaymentStatus> = ko.observableArray<PaymentStatus>();
    public PaymentStatusOptions: KnockoutObservableArray<PaymentStatusDTO> = ko.observableArray<PaymentStatusDTO>([]);
    // used in view
    public selectedAuctionEventText: KnockoutReadonlyComputed<any> = ko.computed(() => {

        return ko.utils.arrayMap(this.SelectedAuctionEvents(), (val: EventsDropDownInterface) => {
            return {
                title: val.title,
                id: val.eventId
            };
        });

    });

    public SelectedAuctionEventIds: KnockoutReadonlyComputed<any> = ko.computed(() => {
        return ko.utils.arrayMap(this.SelectedAuctionEvents(), (val: EventsDropDownInterface) => {
            return val.eventId;
        });
    });

    public constructor(VM: HomeScreenViewModel) {
        this.VM = VM;
    }

    public async LoadPaymentStatusOptions() {
        try {
            // @ts-ignore
            const result = await this.LoadingTracker.AddOperation(Request<DataOperationResult<PaymentStatusDTO[]>>(mp + '/api/auction/list/payment-status-options', 'GET'));
            this.PaymentStatusOptions(result.Data);
        } catch (e) {
            console.error(e);
            // TODO show error message
        }
    }

    public LoadEventDropdown(events: EventsDropDownInterface[]) {
        this.events(events);
        // @ts-ignore
        jQuery(document).ready(() => {
            // @ts-ignore
            jQuery('.search-box-auction-event').SumoSelect({
                csvDispCount: 3,
                selectAll: true,
                search: true,
                searchText: 'Enter here.',
                okCancelInMulti: true
            });
        });
        this.SelectedAuctionEventIds.subscribe(this.fetchLots.bind(this));
    }

    public async fetchLots() {
        if (this.SelectedAuctionEventIds().length === 0) {
            return;
        }
        this.VM.Loading(true);
        try {
            // @ts-ignore
            const result = await this.LoadingTracker.AddOperation(Request<DataOperationResult<PaymentStatusResponse[]>>(mp + '/api/auction/payment-status', 'POST', {
                eventIds: this.SelectedAuctionEventIds()
            }));
            if (Array.isArray(result.Data)) {
                const paymentStatuses = result.Data.map(e => {
                    return new PaymentStatus(e, this.PaymentStatusOptions());
                });
                this.PaymentStatuses(paymentStatuses);
            } else {
                this.PaymentStatuses([]);
            }
        } catch (e) {
            // TODO
            console.error(e);
        }
        this.VM.Loading(false);
    }
}

export default AuctionList;