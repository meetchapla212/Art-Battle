import RoundContestantDTO from '../../../shared/RoundContestantDTO';
import { ArtistsInImages } from '../../../shared/ArtistImageDTO';
import { ArtistCombinedClientDto, ArtistDto } from '../../../client/src/Voting/ArtistInterface';
import RegistrationDTO from '../../../shared/RegistrationDTO';

const artistWiseImages = function (artistsInRound: RoundContestantDTO[], user?: RegistrationDTO, contestantId?: any) {
    let hasImages = false;
    interface CustomArtistDto extends ArtistDto {
        HasVoted: boolean;
    }

    const artists: CustomArtistDto[] = [];
    for (let k = 0; k < artistsInRound.length; k++) {
        if (artistsInRound[k].EaselNumber && artistsInRound[k].Enabled
            && (!contestantId || (contestantId && artistsInRound[k].Detail && artistsInRound[k].Detail._id.toString() === contestantId.toString()))) {
            const names = artistsInRound[k].Detail.Name.trim().split(' ');
            let firstName = '';
            let lastName = '';
            let originalFirstName = '';
            let originalLastName = '';
            // to highlight first name
            for (let i = 0; i < names.length; i++) {
                if (i !== (names.length - 1)) {
                    if (i > 0) {
                        firstName += ' ';
                    }
                    if (names[i].trim() !== '') {
                        firstName += names[i];
                        originalFirstName += names[i];
                    }
                } else {
                    lastName = ' ' + names[i];
                    originalLastName = ' ' + names[i];
                    if (artistsInRound[k].IsWinner === 1) {
                        lastName += ' (W)';
                    }
                }
            }
            if (artistsInRound[k].Images.length > 0) {
                hasImages = true;
            }
            let hasVoted = false;
            if (user) {
                hasVoted = !!(artistsInRound[k].Votes.find((v) => {
                    return v._id.toString() === user._id.toString();
                }));
            }
            const combined = [];
            for (let i = 0; i < artistsInRound[k].Images.length; i++) {
                const imageObj = artistsInRound[k].Images[i];
                const combinedObj: ArtistCombinedClientDto = {...{FileType: 'image'}, ...JSON.parse(JSON.stringify(imageObj))};
                combined.push(combinedObj);
            }
            for (let i = 0; i < artistsInRound[k].Videos.length; i++) {
                const videoObj: ArtistCombinedClientDto = artistsInRound[k].Videos[i];
                const combinedObj: ArtistCombinedClientDto = {...{FileType: 'video'}, ...JSON.parse(JSON.stringify(videoObj))};
                combined.push(combinedObj);
            }
            artists.push({
                EaselNumber: artistsInRound[k].EaselNumber,
                Name: [firstName, lastName],
                OriginalName: [originalFirstName, originalLastName],
                id: artistsInRound[k]._id,
                ArtistId: artistsInRound[k].Detail._id,
                Images: artistsInRound[k].Images,
                Videos: artistsInRound[k].Videos,
                IsWinner: artistsInRound[k].IsWinner,
                EnableAuction: artistsInRound[k].EnableAuction,
                HasVoted: hasVoted,
                Combined: combined.sort((a, b) => {
                    if (a.Original && b.Original) {
                        return  parseInt(a.Original.id, 16) - parseInt(b.Original.id, 16);
                    } else {
                        return 0;
                    }
                })
            });
        }
    }
    const result: ArtistsInImages = {
        artists: artists.sort((a, b) => {
            return a.EaselNumber - b.EaselNumber;
        }),
        hasImages: hasImages
    };
    return result;
};

export default artistWiseImages;