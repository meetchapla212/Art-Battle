import { NextFunction, Response } from 'express';
import { default as EventModel, EventDocument } from '../models/Event';
import * as utils from '../utils';
import RoundContestantDTO, { RegistrationVoteFactorDTO } from '../../../shared/RoundContestantDTO';
import CodeModel from '../models/Codes';
import RegistrationLogModel from '../models/RegistrationLog';
import { default as VotingLogModel, VotingLogDocument } from '../models/VotingLog';
import { DataOperationResult } from '../../../shared/OperationResult';
import logger from '../config/logger';
import { RegisterVoter } from './RegistrationProcessor';

import RoundDTO from '../../../shared/RoundDTO';

import ContestantModel from '../models/Contestant';

const messageMap: {
    [k: string]: String
} = {
    NO_SUCH_EVENT: 'No event is currently running at this number. Please check the number and try again.',
    PHONE_NOT_REGISTERED: 'This number is not yet registered for this event. Please register and try again.',
    VOTING_CLOSED: 'Voting is now closed.', // not for online
    NO_ROUND_SELECTED_FOR_EVENT: 'Voting is currently closed.', // not for online
    ALREADY_VOTED: 'You already voted for {PLACEHOLDER} in this round.',
    BAD_VOTE_INVALID_OPTION: `Invalid vote. Please choose one of the following options:`,
    SERVER_ERROR: 'We encountered an error saving your vote. Try again?',
    VOTE_ACCEPTED: 'Thanks for your vote for',
    VOTE_ACCEPTED_MULTI: 'Total Votes Cast : ',
    SERVER_ERROR_V2: 'Sorry! Our system encountered an error. Please try again.',
    CODE_ADDED: 'Code Added &#x1f31f;',
    INVALID_CODE: 'Invalid code &#x274c;',
    CODE_EXPIRED: 'Code Expired &#x2753;',
    VOTING_WEB_DISABLED: 'Voting by link is disabled'
};

/**
 * Prepare and send response if res passed
 * @param format
 * @param res
 * @param code
 * @param appendMsg
 * @param openAuctionCount
 * @return DataOperationResult || void
 */
export const sendResponse = (format: String, res: Response, code: string, appendMsg = '', openAuctionCount = 0, placeholder = ''): DataOperationResult<string> | Response => {
    if (messageMap[code]) {
        if (format === 'xml') {
            return res.send(`<Response><Sms>${messageMap[code]} ${appendMsg}</Sms></Response>`);
        } else {
            interface DataOperationResultV1 extends DataOperationResult<string> {
                openAuctionCount: number;
            }
            const response: DataOperationResultV1 = {
                Data: `${(messageMap[code]).replace('{PLACEHOLDER}', placeholder)} ${appendMsg}`,
                Success: (code === 'VOTE_ACCEPTED' || code === 'CODE_ADDED' || code === 'VOTE_ACCEPTED_MULTI'),
                openAuctionCount: openAuctionCount
            };
            if (res) {
                return res.json(response);
            } else {
                return response;
            }
        }
    } else {
        throw new Error(`Invalid message code`);
    }
};

