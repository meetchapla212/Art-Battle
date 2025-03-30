import { Image } from './Image';
import { BusyTracker } from '../Utils/BusyTracker';
import * as ko from 'knockout';
import { Request } from '../Utils/GatewayFunctions';
import { DataOperationResult } from '../../../shared/OperationResult';

import { LotResponseInterface } from '../../../shared/LotResponseInterface';
import { JWTAuth } from '../Utils/JWTAuth';
import { BidDTO } from '../../../shared/BidDTO';
import RoundContestantDTO from '../../../shared/RoundContestantDTO';
import { EventView } from './EventView';
import AuctionViewModel from './AuctionViewModel';
import CountryDTO from '../../../shared/CountryDTO';
import { TopEventRoundContestantDTO } from '../../../shared/EventsInAuctionDTO';

export class Artist {
    public EaselNumber: Number;
    public Name: KnockoutObservableArray<string> = ko.observableArray<string>([]);
    public OriginalName: String;
    public id: String;
    public Images: KnockoutObservableArray<Image> = ko.observableArray<Image>([]);
    public SelectedImage: KnockoutObservable<Image> = ko.observable<Image>();
    public SelectedImageIndex: KnockoutObservable<number> = ko.observable<number>();
    public VoteText: KnockoutObservable<string> = ko.observable<string>('Vote');
    public VoteUpdater: BusyTracker = new BusyTracker();
    public LastStateIndex: KnockoutObservable<number> = ko.observable<number>(0);
    public Status: KnockoutObservable<string> = ko.observable<string>();
    public States = [
        'BID',
        'Confirm?',
        '&#9673;',
    ];
    public CssStates = [
        '',
        'confirm',
        'success'
    ];
    public VoteCss: KnockoutObservable<string> = ko.observable<string>();
    public ArtId: KnockoutObservable<string> = ko.observable<string>();
    public ErrorMessage: KnockoutObservable<string> = ko.observable<string>();
    public Auth: KnockoutObservable<JWTAuth> = ko.observable<JWTAuth>();
    public TopBids: KnockoutObservableArray<BidDTO> = ko.observableArray<BidDTO>([]);
    public AuctionStatus: KnockoutObservable<number> = ko.observable<number>();
    public AuctionStatusCss: KnockoutObservable<string> = ko.observable<string>();
    public AuctionStatusText: KnockoutObservable<string> = ko.observable<string>();
    public Active: KnockoutObservable<boolean> = ko.observable<boolean>();
    public Event: EventView;
    public UserName: KnockoutObservable<string> = ko.observable<string>();
    public Bid: KnockoutObservable<number> = ko.observable<number>(0);
    public SumBid: KnockoutObservable<number> = ko.observable<number>(0);
    public Vm: AuctionViewModel;
    public AuctionCss: KnockoutObservable<string> = ko.observable<string>();
    public LastBidPrice: KnockoutObservable<number> = ko.observable<number>(0);
    public CurrencySymbol: KnockoutObservable<string> = ko.observable<string>('$');
    public DecrementCss: KnockoutObservable<string> = ko.observable<string>('');
    // @ts-ignore
    public RefreshIntervalHandle: NodeJS.Timeout;
    public IsAdmin: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public WidthAndHeight: KnockoutObservable<string> = ko.observable<string>();
    public Description: KnockoutObservable<string> = ko.observable<string>();
    public AuctionMessage: KnockoutObservable<string> = ko.observable<string>('Bid');

    public MinBidIncrement: KnockoutObservable<number> = ko.observable<number>(5);
    public AuctionNotice: KnockoutObservable<string> = ko.observable<string>('');
    public Country: CountryDTO;
    public Currency: CountryDTO;
    public AuctionStartBid: KnockoutObservable<number> = ko.observable<number>();
    public Link: KnockoutObservable<string> = ko.observable<string>();
    public PriceText: KnockoutObservable<string> = ko.observable<string>();

