import { ImageUrlDTO } from '../../../shared/ArtistImageDTO';
import { ArtistIndividualImage } from '../../../shared/RoundContestantDTO';

export class Image {
    public Original: KnockoutObservable<ImageUrlDTO> = ko.observable<ImageUrlDTO>();
    public Thumbnail: KnockoutObservable<ImageUrlDTO> = ko.observable<ImageUrlDTO>();
    public Compressed: KnockoutObservable<ImageUrlDTO> = ko.observable<ImageUrlDTO>();

    public constructor(dto: ArtistIndividualImage) {
        this.Original(dto.Original);
        this.Thumbnail(dto.Thumbnail);
        this.Compressed(dto.Compressed);
    }
}