import { JWTAuth } from '../Utils/JWTAuth';
import * as ko from 'knockout';

import { ArtistListDTO } from '../../../shared/ArtistListDTO';
import { Artist } from './Artist';
export class ArtistListViewModel {
    public Auth: KnockoutObservable<JWTAuth> = ko.observable<JWTAuth>();
    // @ts-ignore comes from html
    public List: ArtistListDTO[] = artistList;
    public Artists: KnockoutObservableArray<Artist> = ko.observableArray<Artist>([]);

    public constructor(auth: JWTAuth) {
        this.Auth(auth);
        for (let i = 0; i < this.List.length; i++) {
            this.Artists.push(new Artist(this.List[i]));
        }
    }
}