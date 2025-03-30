import OperationResult, { DataOperationResult } from '../../../shared/OperationResult';
import { Request } from '../Utils/GatewayFunctions';
import { EventConfigDTO, EventDTO, ReportLink } from '../../../shared/EventDTO';
import Contestant from './Contestant';
import Round from './Round';

import { ObjectId } from 'bson';
import EventPhoneNumberDTO from '../../../shared/EventPhoneNumberDTO';
import HomeScreenViewModel from './HomeScreenViewModel';
import CountryDTO from '../../../shared/CountryDTO';
import TimezoneDTO from '../../../shared/TimezoneDTO';
import MediaDTO from '../../../shared/MediaDTO';
import ContestantDTO, { MinimalContestantDTO } from '../../../shared/ContestantDTO';
import Artist from './Artist';
import { CityDTO } from '../../../shared/CityDTO';

export class EventEditor {

    public Name: KnockoutObservable<string> = ko.observable<string>();
    public PhoneNumber?: KnockoutObservable<string> = ko.observable<string>();
    public RegistrationMessage: KnockoutObservable<string> = ko.observable<string>();
    public Enabled: KnockoutObservable<boolean> = ko.observable<boolean>(true);
    public CurrentRound: KnockoutObservable<Round> = ko.observable<Round>();
    public ShowArchiveMessage: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public IsNew: KnockoutObservable<boolean> = ko.observable<boolean>(false);

    public Contestants: KnockoutObservableArray<Contestant> = ko.observableArray<Contestant>();
    public Rounds: KnockoutObservableArray<Round> = ko.observableArray<Round>();

    public DisplayContestants: KnockoutReadonlyComputed<string>;

    public ReportLinks: KnockoutObservableArray<ReportLink> = ko.observableArray<ReportLink>();

    public VoteByLink: KnockoutObservable<boolean> = ko.observable<boolean>();

    private readonly _id: string;
    public EID: string;
    public PhoneNumbers: EventPhoneNumberDTO[];
    public Countries: CountryDTO[];
    public Cities: CityDTO[];
    public Currencies: KnockoutObservableArray<CountryDTO> = ko.observableArray<CountryDTO>();
    public Timezones: TimezoneDTO[];

    public selectedPhoneNumberId: KnockoutObservable<any> = ko.observable<any>();
    public selectedPhoneNumber: KnockoutObservable<string> = ko.observable<string>();
    public saveError: KnockoutObservable<Error> = ko.observable<Error>();
    public Description: KnockoutObservable<string> = ko.observable<string>();
    public SendLinkToGuests: KnockoutObservable<boolean> = ko.observable<boolean>();
    public EmailRegistration: KnockoutObservable<boolean> = ko.observable<boolean>();
    public Country: KnockoutObservable<CountryDTO> = ko.observable<CountryDTO>();
    public City: KnockoutObservable<CityDTO> = ko.observable<CityDTO>();
    public Currency: KnockoutObservable<CountryDTO> = ko.observable<CountryDTO>();
    public selectedCountryId: KnockoutObservable<any> = ko.observable<any>();
    public selectedCityId: KnockoutObservable<any> = ko.observable<any>();
    public Timezone: KnockoutObservable<TimezoneDTO> = ko.observable<TimezoneDTO>();
    public selectedTimezoneId: KnockoutObservable<any> = ko.observable<any>();
    public selectedCurrencyId: KnockoutObservable<any> = ko.observable<any>();
    public EventStartDateTime: KnockoutObservable<string> = ko.observable<string>();
    public EventEndDateTime: KnockoutObservable<string> = ko.observable<string>();

    public TicketLink: KnockoutObservable<string> = ko.observable<string>();
    public Venue: KnockoutObservable<string> = ko.observable<string>();
    public Price: KnockoutObservable<string> = ko.observable<string>();
    public ShowInApp: KnockoutObservable<boolean> = ko.observable<boolean>();

