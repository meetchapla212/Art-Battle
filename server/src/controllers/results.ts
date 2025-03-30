import { Request, Response, NextFunction } from 'express';
import { default as EventModel } from '../models/Event';
import RoundContestantDTO, {
    RoundContestantResultDto, RoundResultDTO
} from '../../../shared/RoundContestantDTO';
import RoundDTO from '../../../shared/RoundDTO';
import EventDTO, { EventResultDTO } from '../../../shared/EventDTO';
import RegistrationLogModel from '../models/RegistrationLog';
// @ts-ignore
import { distanceInWordsToNow } from 'date-fns';
import LotModel from '../models/Lot';
import logger from '../config/logger';
import { DataOperationResult } from '../../../shared/OperationResult';
import { AutoCloseStates } from '../common/States';
import { States, StateColors } from '../common/States';
/**
 * GET /
 * Vote results
 */
export let index = async(req: Request, res: Response, next: NextFunction) => {
    try {
        const event = await EventModel.findById(req.params.eventId)
            .select('Name')
            .select('Country')
            .select('RegistrationsVoteFactor')
            .populate('Country');
        let voteLink = '';
        for (let i = 0; i < event.RegistrationsVoteFactor.length; i++) {
            if (event.RegistrationsVoteFactor[i].RegistrationId.toString() == req.user._id.toString()) {
                voteLink = event.RegistrationsVoteFactor[i].VoteUrl.toString();
            }
        }
        res.render('results', {
            title: `Results for ${event.Name}`,
            EventName: event.Name,
            countryFlag: event.Country && event.Country.country_image,
            user: req.user,
            voteLink: voteLink,
            editPhotoLink: `/event/edit-images/${req.params.eventId}`,
            registerUserLink: `/event/${req.params.eventId}/register`
        });
    } catch (err) {
        return next(err);
    }
};

