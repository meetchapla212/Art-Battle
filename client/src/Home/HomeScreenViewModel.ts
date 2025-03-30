import * as ko from 'knockout';
import { Request } from '../Utils/GatewayFunctions';
import { OperationResult } from '../../../shared/OperationResult';
import { EventConfigDTO, EventHomeDto } from '../../../shared/EventDTO';
import EventEditor from './EventEditor';
import { BusyTracker } from '../Utils/BusyTracker';
import EventSummary from './EventSummary';
import Promotion from './Promotion';
import Artists from './Artists';
import Buy from './Buy';

import { ObjectId } from 'bson';
import Stats from './Stats';
import { EventStatDTO } from '../../../shared/EventStatDTO';
import AuctionList from './AuctionList';
import Artist from './Artist';
import { CityDTO } from '../../../shared/CityDTO';

export class HomeScreenViewModel {
    public ActiveEvents: KnockoutObservableArray<EventSummary> = ko.observableArray<EventSummary>();
    public ArchivedEvents: KnockoutObservableArray<EventSummary> = ko.observableArray<EventSummary>();
    public Stats: KnockoutObservableArray<Stats> = ko.observableArray<Stats>([]);
    public Promotion: KnockoutObservable<Promotion> = ko.observable<Promotion>();
    public Auction: KnockoutObservable<AuctionList> = ko.observable<AuctionList>();
    public Artists: KnockoutObservable<Artists> = ko.observable<Artists>();
    public PromotionLogs: KnockoutObservable<Promotion> = ko.observable<Promotion>();
    public Buy: KnockoutObservable<Buy> = ko.observable<Buy>();
    public Editor: KnockoutObservable<EventEditor> = ko.observable<EventEditor>();
    public OpenPopup: KnockoutObservable<boolean> = ko.observable<boolean>();
    public SelectedArtist: KnockoutObservable<Artist> = ko.observable<Artist>();
    public Cities: KnockoutObservableArray<CityDTO> = ko.observableArray<CityDTO>();
    public LoadingTracker: BusyTracker = new BusyTracker();

    public selectedEvent: KnockoutObservable<Promotion> = ko.observable<Promotion>();
    public multipleSelectedOptionValues: KnockoutObservableArray<Promotion> = ko.observableArray<Promotion>([]);

    // used in view
    public selectedText: KnockoutReadonlyComputed<any> = ko.computed(() => {

        return ko.utils.arrayMap(this.multipleSelectedOptionValues(), (val: { title: any; id: any; }) => {
            return {
                title: val.title,
                id: val.id
            };
        });

    });

    public guestCount: KnockoutObservable<any> = ko.observable<any>();
    public Loading: KnockoutObservable<boolean> = ko.observable<false>();

    public constructor() {

        const promotion = new Promotion(this);
        const auctionObj = new AuctionList(this);
        const buyObj = new Buy(this);
        this.Promotion(promotion);
        this.Auction(auctionObj);
        this.PromotionLogs(promotion);
        this.Loading(true);
        this.Artists(new Artists(this));
        this.Buy(buyObj);
        // @ts-ignore
        this.Cities(citiesDict);
        this.LoadActiveEvents().then(() => {
            return Promise.all([
                // this.LoadArchivedEvents(),
                // this.LoadStats(),
                promotion.LoadEventDropdown(''),
                promotion.LoadEventPhoneNumber(),
                promotion.LoadPromotionLogs(),
                promotion.LoadPromotionMessageLogs(),
                promotion.LoadPromotionTopVotesLogs(),
                auctionObj.LoadPaymentStatusOptions()
            ]);
        }).then(() => {
            this.Auction().LoadEventDropdown(promotion.events());
            this.Loading(false);
        }).catch(e => {
            this.Loading(false);
            console.error(e);
        });
        this.multipleSelectedOptionValues.subscribe(async () =>  {
            const res = await this.Promotion().getGuestCount(this.multipleSelectedOptionValues());
            this.guestCount(res);
        });

    }

