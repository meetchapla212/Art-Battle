import * as ko from 'knockout';
import { RoundContestantDTO } from '../../../shared/RoundContestantDTO';

export class ContestantResults {
    public EaselNumber: number = null;
    public Name: string = null;
    public Votes: number = null;

    public constructor(dto: RoundContestantDTO, public Rank: number) {
        this.EaselNumber = dto.EaselNumber;
        this.Name = dto.Detail.Name;
        this.Votes = 0;
        for (let i = 0; i < dto.VotesDetail.length; i++) {
            // consider vote factor for new event, for old use 1
            this.Votes += (dto.VotesDetail[i].VoteFactor) || 1;
        }
    }
}

export default ContestantResults;