import { NextFunction, Request, Response } from 'express';
import { default as EventModel } from '../models/Event';
import LotModel from '../models/Lot';
import artistWiseImages from '../common/ArtistWiseImages';
import { RoundArtistsInterface } from '../../../shared/ArtistImageDTO';

export const editImages = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const eventDoc = await EventModel.findOne({
            '_id': req.params.eventId,
        }).select(['Name', 'EID', 'Description', '_id', 'VoteByLink', 'Rounds', 'CurrentRound', 'RegistrationsVoteFactor', 'Contestants', 'Images', 'EnableAuction'])
            .populate('Rounds.Contestants.Detail')
            .populate('Country');
        if (!eventDoc) {
            return next(new Error('Invalid Event'));
        }
        const openAuctionCount = await LotModel.countDocuments({
            'Event': eventDoc._id,
            'Status': 1
        });
        const totalRounds = eventDoc.Rounds.length;
        const currentRound = eventDoc.CurrentRound;
        let currentRoundNumber = currentRound && currentRound.RoundNumber;
        let currentRoundIndex: number;
        const roundWiseImages = [];
        for ( let j = 0; j < totalRounds; j++ ) {
            const artistsInRound = eventDoc.Rounds[j].Contestants;
            const artistsImages = artistWiseImages(artistsInRound);
            const response: RoundArtistsInterface = {
                EventId: eventDoc.id,
                EID: eventDoc.EID,
                RoundNumber: eventDoc.Rounds[j].RoundNumber,
                Artists: artistsImages.artists,
                IsCurrentRound: currentRoundNumber === eventDoc.Rounds[j].RoundNumber,
                HasOpenRound: !eventDoc.Rounds[j].IsFinished,
                HasImages: artistsImages.hasImages,
                EnableAuction: eventDoc.EnableAuction
            };
            roundWiseImages.push(response);
            if (eventDoc.Rounds[j].RoundNumber === currentRoundNumber) {
                currentRoundIndex = j;
            }
        }
        if (!currentRoundNumber) {
            currentRoundNumber = 0;
        }
        res.render('ImageEditor/editor', {
            title: eventDoc.Name,
            Description: eventDoc.Description,
            countryFlag: eventDoc.Country && eventDoc.Country.country_image,
            roundWiseImages: roundWiseImages,
            CurrentRoundNumber: currentRoundNumber,
            openAuctionCount: openAuctionCount,
            EID: eventDoc.EID
        });
    }
    catch (e) {
        next(e);
    }
};