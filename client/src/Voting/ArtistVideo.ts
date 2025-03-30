import { ArtistImageClientDto } from './ArtistInterface';
import * as ko from 'knockout';
import { MediaSpecDTO } from '../../../shared/ArtistImageDTO';
import VotingScreenViewModel from './VotingScreenViewModel';

export class ArtistVideo {
    public Original: KnockoutObservable<MediaSpecDTO> = ko.observable<MediaSpecDTO>();
    public vm: VotingScreenViewModel;

    public constructor(dto: ArtistImageClientDto, vm: VotingScreenViewModel) {
        this.Original(dto.Original);
        this.vm = vm;
    }
}

export default ArtistVideo;