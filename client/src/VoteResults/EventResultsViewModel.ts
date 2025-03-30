import * as ko from 'knockout';
import { EventResultDTO, Logs, Series } from '../../../shared/EventDTO';
import { Request } from '../Utils/GatewayFunctions';
import { BusyTracker } from '../Utils/BusyTracker';
// @ts-ignore
import * as Highcharts from 'highcharts';
import { RoundResultV2DTO, RoundResultDTO } from '../../../shared/RoundContestantDTO';
import HomeScreenViewModel from '../Home/HomeScreenViewModel';
import { Contestant } from './Contestant';
import { DataOperationResult } from '../../../shared/OperationResult';
import RegistrationDTO from '../../../shared/RegistrationDTO';
import {
    AutoCloseStateCss,
    AutoCloseStates,
    CopyWinnerStateCss,
    CopyWinnerStates
} from '../../../server/src/common/States';

export class EventResultsViewModel {
    public Name: KnockoutObservable<string> = ko.observable<string>();
    public Rounds: KnockoutObservableArray<RoundResultDTO> = ko.observableArray<RoundResultDTO>();
    public RoundsResults: KnockoutObservableArray<RoundResultV2DTO> = ko.observableArray<RoundResultV2DTO>();
    public RegistrationCount: KnockoutObservable<number> = ko.observable<number>();
    public LoadingTracker: BusyTracker = new BusyTracker();
    public Logs: KnockoutObservableArray<Logs> = ko.observableArray<Logs>();
    public Series: KnockoutObservableArray<Series> = ko.observableArray<Series>();
    public AllUsersCount: KnockoutObservable<number> = ko.observable<number>(0);
    public DoorUsersCount: KnockoutObservable<number> = ko.observable<number>(0);
    public OnlineUsersCount: KnockoutObservable<number> = ko.observable<number>(0);
    public TopUsersCount: KnockoutObservable<number> = ko.observable<number>(0);
    public AppUsersPercent: KnockoutObservable<number> = ko.observable<number>(0);
    public OnlineTopUsersPercent: KnockoutObservable<number> = ko.observable<number>(0);
    /*public PastVoterCount: KnockoutObservable<number> = ko.observable<number>();
    public NewVoterCount: KnockoutObservable<number> = ko.observable<number>();
    public NewVoterPercentage: KnockoutObservable<number> = ko.observable<number>();*/
    public SendAuctionLinkCSS: KnockoutObservable<string> = ko.observable<string>('btn-success');
    public SendSummarySheetCSS: KnockoutObservable<string> = ko.observable<string>('btn-success');
    public SendAuctionLinkMessage: KnockoutObservable<string> = ko.observable<string>('Send');
    public SendDataToSummarySheetMessage: KnockoutObservable<string> = ko.observable<string>('Send');
    public SendShortAuctionLinkMessage: KnockoutObservable<string> = ko.observable<string>('Send');
    public SendShortAuctionLinkCSS: KnockoutObservable<string> = ko.observable<string>('btn-success');
    public BidMessage: KnockoutObservable<string> = ko.observable<string>();
    public BidMessageCss: KnockoutObservable<string> = ko.observable<string>();
    // path is artbattle.com/event/{eventId}/results
    private _eventId: string = location.pathname.split('/')[3];
    public EnableAutoClose: KnockoutObservable<number> = ko.observable<number>(0);
    public AutoCloseCss: KnockoutObservable<string> = ko.observable<string>('');
    // @ts-ignore
    public AutoCloseMessage: KnockoutObservable<string> = ko.computed(this._calculateAutoCloseMessage.bind(this));
    public AutoCloseUpdater: BusyTracker = new BusyTracker();
    // @ts-ignore
    public AutoCloseAuctionCss: KnockoutComputed<string> = ko.computed(this._calculateAutoCloseCss.bind(this));

    public CopyWinners: KnockoutObservable<number> = ko.observable<number>(0);
    // @ts-ignore
    public CopyWinnerMessage: KnockoutObservable<string> = ko.computed(this._calculateCopyWinnerMessage.bind(this));
    public CopyWinnerUpdater: BusyTracker = new BusyTracker();
    // @ts-ignore
    public CopyWinnerCss: KnockoutComputed<string> = ko.computed(this._calculateCopyWinnerCss.bind(this));