    public EnableAuction: KnockoutObservable<boolean> = ko.observable<boolean>();
    public ArtWidthHeight: KnockoutObservable<string> = ko.observable<string>();
    public AuctionDescription: KnockoutObservable<string> = ko.observable<string>();
    public AuctionStartBid: KnockoutObservable<number> = ko.observable<number>();
    public MinBidIncrement: KnockoutObservable<number> = ko.observable<number>();
    public AuctionNotice: KnockoutObservable<string> = ko.observable<string>();
    public AdminControlInAuctionPage: KnockoutObservable<boolean> = ko.observable<boolean>(true);
    public Tax: KnockoutObservable<number> = ko.observable<number>(0);
    public RegisterAtSMSVote: KnockoutObservable<boolean> = ko.observable<boolean>();
    public SendAuctionLinkToGuests: KnockoutObservable<boolean> = ko.observable<boolean>();
    public SponsorLogo: KnockoutObservable<MediaDTO> = ko.observable<MediaDTO>();
    public SponsorText: KnockoutObservable<string> = ko.observable<string>();
    public IsFileReadInProgress: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public SearchText: KnockoutObservable<string> = ko.observable<string>();
    public Options: KnockoutObservableArray<{label: string; value: number; contestant: ContestantDTO }> = ko.observableArray<{label: string; value: number; contestant: ContestantDTO; }>();
    public selectedValue: KnockoutObservable<string> = ko.observable<string>('');
    public SlackChannel: KnockoutObservable<string> = ko.observable<string>('');
    public VideoStream: KnockoutObservable<string> = ko.observable<string>('');
    public LiveStream: KnockoutObservable<string> = ko.observable<string>('');
    public AuctionCloseRoundDelay: KnockoutObservable<number> = ko.observable<number>();
    public AuctionCloseStartsAt: KnockoutObservable<Date> = ko.observable<Date>();

    public constructor(dto: EventConfigDTO, private _closeCallback: (dto?: EventDTO) => void) {
        this._id = dto._id;
        this.EID = dto.EID;
        this.Name(dto.Name);
        this.Enabled(dto.Enabled);
        this.Contestants(dto.Contestants.map(c => new Contestant(c, true)));
        this.Rounds(dto.Rounds.map(r => new Round(r, this.Contestants)));
        this.RegistrationMessage(dto.RegistrationConfirmationMessage);
        this.VoteByLink(dto.VoteByLink);
        this.SendLinkToGuests(dto.SendLinkToGuests);
        this.EmailRegistration(dto.EmailRegistration);
        this.ReportLinks(dto.ReportLinks || []);
        this.DisplayContestants = ko.computed(() => this.Contestants().map(c => c.Name).join(', '));
        this.TicketLink(dto.TicketLink);
        this.Venue(dto.Venue);
        this.Price(dto.Price);
        this.ShowInApp(dto.ShowInApp);
        this.AdminControlInAuctionPage(dto.AdminControlInAuctionPage);
        this.Tax(dto.Tax);
        // @ts-ignore
        this.PhoneNumbers = phoneNumberDict; // coming from html
        // @ts-ignore
        this.Countries = countriesDict; // coming from html
        // @ts-ignore
        this.Cities = citiesDict; // coming from html
        const currencyLabels = [];
        for (let i = 0; i < this.Countries.length; i++) {
            if (currencyLabels.indexOf(this.Countries[i].currency_label) === -1) {
                this.Currencies().push(this.Countries[i]);
                currencyLabels.push(this.Countries[i].currency_label);
            }
        }
        // @ts-ignore
        this.Timezones = timezonesDict; // coming from html

        this.EventStartDateTime(dto.EventStartDateTime);
        this.EventEndDateTime(dto.EventEndDateTime);
        this.AuctionCloseStartsAt(dto.AuctionCloseStartsAt);

        this.PhoneNumber(dto.PhoneNumber);
        const selectedNumberObj = this.PhoneNumbers.filter(r => {
            return r.phone === this.PhoneNumber();
        })[0];
        if (selectedNumberObj) {
            this.selectedPhoneNumberId(selectedNumberObj._id);
            this.selectedPhoneNumber(selectedNumberObj.phone);
        }

        this.Description(dto.Description);
        // save default value
        this.selectedCountryId(dto.Country);
        this.selectedCityId(dto.City);
        this.selectedCurrencyId(dto.Currency);
        this.Currency(dto.Currency);
        this.Country(dto.Country);
        this.City(dto.City);

        this.selectedTimezoneId(dto.TimeZone);
        this.Timezone(dto.TimeZone);
        this.EnableAuction(dto.EnableAuction);
        this.RegisterAtSMSVote(dto.RegisterAtSMSVote);
        this.SendAuctionLinkToGuests(dto.SendAuctionLinkToGuests);
        this.ArtWidthHeight(dto.ArtWidthHeight);
        this.AuctionDescription(dto.AuctionDescription);
        this.AuctionStartBid(dto.AuctionStartBid);
        this.MinBidIncrement(dto.MinBidIncrement);
        this.AuctionNotice(dto.AuctionNotice);
        this.SponsorLogo(dto.SponsorLogo);
        this.SponsorText(dto.SponsorText);
        this.SlackChannel(dto.SlackChannel);
        this.LiveStream(dto.LiveStream);
        this.VideoStream(dto.VideoStream);
        this.AuctionCloseRoundDelay(dto.AuctionCloseRoundDelay);
        this.selectedCityId.subscribe((cityId: any) => {
            // save the value  of select.
            this.City(cityId);
        });
        this.selectedCountryId.subscribe((countryId: any) => {
            // save the value  of select.
            this.Country(countryId);
        });

        this.selectedCurrencyId.subscribe((countryId: any) => {
            // save the value  of select.
            this.Currency(countryId);
        });

        this.selectedTimezoneId.subscribe((timezoneId: any) => {
            // save the value  of select.
            this.Timezone(timezoneId);
        });

        // @ts-ignore
        jQuery(document).ready(() => {
            // @ts-ignore
            jQuery('#inputStartDateTime').datetimepicker({
                format: 'm/d/Y h:i A',
                timeFormat: 'h:i A',
                defaultTime: '19:00'
            });
            // @ts-ignore
            jQuery('#inputEndDateTime').datetimepicker({
                format: 'm/d/Y h:i A',
                defaultTime: '21:00'
            });
            // @ts-ignore
            jQuery('#inputAuctionCloseStartsAt').datetimepicker({
                format: 'm/d/Y h:i A',
                // defaultTime: '21:00',
                value: this.AuctionCloseStartsAt()
            });
        });
    }

