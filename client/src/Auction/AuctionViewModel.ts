import * as ko from 'knockout';
import { Request } from '../Utils/GatewayFunctions';
import { DataOperationResult } from '../../../shared/OperationResult';
import { EventView } from './EventView';
import { JWTAuth } from '../Utils/JWTAuth';
import { BusyTracker } from '../Utils/BusyTracker';
import { Artist } from './Artist';
import { RegistrationResponseDTO } from '../../../shared/RegistrationResponse';
import { EventsInAuction } from '../../../shared/EventsInAuctionDTO';
export class AuctionViewModel {
    public Message: KnockoutObservable<string> = ko.observable<string>('');
    public disableSubmit: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public Auth: KnockoutObservable<JWTAuth> = ko.observable<JWTAuth>();
    public EventListUpdater: BusyTracker = new BusyTracker();
    public EventListView: KnockoutObservableArray<EventView> = ko.observableArray<EventView>();
    public ErrorMessage: KnockoutObservable<string> = ko.observable<string>();
    public ActiveArtist: KnockoutObservable<Artist> = ko.observable<Artist>();
    public UserNumber: KnockoutObservable<string> = ko.observable<string>();
    public UserOTP: KnockoutObservable<string> = ko.observable<string>();
    public VerifyUser: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public RegistrationId: KnockoutObservable<string> = ko.observable<string>();
    public RegisterErrorMessage: KnockoutObservable<string> = ko.observable<string>();
    public ActiveArtistWidthAndHeight: KnockoutObservable<string> = ko.observable<string>();
    public ActiveArtistDescription: KnockoutObservable<string> = ko.observable<string>();
    public LotSaveMessage: KnockoutObservable<string> = ko.observable<string>();
    public LotSaveCss: KnockoutObservable<string> = ko.observable<string>();
    public ShowEmailAndNamePopup: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public Name: KnockoutObservable<string> = ko.observable<string>();
    public Email: KnockoutObservable<string> = ko.observable<string>();
    public NickName: KnockoutObservable<string> = ko.observable<string>();
    public ArtBattleNews: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public NotificationEmails: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public LoyaltyOffers: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public MoreDetailMessage: KnockoutObservable<string> = ko.observable<string>();
    public MoreDetailCss: KnockoutObservable<string> = ko.observable<string>();
    // used in view
    public ShowAdminControls: KnockoutObservable<boolean> = ko.observable<boolean>();
    public RetryBid: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public EventId: string; // filter by event

    public constructor(auth: JWTAuth, eventId?: string, loadAtInit: boolean = true) {
        this.Auth(auth);
        this.EventId = eventId;
        if (loadAtInit) {
            this.populateEventList().catch(e => {
                if (e) {
                    console.error(e);
                } else {
                    console.error('error in e');
                }
            });
        }
    }

    messageClick(message: string) {
        this.Message(message);
    }

    submitForm(form: HTMLFormElement) {
        $(form).find('button').addClass('disabled');
        if (!this.disableSubmit()) {
            // submit is allowed
            this.disableSubmit(true);
            return true;
        } else {
            return false;
        }
    }

    public async populateEventList() {
        const result = await this.EventListUpdater.AddOperation(Request<DataOperationResult<EventsInAuction>>(
            // @ts-ignore artId phoneHash comes from js
            `${mp}/api/auction/events?artId=${artId}&phoneHash=${phoneHash}&eventId=${this.EventId || ''}`,
            'GET', null, null, await this.Auth().get()));
        if (result.Success) {
            const topEventIndex = result.Data.topEventIndex;
            const topRoundIndex = result.Data.topRoundIndex;
            const topArtistIndex = result.Data.topArtistIndex;
            const topEvents = result.Data.topEventsArr;
            if (topEventIndex !== -1) {
                this.EventListView.push(new EventView(this.Auth(), this, topRoundIndex, topArtistIndex, result.Data.eventsArr[topEventIndex]));
            }
            for (let i = 0; i < result.Data.eventsArr.length; i++) {
                if (topEventIndex !== i) {
                    this.EventListView.push(new EventView(this.Auth(), this, -1, -1, result.Data.eventsArr[i]));
                }
            }
            if (topEvents[0]) {
                if (this.EventListView.length > 0) {
                    this.EventListView.splice(1, 0, new EventView(this.Auth(), this, topRoundIndex, topArtistIndex, null, topEvents[0]));
                } else {
                    this.EventListView.push(new EventView(this.Auth(), this, topRoundIndex, topArtistIndex, null, topEvents[0]));
                }
            }
        } else {
            this.ErrorMessage('An Error occurred');
        }
    }

    public setActiveArtist(Artist: Artist) {
        if (this.ActiveArtist() && this.ActiveArtist().RefreshIntervalHandle) {
            clearInterval(this.ActiveArtist().RefreshIntervalHandle);
        }
        this.ActiveArtist(Artist);
    }