export let result = async(req: Request, res: Response, next: NextFunction) => {
    try {
        const event = await EventModel.findById(req.params.eventId)
            .select(['EID', 'Name', 'Rounds', 'Registrations', 'Logs', 'CurrentRound', 'Currency', 'EnableAuction', 'AuctionCloseStartsAt', 'RegistrationsVoteFactor'])
            .populate('Rounds.Contestants.Detail')
            // .populate('CurrentRound.Contestants.Detail')
            // .populate('Rounds.Contestants.Lot')
            // .populate('Rounds.Contestants.Lot.Bids.Registration')
            .populate('Currency');
        const registrationStat = await  Promise.all([
            RegistrationLogModel.countDocuments({EventId: req.params.eventId, AlreadyRegisteredForEvent: false}),
            // RegistrationLogModel.countDocuments({EventId: req.params.eventId, AlreadyRegisteredForEvent: false, NumberExists: true}),
            // RegistrationLogModel.countDocuments({EventId: req.params.eventId, AlreadyRegisteredForEvent: false, NumberExists: {'$ne': true}}),
            RegistrationLogModel.countDocuments({EventId: req.params.eventId, AlreadyRegisteredForEvent: false,
                RegisteredAt: 'sms'}),
            RegistrationLogModel.countDocuments({EventId: req.params.eventId, AlreadyRegisteredForEvent: false,
                RegisteredAt: {'$in': ['app', 'app-global']}}),
            RegistrationLogModel.countDocuments({EventId: req.params.eventId, AlreadyRegisteredForEvent: false,
                VoteFactor: {'$gt': 1.4}, RegisteredAt: {'$in': ['app', 'app-global']}}),
        ]);
        const contestantMetricMap: {[key: string]: {
                totalBids: number;
                TopBidAndTime: string;
            }} = {};


        const allUsers = registrationStat[0];
        const doorUsers = registrationStat[1];
        const onlineUsers = registrationStat[2];
        const topOnlineUsers = registrationStat[3];
        const artIdsToSearch = [];
        for (let j = 0; j < event.Rounds.length; j++) {
            for (let k = 0; k < event.Rounds[j].Contestants.length; k++) {
                const artId = `${event.EID}-${event.Rounds[j].RoundNumber}-${event.Rounds[j].Contestants[k].EaselNumber}`;
                artIdsToSearch.push(artId);
            }
        }
        if (artIdsToSearch.length > 0) {
            const Lots = await LotModel.find({
                ArtId: {
                    '$in': artIdsToSearch
                }
            }).populate('Bids.Registration');
            for (let i = 0; i < Lots.length; i++) {
                const Lot = Lots[i];
                const totalBids = Lot.Bids.length;
                // Highest Bid always comes in last;
                const highestBid = Lot.Bids[totalBids - 1];
                let topBidAndTime;
                if (highestBid && highestBid.Registration) {
                    const bidDate = new Date(highestBid.createdAt);
                    const result = distanceInWordsToNow(
                        bidDate,
                        {includeSeconds: true}
                    );
                    const firstName = `${highestBid.Registration.FirstName || ''}`;
                    const lastName = `${highestBid.Registration.LastName || ''}`;
                    const nameArr = [];
                    if (firstName) {
                        nameArr.push(firstName);
                    }
                    if (lastName) {
                        nameArr.push(lastName);
                    }
                    const name =  nameArr.join(' ');
                    const registrationId = highestBid.Registration._id;
                    const regFactor = event.RegistrationsVoteFactor.find(r => {
                        return (r.RegistrationId.toString() == registrationId.toString());
                    });
                    const lastStateIndex = States.indexOf(regFactor.Status);
                    let css = 'btn-default';
                    let statusColor = '';
                    if (lastStateIndex !== -1) {
                        // this.Status(status);
                        css = 'btn-default';
                        statusColor = StateColors[lastStateIndex];
                    }
                    // , css: StatusCss(), style: {'background-color': StatusColor(), 'border-color': StatusColor()}"
                    topBidAndTime = `<a href="${process.env.MP}/p/${highestBid.Registration.PhoneNumber}">${name || highestBid.Registration.NickName} <button onclick="return false" class="btn btn-xs ladda-button ${css}" style="width: 50px; background-color: ${statusColor}; border-color: ${statusColor}">${regFactor.Status || regFactor.VoteFactor.toString()}</button> <br/> ${event.Currency && event.Currency.currency_symbol || '$'}${highestBid.Amount}</a><br/>${result}`;
                }
                contestantMetricMap[Lot.ArtId] = {
                    totalBids: totalBids,
                    TopBidAndTime: topBidAndTime
                };
            }
        }
        const _processRound = (event: EventDTO, round: RoundDTO) => {

            const roundObj: RoundResultDTO = {
                IsCurrentRound: (event.CurrentRound && event.CurrentRound._id.equals(round._id)) || false,
                RoundNumber: round.RoundNumber,
                IsFinished: round.IsFinished,
                VotesCast: 0,
                Contestants: [],
                AuctionContestants: [],
                TotalVotes: 0,
                Experience: 0,
            };
            /* If it is current round then its votes are in currentRound obj
            if (roundObj.IsCurrentRound) {
               round.Contestants = event.CurrentRound.Contestants;
            }*/

            roundObj.Contestants = round.Contestants
                .filter( (c: RoundContestantDTO) => {
                    return (c.EaselNumber && c.EaselNumber > 0) && c.Enabled;
                })
                .map((c: RoundContestantDTO) => {
                    const contestantObj = _processContestant(c, roundObj);
                    roundObj.VotesCast += contestantObj.Votes;
                    roundObj.TotalVotes += contestantObj.TotalVotes;
                    return contestantObj;
                })
                .sort((a: RoundContestantResultDto, b: RoundContestantResultDto) => a.EaselNumber - b.EaselNumber)
                .sort((a: RoundContestantResultDto, b: RoundContestantResultDto) => b.Votes - a.Votes);
            roundObj.AuctionContestants = JSON.parse(JSON.stringify(roundObj.Contestants));
            roundObj.AuctionContestants = roundObj.AuctionContestants.sort((a, b) => a.EaselNumber - b.EaselNumber);
            roundObj.VotesCast = Math.round(roundObj.VotesCast * 10) / 10;
            roundObj.Experience = Math.round((((roundObj.VotesCast - roundObj.TotalVotes) / roundObj.TotalVotes) * 100) * 10) / 10;
            return roundObj;
        };

        const _processContestant = (contestant: RoundContestantDTO, round: RoundResultDTO) => {
            const metricObj = contestantMetricMap[`${event.EID}-${round.RoundNumber}-${contestant.EaselNumber}`];
            const contestantObj: RoundContestantResultDto  = {
                _id: contestant._id,
                EaselNumber: contestant.EaselNumber || 0,
                Name: contestant.Detail && contestant.Detail.Name,
                Votes: 0,
                VotesDetail: [],
                Enabled: contestant.Enabled,
                TotalVotes: 0,
                IsWinner: contestant.IsWinner,
                EnableAuction: contestant.EnableAuction,
                NumBids: metricObj && metricObj.totalBids || 0,
                TopBidAndTime: metricObj && metricObj.TopBidAndTime || 'N.A.',
                LatestImage: contestant.Images[contestant.Images.length - 1],
                LatestVideo: contestant.Videos[contestant.Videos.length - 1],
                Link: `/ar/${contestant.Detail._id}`,
                PeopleUrl: contestant.Detail.PhoneNumber && `/p/${contestant.Detail.PhoneNumber}` || ''
            };

            for (let i = 0; i < contestant.VotesDetail.length; i++) {
                // consider v`ote factor for new event, for old use 1
                contestantObj.Votes += (contestant.VotesDetail[i].VoteFactor) || 1;
                contestantObj.TotalVotes++;
            }
            return contestantObj;
        };

        const resultObj: EventResultDTO = {
            Name: event.Name,
            rounds: event.Rounds
                .sort((a, b) => a.RoundNumber - b.RoundNumber)
                .map((roundObj) => _processRound(event, roundObj)),
            RegistrationCount: event.Registrations.length,
            Logs: event.Logs,
            // PastVoterCount: registrationStat[0],
            // NewVoterCount: registrationStat[1],
            // NewVoterPercentage: Math.round(((registrationStat[1] / (registrationStat[0] + registrationStat[1])) * 100) * 100) / 100,
            EID: event.EID,
            AllUsers: allUsers,
            DoorUsers: doorUsers,
            OnlineUsers: onlineUsers,
            TopOnlineUsers: topOnlineUsers,
            EnableAuction: event.EnableAuction,
            AuctionCloseStartsAt: event.AuctionCloseStartsAt,
            AutoCloseOn: event.AuctionCloseStartsAt && new Date(event.AuctionCloseStartsAt).toISOString().slice(0, 10) !== '1970-01-01'
        };
        res.json(resultObj);
    } catch (err) {
        return next(err);
    }
};