export const processVote = async (format = 'xml', body: string, from: string, event: EventDocument, res: Response, log: VotingLogDocument, roundNumber?: number, openAuctionCount?: number, where= 'door') => {
    const to = event && event.PhoneNumber;
    try {
        log.VoteChannel.Channel = format === 'xml' ? 'sms' : 'web';
        logger.info(`vote endpoint called at ${new Date().toISOString()}`);
        log.PhoneNumber = from;
        logger.info(`Vote received - Body: ${body} From: ${from} To: ${to}`);
        let selectedRound: RoundDTO;
        if (roundNumber) {
            selectedRound = event.Rounds.find(value => roundNumber == value.RoundNumber);
        } else {
            selectedRound = event.Rounds.find(value => value.RoundNumber === (event.CurrentRound && event.CurrentRound.RoundNumber));
        }

        if (!event) {
            log.Status = 'NO_SUCH_EVENT';
            logger.info(`No event is configured at this number: ${to}`);
            sendResponse(format, res, 'NO_SUCH_EVENT');
            // Intentionally not waiting for the log entry to complete
            log.save().catch(err => {
                logger.info(err);
            });
            return;
        } else {
            log.EventId = event.id;
            log.EventName = event.Name;
            log.RoundNumber = selectedRound.RoundNumber;
        }

        let voterRegistration = event.RegistrationsVoteFactor.find(r => {
            return (r.PhoneNumber == from || r.Email === from);
        });

        if (!voterRegistration) {
            const result = await RegisterVoter({
                _id: undefined,
                PhoneNumber: from,
                FirstName: '',
                LastName: '',
                Email: '',
                Hash: '',
                DisplayPhone: '',
                RegionCode: '',
                Preferences: [],
                ArtBattleNews: false,
                NotificationEmails: false,
                LoyaltyOffers: false,
                RegisteredAt: where
            }, event.id, false, 1, true);
            // refresh event
            event = await EventModel.findById(event.id).populate('Registrations')
                .populate('Contestants')
                .populate('Rounds.Contestants.Detail')
                .populate('Rounds.Contestants.Votes')
                .populate('CurrentRound.Contestants.Detail')
                .populate('CurrentRound.Contestants.Votes');
            voterRegistration = result.Data.userVoteFactor;
        }
        const registration = event.Registrations.find(r => {
            return (r.PhoneNumber === from || r.Email === from);
        });
        const voterInfo = event.RegistrationsVoteFactor.find(r => registration._id.equals(r.RegistrationId));
        const isMultiAllowed = voterRegistration.Status === 'Admin' || voterRegistration.VoteFactor === 0.99;
        if (body.length === 6) {
            // handle six digit secret code
            return await handleSecretCode(body, event, voterRegistration, format, res);
        }

        if (!event.Enabled && !selectedRound) {
            log.Status = 'VOTING_CLOSED';
            sendResponse(format, res, 'VOTING_CLOSED');
            // Intentionally not waiting for the log entry to complete
            log.save().catch(err => {
                logger.info(err);
            });
            return;
        }
        else if (!selectedRound) {
            log.Status = 'NO_ROUND_SELECTED_FOR_EVENT';
            logger.info(`No round is currently selected for event: ${event.Name}`);
            sendResponse(format, res, 'NO_ROUND_SELECTED_FOR_EVENT');
            // Intentionally not waiting for the log entry to complete
            log.save().catch(err => {
                logger.info(err);
            });
            return;
        }
        const votedContestant = event.hasVoted(from, selectedRound);
        if (votedContestant && !isMultiAllowed) {
            log.Status = 'ALREADY_VOTED';
            logger.info('Denying vote: ' + event.Name + ', ' + from + ' - Already voted');
            let placeholder = 'this artist';
            if (typeof votedContestant === 'object' && 'Detail' in votedContestant) {
                const contestantModel = await ContestantModel.findById(votedContestant.Detail);
                placeholder = contestantModel && contestantModel.Name || placeholder;
            }
            sendResponse(format, res, 'ALREADY_VOTED', '', 0, placeholder);
            // Intentionally not waiting for the log entry to complete
            log.save().catch(err => {
                logger.info(err);
            });
            return;
        }
        let availableOptions;
        let availableOptionsString;
        if (selectedRound) {
            availableOptions = selectedRound.Contestants
                .filter(c => c.Enabled && c.EaselNumber)
                .map(c => c.EaselNumber);
            availableOptionsString = availableOptions.join(', ');
        }



        const choice: number[] = [];
        const logModels = [];
        if (body.length > 1 && isMultiAllowed && !availableOptions.contains(parseInt(body))) {
            // Multiple if body's length is greater than zero, vote factor is 0.99 or status is admin
            // and voting option is not in existing contestant list
            for (let i = 0; i < body.length; i++) {
                const artistInt = parseInt(body[i]);
                if (!isNaN(artistInt) && artistInt > 0) {
                    const logModel = new VotingLogModel();

                    if (!availableOptions.contains(artistInt) ) {
                        logModel.Status = 'BAD_VOTE_INVALID_OPTION';
                        logger.info('Bad vote: ' + event.Name + ', ' + from + ', ' + body + ', Available Options: ' + availableOptionsString);
                    } else {
                        choice.push(artistInt);
                    }
                    logModel.PhoneNumber = log.PhoneNumber;
                    logModel.EventId = log.EventId;
                    logModel.EventName = log.EventName;
                    logModel.RoundNumber = log.RoundNumber;
                    logModels.push(logModel);
                }
            }
        } else {
            // SINGLE
            if (!utils.testint(body)) {
                log.Status = 'BAD_VOTE_INVALID_OPTION';
                logger.info('Bad vote: ' + event.Name + ', ' + from + ', ' + body);
                sendResponse(format, res, 'BAD_VOTE_INVALID_OPTION', availableOptionsString);
                // Intentionally not waiting for the log entry to complete
                log.save().catch(err => {
                    logger.info(err);
                });
                return;
            }
            const artistInt = parseInt(body);
            if (!availableOptions.contains(artistInt) ) {
                log.Status = 'BAD_VOTE_INVALID_OPTION';
                logger.info('Bad vote: ' + event.Name + ', ' + from + ', ' + body + ', Available Options: ' + availableOptionsString);
                sendResponse(format, res, 'BAD_VOTE_INVALID_OPTION', availableOptionsString);
                return ;
            } else {
                logModels.push(log);
                choice.push(artistInt);
            }
        }



        const artistNames = [];
        for (let i = 0; i < choice.length; i++) {
            logModels[i].DisplayPhone = registration.DisplayPhone;
            logModels[i].PhoneHash = registration.Hash;
            let votedFor: RoundContestantDTO;
            for (let j = 0; j < selectedRound.Contestants.length; j++) {
                const contestant = selectedRound.Contestants[j];
                if (contestant.EaselNumber === choice[i] && contestant.Enabled) {
                    votedFor = contestant;
                    const contestantModel = await ContestantModel.findById(votedFor.Detail);
                    if (!contestantModel.VotesCount || isNaN(contestantModel.VotesCount)) {
                        contestantModel.VotesCount = 0;
                    }
                    contestantModel.VotesCount = contestantModel.VotesCount + 1;
                    if (!contestantModel.Score || isNaN(contestantModel.Score)) {
                        contestantModel.Score = 0;
                    }
                    if (!contestantModel.FollowersCount || isNaN(contestantModel.FollowersCount)) {
                        contestantModel.FollowersCount = 0;
                    }
                    contestantModel.Score = contestantModel.VotesCount + contestantModel.FollowersCount;

                    await contestantModel.save();
                    votedFor.Detail = contestantModel;
                    break;
                }
            }
            votedFor.Votes.push(registration);
            votedFor.VotesDetail.push({
                RegistrationId: registration._id,
                VoteFactor: voterInfo.VoteFactor,
                PhoneNumber: voterInfo.PhoneNumber,
                VoteFactorInfo: voterInfo.VoteFactorInfo,
                Hash: voterInfo.Hash,
                VoteUrl: voterInfo.VoteUrl,
                RegionCode: voterInfo.RegionCode,
                Email: voterInfo.Email,
                Status: voterInfo.Status,
                AuctionUrl: voterInfo.AuctionUrl
            });
            logModels[i].ArtistName = votedFor.Detail.Name;
            logModels[i].EaselNumber = votedFor.EaselNumber;
            logModels[i].VoteFactor = voterInfo.VoteFactor;
            logModels[i].VoteFactorInfo = voterInfo.VoteFactorInfo;
            logModels[i].VoteChannel.Type = voterInfo.VoteFactorInfo.Type;
            /*Follow/Following Start*/
            logModels[i].Status = 'VOTE_ACCEPTED';
            logModels[i].Registration = registration;
            logModels[i].Contestant = votedFor.Detail;
            /*Follow/Following End*/
            logModels[i].Lot = votedFor.Lot;
            logger.info('Accepting vote: ' + votedFor.Detail.Name + ', ' + from);
            artistNames.push(votedFor.Detail.Name);
            await logModels[i].save();
        }

        try {
            await event.save();
            if (artistNames.length === 1) {
                sendResponse(format, res, 'VOTE_ACCEPTED', `${artistNames[0]}.`, openAuctionCount);
            } else {
                sendResponse(format, res, 'VOTE_ACCEPTED_MULTI', `${artistNames.length}`, openAuctionCount);
            }

        } catch (err) {
            log.Status = 'SERVER_ERROR';
            await log.save();
            sendResponse(format, res, 'SERVER_ERROR');
        }
    }
    catch (e) {
        logger.info(`Error in voteSMS ${e.stack} Body: ${body}, From: ${from}, To: ${to}`);
        sendResponse(format, res, 'SERVER_ERROR_V2');
    }
};