    public artistAutoCompleteCallback(request: {term: string}, response: (options: { label: string; value: number }[]) => { data: string }) {
        Request<DataOperationResult<{
            Contestants: ContestantDTO[];
            // @ts-ignore
        }>>(`${mp}/api/artist/auto-suggest/?q=${request.term}`, 'GET').then((r) => {
            this.Options([]);
            for (let i = 0; i < r.Data.Contestants.length; i++) {
                const entryId = r.Data.Contestants[i].EntryId ? ` (${r.Data.Contestants[i].EntryId})` : '';
                this.Options.push({
                    label: `${r.Data.Contestants[i].Name}${entryId}`,
                    value: r.Data.Contestants[i]._id,
                    contestant: r.Data.Contestants[i]
                });
            }
            response(this.Options());
        }).catch(e => {
            console.error('auto suggest api call', e);
            response(this.Options());
        });
    }

    /*
    // TODO temp
    async getPhoneNumbers() {
        console.log('ddd', this.Options().map((p) => {return {label: p.name, value: p.id}; }));
        try {
            const result = await Request<OperationResult>(`api/event/h`, 'DELETE');
        } catch (e) {

        }
        return this.Options().map((p) => {return {name: p.name, id: p.id}; });
    }

    selectPhoneNumber(event: any, ui: { item: { name: any; }; }) {
        console.log('ui', ui);
        this.selectedValue(ui.item.name);
    }*/

