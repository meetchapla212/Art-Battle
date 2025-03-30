import { ArtistCombinedClientDto } from './ArtistInterface';
import * as ko from 'knockout';
import { MediaSpecDTO } from '../../../shared/ArtistImageDTO';
import VotingScreenViewModel from './VotingScreenViewModel';

export class ArtistCombined {
    public EaselNumber: number;
    public ArtistId: any;
    public RoundNumber: number;
    public EventId: any;
    public VoterHash: string;
    public FileType: KnockoutObservable<string> = ko.observable<string>();
    public Thumbnail: KnockoutObservable<MediaSpecDTO> = ko.observable<MediaSpecDTO>();
    public Compressed: KnockoutObservable<MediaSpecDTO> = ko.observable<MediaSpecDTO>();
    public Original: KnockoutObservable<MediaSpecDTO> = ko.observable<MediaSpecDTO>();
    public vm: VotingScreenViewModel;
    public Style: KnockoutObservable<string> = ko.observable<string>();

    public constructor(dto: ArtistCombinedClientDto, ArtistId: any, EaselNumber: number, EventId: any, RoundNumber: number, VoterHash: string, isNew: boolean, vm: VotingScreenViewModel) {
        this.ArtistId = ArtistId;
        this.EaselNumber = EaselNumber;
        this.EventId = EventId;
        this.RoundNumber = RoundNumber;
        this.FileType(dto.FileType);

        this.VoterHash = VoterHash;
        if (this.FileType() === 'video') {
            this.Thumbnail({
                url: '/images/video_icon.svg',
                id: 'none'
            });
            this.Style('isVideo');
        } else {
            this.Thumbnail(dto.Thumbnail);
        }
        this.Original(dto.Original);
        this.Compressed(dto.Compressed);

        this.vm = vm;
    }

    public Download() {
        window.location.href = this.Original().url;
    }
}

export default ArtistCombined;