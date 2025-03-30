import { IndividualArtistImages } from '../../../shared/ArtistImageDTO';
import { Image } from './Image';
import { BusyTracker } from '../Utils/BusyTracker';
import * as ko from 'knockout';
import { EventView } from './EventView';
import { Request } from '../Utils/GatewayFunctions';
import { DataOperationResult } from '../../../shared/OperationResult';
import { Round } from './Round';
import { LotResponseInterface } from '../../../shared/LotResponseInterface';

export class Artist {
    public EaselNumber: Number;
    public Name: String[];
    public OriginalName: String[];
    public id: String;
    public Images: KnockoutObservableArray<Image> = ko.observableArray<Image>([]);
    public SelectedImage: KnockoutObservable<Image> = ko.observable<Image>();
    public SelectedImageIndex: KnockoutObservable<number> = ko.observable<number>();
    public VoteText: KnockoutObservable<string> = ko.observable<string>('Vote');
    public VoteUpdater: BusyTracker = new BusyTracker();
    public LastStateIndex: KnockoutObservable<number> = ko.observable<number>(0);
    public Status: KnockoutObservable<string> = ko.observable<string>();
    public States = [
        'VOTE',
        'CONFIRM?',
        '&#9673;',
    ];
    public VoteCss: KnockoutObservable<string> = ko.observable<string>();
    public TotalBids: KnockoutObservable<number> = ko.observable<number>(0);
    public HasVoted: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public AuctionStatusCss: KnockoutObservable<string> = ko.observable<string>();
    public Link: KnockoutObservable<string> = ko.observable<string>();

    public constructor(dto: IndividualArtistImages, Event: EventView, Round: Round) {
        this.HasVoted(dto.HasVoted);
        this.EaselNumber = dto.EaselNumber;
        this.Name = dto.Name;
        this.OriginalName = dto.OriginalName;
        this.id = dto.id;
        if(this.Images().length){
            this.Images().splice(0,this.Images().length)
        }
        for (let i = 0; i < dto.Images.length; i++) {
            let index = this.Images().findIndex(x => x.Thumbnail().url == dto.Images[i].Thumbnail.url)
            if (index == -1) {
                this.Images().push(new Image(dto.Images[i], Event, Round, this));
            }
        }
        if (this.Images().length > 0) {
            const Index = this.Images().length - 1;
            this.SelectedImage(this.Images()[Index]);
            this.SelectedImageIndex(Index);
        }
        if (this.HasVoted()) {
            this.LastStateIndex(-1);
        }
        this.Link(`/ar/${dto.ArtistId}/${Event.Vm.PhoneHash()}`);
    }

    public async Vote(e: Event, Event: EventView, Round: Round, Image: Image) {
        e.stopPropagation();
        // To do Ajax call then do it
        this.LastStateIndex(this.LastStateIndex() + 1);
        this.Status(this.States[this.LastStateIndex()]);
        this.VoteText( this.Status() );
        if (this.LastStateIndex() + 1 === this.States.length) {
            // End of the cycle
            // perform voting
            await this.vote(Event, Round, Image);
            this.LastStateIndex(-1);
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

    public async vote(Event: EventView, Round: Round, Image: Image) {
        try {
            const token = await Event.Auth().get();
            if (token && token.length > 0) {
                interface DataOperationResultV1 extends DataOperationResult<string> {
                    openAuctionCount: number;
                }
                // @ts-ignore
                const result = await  this.VoteUpdater.AddOperation(Request<DataOperationResultV1>(`${mp}/api/vote/app/${Event.eventId}/${Round.RoundNumber}/${this.EaselNumber}`, 'POST', null, null, token));
                if (result.Success) {

                    Event.openAuctionCount(result.openAuctionCount);
                    this.VoteCss('text-success');
                    Round.HasVoted(true);
                    this.HasVoted(true);
                    const promises: any[] = [];
                    try {
                        for (let i = 0; i < Round.Artists().length; i++) {
                            Round.Artists()[i].LastStateIndex(-1);
                            if (Round.Artists()[i].SelectedImage()) {
                                promises.push(Round.Artists()[i].getAuctionDetail(Round.Artists()[i].SelectedImage(), Event));
                            }
                        }
                        await Promise.all(promises);
                    } catch (e) {
                        // default behaviour when auction is disabled
                        console.error(e);
                    }
                } else {
                    this.VoteCss('text-danger');
                }
            } else {
                // TODO logout
                // deepRedirectToNative(Event);
            }
        } catch (e) {
            if (e.message === 'INVALID_TOKEN') {
                // TODO logout
                // return deepRedirectToNative(Event);
            }
            console.error(e);
            this.VoteCss('text-danger');
        }
    }

    public async getAuctionDetail(Image: Image, Event: EventView) {
        if (!Image) {
            return ;
        }
        // @ts-ignore
        const result = await this.VoteUpdater.AddOperation(Request<DataOperationResult<LotResponseInterface>>(`${mp}/api/auction/${Image.ArtId()}`, 'GET', null, null, await Event.Auth().get()));
        if (result.Success) {
            if (result.Data.TopNBids && result.Data.TopNBids[0] && result.Data.TopNBids[0].Registration.Hash === 'jup4iv2g') {
                // SYSTEM don't count
                result.Data.TotalBids = result.Data.TotalBids - 1;
            }
            let bidText = 'bids';
            if (result.Data.TotalBids === 1) {
                bidText = 'bid';
            }
            this.TotalBids(result.Data.TotalBids);
            const isAuctionClosed = (result.Data.Status === 2 || result.Data.Status === 0);
            if (this.TotalBids() === 0 && isAuctionClosed) {
                this.AuctionStatusCss('no-bids');
            } else if (this.TotalBids() > 0 && isAuctionClosed) {
                this.AuctionStatusCss('closed-auc');
            } else if (result.Data.Status === 1) {
                this.AuctionStatusCss('open-auc');
            }
            const topBids = result.Data.TopNBids;
            const topBid = topBids[topBids.length - 1];
            if (topBid) {
                /*const nick = topBid.Registration.NickName || topBid.Registration.PhoneNumber.substr(
                    topBid.Registration.PhoneNumber.length - 4);*/
                const amount = `${result.Data.CurrencySymbol}${topBid.Amount}`;
                if (result.Data.Status === 2) {
                    // Image.topBidText(`&#9673; Auction Closed: ${amount} by ${nick}`);
                    Image.topBidText(`${this.TotalBids()} ${bidText} @ ${amount}`);
                    // Image.topBidCss(`text-danger`);
                } else {
                    // Image.topBidText(`&#9673; ${amount} by ${nick}`);
                    Image.topBidText(`${this.TotalBids()} ${bidText} @ ${amount}`);
                    // Image.topBidCss(`text-success`);
                }
            }
            Image.AuctionLink(`/a/${Image.ArtId()}`);
        } else {
            console.error('An Error occurred');
        }
    }
}