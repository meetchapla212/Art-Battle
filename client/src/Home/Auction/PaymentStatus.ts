import { PaymentStatusResponse } from '../../../../shared/PaymentStatusResponse';
import * as ko from 'knockout';
import { BidDTO } from '../../../../shared/BidDTO';
import PaymentStatusDTO from '../../../../shared/PaymentStatusDTO';
import { ArtistIndividualImage } from '../../../../shared/RoundContestantDTO';
import { Request } from '../../Utils/GatewayFunctions';
import HomeScreenViewModel from '../HomeScreenViewModel';
import { BusyTracker } from '../../Utils/BusyTracker';
import { DataOperationResult } from '../../../../shared/OperationResult';
const month = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'June',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
];

export class PaymentStatus {
    public LotId: KnockoutObservable<string> = ko.observable<string>('');
    public ArtistName: KnockoutObservable<string> = ko.observable<string>('');
    public ArtistId: KnockoutObservable<string> = ko.observable<string>('');
    public Bids: KnockoutObservableArray<BidDTO> = ko.observableArray<BidDTO>();
    public EventName: KnockoutObservable<string> = ko.observable<string>('');
    public ArtId: KnockoutObservable<string> = ko.observable<string>('');
    public CurrencySymbol: KnockoutObservable<string> = ko.observable<string>('');
    public ArtistPayRecentStatus: KnockoutObservable<PaymentStatusDTO> = ko.observable<PaymentStatusDTO>();
    public BuyerPayRecentStatus: KnockoutObservable<PaymentStatusDTO> = ko.observable<PaymentStatusDTO>();
    public Image: KnockoutObservable<ArtistIndividualImage> = ko.observable<ArtistIndividualImage>();
    public BuyerPayRecentDate: KnockoutObservable<Date> = ko.observable<Date>();
    public ArtistPayRecentDate: KnockoutObservable<Date> = ko.observable<Date>();
    public FormattedBuyerPayRecentDate: KnockoutObservable<string> = ko.observable<string>();
    public FormattedArtistPayRecentDate: KnockoutObservable<string> = ko.observable<string>();
    public BuyerPayRecentUser: KnockoutObservable<string> = ko.observable<string>();
    public ArtistPayRecentUser: KnockoutObservable<string> = ko.observable<string>();
    public selectedBuyerPayRecentStatus: KnockoutObservable<string> = ko.observable<string>();
    public selectedArtistPayRecentStatus: KnockoutObservable<string> = ko.observable<string>();

    public PaymentStatusOptions: KnockoutObservableArray<PaymentStatusDTO> = ko.observableArray<PaymentStatusDTO>([]);
    public LoadingTracker: BusyTracker = new BusyTracker();

    public constructor(paymentStatus: PaymentStatusResponse, PaymentStatusOptions: PaymentStatusDTO[]) {
        this.LotId(paymentStatus.LotId);
        this.ArtistName(paymentStatus.ArtistName);
        this.ArtistId(paymentStatus.ArtistId);
        const bids = paymentStatus.Bids.sort((a, b) => {
           return a.Amount - b.Amount;
        }).slice(0, 3);
        this.Bids(bids);
        this.EventName(paymentStatus.EventName);
        this.ArtId(paymentStatus.ArtId);
        this.ArtistPayRecentStatus(paymentStatus.ArtistPayRecentStatus);
        this.BuyerPayRecentStatus(paymentStatus.BuyerPayRecentStatus);
        this.Image(paymentStatus.Image);
        this.PaymentStatusOptions(PaymentStatusOptions);
        this.BuyerPayRecentDate(paymentStatus.BuyerPayRecentDate);
        this.ArtistPayRecentDate(paymentStatus.ArtistPayRecentDate);
        if (this.BuyerPayRecentDate()) {
            this.FormattedBuyerPayRecentDate(this._formatDate(this.BuyerPayRecentDate().toString()));
        }
        if (this.ArtistPayRecentDate()) {
            this.FormattedArtistPayRecentDate(this._formatDate(this.ArtistPayRecentDate().toString()));
        }
        this.BuyerPayRecentUser(paymentStatus.BuyerPayRecentUser);
        this.ArtistPayRecentUser(paymentStatus.ArtistPayRecentUser);
        this.selectedArtistPayRecentStatus(paymentStatus.ArtistPayRecentStatus && paymentStatus.ArtistPayRecentStatus._id);
        this.selectedBuyerPayRecentStatus(paymentStatus.BuyerPayRecentStatus && paymentStatus.BuyerPayRecentStatus._id);
        this.CurrencySymbol(paymentStatus.CurrencySymbol);
    }

    // used in view
    public async markArtistPaid(VM: HomeScreenViewModel) {
        VM.Loading(true);
        try {
            const result = await this.LoadingTracker.AddOperation(Request<DataOperationResult<{
                ArtistPayRecentDate: Date;
                ArtistPayRecentUser: string;
            }>>(
                // @ts-ignore
                mp + '/api/auction/mark-artist-paid', 'POST', {
                    LotId: this.LotId(),
                    ArtistPayRecentStatus: this.selectedArtistPayRecentStatus(),
                    ArtistId: this.ArtistId()
                }));
            this.ArtistPayRecentDate(result.Data.ArtistPayRecentDate);
            this.ArtistPayRecentUser(result.Data.ArtistPayRecentUser);

        } catch (e) {
            console.error(e);
        }
        VM.Loading(false);
    }

    // used in view
    public async markBuyerPaid(VM: HomeScreenViewModel) {
        VM.Loading(true);
        try {
            const result = await this.LoadingTracker.AddOperation(Request<DataOperationResult<{
                BuyerPayRecentDate: Date;
                BuyerPayRecentUser: string;
            }>>(
                // @ts-ignore
                mp + '/api/auction/mark-buyer-paid', 'POST', {
                    LotId: this.LotId(),
                    BuyerPayRecentStatus: this.selectedBuyerPayRecentStatus()
                }));
            this.BuyerPayRecentDate(result.Data.BuyerPayRecentDate);
            this.BuyerPayRecentUser(result.Data.BuyerPayRecentUser);
        } catch (e) {
            console.error(e);
        }
        VM.Loading(false);
    }

    private _formatDate(dateStr: string) {
        const dateObj = new Date(dateStr);
        const hours = this._pad(dateObj.getHours());
        const minutes = this._pad(dateObj.getMinutes());
        const date = this._pad(dateObj.getDate());
        const year = dateObj.getFullYear();
        const shortMonth = month[dateObj.getMonth()];
        // 13:23 Nov 19 2019
        return `${hours}:${minutes} ${shortMonth} ${date} ${year}`
    }

    private _pad(n: number) {
        return n<10 ? '0'+n : n
    }
}