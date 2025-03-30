import { JWTAuth } from '../Utils/JWTAuth';
import * as ko from 'knockout';
import { Event } from './Event';
import { Request } from '../Utils/GatewayFunctions';
import { DataOperationResult } from '../../../shared/OperationResult';

import { BusyTracker } from '../Utils/BusyTracker';
import { ArtistProfileDTO } from '../../../shared/ArtistProfileDTO';

interface NameDTO { firstName: string; lastName: string; }
interface ImageDto {
    url: string;
    imageContext: string;
    clickUrl?: string;
    price?: string;
}

export class ArtistPublicProfileViewModel {
    public Auth: KnockoutObservable<JWTAuth> = ko.observable<JWTAuth>();
    public IsFollowing: KnockoutObservable<boolean> = ko.observable<boolean>();
    public ParsedName: KnockoutObservable<NameDTO> = ko.observable<NameDTO>();
    public CityText: KnockoutObservable<string> = ko.observable<string>();
    public Events: KnockoutObservableArray<Event> = ko.observableArray<Event>();
    public Message: KnockoutObservable<string> = ko.observable<string>();
    public MessageCss: KnockoutObservable<string> = ko.observable<string>();
    public LoadingTracker: BusyTracker = new BusyTracker();
    public ShowFollowingButton: KnockoutObservable<boolean> = ko.observable<boolean>();
    public Bio: KnockoutObservable<string> = ko.observable<string>();
    public Instagram: KnockoutObservable<string> = ko.observable<string>();
    public Website: KnockoutObservable<string> = ko.observable<string>();
    public AdminBio: KnockoutObservable<string> = ko.observable<string>();
    public AdminNotes: KnockoutObservable<string> = ko.observable<string>();
    public FollowersCount: KnockoutObservable<number> = ko.observable<number>();
    public FollowingText: KnockoutObservable<string> = ko.observable<string>();
    public Images: KnockoutObservableArray<ImageDto> = ko.observableArray<ImageDto>([]);
    public ImageContexts: KnockoutObservableArray<string> = ko.observableArray<string>([]);
    public FollowingCss: KnockoutReadonlyComputed<any> = ko.computed<any>(this.getFollowingCss.bind(this));
    public SelectedImageIndex: KnockoutObservable<number> = ko.observable<number>();
    public SelectedImage: KnockoutObservable<string> = ko.observable<string>();
    public SelectedImageContext: KnockoutObservable<string> = ko.observable<string>();

    // @ts-ignore this comes from html view
    public ArtistId = artistId;
    public constructor(auth: JWTAuth) {
        this.Auth(auth);
        // @ts-ignore this comes from html view
        const profile: ArtistProfileDTO = artistProfile;
        this.IsFollowing(profile.IsFollowing);
        this.IsFollowing.notifySubscribers();
        this.ParsedName(profile.ParsedName);
        this.CityText(profile.CityText);
        this.FollowersCount(profile.Score);
        if (this.FollowersCount() > 0)  {
            this.FollowingText(`${profile.Score} following`);
        }
        for (let i = 0; i < profile.ArtistInEvents.length; i++) {
            const eventObj = new Event(profile.ArtistInEvents[i], this);
            this.Events().push(eventObj);
        }
        // this.SelectedImage(this.Images()[0]);
        this.SelectedImageContext(this.ImageContexts()[0] || '');
        const token = this.Auth().get();
        // @ts-ignore
        this.ShowFollowingButton(token && token.length > 0 || phoneHash && phoneHash.length > 0);
        this.Bio(profile.Bio);
        this.Instagram(profile.Instagram);
        this.Images(this.Images().reverse());
        if (Array.isArray(profile.WooProducts)) {
            for (let i = 0; i < profile.WooProducts.length; i++) {
                if (profile.WooProducts[i].images[0] && profile.WooProducts[i].images[0].src) {
                    const isBuy = profile.WooProducts[i].purchasable && profile.WooProducts[i].price;
                    this.Images.push({
                        url: profile.WooProducts[i].images[0].src,
                        imageContext: profile.WooProducts[i].name,
                        clickUrl: profile.WooProducts[i].permalink,
                        price:  isBuy ? ` - for sale on artbattle.com - ${profile.WooProducts[i].price}` : ''
                    });
                }
            }
        }
        for (let i = 0; i < profile.Images.length; i++) {
            if (profile.Images[i] && profile.Images[i].length > 0) {
                this.Images.push({
                    url: profile.Images[i],
                    imageContext: `Studio work sample from ${this.ParsedName().firstName || ''} ${this.ParsedName().lastName || ''}`
                });
            }
        }
        this.Website(profile.Website);
        this.AdminBio(profile.AdminBio);
        this.AdminNotes(profile.AdminNotes);
    }

    public async ToggleFollow() {
        if (this.IsFollowing() ) {
            this.IsFollowing(false);
        } else {
            this.IsFollowing(true);
        }
        this.IsFollowing.notifySubscribers();
        await this.updateFollowStatus();
    }

    public getFollowingCss() {
        return this.IsFollowing() && 'following' || 'not-following';
    }

    public async updateFollowStatus() {
        try {
            await this.LoadingTracker.AddOperation(Request<DataOperationResult<string>>(
                // @ts-ignore phoneHash coming from view
                `${mp}/api/artist/follow/${this.ArtistId}/${phoneHash}`, 'POST', {
                IsFollowing: this.IsFollowing()
            }, null, this.Auth().get()));
        } catch (e) {
            console.error(e);
            this.Message(e && e.Message || e.message || 'An error occurred');
            this.MessageCss('alert-danger');
        }
    }

    public OpenProductUrl(Image: ImageDto) {
        if (Image.clickUrl) {
            window.location.href = Image.clickUrl;
            return ;
        }
        return false;
    }

    /*public CycleImage() {
        let index = this.SelectedImageIndex() - 1;
        if (index >= 0) {
            this.SelectedImageIndex(index);
        } else {
            index = this.Images().length - 1;
            this.SelectedImageIndex(index);
        }
        this.SelectedImage(this.Images()[index]);
    }*/
}