import { Round } from './Round';
import { JWTAuth } from '../Utils/JWTAuth';
import * as ko from 'knockout';
import EventDTO, { UserEventDTO } from '../../../shared/EventDTO';
import CountryDTO from '../../../shared/CountryDTO';
import AuctionViewModel from './AuctionViewModel';
import { TopEventDTO } from '../../../shared/EventsInAuctionDTO';

export class EventView {
    public Name: string;
    public EID: string;
    public Auth: KnockoutObservable<JWTAuth> = ko.observable<JWTAuth>();
    public flag: string;
    public flagPng: string;
    public Rounds: KnockoutObservableArray<Round> = ko.observableArray<Round>([]);
    public Country: CountryDTO;
    public Currency: CountryDTO;
    public AuctionNotice: KnockoutObservable<string> = ko.observable<string>();
    public AuctionStartBid: KnockoutObservable<number> = ko.observable<number>();
    public MinBidIncrement: KnockoutObservable<number> = ko.observable<number>();
    public Top: KnockoutObservable<boolean> = ko.observable<boolean>();
    public _id: any;
    public VoteUrl: KnockoutObservable<string> = ko.observable<string>();

    public constructor(auth: JWTAuth, Vm: AuctionViewModel, topRoundIndex: number = -1, topArtistIndex: number = -1,
                       dto?: UserEventDTO, topEventDto?: TopEventDTO) {
        this.Top(!!topEventDto);
        this.Country = undefined;
        this.Name = '';
        if (dto) {
            this.Country = dto.Country;
            this.Currency = dto.Currency;
            this.AuctionNotice(dto.AuctionNotice);
            this.AuctionStartBid(dto.AuctionStartBid);
            this.MinBidIncrement(dto.MinBidIncrement);
            this.Name = dto.Name;
            this.EID = dto.EID.toString();
            this.Auth(auth);
            this._id = dto._id;
            this.VoteUrl(dto.VoteUrl);
            if (topRoundIndex !== -1) {
                this.Rounds()[topRoundIndex] = new Round(this, Vm, topArtistIndex, dto.Rounds[topRoundIndex]);
            }
            for (let i = 0; i < dto.Rounds.length; i++) {
                if (topRoundIndex !== i) {
                    this.Rounds()[i] = new Round(this, Vm, topArtistIndex, dto.Rounds[i]);
                }
            }
        } else if (topEventDto) {
            this.Country = undefined;
            this.Name = topEventDto.Name;
            this.EID = topEventDto.EID.toString();
            this.Auth(auth);
            this.Top(!!topEventDto);
            this._id = topEventDto._id;
            if (topRoundIndex !== -1) {
                this.Rounds()[topRoundIndex] = new Round(this, Vm, topArtistIndex, null, topEventDto.Rounds[topRoundIndex]);
            }
            for (let i = 0; i < topEventDto.Rounds.length; i++) {
                if (topRoundIndex !== i) {
                    this.Rounds()[i] = new Round(this, Vm, topArtistIndex, null, topEventDto.Rounds[i]);
                }
            }
        }
    }

    public OpenVotingLink() {
        if (this.VoteUrl() && this.VoteUrl().length > 0) {
            // @ts-ignore
            window.location.href = mp + this.VoteUrl();
        } else {
        }
    }
}