import { JWTAuth } from '../Utils/JWTAuth';
import * as ko from 'knockout';

import { ArtistListV2 } from '../../../shared/ArtistListDTO';
import { Artist } from './Artist';
import { PaginatedLoader } from './PaginatedLoader';
export class ArtistListViewModel {
    public Auth: KnockoutObservable<JWTAuth> = ko.observable<JWTAuth>();
    // @ts-ignore comes from html
    public List: ArtistListV2[] = artistList;
    // @ts-ignore comes from html
    public FollowingArtistsList: ArtistListV2[] = followingArtist;
    public FollowingArtists: KnockoutObservableArray<Artist> = ko.observableArray<Artist>([]);
    public FullArtists: KnockoutObservableArray<Artist> = ko.observableArray<Artist>([]);
    // @ts-ignore
    public Artists: KnockoutObservableArray<Artist> = ko.observableArray<Artist>([]);
    public PaginatedTopArtists: PaginatedLoader;
    public PaginatedFollowingArtists: PaginatedLoader;

    public constructor(auth: JWTAuth) {
        this.Auth(auth);
        for (let i = 0; i < this.List.length; i++) {
            const artistObj = new Artist(this.List[i]);
            this.FullArtists.push(artistObj);
        }
        for (let j = 0; j < this.FollowingArtistsList.length; j++) {
            this.FollowingArtists.push(new Artist(this.FollowingArtistsList[j]));
        }
        this.PaginatedTopArtists = new PaginatedLoader(this.FullArtists());
        this.PaginatedFollowingArtists = new PaginatedLoader(this.FollowingArtists());
    }
}
