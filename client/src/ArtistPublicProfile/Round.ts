import { RoundArtistsInterface } from '../../../shared/ArtistImageDTO';
import { ArtistDto } from '../Voting/ArtistInterface';
import { Image } from './Image';
import * as ko from 'knockout';
import { ArtistPublicProfileViewModel } from './ArtistPublicProfileViewModel';
import { Event } from  './Event';
export class Round {
    public RoundNumber: KnockoutObservable<number> = ko.observable<number>();
    public Images: KnockoutObservableArray<Image> = ko.observableArray<Image>();
    public Vm: ArtistPublicProfileViewModel;
    public Event: Event;
    constructor(roundArtist: RoundArtistsInterface, Vm: ArtistPublicProfileViewModel, Event: Event) {
        this.RoundNumber(roundArtist.RoundNumber);
        this.Vm = Vm;
        this.Event = Event;
        const Artists = roundArtist.Artists;
        for (let i = 0; i < Artists.length; i++) {
            this._assignArtistImages(Artists[i]);
        }
    }

    private _assignArtistImages(artist: ArtistDto) {
        const latestImg = artist.Images[artist.Images.length - 1];
        if (latestImg) {
            const cityText = this.Event.City() ? ` in ${this.Event.City()}` : '';
            console.log('this.Event', this.Event);
            this.Vm.Images().push({
                url: new Image(latestImg).Compressed().url,
                imageContext: `Round ${this.RoundNumber()} painting from ${this.Event.EID() || this.Event.Name()}${cityText || ''}`
            });
        }
        /*for (let k = 0; k < artist.Images.length; k++) {
            const image = artist.Images[k];
            this.Vm.Images().push(new Image(image));
        }*/
    }
}