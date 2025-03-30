import HomeScreenViewModel from './HomeScreenViewModel';
import { Request } from '../Utils/GatewayFunctions';
import { EventConfigDTO } from '../../../shared/EventDTO';
import { BusyTracker } from '../Utils/BusyTracker';
import ContestantDTO from '../../../shared/ContestantDTO';
import Artists from './Artists';
import { CityDTO } from '../../../shared/CityDTO';
import Contestant from "./Contestant";
import {DataOperationResult} from "../../../shared/OperationResult";
import RoundContestant from "./RoundContestant";

export default class Artist {
    public LoadingTracker: BusyTracker = new BusyTracker();
    public Vm: HomeScreenViewModel;
    public Parent: Artists;
    public Name: KnockoutObservable<string> = ko.observable<string>();
    public EntryId: KnockoutObservable<number> = ko.observable<number>();
    public Email: KnockoutObservable<string> = ko.observable<string>();
    public Website: KnockoutObservable<string> = ko.observable<string>();
    public City: KnockoutObservable<CityDTO> = ko.observable<CityDTO>();
    public VoterProfile: KnockoutObservable<string> = ko.observable<string>();
    public PhoneNumber: KnockoutObservable<string> = ko.observable<string>();
    public SaveMessage: KnockoutObservable<string> = ko.observable<string>();
    public SaveMessageCss: KnockoutObservable<string> = ko.observable<string>();
    public IsNew = false;
    private ArtistId: string;

    public constructor(Artist: ContestantDTO, Parent: Artists, vm: HomeScreenViewModel, IsNew?: boolean) {
        this.Vm = vm;
        this.Parent = Parent;
        this.Name(Artist.Name);
        this.ArtistId = Artist._id;
        this.EntryId(Artist.EntryId);
        this.Email(Artist.Email);
        this.Website(Artist.Website);
        this.City(Artist.City);
        this.PhoneNumber(Artist.PhoneNumber);
        this.IsNew = IsNew;

        if (Artist.Registration) {
            this.VoterProfile(Artist.Registration.Hash.toString());
        }
    }

    public async Save() {
        if (this.IsNew) {
            return this.Add();
        }
        try {
            await this.LoadingTracker.AddOperation(Request<ContestantDTO>(
                // @ts-ignore
                `${mp}/api/artist/${this.ArtistId}`, 'PUT', this.ToDTO()));
            this.SaveMessage(`Contestant Updated`);
            this.SaveMessageCss('alert-success');
        } catch (e) {
            console.error('error', e);
            this.SaveMessage(e && e.Message || e.message || 'An error occurred');
            this.SaveMessageCss('alert-danger');
            this.Parent.Vm.SelectedArtist(this);
            // this.Vm.OpenPopup(true);
        }
    }

    public async Add() {
        try {
            const result = await this.LoadingTracker.AddOperation(Request<DataOperationResult<ContestantDTO>>(
                `api/artist`, 'POST', this.ToDTO()));
            this.SaveMessage(`Contestant Added`);
            this.SaveMessageCss('alert-success');
            this.ArtistId = result.Data._id;
            if (this.Vm.Editor()) {
                const contestantObj = new Contestant(result.Data, true);
                this.Vm.Editor().Contestants().push(contestantObj);
                this.Vm.Editor().Contestants.notifySubscribers();
                for (let i = 0; i < this.Vm.Editor().Rounds().length; i++) {
                    const roundContestant = new RoundContestant(contestantObj);
                    this.Vm.Editor().Rounds()[i].Contestants.push(roundContestant);
                    this.Vm.Editor().Rounds()[i].Contestants.notifySubscribers();
                }
                this.Vm.Editor().Rounds.notifySubscribers();
            }
            this.IsNew = false;
        } catch (e) {
            console.error('error', e);
            this.SaveMessage(e && e.Message || e.message || 'An error occurred');
            this.SaveMessageCss('alert-danger');
            this.Parent.Vm.SelectedArtist(this);
            // this.Vm.OpenPopup(true);
        }
    }

    public ToDTO() {
        return {
            Name: this.Name(),
            EntryId: this.EntryId(),
            Email: this.Email(),
            Website: this.Website(),
            City: this.City(),
            PhoneNumber: this.PhoneNumber()
        };
    }

    public Edit() {
        this.Vm.SelectedArtist(this);
        this.Vm.OpenPopup(true);
    }
}