    // Bid Vars
    public phone: KnockoutObservable<number> = ko.observable<number>();
    public email: KnockoutObservable<string> = ko.observable<string>();
    public name: KnockoutObservable<string> = ko.observable<string>();
    public EID: KnockoutObservable<string> = ko.observable<string>();
    public bid: KnockoutObservable<number> = ko.observable<number>();
    public openPopup: KnockoutObservable<boolean> = ko.observable<boolean>();
    public selectedContestant: KnockoutObservable<Contestant> = ko.observable<Contestant>();
    public artId: KnockoutObservable<string> = ko.observable<string>();
    public showEmail: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public showName: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public AuctionEnabled: KnockoutObservable<boolean> = ko.observable<boolean>();
    public AuctionCloseStartsAt: KnockoutObservable<string> = ko.observable<string>();
    public AutoCloseTime: KnockoutObservable<string> = ko.observable<string>();

    public constructor() {
        // this.AutoCloseMessage(AutoCloseStates[this.EnableAutoClose()]);
        // @ts-ignore
        this.LoadingTracker.AddOperation(Request<EventResultDTO>(`${mp}/api/event/${this._eventId}/result`, 'GET')
            .then(this._hydrateResult.bind(this))).catch(e => console.error(e));
        // @ts-ignore
        this.LoadingTracker.AddOperation(Request<Series[]>(`${mp}/api/event/${this._eventId}/votes-registrations`, 'GET')
            .then((dto) => {
                // @ts-ignore
                new Highcharts.default.Chart('container', {
                    chart: {
                        type: 'spline'
                    },
                    xAxis: {
                        type: 'datetime',
                        dateTimeLabelFormats: { // don't display the dummy year
                            month: '%e. %b',
                            year: '%b'
                        },
                        title: {
                            text: 'Date'
                        }
                    },
                    title: {
                        text: 'Event History'
                    },
                    series: dto
                });
            })).catch((e) => console.error(e));
        // @ts-ignore
        this.LoadingTracker.AddOperation(Request<Series[]>(`${mp}/api/event/${this._eventId}/votes-rounds`, 'GET')
            .then((dto) => {
                // @ts-ignore
                new Highcharts.default.Chart('container-votes-rounds', {
                    chart: {
                        type: 'spline'
                    },
                    xAxis: {
                        type: 'datetime',
                        dateTimeLabelFormats: { // don't display the dummy year
                            month: '%e. %b',
                            year: '%b'
                        },
                        title: {
                            text: 'Date'
                        }
                    },
                    title: {
                        text: 'Per Round Votes/Per minute'
                    },
                    series: dto
                });
            })).catch(e => console.error(e));

        this.LoadingTracker.AddOperation(Request<{
            series: Series[],
            categories: string[]
            // @ts-ignore
        }>(`${mp}/api/event/${this._eventId}/votes-rounds-channels`, 'GET')
            .then((dto) => {
                // @ts-ignore
                new Highcharts.default.Chart('container-votes-rounds-channels', {
                    chart: {
                        type: 'area'
                    },
                    title: {
                        text: 'Votes Distribution'
                    },
                    series: dto.series,
                    xAxis: {
                        categories: dto.categories,
                        title: {
                            enabled: false
                        },
                        tickmarkPlacement: 'on'
                    },
                    plotOptions: {
                        area: {
                            stacking: 'normal',
                            lineColor: '#ffffff',
                            lineWidth: 1,
                            marker: {
                                lineWidth: 1,
                                lineColor: '#ffffff'
                            }
                        }
                    }
                });
            })).catch(e => console.error(e));
    }