export const copyWinner = async(req: Request, res: Response, next: NextFunction) => {
    try {
        const eventId = req.body.eventId;
        const copyFromRounds = req.body.copyFromRounds;
        const copyTo = req.body.copyTo;
        const event = await EventModel.findById(eventId).select(['Rounds']);
        if (!event) {
            const result: DataOperationResult<{ Message: string; }> = {
                'Success': false,
                Data: {
                    Message: 'wrong event id',
                }
            };
            res.json(result);
        }
        const winners = [];
        const winnerContestants = [];
        let copyToRound: RoundDTO;
        for (let i = 0; i < event.Rounds.length; i++) {
            const contestants = event.Rounds[i].Contestants;
            if (copyFromRounds.indexOf(event.Rounds[i].RoundNumber) > - 1 ) {
                for (let j = 0; j < contestants.length; j++) {
                    const contestant = contestants[j];
                    if (contestant.IsWinner) {
                        if (winners.indexOf(contestant.Detail.toString()) === -1) {
                            winners.push(contestant.Detail.toString());
                            // clone the object
                            winnerContestants.push(JSON.parse(JSON.stringify(contestant)));
                        }
                    }
                }
            } else if (copyTo === event.Rounds[i].RoundNumber) {
                copyToRound = event.Rounds[i];
            }
        }
        logger.info(`winners ${JSON.stringify(winners, null, 1)}`);
        const copyToRoundContestantIds = [];
        if (winners.length > 0 && copyToRound) {
            for (let k = 0; k < copyToRound.Contestants.length; k++) {
                copyToRoundContestantIds.push(copyToRound.Contestants[k].Detail.toString());
            }
            for (let l = 0; l < winners.length; l++) {
                console.log('copyToRoundContestantIds.indexOf(winners[l])', copyToRoundContestantIds.indexOf(winners[l]));
                const winnerContestantIndex = copyToRoundContestantIds.indexOf(winners[l]);
                if (winnerContestantIndex === - 1) {
                    // copy this contestant
                    winnerContestants[l].Iswinner = 0;
                    copyToRound.Contestants.push(winnerContestants[l]);
                } else if (copyToRound.Contestants[winnerContestantIndex].Enabled === false || !copyToRound.Contestants[winnerContestantIndex].EaselNumber) {
                    copyToRound.Contestants[winnerContestantIndex].Enabled = true;
                    copyToRound.Contestants[winnerContestantIndex].EaselNumber = winnerContestants[l].EaselNumber;
                    copyToRound.Contestants[winnerContestantIndex].IsWinner = 0;
                }
            }
            await event.save();
        }
        const result: DataOperationResult<{ Message: string; }> = {
            'Success': true,
            Data: {
                Message: 'Winners Copied',
            }
        };
        res.json(result);
    } catch (e) {
        next(e);
    }
};