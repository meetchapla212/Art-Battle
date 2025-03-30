import { ArtistDto, ArtistImageClientDto } from './ArtistInterface';
import ArtistImage from './ArtistImage';
import VotingScreenViewModel from './VotingScreenViewModel';
import Round from './Round';
import ArtistVideo from './ArtistVideo';
import ArtistCombined from './ArtistCombined';

export class Artist {
    public Images: KnockoutObservableArray<ArtistImage> = ko.observableArray<ArtistImage>();
    public Videos: KnockoutObservableArray<ArtistVideo> = ko.observableArray<ArtistVideo>();
    public Combined: KnockoutObservableArray<ArtistCombined> = ko.observableArray<ArtistCombined>();
    public Name: string[];
    public EaselNumber: number;
    public id: any;
    public EventId: any;
    public RoundNumber: number;
    public VoterHash: string;
    public showDialog: KnockoutObservable<boolean> = ko.observable<boolean>(false);
    public EID: string;
    public Round: Round;
    public vm: VotingScreenViewModel;

    public constructor(dto: ArtistDto, EventId: any, Round: Round, VoterHash: string, vm: VotingScreenViewModel) {
        this.Name = dto.Name;
        this.EaselNumber = dto.EaselNumber;
        this.id = dto.id;
        this.EventId = EventId;
        this.RoundNumber = Round.RoundNumber();
        this.VoterHash = VoterHash;
        for (let i = 0; i < dto.Combined.length; i++) {
            this.Combined().unshift(new ArtistCombined(dto.Combined[i], this.id, this.EaselNumber, this.EventId, this.RoundNumber, this.VoterHash, false, vm));
        }
        this.showDialog = ko.observable(false);
        this.EID = vm.EID;
        this.vm = vm;
        this.Round = Round;
    }

    public AddMedia(media: ArtistImageClientDto) {
        const artistImage = new ArtistCombined(media, this.id, this.EaselNumber, this.EventId, this.RoundNumber, this.VoterHash, false, this.vm);
        this.Combined.unshift(artistImage);
    }

    public fileUpload(Artist: Artist, e: Event) {
        e.preventDefault();
        if (this.vm.RequestArr().length >= 3) {
            // do not allow more than 3 uploads simultaneously
            alert('Maximum of 3 files can be uploaded simultaneously');
            return ;
        }
        const files = (<HTMLInputElement>e.target).files;
        if (files.length > 1) {
            alert('Please select only one file');
            return ;
        }
        this.vm.selectedEaselNumber(this.EaselNumber);
        this.vm.selectedArtistName(this.Name.join('').replace(/ /g, ''));
        this.vm.selectedContestantId(this.id);
        this.vm.eventId(this.EventId);
        this.vm.SelectedRound(this.Round);
        this.vm.uploadManager.addFile(files[0]);
        // @ts-ignore
        // this.vm.uploadManager.addFiles(files);
    }
}

export default Artist;