    private _hydrateResult(dto: EventResultDTO) {
        let hasEnabledAuction = false;
        if (!dto.EnableAuction) {
            this.EnableAutoClose(6);
        } else if (dto.AutoCloseOn) {
            this.EnableAutoClose(3);
            this.AutoCloseTime(`Closing at: ${new Date(dto.AuctionCloseStartsAt).toLocaleTimeString()}`);
        }
        this.AuctionEnabled(dto.EnableAuction);
        this.Name(dto.Name);
        this.RegistrationCount(dto.RegistrationCount);
        this.Logs(dto.Logs || []);
        this.Rounds(dto.rounds);
        this.AllUsersCount(dto.AllUsers);
        this.DoorUsersCount(dto.DoorUsers);
        this.OnlineUsersCount(dto.OnlineUsers);
        this.TopUsersCount(dto.TopOnlineUsers);
        this.AppUsersPercent(this._round((dto.OnlineUsers / dto.AllUsers) * 100));
        this.OnlineTopUsersPercent(this._round((dto.TopOnlineUsers / dto.OnlineUsers) * 100));
        for (let i = 0; i < this.Rounds().length; i++) {
            const RoundContestants = this.Rounds()[i].Contestants;
            const contestants = [];
            for (let j = 0;  j < RoundContestants.length; j++) {
                contestants.push(new Contestant(RoundContestants[j], this._eventId, this.Rounds()[i].RoundNumber, dto.EID, this));
            }
            const auctionContestants = [];
            for (let j = 0;  j < this.Rounds()[i].AuctionContestants.length; j++) {
                if (!hasEnabledAuction && this.Rounds()[i].AuctionContestants[j].EnableAuction !== 2) {
                    hasEnabledAuction = true;
                }
                auctionContestants.push(new Contestant(this.Rounds()[i].AuctionContestants[j], this._eventId, this.Rounds()[i].RoundNumber, dto.EID, this));
            }
            this.RoundsResults()[i] = {
                Experience: this.Rounds()[i].Experience,
                IsCurrentRound: this.Rounds()[i].IsCurrentRound,
                RoundNumber: this.Rounds()[i].RoundNumber,
                IsFinished: this.Rounds()[i].IsFinished,
                VotesCast: this.Rounds()[i].VotesCast,
                Contestants: contestants,
                AuctionContestants: auctionContestants,
                TotalVotes: this.Rounds()[i].TotalVotes
            };
        }
        if (!hasEnabledAuction) {
            this.EnableAutoClose(6);
        }
        this.RoundsResults.notifySubscribers();
        this.EID(dto.EID);
    }
    public static toggleHandle(vm: HomeScreenViewModel, e: Event) {
        // @ts-ignore
        $(e.target).find('i').toggleClass('glyphicon-plus glyphicon-minus');
    }

    public async sendAuctionLink() {
        try {
            this.SendAuctionLinkCSS('btn-info');
            this.SendAuctionLinkMessage('Sending..');
            // @ts-ignore
            await this.LoadingTracker.AddOperation(Request<EventResultDTO>(`${mp}/api/auction/notify/${this._eventId}`, 'GET'));
            this.SendAuctionLinkCSS('btn-default');
            this.SendAuctionLinkMessage('Sent');
        } catch (e) {
            console.error(e);
            this.SendAuctionLinkCSS('btn-danger');
            this.SendAuctionLinkMessage('Failed');
        }
    }

    public async sendDataToSummarySheet() {
        try {
            this.SendSummarySheetCSS('btn-info');
            this.SendDataToSummarySheetMessage('Sending..');
            // @ts-ignore
            await this.LoadingTracker.AddOperation(Request<EventResultDTO>(`${mp}/api/auction/export-to-google-sheet/${this._eventId}`, 'GET'));
            this.SendSummarySheetCSS('btn-default');
            this.SendDataToSummarySheetMessage('Sent');
        } catch (e) {
            console.error(e);
            this.SendSummarySheetCSS('btn-danger');
            this.SendDataToSummarySheetMessage('Failed');
        }
    }

    public async sendShortAuctionLink() {
        try {
            this.SendShortAuctionLinkCSS('btn-info');
            this.SendShortAuctionLinkMessage('Sending..');
            // @ts-ignore
            await this.LoadingTracker.AddOperation(Request<EventResultDTO>(`${mp}/api/auction/notify-short-link/${this._eventId}`, 'GET'));
            this.SendShortAuctionLinkCSS('btn-default');
            this.SendShortAuctionLinkMessage('Sent');
        } catch (e) {
            console.error(e);
            this.SendShortAuctionLinkCSS('btn-danger');
            this.SendShortAuctionLinkMessage('Failed');
        }
    }

