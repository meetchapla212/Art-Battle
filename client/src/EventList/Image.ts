import { ImageUrlDTO } from '../../../shared/ArtistImageDTO';
import { ArtistIndividualImage } from '../../../shared/RoundContestantDTO';
import { Round } from './Round';
import { Artist } from './Artist';
import { EventView } from './EventView';

export class Image {
    public Original: KnockoutObservable<ImageUrlDTO> = ko.observable<ImageUrlDTO>();
    public Thumbnail: KnockoutObservable<ImageUrlDTO> = ko.observable<ImageUrlDTO>();
    public Compressed: KnockoutObservable<ImageUrlDTO> = ko.observable<ImageUrlDTO>();
    public ArtId: KnockoutObservable<string> = ko.observable<string>();
    public AuctionLink: KnockoutObservable<string> = ko.observable<string>();
    public topBidText: KnockoutObservable<string> = ko.observable<string>();
    public topBidCss: KnockoutObservable<string> = ko.observable<string>();

    public constructor(dto: ArtistIndividualImage, Event: EventView, Round: Round, Artist: Artist) {
        this.Original(dto.Original);
        this.Thumbnail(dto.Thumbnail);
        this.Compressed(dto.Compressed);
        if (dto.ArtId) {
            this.ArtId(dto.ArtId);
        } else {
            this.ArtId(`${Event.EID}-${Round.RoundNumber}-${Artist.EaselNumber}`);
        }
    }
}