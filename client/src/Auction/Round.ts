import { Artist } from './Artist';
import { JWTAuth } from '../Utils/JWTAuth';
import * as ko from 'knockout';
import RoundDTO from '../../../shared/RoundDTO';
import { EventView } from './EventView';
import AuctionViewModel from './AuctionViewModel';
import { TopEventRoundContestantDTO } from '../../../shared/EventsInAuctionDTO';

export class Round {
    public RoundNumber: number;
    public Artists: KnockoutObservableArray<Artist> = ko.observableArray<Artist>([]);
    public Auth: KnockoutObservable<JWTAuth> = ko.observable<JWTAuth>();

    public constructor(Event: EventView, Vm: AuctionViewModel, topArtistIndex: number, dto?: RoundDTO,
                       topRoundDto?: { RoundNumber: number; Contestants: TopEventRoundContestantDTO[] }) {
        this.Auth(Event.Auth());
        const EID = Event.EID;
        if (dto) {
            this.RoundNumber = dto.RoundNumber;
            if (topArtistIndex !== -1) {
                if (dto.Contestants[topArtistIndex].Enabled && (dto.Contestants[topArtistIndex].EnableAuction || (dto.Contestants[topArtistIndex].Images && dto.Contestants[topArtistIndex].Images.length > 0))
                    && dto.Contestants[topArtistIndex].Images.length > 0 && dto.Contestants[topArtistIndex].EaselNumber > 0)  {
                    this.Artists().push(new Artist(dto.Contestants[topArtistIndex], Event, dto.Contestants[topArtistIndex].ArtId || `${EID}-${this.RoundNumber}-${dto.Contestants[topArtistIndex].EaselNumber}`, Vm));
                }
            }
            for (let i = 0; i < dto.Contestants.length; i++) {
                if (topArtistIndex !== i && (dto.Contestants[i].Enabled && (dto.Contestants[i].EnableAuction || (dto.Contestants[i].Images && dto.Contestants[i].Images.length > 0)))
                    && dto.Contestants[i].Images.length > 0 && dto.Contestants[i].EaselNumber > 0)  {
                    this.Artists().push(new Artist(dto.Contestants[i], Event, dto.Contestants[i].ArtId || `${EID}-${this.RoundNumber}-${dto.Contestants[i].EaselNumber}`, Vm));
                }
            }
        } else {
            this.RoundNumber = topRoundDto.RoundNumber;
            if (topArtistIndex !== -1) {
                if (topRoundDto.Contestants[topArtistIndex].Enabled && (topRoundDto.Contestants[topArtistIndex].EnableAuction || (topRoundDto.Contestants[topArtistIndex].Images && topRoundDto.Contestants[topArtistIndex].Images.length > 0))
                    && topRoundDto.Contestants[topArtistIndex].Images.length > 0 && topRoundDto.Contestants[topArtistIndex].EaselNumber > 0)  {
                    this.Artists().push(new Artist(topRoundDto.Contestants[topArtistIndex], Event, topRoundDto.Contestants[topArtistIndex].ArtId || `${EID}-${this.RoundNumber}-${topRoundDto.Contestants[topArtistIndex].EaselNumber}`, Vm));
                }
            }
            for (let i = 0; i < topRoundDto.Contestants.length; i++) {
                if (topArtistIndex !== i && (topRoundDto.Contestants[i].Enabled && (topRoundDto.Contestants[i].EnableAuction || (topRoundDto.Contestants[i].Images && topRoundDto.Contestants[i].Images.length > 0)))
                    && topRoundDto.Contestants[i].Images.length > 0 && topRoundDto.Contestants[i].EaselNumber > 0)  {
                    this.Artists().push(new Artist(topRoundDto.Contestants[i], Event, topRoundDto.Contestants[i].ArtId || `${EID}-${this.RoundNumber}-${topRoundDto.Contestants[i].EaselNumber}`, Vm));
                }
            }
        }
    }
}