    public openManualBidPopup(contestant: Contestant) {
        // reset
        this.bid(undefined);
        this.phone(undefined);
        this.email(undefined);
        this.selectedContestant(undefined);
        this.name(undefined);
        this.artId(undefined);
        this.BidMessageCss(undefined);
        this.BidMessage(undefined);
        // end reset
        this.selectedContestant(contestant);
        this.artId(`${this.EID()}-${this.selectedContestant().RoundNumber}-${this.selectedContestant().EaselNumber}`);
        this.openPopup(true);
    }

    public closeManualBidPopup() {
        this.openPopup(false);
    }

    public async submitManualBid() {
        const eventId = this.selectedContestant().eventId;
        this.BidMessageCss(undefined);
        this.BidMessage(undefined);
        if (!this.email() || !this.name()) {
            await this.populateEmailAndName(eventId);
        }
        let dontSave = false;
        this.showEmail(true);
        this.showName(true);
        const message = [];
        if (!this.email()) {
            dontSave = true;
            message.push('email');
        }
        if (!this.Name() || this.Name().length < 1) {
            dontSave = true;
            message.push('phone');
        }
        if (dontSave) {
            this.BidMessageCss('alert-danger');
            this.BidMessage(`Please fill ${message.join(' and ')}`);
            return ;
        }
        try {
            const result = await this.LoadingTracker.AddOperation(Request<{
                Message: string;
                code: string;
                Success: boolean;
                // @ts-ignore
            }>(`${mp}/auction/manual-bid`, 'PUT', {
                phone: this.phone(),
                email: this.email(),
                name: this.name(),
                bid: this.bid(),
                eventId: eventId,
                artId: this.artId()
            }));
            this.BidMessageCss('alert-success');
            this.BidMessage(result.Message);
            // reset vars
            this.showName(false);
            this.showEmail(false);
            this.email(undefined);
            this.name(undefined);
        } catch (e) {
            console.error(e);
            this.BidMessageCss('alert-danger');
            this.BidMessage(e.Message || e.message || 'Unexpected error');
            this.showName(true);
            this.showEmail(true);
        }
    }

    public async populateEmailAndName(eventId: string) {
        try {
            // @ts-ignore
            const result = await this.LoadingTracker.AddOperation(Request<DataOperationResult<RegistrationDTO>>(`${mp}/registration/find/${this.phone()}/${eventId}`, 'GET'));
            if (result.Data) {
                if (result.Data.FirstName && result.Data.FirstName.length > 0) {
                    this.name(result.Data.FirstName);
                }
                if (result.Data.LastName && result.Data.LastName.length > 0) {
                    this.name(this.name() || ' ' + ' ' + result.Data.LastName);
                }
                this.email(`${result.Data.Email || ''}`);
            }
        } catch (e) {
            console.error(e);
            this.BidMessageCss('alert-danger');
            this.BidMessage(e.Message || e.message || 'Unexpected error');
        }
    }

    public getEventId() {
        return this._eventId;
    }


    public async sendAuctionClosingNotice(roundNumber: number) {
        // @ts-ignore
        const url = `${mp}/api/auction/send-closing-status/${this._eventId}/${roundNumber}/`;
        try {
            alert(`Sending Auction closing notice for ${roundNumber}, Please wait for the success message`);
            await this.LoadingTracker.AddOperation(Request<DataOperationResult<RegistrationDTO>>(url, 'GET'));
            alert(`Sent Auction closing notice successfully for ${roundNumber}`);
        } catch (e) {
            alert(`Sending Auction closing notice was not successful for ${roundNumber}`);
            console.error(e);
        }
    }