/**
 * Handle Event secret code to manipulate user vote factor
 * @param code
 * @param event
 * @param voteRegistration
 * @param res
 * @param format
 * @return DataOperationResult<String> || void
 */
export const handleSecretCode = async (code: String, event: EventDocument, voteRegistration: RegistrationVoteFactorDTO, format: string, res?: Response): Promise<DataOperationResult<string> | Response> => {
    try {
        const results = await Promise.all([
            await CodeModel.findOne({
                code: code.toUpperCase(),
                // used: '0'
            }),
            RegistrationLogModel.findOne({
                'EventId': event._id,
                'PhoneNumber': voteRegistration.PhoneNumber
            })
        ]);
        const codeDocument = results[0];
        const logObj = results[1];

        if (codeDocument && codeDocument.used === '0' && logObj) {
            // update event vote factor
            const voteFactorInfo  = {
                Type: 'Secret',
                Value: codeDocument.code
            };
            voteRegistration.VoteFactor = parseFloat(codeDocument.value);
            voteRegistration.VoteFactorInfo = voteFactorInfo;
            codeDocument.used = '1'; // mark code as used
            logObj.VoteFactor = voteRegistration.VoteFactor; // update event vote factor
            logObj.VoteFactorInfo = voteFactorInfo;
            await Promise.all([
                logObj.save(),
                event.save(),
                codeDocument.save()
            ]);
            return sendResponse(format, res, 'CODE_ADDED');
        }
        else {
            if (!codeDocument) {
                logger.info(`Invalid code entered, code:${code}, phone: ${voteRegistration.PhoneNumber}`);
                return sendResponse(format, res, 'INVALID_CODE');
            }
            else if (codeDocument.used === '1') {
                logger.info(`Used code, code:${code}, phone: ${voteRegistration.PhoneNumber}`);
                return sendResponse(format, res, 'CODE_EXPIRED');
            }
            else {
                logger.info(`Phone number ${voteRegistration.PhoneNumber} is not registered to vote in this event, code ${code}`);
                return sendResponse(format, res, 'PHONE_NOT_REGISTERED');
            }
        }
    }
    catch (e) {
        logger.info(`error in handleSecretCode, code: ${code}, phone: ${voteRegistration.PhoneNumber}`, e);
        return sendResponse(format, res, 'SERVER_ERROR_V2');
    }
};

