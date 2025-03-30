import { EventsInterface } from '../../../shared/EventListResponseDTO';
import { Request } from '../Utils/GatewayFunctions';
import { DataOperationResult } from '../../../shared/OperationResult';
import { BusyTracker } from '../Utils/BusyTracker';
import ArtistImageDto, { EventViewResponse } from '../../../shared/ArtistImageDTO';
import { Round } from './Round';
import EventListViewModel from './EventListViewModel';
import { JWTAuth } from '../Utils/JWTAuth';
import * as ko from 'knockout';
import { deepRedirectToNative } from '../Common/DeepRedirectToNative';
import MediaDTO from '../../../shared/MediaDTO';
import { AuctionViewModel } from '../Auction/AuctionViewModel';

export class EventView {
    public DataTimeRange: string;
    public Description: string;
    public ShortDescription: string;
    public Price: string;
    public TicketLink: string;
    public Venue: string;
    public Votes: Number;
    public eventId: string;
    public EID: string;
    public flag: string;
    public flagPng: string;
    public openStatus: boolean;
    public openVoting: boolean;
    public statusColor: string;
    public statusText: string;
    public statusTextColor: string;
    public title: string;
    public EventViewUpdater: BusyTracker = new BusyTracker();
    public ErrorMessage: KnockoutObservable<string> = ko.observable<string>();
    public Rounds: KnockoutObservableArray<Round> = ko.observableArray<Round>([]);
    public show: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public Expanded: KnockoutObservable<string> = ko.observable<string>('');
    public Auth: KnockoutObservable<JWTAuth> = ko.observable<JWTAuth>();
    public openAuctionCount: KnockoutObservable<number> = ko.observable<number>();
    public winnerImage: KnockoutObservable<ArtistImageDto> = ko.observable<ArtistImageDto>();
    public winnerName: KnockoutObservable<string> = ko.observable<string>();
    public winnerLink: KnockoutObservable<string> = ko.observable<string>();
    public winnerNameArr: KnockoutObservableArray<string> = ko.observableArray<string>([]);
    public SponsorLogo: KnockoutObservable<MediaDTO> = ko.observable<MediaDTO>();
    public SponsorText: KnockoutObservable<string> = ko.observable<string>();
    public Vm: EventListViewModel;
    public AuctionViewModel: AuctionViewModel;
    public IsVoteOpen: KnockoutObservable<boolean> = ko.observable<boolean>(true);
    // @ts-ignore used in view
    public VoteSwitchImg: KnockoutComputed<string> = ko.computed(() => this.IsVoteOpen() ? `/images/vote-on.png?1=1` : `/images/vote-off.png?1=1`);
    // @ts-ignore used in view
    public AuctionSwitchImg: KnockoutComputed<string> = ko.computed<string>(() => this.IsVoteOpen() ? `/images/auction-off.png?1=1` : `/images/auction-on.png?1=1`);
    public IsAuctionLoaded: boolean;
    public EnableAuction: KnockoutObservable<boolean> = ko.observable<boolean>(true);
    public StreamUrl: KnockoutObservable<string> = ko.observable<string>('');

    public constructor(dto: EventsInterface, auth: JWTAuth, Vm: EventListViewModel) {
        this.DataTimeRange = dto.DataTimeRange.toString();
        this.Vm = Vm;
        this.Description = dto.Description.toString();
        this.ShortDescription = this.Description.substr(0, 130) + '...';
        this.Price = dto.Price.toString();
        this.TicketLink = dto.TicketLink.toString();
        this.Venue = dto.Venue.toString();
        this.Votes = dto.Votes;
        this.eventId = dto.eventId.toString();
        this.flag = dto.flag.toString();
        this.flagPng = dto.flagPng.toString();
        this.openStatus = dto.openStatus;
        this.openVoting = dto.openVoting;
        this.statusColor = dto.statusColor.toString();
        this.statusText = dto.statusText.toString();
        this.statusTextColor = dto.statusTextColor.toString();
        this.title = dto.title.toString();
        this.EID = dto.EID.toString();
        this.winnerLink(`/ar/${dto.winnerId}/${Vm.PhoneHash()}`);
        this.Auth(auth);
        this.openAuctionCount(dto.openAuctionCount);
        this.SponsorLogo(dto.sponsorLogo);
        this.SponsorText(dto.sponsorText);
        if (this.statusText.toLowerCase() === 'final' && dto.winnerImage && dto.winnerName) {
            this.winnerImage(dto.winnerImage);
            this.winnerName(dto.winnerName);
            this.winnerNameArr(dto.winnerName.split(' '));
        }
        this.AuctionViewModel = new AuctionViewModel(auth, this.eventId, false);
        this.EnableAuction(dto.EnableAuction);
        this.StreamUrl(dto.StreamUrl);
    }

    public async handleEventView($root: EventListViewModel) {
        $root.Loading(true);
        const me = this;
        const token = await this.Auth().get();
        if (!(token && token.length > 0) && !$root.VoterHash()) {
            return deepRedirectToNative(this);
        }
        let tileClass = '';
        if (me.winnerImage() && me.winnerName()) {
            tileClass += 'has-winner';
        }
        if ( me.Expanded().indexOf('expanded') === -1) {
            try {
                // @ts-ignore
                const result = await  this.EventViewUpdater.AddOperation(Request<DataOperationResult<EventViewResponse>>(`${mp}/api/event/${this.eventId}/view`, 'GET', null, null, token));
                if (result.Success) {
                    for (let i =  0; i < result.Data.roundWiseImages.length; i++) {
                        me.Rounds()[i] = new Round(result.Data.roundWiseImages[i], this);
                    }
                    me.Rounds.notifySubscribers();
                    $root.manageEventVisibility(this.eventId);
                    tileClass += ' expanded';
                    $root.showMessageAlert(false);
                    me.Expanded(tileClass);
                } else {
                    if (result.message === 'INVALID_TOKEN') {
                        // return deepRedirectToNative(this);
                        // TODO logout
                    }
                    this.ErrorMessage('An Error occurred');
                }
            } catch (e) {
                if (e.message === 'INVALID_TOKEN') {
                    alert('Please logout and login again to vote.');
                    // TODO implement logout
                    window.location.href = 'ios::logout::{}';
                    // return deepRedirectToNative(this);
                }
                console.error(e);
            }
        } else {
            me.Expanded(tileClass);
            me.show(false);
        }
        $root.Loading(false);
    }

    // used in view
    public SwitchToVote(vm: EventView, e: MouseEvent) {
        e.stopPropagation();
        if (this.IsVoteOpen()) {
            return ;
        } else {
            this.IsVoteOpen(true);
        }
    }

    // used in view
    public async SwitchToAuction(vm: EventView, e: MouseEvent) {
        e.stopPropagation();
        if (!this.IsVoteOpen()) {
            return ;
        } else {
            if (!this.IsAuctionLoaded) {
                try {
                    await this.AuctionViewModel.populateEventList();
                    this.IsAuctionLoaded = true;
                } catch (e) {
                    console.error('unable to load auction\'s event list');
                }
            }
            this.IsVoteOpen(false);
        }
    }
}