    public constructor(dto: TopEventRoundContestantDTO, Event: EventView, ArtId: string, Vm: AuctionViewModel) {
        this.Vm = Vm;
        this.Auth(Event.Auth());
        this.EaselNumber = dto.EaselNumber;
        this.OriginalName = dto.Detail.Name;
        this.Name(dto.Detail.Name.split(' '));
        this.id = dto.Detail._id;
        // @ts-ignore comes from html
        this.Link(`/ar/${this.id}/${phoneHash}`);
        if (this.Images().length) {
            this.Images().splice(0, this.Images().length)
        }
        for (let i = 0; i < dto.Images.length; i++) {
            let index = this.Images().findIndex(x => x.Thumbnail().url == dto.Images[i].Thumbnail.url)
            if (index == -1) {
                this.Images().push(new Image(dto.Images[i]));
            }
        }
        if (this.Images().length > 0) {
            const Index = this.Images().length - 1;
            this.SelectedImage(this.Images()[Index]);
            this.SelectedImageIndex(Index);
        }
        this.Event = Event;
        this.ArtId(ArtId);
        this.LastBidPrice(dto.LastBidPrice);

        this.AuctionNotice(dto.AuctionNotice || Event.AuctionNotice());
        this.Country = dto.Country || Event.Country;
        this.Currency = dto.Currency || Event.Currency;
        this.MinBidIncrement(Event.MinBidIncrement() || dto.MinBidIncrement);
        this.AuctionStartBid(Event.AuctionStartBid() || dto.AuctionStartBid);

        this.Bid(Artist._round(this.LastBidPrice() + (this.LastBidPrice() * (this.MinBidIncrement() / 100))) || Event.AuctionStartBid());
        this.CurrencySymbol((Event.Currency && Event.Currency.currency_symbol) || '$');

        // comes from global var
        // @ts-ignore
        // @ts-ignore
        if (artId && this.ArtId().trim() == artId.trim()) {
            this.OpenAuction().catch(e => {
                if (e) {
                    console.error(e);
                } else {
                    console.error('error in getAuctionDetail e');
                }
            });
        }
        if (this.LastBidPrice() && dto.BidCount > 0 && dto.EnableAuction === 1) {
            this.PriceText(`${this.CurrencySymbol()} ${this.LastBidPrice()}`);
        }
    }

    // used in click event in view
    public CycleImage() {
        let index = this.SelectedImageIndex() - 1;
        if (index >= 0) {
            this.SelectedImageIndex(index);
        } else {
            index = this.Images().length - 1;
            this.SelectedImageIndex(index);
        }
        this.SelectedImage(this.Images()[index]);
    }

    private static _round(x: number) {
        return Math.ceil(x / 5) * 5;
    }

    public async getAuctionDetail(scroll = true) {
        // @ts-ignore
        const result = await this.VoteUpdater.AddOperation(Request<DataOperationResult<LotResponseInterface>>(`${mp}/api/auction/${this.ArtId()}`, 'GET', null, null, await this.Auth().get()));
        if (result.Success) {
            if (this.Images().length) {
                this.Images().splice(0, this.Images().length)
            }
            for (let i = 0; i < result.Data.Arts.length; i++) {
                let index = this.Images().findIndex(x => (x.Thumbnail().url).toString() == (result.Data.Arts[i].Thumbnail.url).toString())
                if (index == -1) {
                    this.Images().push(new Image(result.Data.Arts[i]));
                }
            }
            if (result.Data.SelectArtIndex >= 0) {
                this.SelectedImage(this.Images()[result.Data.SelectArtIndex]);
                this.SelectedImageIndex(result.Data.SelectArtIndex);
            }
            this.TopBids(result.Data.TopNBids);
            this.AuctionStatus(result.Data.Status);
            if (this.AuctionStatus() === 0 && this.Images().length === 0) {
                this.AuctionStatusCss('auction-pending');
                this.AuctionStatusText('Auction Yet to start');
            } else if (this.AuctionStatus() === 1) {
                this.AuctionStatusCss('auction-open');
                this.AuctionStatusText('Auction Open');
            } else {
                this.AuctionStatusCss('auction-closed');
                this.AuctionStatusText('Auction Closed');
            }
            this.UserName(result.Data.UserName);
            this.Vm.setActiveArtist(this);
            if (!(this.AuctionStatus() === 0 || this.AuctionStatus() === 2)) {
                this.RefreshIntervalHandle = setInterval(this.getAuctionDetail.bind(this, false), 3000);
            }
            if (scroll) {
                $('html,body').animate({ scrollTop: $('.bid-info').offset().top }, 500);
            }
            this.Name(result.Data.ArtistName && result.Data.ArtistName.split(' '));
            this.OriginalName = result.Data.ArtistName;
            this._SumBidAmount();
            this.Description(result.Data.Description);
            this.WidthAndHeight(result.Data.WidthAndHeight);
            this.IsAdmin(result.Data.isAdmin);
            this.CurrencySymbol(result.Data.CurrencySymbol);
        } else {
            this.ErrorMessage('An Error occurred');
        }
    }
    // used in pug
    public async handleBidClick(Vm: EventView, e: Event) {
        e.stopPropagation();
        this.LastStateIndex(this.LastStateIndex() + 1);
        this.Status(this.States[this.LastStateIndex()]);
        this.AuctionCss(this.CssStates[this.LastStateIndex()]);
        this.AuctionMessage(this.Status());
        if (this.LastStateIndex() + 1 === this.States.length) {
            // End of the cycle
            // perform bidding
            await this.BidForArt();
            this.LastStateIndex(-1);
        }
    }

