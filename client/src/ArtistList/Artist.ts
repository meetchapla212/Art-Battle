import { ArtistListDTO } from '../../../shared/ArtistListDTO';

import { ArtistIndividualImage } from '../../../shared/RoundContestantDTO';
export class Artist {
    public Name: string[];
    public Link: string;
    public Images: ArtistIndividualImage[];
    public SelectedImageIndex: KnockoutObservable<number> = ko.observable<number>();
    public SelectedImage: KnockoutObservable<ArtistIndividualImage> = ko.observable<ArtistIndividualImage>();

    constructor(dto: ArtistListDTO) {
        this.Name = dto.Name.split(' ');
        if (this.Name[1] === '-') {
            this.Name[1] = '';
        }
        this.Link = dto.Link;
        this.Images = dto.Images;
        this.SelectedImage(this.Images[0]);
    }

    public CycleImage() {
        let index = this.SelectedImageIndex() - 1;
        if (index >= 0) {
            this.SelectedImageIndex(index);
        } else {
            index = this.Images.length - 1;
            this.SelectedImageIndex(index);
        }
        this.SelectedImage(this.Images[index]);
    }
}