    public AddNew() {
        this.Editor(new EventEditor({
            LiveStream: '',
            VideoStream: '',
            _id: new ObjectId().toHexString(),
            Name: '',
            Enabled: true,
            Contestants: [],
            PhoneNumber: '',
            Rounds: [],
            CurrentRound: null,
            RegistrationConfirmationMessage: '',
            ReportLinks: [],
            Logs: [],
            RegistrationsVoteFactor: [],
            VoteByLink: false,
            Description: '',
            SendLinkToGuests: false,
            EmailRegistration: false,
            Country: null,
            EventStartDateTime: '',
            EventEndDateTime: '',
            TimeZone: null,
            TicketLink: '',
            Venue: '',
            Price: '',
            EID: '',
            ShowInApp: true,
            Currency: null,
            ArtWidthHeight: '',
            AuctionDescription: '',
            AuctionStartBid: 50,
            MinBidIncrement: 10,
            AuctionNotice: '',
            AdminControlInAuctionPage: true,
            RegisterAtSMSVote: false,
            SendAuctionLinkToGuests: false,
            EnableAuction: true,
            Tax: 0,
            SponsorText: '',
            AuctionCloseRoundDelay: 0,
            AuctionCloseStartsAt: new Date()
        },
            (result) => {
                if (result) {
                    this.LoadActiveEvents().then(() => {
                        return this.LoadArchivedEvents();
                    }).catch(e => {
                        console.error(e);
                    });
                }
                this.Editor(null);
            }));

        this.Editor().IsNew(true);
    }

    public async Edit(eventId: string) {
        // @ts-ignore
        const event = await this.LoadingTracker.AddOperation(Request<EventConfigDTO>(mp + `/api/event/${eventId}`, 'GET'));
        this.Editor(new EventEditor(event, (result) => {
            if (result) {
                this.LoadActiveEvents().then(() => {
                    /*return Promise.all([
                        this.LoadArchivedEvents(),
                        this.LoadStats()
                    ]);*/
                    console.log('active events refreshed');
                })
                    .catch(e => {
                        console.error(e);
                    });
            }
            this.Editor(null);
        }));
    }

    public async Delete(event: EventSummary) {
        // @ts-ignore
        const result = await Request<OperationResult>(mp + `/api/event/${event._id}`, 'DELETE');
        if (result.Success) {
            this.ActiveEvents.remove(event);
            this.ArchivedEvents.remove(event);
        }
    }

    public async LoadActiveEvents(): Promise<void> {
        this.Loading(true);
        try {
            // @ts-ignore
            const dtos = await this.LoadingTracker.AddOperation(Request<EventHomeDto[]>(mp + '/api/events?enabled=1', 'GET'));
            if (Array.isArray(dtos)) {
                this.ActiveEvents(dtos.map(e => new EventSummary(e)));
            } else {
                this.ActiveEvents([]);
            }
        } catch (e) {
            console.error(e);
        }
        this.Loading(false);
    }

    public async LoadArchivedEvents(): Promise<void> {
        this.Loading(true);
        try {
            // @ts-ignore
            const dtos = await this.LoadingTracker.AddOperation(Request<EventHomeDto[]>(mp + '/api/events?enabled=0', 'GET'));
            if (Array.isArray(dtos)) {
                this.ArchivedEvents(dtos.map(e => new EventSummary(e)));
            } else {
                this.ArchivedEvents([]);
            }
            this.Loading(false);
        } catch (e) {
            console.error(e);
            this.Loading(false);
        }
    }

    public async LoadStats(): Promise<void> {
        this.Loading(true);
        try {
            const stats = await this.LoadingTracker.AddOperation(Request<{
                Data: EventStatDTO[],
                Success: boolean
                // @ts-ignore
            }>(mp + '/api/events-stats', 'GET'));
            if (Array.isArray(stats.Data))
                this.Stats(stats.Data.map(e => new Stats(e)));
            this.Loading(false);
        } catch (e) {
            console.error(e);
            this.Loading(false);
        }
    }

    public async LoadBuyData(): Promise<void> {
        this.Buy().ResetData();
        this.Buy().Visible(true);
        return this.Buy().LoadPaginatedData();
    }
}

export default HomeScreenViewModel;