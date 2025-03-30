import * as ko from 'knockout';
import { BusyTracker } from '../Utils/BusyTracker';
import { Request } from '../Utils/GatewayFunctions';
import { DataOperationResult } from '../../../shared/OperationResult';

import { JWTAuth } from '../Utils/JWTAuth';
import RegistrationDTO from '../../../shared/RegistrationDTO';
import VideoUrl from './VideoUrl';

export class PeopleViewModel {
    public busy: KnockoutObservable<boolean> = ko.observable<boolean>(false);

    public PeopleStatusUpdater: BusyTracker = new BusyTracker();
    // @ts-ignore
    public Registration: RegistrationDTO = registration;

    public ErrorMessage: KnockoutObservable<string> = ko.observable<string>();

    public Loading: KnockoutObservable<boolean> = ko.observable<boolean>(true);

    public Auth: KnockoutObservable<JWTAuth> = ko.observable<JWTAuth>();
    // @ts-ignore
    public RegistrationId = registrationId;
    // @ts-ignore
    public IsBlocked: KnockoutObservable<number> = ko.observable<number>(isBlocked);
    // @ts-ignore
    public MessageStatusCss: KnockoutComputed<string> = ko.computed<string>(() => this.IsBlocked() === 0 ? 'btn-default' : 'btn-danger');
    // @ts-ignore
    public MessageStatusMessage: KnockoutObservable<string> = ko.computed<string>(() => this.IsBlocked() === 0 ? '&nbsp;' : 'Blocked');

    public VideoUrls: KnockoutObservableArray<VideoUrl> = ko.observableArray<VideoUrl>([]);
    public OpenPopup: KnockoutObservable<boolean> = ko.observable<boolean>();
    public SelectedVideo: KnockoutObservable<VideoUrl> = ko.observable<VideoUrl>();

    public constructor(auth: JWTAuth) {
        this.Auth(auth);
        if (this.Registration.Artist && Array.isArray(this.Registration.Artist.Videos)) {
            for (let i = 0; i < this.Registration.Artist.Videos.length; i++) {
                this.VideoUrls().push(new VideoUrl(this, this.Registration.Artist.Videos[i], i));
            }
        }
    }

    // changing in view
    public async handleMessageStatusChange() {
        try {
            let blocked = this.IsBlocked();
            if (blocked === 0) {
                blocked = 1;
            } else {
                blocked = 0;
            }
            // @ts-ignore
            const result = await this.PeopleStatusUpdater.AddOperation(Request<DataOperationResult<string>>(`${mp}/api/people/message-status/${this.RegistrationId}/${blocked}`, 'GET', null, null, await this.Auth().get()));
            if (result.Success) {
                if (result.Data.length === 0) {
                    this.IsBlocked(0);
                } else {
                    this.IsBlocked(1);
                }
            }
        } catch (e) {
            console.error(e);
            this.MessageStatusCss('btn-danger');
            this.MessageStatusMessage('<span>Error</span>');
        }
    }

    public OpenVideoPopup() {
        this.OpenPopup(true);
        const videoUrl = new VideoUrl(this, '', -1);
        this.SelectedVideo(videoUrl);
    }
}
export default PeopleViewModel;