    public async copyWinner() {
        // @ts-ignore
        const url = `${mp}/api/event/copy-winner/`;
        try {
            if (this.CopyWinners() === 0) {
                const result = await this.CopyWinnerUpdater.AddOperation(Request<DataOperationResult<{ Message: string; }>>(url, 'POST', {
                    eventId: this._eventId,
                    copyFromRounds: [1, 2],
                    copyTo: 3
                }));
                if (result.Success) {
                    // @ts-ignore
                    const result = await this.LoadingTracker.AddOperation(Request<EventResultDTO>(`${mp}/api/event/${this._eventId}/result`, 'GET'));
                    this._hydrateResult(result);
                    this.CopyWinners(1);
                } else {
                    this.CopyWinners(2);
                }
            }
        } catch (e) {
            this.CopyWinners(2);
            console.error(e);
        }
    }

    public async AutoClose() {
        if (this.EnableAutoClose() === 2
            || this.EnableAutoClose() === 4 || this.EnableAutoClose() === 6) {
            // API call is in progress or disabled state
            return ;
        }
        const me = this;
        const original = this.EnableAutoClose();
        try {
            if (this.EnableAutoClose() === 0) {
                this.EnableAutoClose(1);
                return ;
            } else if (this.EnableAutoClose() === 1) {
                // API call in progress
                this.EnableAutoClose(2);
            } else if (this.EnableAutoClose() === 3) {
                // API call in progress
                this.EnableAutoClose(4);
            }
            // @ts-ignore
            const result = await this.AutoCloseUpdater.AddOperation(Request<DataOperationResult<{Message: string; AuctionCloseStartsAt: Date}>>(`${mp}/api/auction/auto-close/${this._eventId}/${this.EnableAutoClose()}`, 'GET'));
            if (result.Success) {
                // this.AutoCloseMessage('<span>' + result.Data + '</span>');
                if (this.EnableAutoClose() === 2) {
                    this.EnableAutoClose(3);
                    this.AutoCloseTime(`Closing at: ${new Date(result.Data.AuctionCloseStartsAt).toLocaleTimeString()}`);
                } else if (this.EnableAutoClose() === 4) {
                    this.EnableAutoClose(0);
                    this.AutoCloseTime('');
                }
            } else {
                me.EnableAutoClose(5);
                // this.AutoCloseMessage('<span> failed </span>');
                setTimeout(() => {
                    me.EnableAutoClose(original);
                    // this.AutoCloseMessage(AutoCloseStates[original]);
                }, 1000);
            }
        } catch (e) {
            console.error(e);
            me.EnableAutoClose(5);
            // this.AutoCloseMessage('<span> failed </span>');
            setTimeout(() => {
                me.EnableAutoClose(original);
                // this.AutoCloseMessage(AutoCloseStates[original]);
            }, 2000);
        }
    }

    private _calculateAutoCloseCss() {
        return AutoCloseStateCss[this.EnableAutoClose()];
    }

    private _calculateAutoCloseMessage() {
        return AutoCloseStates[this.EnableAutoClose()];
    }

    private _calculateCopyWinnerCss() {
        console.log('CopyWinnerStateCss[this.CopyWinners()]', CopyWinnerStateCss[this.CopyWinners()]);
        return CopyWinnerStateCss[this.CopyWinners()];
    }

    private _calculateCopyWinnerMessage() {
        return CopyWinnerStates[this.CopyWinners()];
    }

    public calculateAutoCloseStatus() {
        const hasOpenAuction = this._hasOpenAuction();
        console.log(hasOpenAuction, this.AuctionEnabled());
        if (hasOpenAuction && this.AuctionEnabled()) {
            this.EnableAutoClose(0);
        } else if (!hasOpenAuction) {
            this.EnableAutoClose(6);
        }
    }

    private  _hasOpenAuction() {
        for (let i = 0; i < this.RoundsResults().length; i++) {
            for (let j = 0; j < this.RoundsResults()[i].AuctionContestants.length; j++) {
                if (this.RoundsResults()[i].AuctionContestants[j].EnableAuction() !== 2) {
                    console.log('this.RoundsResults()[i].Contestants[j].EnableAuction()', this.RoundsResults()[i].AuctionContestants[j].EnableAuction());
                    return true;
                }
            }
        }
        return false;
    }

    private _round(num: number) {
        num = isNaN(num) ? 0 : num;
        return parseFloat(parseFloat(String((num))).toFixed(2));
    }
}

export default EventResultsViewModel;