import { ArtistInEvent } from '../../../shared/ContestantDTO';
import CountryDTO from '../../../shared/CountryDTO';
import { Round } from './Round';
import * as ko from 'knockout';
import { ArtistPublicProfileViewModel } from './ArtistPublicProfileViewModel';

export class Event {
    public Name: KnockoutObservable<string> = ko.observable<string>();
    public Country: KnockoutObservable<CountryDTO> = ko.observable<CountryDTO>();
    public Rounds: KnockoutObservableArray<Round> = ko.observableArray<Round>();
    public WinnerText: KnockoutObservable<string> = ko.observable<string>();
    public NameWithoutArtId: KnockoutObservable<string> = ko.observable<string>();
    public EID: KnockoutObservable<string> = ko.observable<string>();
    public UserVoteLink: KnockoutObservable<string> = ko.observable<string>();
    public EventDate: KnockoutObservable<string> = ko.observable<string>('');
    public EventDateEID: KnockoutObservable<string> = ko.observable<string>();
    public City: KnockoutObservable<string> = ko.observable<string>();
    public LinkCss: KnockoutObservable<string> = ko.observable<string>('');
    constructor(artistInEvent: ArtistInEvent, Vm: ArtistPublicProfileViewModel) {
        this.Country(artistInEvent.Country);
        const hyphenIdx = artistInEvent.Name.indexOf('-');
        let calcEid;
        if (hyphenIdx !== -1) {
            calcEid = artistInEvent.Name.slice(0, hyphenIdx).trim();
            this.City(artistInEvent.Name.slice(hyphenIdx + 1, artistInEvent.Name.length).trim());
        } else {
            calcEid = artistInEvent.EID;
        }
        this.EID(calcEid);
        this.Name(artistInEvent.Name);
        if (artistInEvent.UserVoteHash) {
            this.UserVoteLink(`/v/${artistInEvent.UserVoteHash}`);
            this.LinkCss('link');
        }
        this.WinnerText('');
        if (artistInEvent.EventStartDateTime) {
            this.EventDate(new Date(artistInEvent.EventStartDateTime).toLocaleDateString());
        }
        this.NameWithoutArtId(artistInEvent.Name.replace(`${this.EID()} -`, '').trim());
        this.EventDateEID(`${this.EventDate()} ${this.EID()}`);
        for (let i = 0; i < artistInEvent.roundWiseImages.length; i++) {
            const roundObj = new Round(artistInEvent.roundWiseImages[i], Vm, this);
            this.Rounds.push(roundObj);
        }
    }

    // used in view
    OpenEventLink(vm: ArtistPublicProfileViewModel) {
        if (this.UserVoteLink()) {
            // @ts-ignore
            window.location.href = mp + this.UserVoteLink();
        }
    }
}