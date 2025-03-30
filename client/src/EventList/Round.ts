import { RoundArtistsInterface } from '../../../shared/ArtistImageDTO';
import { Artist } from './Artist';
import EventListViewModel from './EventListViewModel';
import { EventView } from './EventView';

export class Round {
    public RoundNumber: number;
    public Artists: KnockoutObservableArray<Artist> = ko.observableArray<Artist>([]);
    public Active: KnockoutObservable<string> = ko.observable<string>();
    public StatusCss: KnockoutObservable<string> = ko.observable<string>();
    public WinningArtists: KnockoutObservableArray<{
        Name: string[];
        Link: string;
    }> = ko.observableArray<{
        Name: string[];
        Link: string;
    }>();
    public HasVoted: KnockoutObservable<boolean> = ko.observable<boolean>(false);

    public constructor(dto: RoundArtistsInterface, Event: EventView) {
        this.RoundNumber = dto.RoundNumber;
        this.HasVoted(dto.HasVoted);
        for (let i = 0; i < dto.Artists.length; i++) {
            if (dto.Artists[i].IsWinner > 0) {
                this.WinningArtists().push({
                    Name: dto.Artists[i].OriginalName,
                    Link: `/ar/${dto.Artists[i].ArtistId}/${Event.Vm.PhoneHash()}`
                });
            }
            this.Artists().push(new Artist(dto.Artists[i], Event, this));
        }
        if (dto.HasOpenRound && dto.IsCurrentRound) {
            this.StatusCss('round-live');
        } else {
            this.StatusCss('round-finished');
        }
    }

    public async makeActive($root: EventListViewModel, $parent: EventView) {
        await $root.makeOthersActive(this.RoundNumber, $parent.eventId);
        const promises = [];
        try {
            for (let i = 0; i < this.Artists().length; i++) {
                // this.Artists()[i].LastStateIndex(-1);
                if (this.Artists()[i].SelectedImage()) {
                    promises.push(this.Artists()[i].getAuctionDetail(this.Artists()[i].SelectedImage(), $parent));
                }
            }
            await Promise.all(promises);
        } catch (e) {
            // default behaviour when auction is disabled
            console.error(e);
        }
    }
}