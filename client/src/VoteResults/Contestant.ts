import * as ko from 'knockout';
import { RoundContestantResultDto } from '../../../shared/RoundContestantDTO';
import { BusyTracker } from '../Utils/BusyTracker';
import { Request } from '../Utils/GatewayFunctions';
import { DataOperationResult } from '../../../shared/OperationResult';
import {
    AuctionAdminCss,
    AuctionAdminStats,
    AuctionStatesCss,
    AuctionStatesTitle
} from '../../../server/src/common/States';
import ArtistImageDto from '../../../shared/ArtistImageDTO';
import EventResultsViewModel from './EventResultsViewModel';

export class Contestant {
    public EaselNumber: number = null;
    public Name: String = null;
    public Votes: number = null;
    public WinnerUpdater: BusyTracker = new BusyTracker();
    public WinnerCss: KnockoutObservable<string> = ko.observable<string>('btn-default');
    public AuctionMessage: KnockoutObservable<string> = ko.observable<string>();
    public WinnerMessage: KnockoutObservable<string> = ko.observable<string>();
    public eventId: string;
    public RoundNumber: Number;
    public contestantId: string;
    public IsWinner: KnockoutObservable<number> = ko.observable<number>(0);
    public EnableAuction: KnockoutObservable<number> = ko.observable<number>(0);
    public TotalBids: KnockoutObservable<number> = ko.observable<number>(0);
    public TopBidAndTime: KnockoutObservable<string> = ko.observable<string>('N.A.');
    public LatestImage: KnockoutObservable<string> = ko.observable<string>();
    // used in pug
    // @ts-ignore
    public AuctionCss: KnockoutComputed<string> = ko.computed(this._calculateAuctionStyle.bind(this));
    public ArtId: string;
    public Vm: EventResultsViewModel;
    public AuctionStatus: KnockoutObservable<string> = ko.computed(this._calculateAuctionResultStyle.bind(this));
    public AuctionStatusTitle: KnockoutObservable<string> = ko.computed(this._calculateAuctionResultStatus.bind(this));
    public PublicUrl: string;
    public PeopleUrl: string;

    public constructor(dto: RoundContestantResultDto, eventId: string, roundNumber: Number, eid: string, vm: EventResultsViewModel) {
        this.EaselNumber = dto.EaselNumber;
        this.Name = dto.Name;
        this.contestantId = dto._id;
        // @ts-ignore
        this.PublicUrl = mp + dto.Link;
        // @ts-ignore
        this.PeopleUrl = mp + dto.PeopleUrl;
        this.IsWinner(dto.IsWinner || 0);
        if (this.IsWinner() === 1) {
            this.WinnerCss('btn-success');
            this.WinnerMessage('Winner');
        }
        this.EnableAuction(dto.EnableAuction || 0);
        this.AuctionMessage(AuctionAdminStats[this.EnableAuction()]);
        this.eventId = eventId;
        this.RoundNumber = roundNumber;
        this.Votes = dto.Votes;
        this.TotalBids(dto.NumBids);
        this.TopBidAndTime(dto.TopBidAndTime);
        this.LatestImage(dto.LatestImage && dto.LatestImage.Thumbnail.url);
        this.ArtId = `${eid}-${roundNumber}-${this.EaselNumber}`;
        this.Vm = vm;
    }

    _calculateAuctionStyle() {
        return AuctionAdminCss[this.EnableAuction()];
    }

    _calculateAuctionResultStatus() {
        if (this.EnableAuction() === 0 && this.TotalBids() === 0) {
            return ;
        }
        return AuctionStatesTitle[this.EnableAuction()];
    }

    _calculateAuctionResultStyle() {
        if (this.EnableAuction() === 0 && this.TotalBids() === 0) {
            return ;
        }
        return AuctionStatesCss[this.EnableAuction()];
    }

    async handleWinnerChange() {
        try {
            if (this.IsWinner() === 0) {
                this.IsWinner(1);
            } else {
                this.IsWinner(0);
            }
            // @ts-ignore
            const result = await this.WinnerUpdater.AddOperation(Request<DataOperationResult<string>>(`${mp}/api/vote/${this.eventId}/${this.contestantId}/${this.RoundNumber}/${this.IsWinner()}`, 'GET'));
            if (result.Success) {
                if (result.Data.length === 0) {
                    this.WinnerCss('btn-default');
                } else {
                    this.WinnerCss('btn-success');
                }
                this.WinnerMessage('<span>' + result.Data + '</span>');
            }
        } catch (e) {
            console.error(e);
            this.WinnerCss('btn-danger');
            this.WinnerMessage('<span>Error</span>');
        }
    }

    async handleAuctionStatusChange() {
        if (this.EnableAuction() === 3) {
            return ;
        }
        const me = this;
        const original = this.EnableAuction();
        try {
            if (this.EnableAuction() === 0) {
                this.EnableAuction(1);
            } else if (this.EnableAuction() === 1) {
                this.EnableAuction(2);
            } else if (this.EnableAuction() > 1) {
                this.EnableAuction(0);
                // this.startCounter();
            }
            // @ts-ignore
            const result = await this.WinnerUpdater.AddOperation(Request<DataOperationResult<string>>(`${mp}/api/auction/${this.eventId}/${this.RoundNumber}/${this.contestantId}/${this.EnableAuction()}`, 'GET'));
            if (result.Success) {
                this.AuctionMessage('<span>' + result.Data + '</span>');
                this.Vm.calculateAutoCloseStatus();
            } else {
                me.EnableAuction(3);
                this.AuctionMessage('<span> failed </span>');
                setTimeout(() => {
                    me.EnableAuction(original);
                    this.AuctionMessage(AuctionAdminStats[original]);
                }, 1000);
            }
        } catch (e) {
            console.error(e);
            me.EnableAuction(3);
            this.AuctionMessage('<span> failed </span>');
            setTimeout(() => {
                me.EnableAuction(original);
                this.AuctionMessage(AuctionAdminStats[original]);
            }, 2000);
        }
    }
}

export default Contestant;