    private _SumBidAmount() {
        this.SumBid(parseInt('' + this.Bid()) || 0);
        for (let i = 0; i < this.TopBids().length; i++) {
            this.SumBid(this.SumBid() + this.TopBids()[i].Amount);
        }
    }

    public async OpenAuction() {
        this.Vm.ActiveArtistDescription(undefined);
        this.Vm.ActiveArtistWidthAndHeight(undefined);
        await this.getAuctionDetail();
        this.Vm.ActiveArtistDescription(this.Description());
        this.Vm.ActiveArtistWidthAndHeight(this.WidthAndHeight());
        if ($('.slider-nav').hasClass('slick-initialized') || $('.slider-nav').hasClass('slick-slider')) {
            $('.slider-nav').slick('unslick');
            $('.slider-nav').slick('destroy');
            $('.slider-nav').slick('refresh');
            let slickCount = $(".slider-nav").slick("getSlick").slideCount;
            const removeSliderCount = slickCount - this.Images().length;
            for (let i = 0; i < removeSliderCount; i++) {
                $('.slider-nav').slick('slickRemove', this.Images().length);
            }
        }
        $('.slider-nav').slick({
            slidesToShow: 4,
            slidesToScroll: 1,
            dots: false,
            focusOnSelect: true
        });
    }

    public ResetButtonState(index: number) {
        const me = this;
        me.LastStateIndex(index);
        me.Status(me.States[me.LastStateIndex()]);
        me.AuctionMessage(me.Status());
        me.AuctionCss(me.CssStates[me.LastStateIndex()]);
    }

    public async BidForArt() {
        const Event = this.Event;
        function deepRedirectIos() {
            const obj: any = {
                eventId: Event._id,
                flag: Event.flag,
                flagPng: Event.flagPng,
                openStatus: true,
                openVoting: true,
                statusColor: '',
                statusText: 'Open',
                statusTextColor: '',
                title: Event.Name,
                Votes: 0,
                backInHome: 0
            };
            window.location.href = `ios::closepayment::${JSON.stringify(obj)}`;
        }
        const me = this;
        try {
            const token = await Event.Auth().get();
            if (token && token.length > 0) {
                const result = await this.VoteUpdater.AddOperation(Request<{
                    'Success': boolean;
                    'Message': string;
                    'code': string;
                    Name: string;
                    Email: string;
                    NickName: string;
                    // @ts-ignore
                }>(`${mp}/api/auction/bid/${this.ArtId()}/${this.Bid()}`, 'PUT', null, null, await this.Auth().get()));
                if (result.Success) {
                    await this.getAuctionDetail();
                } else if (result.code === 'VERIFY') {
                    // this.ErrorMessage('Bid Failure');
                    // this.ResetButtonState(me.LastStateIndex() - 1);
                    this.Vm.Name(result.Name || '');
                    this.Vm.Email(result.Email || '');
                    this.Vm.NickName(result.NickName || '');
                    this.Vm.ShowEmailAndNamePopup(true);
                    this.Vm.RetryBid(true);
                } else {
                    this.ErrorMessage('Bid Failure');
                    this.ResetButtonState(me.LastStateIndex() - 1);
                }
            } else {
                this.ResetButtonState(me.LastStateIndex() - 1);
                // TODO logut
                // deepRedirectIos();
            }
        } catch (e) {
            if (e.message === 'INVALID_TOKEN') {
                // TODO logout
                // return deepRedirectIos();
            }
            e.Message && alert(e.Message);
            console.error(e);
            this.ResetButtonState(me.LastStateIndex() - 1);
        }
    }

    public DecrementBid() {
        const calculatedBid = this.Bid() - (this.Bid() * (this.MinBidIncrement() / 100));
        if (calculatedBid > this.LastBidPrice()) {
            this.Bid(Artist._round(calculatedBid));
        } else {
            this.DecrementCss('text-muted');
        }
    }

    public IncrementBid() {
        this.Bid(Artist._round(this.Bid() + (this.Bid() * (this.MinBidIncrement() / 100))));
        this.DecrementCss('');
    }
}