    public ToDTO(): EventConfigDTO {
        const phone = this.PhoneNumbers.filter(r => {
            return r._id === this.selectedPhoneNumberId();
        })[0];
        let sponsorLogo;
        if (this.SponsorLogo() && !this.SponsorLogo()._id) {
            sponsorLogo = {
                _id: '',
                Name: '',
                Size: 0,
                Url: this.SponsorLogo().Url,
                Type: 'Original',
                FileType: 'photo'
            };
        }
        return {
            LiveStream: this.LiveStream(),
            VideoStream: this.VideoStream(),
            _id: this._id,
            EID: this.EID,
            Name: this.Name(),
            Enabled: this.Enabled(),
            Contestants: this.Contestants().map((c) => c.ToDTO()),
            PhoneNumber: phone && phone.phone, // allow empty
            Rounds: this.Rounds().map((r) => r.ToDTO()),
            CurrentRound: this.CurrentRound() && this.CurrentRound().ToDTO(),
            RegistrationConfirmationMessage: this.RegistrationMessage(),
            ReportLinks: this.ReportLinks().map((r) => {
                return {link: r.link, label: r.label};
            }),
            Logs: [],
            RegistrationsVoteFactor: [],
            VoteByLink: this.VoteByLink(),
            // PhoneNumbers: [],
            Description: this.Description(),
            SendLinkToGuests: this.SendLinkToGuests(),
            EmailRegistration: this.EmailRegistration(),
            Country: this.Country(),
            City: this.City(),
            TimeZone: this.Timezone(),
            EventStartDateTime: this.EventStartDateTime(),
            EventEndDateTime: this.EventEndDateTime(),
            TicketLink: this.TicketLink(),
            Price: this.Price(),
            Venue: this.Venue(),
            ShowInApp: this.ShowInApp(),
            Currency: this.Currency(),
            ArtWidthHeight: this.ArtWidthHeight(),
            AuctionDescription: this.AuctionDescription(),
            AuctionStartBid: this.AuctionStartBid(),
            MinBidIncrement: this.MinBidIncrement(),
            AuctionNotice: this.AuctionNotice(),
            EnableAuction: this.EnableAuction(),
            AdminControlInAuctionPage: this.AdminControlInAuctionPage(),
            Tax: this.Tax(),
            RegisterAtSMSVote: this.RegisterAtSMSVote(),
            SendAuctionLinkToGuests: this.SendAuctionLinkToGuests(),
            SponsorLogo: sponsorLogo,
            SponsorText: this.SponsorText(),
            SlackChannel: this.SlackChannel(),
            AuctionCloseRoundDelay: this.AuctionCloseRoundDelay(),
            AuctionCloseStartsAt: this.AuctionCloseStartsAt()
        };
    }

    public AddContestant(Vm: HomeScreenViewModel): void {
        // this.AddArtist(Vm);

        const contestantObj: MinimalContestantDTO = {
            EntryId: 0,
            Name: '',
            _id: new ObjectId().toHexString(),
            oldId: undefined
        };
        this.Contestants.push(new Contestant(contestantObj, false));
    }

    public AddArtist(Vm: HomeScreenViewModel) {
        const ArtistObj = new Artist({
            ChildContestants: [],
            City: undefined,
            CityText: '',
            Email: '',
            EntryId: undefined,
            IsDuplicate: false,
            Name: '',
            PhoneNumber: '',
            Website: '',
            _id: undefined
        }, Vm.Artists(), Vm, true);
        // this.Artists().push(ArtistObj);
        ArtistObj.Edit();
    }

    public DeleteContestant(contestant: Contestant): void {
        this.Contestants.remove(contestant);
    }

    public AddRound(): void {
        this.Rounds.push(new Round({
            _id: new ObjectId().toHexString(),
            RoundNumber: this.Rounds().length + 1,
            Contestants: [],
            VideoUrl: ''
        }, this.Contestants));
        // collapse ignored because it comes from the bootstrap
        try {
            // @ts-ignore
            $('#roundsPanel').collapse('show');
            // @ts-ignore
            const lastRound = $('#roundsPanel table:last');
            if (lastRound && lastRound[0]) {
                // @ts-ignore
                $('html, body').animate({
                    // @ts-ignore
                    scrollTop: $(lastRound[0]).offset().top
                }, 500);
            }
        }
        catch (e) {
            console.error(e);
        }
    }

    public DeleteRound(round: Round): void {
        this.Rounds.remove(round);
    }

    public SetCurrentRound(round: Round): void {
        this.CurrentRound(round);
    }