    public async RegisterUser() {
        try {
            this.RegisterErrorMessage('');
            // @ts-ignore
            const result = await  this.EventListUpdater.AddOperation(Request<DataOperationResult<RegistrationResponseDTO>>(`${mp}/api/register`, 'POST', {
                'eventId': this.ActiveArtist().Event._id,
                'PhoneNumber': this.UserNumber()
            }, null, await this.Auth().get()));
            if (result.Success) {
                this.VerifyUser(true);
                this.RegistrationId(result.Data.RegistrationId);
                alert('Please enter text verification code received in SMS');
            } else {
                this.RegisterErrorMessage('An Error occurred');
            }
        } catch (e) {
            console.error(e);
            this.RegisterErrorMessage(e.message || 'An error occurred');
        }
    }

    public async VerifyOTP() {
       try {
           this.RegisterErrorMessage('');
           const result = await  this.EventListUpdater.AddOperation(Request<DataOperationResult<{
               Message: String;
               JWT: string;
               Email: string;
               Name: string;
               NickName: string;
               ArtBattleNews: boolean;
               NotificationEmails: boolean;
               LoyaltyOffers: boolean;
               // @ts-ignore
           }>>(`${mp}/api/verifyOtp`, 'POST', {
               registrationId: this.RegistrationId(),
               otp: this.UserOTP(),
               deviceToken: null,
               eventId: this.ActiveArtist().Event._id
           }, null, await this.Auth().get()));
           if (result.Success) {
               if (!result.Data.Name || result.Data.Name.length === 0) {
                   this.ShowEmailAndNamePopup(true);
               } else {
                   this.Name(result.Data.Name);
               }
               if (!result.Data.Email || result.Data.Email.length === 0) {
                   this.ShowEmailAndNamePopup(true);
               } else {
                   this.Email(result.Data.Email);
               }
               if (!result.Data.NickName || result.Data.NickName.length === 0) {
                   this.ShowEmailAndNamePopup(true);
                   this.NickName(result.Data.NickName);
               }
               this.VerifyUser(true);
               this.Auth().set(result.Data.JWT);
               this.VerifyUser(false);
               this.ArtBattleNews(result.Data.ArtBattleNews);
               this.NotificationEmails(result.Data.NotificationEmails);
               this.LoyaltyOffers(result.Data.LoyaltyOffers);
               if (!this.ShowEmailAndNamePopup()) {
                   alert('You are now logged in');
               }
           } else {
               this.RegisterErrorMessage('An Error occurred');
           }
       } catch (e) {
           console.error(e);
           this.RegisterErrorMessage(e.message || 'An error occurred');
       }
    }

    public async SaveLotConfig() {
        try {
            this.LotSaveMessage('');
            this.LotSaveCss('');
            const result = await  this.EventListUpdater.AddOperation(Request<DataOperationResult<{
                Message: String;
                JWT: string;
                // @ts-ignore
            }>>(`${mp}/api/auction/saveLotConfig/${this.ActiveArtist().ArtId()}`, 'PUT', {
                Description: this.ActiveArtistDescription(),
                WidthAndHeight: this.ActiveArtistWidthAndHeight(),
            }, null, await this.Auth().get()));
            if (result.Success) {
                this.LotSaveMessage('Saved!');
                this.LotSaveCss('alert-success');
            } else {
                this.RegisterErrorMessage('An Error occurred');
            }
        } catch (e) {
            console.error(e);
            this.LotSaveMessage(e.message || 'An error occurred');
            this.LotSaveCss('alert-danger');
        }
    }

    public async submitMoreDetail() {
        this.MoreDetailCss(undefined);
        this.MoreDetailMessage(undefined);
        if (!this.Email() || !this.Name() || !this.NickName()) {
            this.MoreDetailCss('alert-danger');
            this.MoreDetailMessage(`Please fill all details`);
            return ;
        }
        try {
            const result = await this.EventListUpdater.AddOperation(Request<{
                Message: string;
                code: string;
                Success: boolean;
                // @ts-ignore
            }>(`${mp}/api/set-nick-name`, 'POST', {
                'nickName': this.NickName(),
                'Email': this.Email(),
                'Name': this.Name(),
                'ArtBattleNews': this.ArtBattleNews(),
                'NotificationEmails': this.NotificationEmails(),
                'LoyaltyOffers': this.LoyaltyOffers()
            }, null, await this.Auth().get()));
            if (result.Success) {
                this.MoreDetailCss('alert-success');
                this.MoreDetailMessage(result.Message);
                this.ShowEmailAndNamePopup(false);
                if (this.RetryBid() && this.ActiveArtist()) {
                    await this.ActiveArtist().BidForArt();
                }
            } else {
                this.MoreDetailCss('alert-danger');
                this.MoreDetailMessage(result.Message || 'Internal server error');
            }
        } catch (e) {
            console.error(e);
            this.MoreDetailCss('alert-danger');
            this.MoreDetailMessage(e.Message || e.message || 'Unexpected error');
        }
        this.RetryBid(false);
    }
}

export default AuctionViewModel;