export const getEventForSMS = async function (to: String, res: Response, next: NextFunction, log: VotingLogDocument) {
    let events: EventDocument[];
    try {
        events = await EventModel
            .find(( { PhoneNumber: to, Enabled: true } ))
            .populate('Registrations')
            .populate('Contestants')
            .populate('Rounds.Contestants.Detail')
            .populate('Rounds.Contestants.Votes')
            .populate('CurrentRound.Contestants.Detail')
            .populate('CurrentRound.Contestants.Votes')
            .sort({_id: -1})
            .exec();
        return  events[0];
    } catch (err) {
        logger.info(err);
        sendResponse('xml', res, 'SERVER_ERROR_V2');
        // Intentionally not waiting for the log entry to complete
        log.save().catch(err => {
            logger.info(err);
        });
    }
};

export const getEventForForm  = async function (res: Response, hash: string, next: NextFunction, log: VotingLogDocument) {
    try {
        return  await EventModel.findOne({
            'RegistrationsVoteFactor.VoteUrl': `/v/${hash}`,
        }).select(['Name', '_id', 'VoteByLink', 'Rounds', 'RegistrationsVoteFactor', 'Enabled', 'PhoneNumber', 'CurrentRound', 'Registrations', 'Email'])
            .populate('Registrations')
            .populate('CurrentRound.Contestants.Detail')
            .populate('CurrentRound.Contestants.Votes')
            .populate('Rounds.Contestants.Votes')
            .populate('Rounds.Contestants.Detail')
            .sort({_id: -1});
    }
    catch (err) {
        logger.info(err);
        sendResponse('json', res, 'SERVER_ERROR_V2');
        // Intentionally not waiting for the log entry to complete
        log.save().catch(err => {
            logger.info(err);
        });
    }
};