    public async Save() {
        while (this.IsFileReadInProgress() === true) {
             console.log('reading file');
        }
        const dto = this.ToDTO();
        try {
            // Start Validation
            const easelRoundCon = [];
            for (let i = 0; i < dto.Rounds.length; i++) {
                const roundNo = dto.Rounds[i].RoundNumber;
                for ( let j = 0; j < dto.Rounds[i].Contestants.length; j++) {
                    const uniqId = `${roundNo}-c${dto.Rounds[i].Contestants[j].EaselNumber}`;
                    if (dto.Rounds[i].Contestants[j].Enabled) {
                        if (easelRoundCon.indexOf(uniqId) === -1) {
                            easelRoundCon.push(uniqId);
                        }
                        else {
                            throw new Error(`Duplicate Easel Number ${dto.Rounds[i].Contestants[j].EaselNumber} assigned in the round ${roundNo}`);
                        }
                        easelRoundCon.push(`${roundNo}-c${dto.Rounds[i].Contestants[j].EaselNumber}`);
                    }
                }
            } // Validation end

            // @ts-ignore
            const result = await Request<DataOperationResult<EventDTO>>(mp + '/api/event', 'POST', dto);
            if (result.Success) {
                window.location.reload();
            }
        }
        catch (e) {
            this.saveError(e && (e.message || e.Message) || e.toString());
            setTimeout(this.saveError.bind(null, ''), 4000);
        }

    }

    public Archive() {
        this.ShowArchiveMessage(true);
    }

    public ArchiveCancel() {
        this.ShowArchiveMessage(false);
    }

    public async ArchiveConfirm() {
        // @ts-ignore
        const result = await Request<OperationResult>(mp + `/api/event/${this._id}`, 'DELETE');
        if (result.Success) {
            window.location.reload();
        }
    }

    public Cancel() {
        this._closeCallback();
    }

    public toggleHandle(vm: HomeScreenViewModel, e: Event) {
        // @ts-ignore
        $(e.target).find('i').toggleClass('glyphicon-plus glyphicon-minus');
    }

    public handleArtistForm(form: HTMLFormElement) {
        return false;
    }

    public fileUpload(vm: HomeScreenViewModel, e: Event) {
        e.preventDefault();
        const file    = (<HTMLInputElement>e.target).files[0];
        const reader  = new FileReader();
        const me = this;
        reader.onloadend = function (onloadend_e) {
            // base 64 file
            const result = reader.result;
            me.SponsorLogo({
                _id: '',
                Name: '',
                Size: 0,
                Url: result.toString(),
                Type: 'Original',
                FileType: 'photo'
            });
            me.IsFileReadInProgress(false);
        };

        reader.onabort = function () {
            me.IsFileReadInProgress(false);
            alert('Upload aborted');
        };

        interface CustomErrorEvent extends ErrorEvent {
            code: number;
            NOT_FOUND_ERR: number;
            NOT_READABLE_ERR: number;
            ABORT_ERR: number;
            SECURITY_ERR: number;
            ENCODING_ERR: number;
        }
        interface CustomEventTarget extends EventTarget {
            error: CustomErrorEvent;
        }
        interface CustomErrorEvent extends ProgressEvent {
            target: CustomEventTarget;
        }
        reader.onerror = function (e: CustomErrorEvent) {
            me.IsFileReadInProgress(false);
            let message = '';
            switch (e.target.error.code) {
                case e.target.error.NOT_FOUND_ERR:
                    message = 'File not found!';
                    break;
                case e.target.error.NOT_READABLE_ERR:
                    message = 'File not readable!';
                    break;

                case e.target.error.ABORT_ERR:
                    message = 'Read operation was aborted!';
                    break;

                case e.target.error.SECURITY_ERR:
                    message = 'File is in a locked state!';
                    break;

                case e.target.error.ENCODING_ERR:
                    message = 'The file is too long to encode in a "data://" URL.';
                    break;
                default:
                    message = 'Read error.';
            }
            alert(message);
        };

        if (file) {
            this.IsFileReadInProgress(true);
            reader.readAsDataURL(file);
        } else {
            alert('no file');
        }
    }

}

export default EventEditor;