import { ArtistImageClientDto } from '../Voting/ArtistInterface';
import { ImageUrlDTO } from '../../../shared/ArtistImageDTO';

export class Image {
    public Thumbnail: KnockoutObservable<ImageUrlDTO> = ko.observable<ImageUrlDTO>();
    public Compressed: KnockoutObservable<ImageUrlDTO> = ko.observable<ImageUrlDTO>();

    constructor(artistImage: ArtistImageClientDto) {
        this.Thumbnail(artistImage.Thumbnail);
        this.Compressed(artistImage.Compressed);
    }
}