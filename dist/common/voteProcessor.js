"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEventForForm = exports.getEventForSMS = exports.handleSecretCode = exports.processVote = exports.sendResponse = void 0;
const Event_1 = require("../models/Event");
const utils = require("../utils");
const Codes_1 = require("../models/Codes");
const RegistrationLog_1 = require("../models/RegistrationLog");
const VotingLog_1 = require("../models/VotingLog");
const logger_1 = require("../config/logger");
const RegistrationProcessor_1 = require("./RegistrationProcessor");
const Contestant_1 = require("../models/Contestant");
const messageMap = {
    NO_SUCH_EVENT: 'No event is currently running at this number. Please check the number and try again.',
    PHONE_NOT_REGISTERED: 'This number is not yet registered for this event. Please register and try again.',
    VOTING_CLOSED: 'Voting is now closed.',
    NO_ROUND_SELECTED_FOR_EVENT: 'Voting is currently closed.',
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
exports.sendResponse = (format, res, code, appendMsg = '', openAuctionCount = 0, placeholder = '') => {
    if (messageMap[code]) {
        if (format === 'xml') {
            return res.send(`<Response><Sms>${messageMap[code]} ${appendMsg}</Sms></Response>`);
        }
        else {
            const response = {
                Data: `${(messageMap[code]).replace('{PLACEHOLDER}', placeholder)} ${appendMsg}`,
                Success: (code === 'VOTE_ACCEPTED' || code === 'CODE_ADDED' || code === 'VOTE_ACCEPTED_MULTI'),
                openAuctionCount: openAuctionCount
            };
            if (res) {
                return res.json(response);
            }
            else {
                return response;
            }
        }
    }
    else {
        throw new Error(`Invalid message code`);
    }
};
exports.processVote = async (format = 'xml', body, from, event, res, log, roundNumber, openAuctionCount, where = 'door') => {
    const to = event && event.PhoneNumber;
    try {
        log.VoteChannel.Channel = format === 'xml' ? 'sms' : 'web';
        logger_1.default.info(`vote endpoint called at ${new Date().toISOString()}`);
        log.PhoneNumber = from;
        logger_1.default.info(`Vote received - Body: ${body} From: ${from} To: ${to}`);
        let selectedRound;
        if (roundNumber) {
            selectedRound = event.Rounds.find(value => roundNumber == value.RoundNumber);
        }
        else {
            selectedRound = event.Rounds.find(value => value.RoundNumber === (event.CurrentRound && event.CurrentRound.RoundNumber));
        }
        if (!event) {
            log.Status = 'NO_SUCH_EVENT';
            logger_1.default.info(`No event is configured at this number: ${to}`);
            exports.sendResponse(format, res, 'NO_SUCH_EVENT');
            // Intentionally not waiting for the log entry to complete
            log.save().catch(err => {
                logger_1.default.info(err);
            });
            return;
        }
        else {
            log.EventId = event.id;
            log.EventName = event.Name;
            log.RoundNumber = selectedRound.RoundNumber;
        }
        let voterRegistration = event.RegistrationsVoteFactor.find(r => {
            return (r.PhoneNumber == from || r.Email === from);
        });
        if (!voterRegistration) {
            const result = await RegistrationProcessor_1.RegisterVoter({
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
            event = await Event_1.default.findById(event.id).populate('Registrations')
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
            return await exports.handleSecretCode(body, event, voterRegistration, format, res);
        }
        if (!event.Enabled && !selectedRound) {
            log.Status = 'VOTING_CLOSED';
            exports.sendResponse(format, res, 'VOTING_CLOSED');
            // Intentionally not waiting for the log entry to complete
            log.save().catch(err => {
                logger_1.default.info(err);
            });
            return;
        }
        else if (!selectedRound) {
            log.Status = 'NO_ROUND_SELECTED_FOR_EVENT';
            logger_1.default.info(`No round is currently selected for event: ${event.Name}`);
            exports.sendResponse(format, res, 'NO_ROUND_SELECTED_FOR_EVENT');
            // Intentionally not waiting for the log entry to complete
            log.save().catch(err => {
                logger_1.default.info(err);
            });
            return;
        }
        const votedContestant = event.hasVoted(from, selectedRound);
        if (votedContestant && !isMultiAllowed) {
            log.Status = 'ALREADY_VOTED';
            logger_1.default.info('Denying vote: ' + event.Name + ', ' + from + ' - Already voted');
            let placeholder = 'this artist';
            if (typeof votedContestant === 'object' && 'Detail' in votedContestant) {
                const contestantModel = await Contestant_1.default.findById(votedContestant.Detail);
                placeholder = contestantModel && contestantModel.Name || placeholder;
            }
            exports.sendResponse(format, res, 'ALREADY_VOTED', '', 0, placeholder);
            // Intentionally not waiting for the log entry to complete
            log.save().catch(err => {
                logger_1.default.info(err);
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
        const choice = [];
        const logModels = [];
        if (body.length > 1 && isMultiAllowed && !availableOptions.contains(parseInt(body))) {
            // Multiple if body's length is greater than zero, vote factor is 0.99 or status is admin
            // and voting option is not in existing contestant list
            for (let i = 0; i < body.length; i++) {
                const artistInt = parseInt(body[i]);
                if (!isNaN(artistInt) && artistInt > 0) {
                    const logModel = new VotingLog_1.default();
                    if (!availableOptions.contains(artistInt)) {
                        logModel.Status = 'BAD_VOTE_INVALID_OPTION';
                        logger_1.default.info('Bad vote: ' + event.Name + ', ' + from + ', ' + body + ', Available Options: ' + availableOptionsString);
                    }
                    else {
                        choice.push(artistInt);
                    }
                    logModel.PhoneNumber = log.PhoneNumber;
                    logModel.EventId = log.EventId;
                    logModel.EventName = log.EventName;
                    logModel.RoundNumber = log.RoundNumber;
                    logModels.push(logModel);
                }
            }
        }
        else {
            // SINGLE
            if (!utils.testint(body)) {
                log.Status = 'BAD_VOTE_INVALID_OPTION';
                logger_1.default.info('Bad vote: ' + event.Name + ', ' + from + ', ' + body);
                exports.sendResponse(format, res, 'BAD_VOTE_INVALID_OPTION', availableOptionsString);
                // Intentionally not waiting for the log entry to complete
                log.save().catch(err => {
                    logger_1.default.info(err);
                });
                return;
            }
            const artistInt = parseInt(body);
            if (!availableOptions.contains(artistInt)) {
                log.Status = 'BAD_VOTE_INVALID_OPTION';
                logger_1.default.info('Bad vote: ' + event.Name + ', ' + from + ', ' + body + ', Available Options: ' + availableOptionsString);
                exports.sendResponse(format, res, 'BAD_VOTE_INVALID_OPTION', availableOptionsString);
                return;
            }
            else {
                logModels.push(log);
                choice.push(artistInt);
            }
        }
        const artistNames = [];
        for (let i = 0; i < choice.length; i++) {
            logModels[i].DisplayPhone = registration.DisplayPhone;
            logModels[i].PhoneHash = registration.Hash;
            let votedFor;
            for (let j = 0; j < selectedRound.Contestants.length; j++) {
                const contestant = selectedRound.Contestants[j];
                if (contestant.EaselNumber === choice[i] && contestant.Enabled) {
                    votedFor = contestant;
                    const contestantModel = await Contestant_1.default.findById(votedFor.Detail);
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
            logger_1.default.info('Accepting vote: ' + votedFor.Detail.Name + ', ' + from);
            artistNames.push(votedFor.Detail.Name);
            await logModels[i].save();
        }
        try {
            await event.save();
            if (artistNames.length === 1) {
                exports.sendResponse(format, res, 'VOTE_ACCEPTED', `${artistNames[0]}.`, openAuctionCount);
            }
            else {
                exports.sendResponse(format, res, 'VOTE_ACCEPTED_MULTI', `${artistNames.length}`, openAuctionCount);
            }
        }
        catch (err) {
            log.Status = 'SERVER_ERROR';
            await log.save();
            exports.sendResponse(format, res, 'SERVER_ERROR');
        }
    }
    catch (e) {
        logger_1.default.info(`Error in voteSMS ${e.stack} Body: ${body}, From: ${from}, To: ${to}`);
        exports.sendResponse(format, res, 'SERVER_ERROR_V2');
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
exports.handleSecretCode = async (code, event, voteRegistration, format, res) => {
    try {
        const results = await Promise.all([
            await Codes_1.default.findOne({
                code: code.toUpperCase(),
            }),
            RegistrationLog_1.default.findOne({
                'EventId': event._id,
                'PhoneNumber': voteRegistration.PhoneNumber
            })
        ]);
        const codeDocument = results[0];
        const logObj = results[1];
        if (codeDocument && codeDocument.used === '0' && logObj) {
            // update event vote factor
            const voteFactorInfo = {
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
            return exports.sendResponse(format, res, 'CODE_ADDED');
        }
        else {
            if (!codeDocument) {
                logger_1.default.info(`Invalid code entered, code:${code}, phone: ${voteRegistration.PhoneNumber}`);
                return exports.sendResponse(format, res, 'INVALID_CODE');
            }
            else if (codeDocument.used === '1') {
                logger_1.default.info(`Used code, code:${code}, phone: ${voteRegistration.PhoneNumber}`);
                return exports.sendResponse(format, res, 'CODE_EXPIRED');
            }
            else {
                logger_1.default.info(`Phone number ${voteRegistration.PhoneNumber} is not registered to vote in this event, code ${code}`);
                return exports.sendResponse(format, res, 'PHONE_NOT_REGISTERED');
            }
        }
    }
    catch (e) {
        logger_1.default.info(`error in handleSecretCode, code: ${code}, phone: ${voteRegistration.PhoneNumber}`, e);
        return exports.sendResponse(format, res, 'SERVER_ERROR_V2');
    }
};
exports.getEventForSMS = async function (to, res, next, log) {
    let events;
    try {
        events = await Event_1.default
            .find(({ PhoneNumber: to, Enabled: true }))
            .populate('Registrations')
            .populate('Contestants')
            .populate('Rounds.Contestants.Detail')
            .populate('Rounds.Contestants.Votes')
            .populate('CurrentRound.Contestants.Detail')
            .populate('CurrentRound.Contestants.Votes')
            .sort({ _id: -1 })
            .exec();
        return events[0];
    }
    catch (err) {
        logger_1.default.info(err);
        exports.sendResponse('xml', res, 'SERVER_ERROR_V2');
        // Intentionally not waiting for the log entry to complete
        log.save().catch(err => {
            logger_1.default.info(err);
        });
    }
};
exports.getEventForForm = async function (res, hash, next, log) {
    try {
        return await Event_1.default.findOne({
            'RegistrationsVoteFactor.VoteUrl': `/v/${hash}`,
        }).select(['Name', '_id', 'VoteByLink', 'Rounds', 'RegistrationsVoteFactor', 'Enabled', 'PhoneNumber', 'CurrentRound', 'Registrations', 'Email'])
            .populate('Registrations')
            .populate('CurrentRound.Contestants.Detail')
            .populate('CurrentRound.Contestants.Votes')
            .populate('Rounds.Contestants.Votes')
            .populate('Rounds.Contestants.Detail')
            .sort({ _id: -1 });
    }
    catch (err) {
        logger_1.default.info(err);
        exports.sendResponse('json', res, 'SERVER_ERROR_V2');
        // Intentionally not waiting for the log entry to complete
        log.save().catch(err => {
            logger_1.default.info(err);
        });
    }
};

//# sourceMappingURL=data:application/json;charset=utf8;base64,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RDtRQUMxRCxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1lBQ25CLGdCQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3JCLENBQUMsQ0FBQyxDQUFDO0tBQ047QUFDTCxDQUFDLENBQUMiLCJmaWxlIjoiY29tbW9uL3ZvdGVQcm9jZXNzb3IuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBOZXh0RnVuY3Rpb24sIFJlc3BvbnNlIH0gZnJvbSAnZXhwcmVzcyc7XG5pbXBvcnQgeyBkZWZhdWx0IGFzIEV2ZW50TW9kZWwsIEV2ZW50RG9jdW1lbnQgfSBmcm9tICcuLi9tb2RlbHMvRXZlbnQnO1xuaW1wb3J0ICogYXMgdXRpbHMgZnJvbSAnLi4vdXRpbHMnO1xuaW1wb3J0IFJvdW5kQ29udGVzdGFudERUTywgeyBSZWdpc3RyYXRpb25Wb3RlRmFjdG9yRFRPIH0gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL1JvdW5kQ29udGVzdGFudERUTyc7XG5pbXBvcnQgQ29kZU1vZGVsIGZyb20gJy4uL21vZGVscy9Db2Rlcyc7XG5pbXBvcnQgUmVnaXN0cmF0aW9uTG9nTW9kZWwgZnJvbSAnLi4vbW9kZWxzL1JlZ2lzdHJhdGlvbkxvZyc7XG5pbXBvcnQgeyBkZWZhdWx0IGFzIFZvdGluZ0xvZ01vZGVsLCBWb3RpbmdMb2dEb2N1bWVudCB9IGZyb20gJy4uL21vZGVscy9Wb3RpbmdMb2cnO1xuaW1wb3J0IHsgRGF0YU9wZXJhdGlvblJlc3VsdCB9IGZyb20gJy4uLy4uLy4uL3NoYXJlZC9PcGVyYXRpb25SZXN1bHQnO1xuaW1wb3J0IGxvZ2dlciBmcm9tICcuLi9jb25maWcvbG9nZ2VyJztcbmltcG9ydCB7IFJlZ2lzdGVyVm90ZXIgfSBmcm9tICcuL1JlZ2lzdHJhdGlvblByb2Nlc3Nvcic7XG5cbmltcG9ydCBSb3VuZERUTyBmcm9tICcuLi8uLi8uLi9zaGFyZWQvUm91bmREVE8nO1xuXG5pbXBvcnQgQ29udGVzdGFudE1vZGVsIGZyb20gJy4uL21vZGVscy9Db250ZXN0YW50JztcblxuY29uc3QgbWVzc2FnZU1hcDoge1xuICAgIFtrOiBzdHJpbmddOiBTdHJpbmdcbn0gPSB7XG4gICAgTk9fU1VDSF9FVkVOVDogJ05vIGV2ZW50IGlzIGN1cnJlbnRseSBydW5uaW5nIGF0IHRoaXMgbnVtYmVyLiBQbGVhc2UgY2hlY2sgdGhlIG51bWJlciBhbmQgdHJ5IGFnYWluLicsXG4gICAgUEhPTkVfTk9UX1JFR0lTVEVSRUQ6ICdUaGlzIG51bWJlciBpcyBub3QgeWV0IHJlZ2lzdGVyZWQgZm9yIHRoaXMgZXZlbnQuIFBsZWFzZSByZWdpc3RlciBhbmQgdHJ5IGFnYWluLicsXG4gICAgVk9USU5HX0NMT1NFRDogJ1ZvdGluZyBpcyBub3cgY2xvc2VkLicsIC8vIG5vdCBmb3Igb25saW5lXG4gICAgTk9fUk9VTkRfU0VMRUNURURfRk9SX0VWRU5UOiAnVm90aW5nIGlzIGN1cnJlbnRseSBjbG9zZWQuJywgLy8gbm90IGZvciBvbmxpbmVcbiAgICBBTFJFQURZX1ZPVEVEOiAnWW91IGFscmVhZHkgdm90ZWQgZm9yIHtQTEFDRUhPTERFUn0gaW4gdGhpcyByb3VuZC4nLFxuICAgIEJBRF9WT1RFX0lOVkFMSURfT1BUSU9OOiBgSW52YWxpZCB2b3RlLiBQbGVhc2UgY2hvb3NlIG9uZSBvZiB0aGUgZm9sbG93aW5nIG9wdGlvbnM6YCxcbiAgICBTRVJWRVJfRVJST1I6ICdXZSBlbmNvdW50ZXJlZCBhbiBlcnJvciBzYXZpbmcgeW91ciB2b3RlLiBUcnkgYWdhaW4/JyxcbiAgICBWT1RFX0FDQ0VQVEVEOiAnVGhhbmtzIGZvciB5b3VyIHZvdGUgZm9yJyxcbiAgICBWT1RFX0FDQ0VQVEVEX01VTFRJOiAnVG90YWwgVm90ZXMgQ2FzdCA6ICcsXG4gICAgU0VSVkVSX0VSUk9SX1YyOiAnU29ycnkhIE91ciBzeXN0ZW0gZW5jb3VudGVyZWQgYW4gZXJyb3IuIFBsZWFzZSB0cnkgYWdhaW4uJyxcbiAgICBDT0RFX0FEREVEOiAnQ29kZSBBZGRlZCAmI3gxZjMxZjsnLFxuICAgIElOVkFMSURfQ09ERTogJ0ludmFsaWQgY29kZSAmI3gyNzRjOycsXG4gICAgQ09ERV9FWFBJUkVEOiAnQ29kZSBFeHBpcmVkICYjeDI3NTM7JyxcbiAgICBWT1RJTkdfV0VCX0RJU0FCTEVEOiAnVm90aW5nIGJ5IGxpbmsgaXMgZGlzYWJsZWQnXG59O1xuXG4vKipcbiAqIFByZXBhcmUgYW5kIHNlbmQgcmVzcG9uc2UgaWYgcmVzIHBhc3NlZFxuICogQHBhcmFtIGZvcm1hdFxuICogQHBhcmFtIHJlc1xuICogQHBhcmFtIGNvZGVcbiAqIEBwYXJhbSBhcHBlbmRNc2dcbiAqIEBwYXJhbSBvcGVuQXVjdGlvbkNvdW50XG4gKiBAcmV0dXJuIERhdGFPcGVyYXRpb25SZXN1bHQgfHwgdm9pZFxuICovXG5leHBvcnQgY29uc3Qgc2VuZFJlc3BvbnNlID0gKGZvcm1hdDogU3RyaW5nLCByZXM6IFJlc3BvbnNlLCBjb2RlOiBzdHJpbmcsIGFwcGVuZE1zZyA9ICcnLCBvcGVuQXVjdGlvbkNvdW50ID0gMCwgcGxhY2Vob2xkZXIgPSAnJyk6IERhdGFPcGVyYXRpb25SZXN1bHQ8c3RyaW5nPiB8IFJlc3BvbnNlID0+IHtcbiAgICBpZiAobWVzc2FnZU1hcFtjb2RlXSkge1xuICAgICAgICBpZiAoZm9ybWF0ID09PSAneG1sJykge1xuICAgICAgICAgICAgcmV0dXJuIHJlcy5zZW5kKGA8UmVzcG9uc2U+PFNtcz4ke21lc3NhZ2VNYXBbY29kZV19ICR7YXBwZW5kTXNnfTwvU21zPjwvUmVzcG9uc2U+YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbnRlcmZhY2UgRGF0YU9wZXJhdGlvblJlc3VsdFYxIGV4dGVuZHMgRGF0YU9wZXJhdGlvblJlc3VsdDxzdHJpbmc+IHtcbiAgICAgICAgICAgICAgICBvcGVuQXVjdGlvbkNvdW50OiBudW1iZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCByZXNwb25zZTogRGF0YU9wZXJhdGlvblJlc3VsdFYxID0ge1xuICAgICAgICAgICAgICAgIERhdGE6IGAkeyhtZXNzYWdlTWFwW2NvZGVdKS5yZXBsYWNlKCd7UExBQ0VIT0xERVJ9JywgcGxhY2Vob2xkZXIpfSAke2FwcGVuZE1zZ31gLFxuICAgICAgICAgICAgICAgIFN1Y2Nlc3M6IChjb2RlID09PSAnVk9URV9BQ0NFUFRFRCcgfHwgY29kZSA9PT0gJ0NPREVfQURERUQnIHx8IGNvZGUgPT09ICdWT1RFX0FDQ0VQVEVEX01VTFRJJyksXG4gICAgICAgICAgICAgICAgb3BlbkF1Y3Rpb25Db3VudDogb3BlbkF1Y3Rpb25Db3VudFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGlmIChyZXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzLmpzb24ocmVzcG9uc2UpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzcG9uc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgbWVzc2FnZSBjb2RlYCk7XG4gICAgfVxufTtcblxuZXhwb3J0IGNvbnN0IHByb2Nlc3NWb3RlID0gYXN5bmMgKGZvcm1hdCA9ICd4bWwnLCBib2R5OiBzdHJpbmcsIGZyb206IHN0cmluZywgZXZlbnQ6IEV2ZW50RG9jdW1lbnQsIHJlczogUmVzcG9uc2UsIGxvZzogVm90aW5nTG9nRG9jdW1lbnQsIHJvdW5kTnVtYmVyPzogbnVtYmVyLCBvcGVuQXVjdGlvbkNvdW50PzogbnVtYmVyLCB3aGVyZT0gJ2Rvb3InKSA9PiB7XG4gICAgY29uc3QgdG8gPSBldmVudCAmJiBldmVudC5QaG9uZU51bWJlcjtcbiAgICB0cnkge1xuICAgICAgICBsb2cuVm90ZUNoYW5uZWwuQ2hhbm5lbCA9IGZvcm1hdCA9PT0gJ3htbCcgPyAnc21zJyA6ICd3ZWInO1xuICAgICAgICBsb2dnZXIuaW5mbyhgdm90ZSBlbmRwb2ludCBjYWxsZWQgYXQgJHtuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCl9YCk7XG4gICAgICAgIGxvZy5QaG9uZU51bWJlciA9IGZyb207XG4gICAgICAgIGxvZ2dlci5pbmZvKGBWb3RlIHJlY2VpdmVkIC0gQm9keTogJHtib2R5fSBGcm9tOiAke2Zyb219IFRvOiAke3RvfWApO1xuICAgICAgICBsZXQgc2VsZWN0ZWRSb3VuZDogUm91bmREVE87XG4gICAgICAgIGlmIChyb3VuZE51bWJlcikge1xuICAgICAgICAgICAgc2VsZWN0ZWRSb3VuZCA9IGV2ZW50LlJvdW5kcy5maW5kKHZhbHVlID0+IHJvdW5kTnVtYmVyID09IHZhbHVlLlJvdW5kTnVtYmVyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNlbGVjdGVkUm91bmQgPSBldmVudC5Sb3VuZHMuZmluZCh2YWx1ZSA9PiB2YWx1ZS5Sb3VuZE51bWJlciA9PT0gKGV2ZW50LkN1cnJlbnRSb3VuZCAmJiBldmVudC5DdXJyZW50Um91bmQuUm91bmROdW1iZXIpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghZXZlbnQpIHtcbiAgICAgICAgICAgIGxvZy5TdGF0dXMgPSAnTk9fU1VDSF9FVkVOVCc7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyhgTm8gZXZlbnQgaXMgY29uZmlndXJlZCBhdCB0aGlzIG51bWJlcjogJHt0b31gKTtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZShmb3JtYXQsIHJlcywgJ05PX1NVQ0hfRVZFTlQnKTtcbiAgICAgICAgICAgIC8vIEludGVudGlvbmFsbHkgbm90IHdhaXRpbmcgZm9yIHRoZSBsb2cgZW50cnkgdG8gY29tcGxldGVcbiAgICAgICAgICAgIGxvZy5zYXZlKCkuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgICAgICBsb2dnZXIuaW5mbyhlcnIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2cuRXZlbnRJZCA9IGV2ZW50LmlkO1xuICAgICAgICAgICAgbG9nLkV2ZW50TmFtZSA9IGV2ZW50Lk5hbWU7XG4gICAgICAgICAgICBsb2cuUm91bmROdW1iZXIgPSBzZWxlY3RlZFJvdW5kLlJvdW5kTnVtYmVyO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHZvdGVyUmVnaXN0cmF0aW9uID0gZXZlbnQuUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3IuZmluZChyID0+IHtcbiAgICAgICAgICAgIHJldHVybiAoci5QaG9uZU51bWJlciA9PSBmcm9tIHx8IHIuRW1haWwgPT09IGZyb20pO1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoIXZvdGVyUmVnaXN0cmF0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBSZWdpc3RlclZvdGVyKHtcbiAgICAgICAgICAgICAgICBfaWQ6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICBQaG9uZU51bWJlcjogZnJvbSxcbiAgICAgICAgICAgICAgICBGaXJzdE5hbWU6ICcnLFxuICAgICAgICAgICAgICAgIExhc3ROYW1lOiAnJyxcbiAgICAgICAgICAgICAgICBFbWFpbDogJycsXG4gICAgICAgICAgICAgICAgSGFzaDogJycsXG4gICAgICAgICAgICAgICAgRGlzcGxheVBob25lOiAnJyxcbiAgICAgICAgICAgICAgICBSZWdpb25Db2RlOiAnJyxcbiAgICAgICAgICAgICAgICBQcmVmZXJlbmNlczogW10sXG4gICAgICAgICAgICAgICAgQXJ0QmF0dGxlTmV3czogZmFsc2UsXG4gICAgICAgICAgICAgICAgTm90aWZpY2F0aW9uRW1haWxzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBMb3lhbHR5T2ZmZXJzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBSZWdpc3RlcmVkQXQ6IHdoZXJlXG4gICAgICAgICAgICB9LCBldmVudC5pZCwgZmFsc2UsIDEsIHRydWUpO1xuICAgICAgICAgICAgLy8gcmVmcmVzaCBldmVudFxuICAgICAgICAgICAgZXZlbnQgPSBhd2FpdCBFdmVudE1vZGVsLmZpbmRCeUlkKGV2ZW50LmlkKS5wb3B1bGF0ZSgnUmVnaXN0cmF0aW9ucycpXG4gICAgICAgICAgICAgICAgLnBvcHVsYXRlKCdDb250ZXN0YW50cycpXG4gICAgICAgICAgICAgICAgLnBvcHVsYXRlKCdSb3VuZHMuQ29udGVzdGFudHMuRGV0YWlsJylcbiAgICAgICAgICAgICAgICAucG9wdWxhdGUoJ1JvdW5kcy5Db250ZXN0YW50cy5Wb3RlcycpXG4gICAgICAgICAgICAgICAgLnBvcHVsYXRlKCdDdXJyZW50Um91bmQuQ29udGVzdGFudHMuRGV0YWlsJylcbiAgICAgICAgICAgICAgICAucG9wdWxhdGUoJ0N1cnJlbnRSb3VuZC5Db250ZXN0YW50cy5Wb3RlcycpO1xuICAgICAgICAgICAgdm90ZXJSZWdpc3RyYXRpb24gPSByZXN1bHQuRGF0YS51c2VyVm90ZUZhY3RvcjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZWdpc3RyYXRpb24gPSBldmVudC5SZWdpc3RyYXRpb25zLmZpbmQociA9PiB7XG4gICAgICAgICAgICByZXR1cm4gKHIuUGhvbmVOdW1iZXIgPT09IGZyb20gfHwgci5FbWFpbCA9PT0gZnJvbSk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCB2b3RlckluZm8gPSBldmVudC5SZWdpc3RyYXRpb25zVm90ZUZhY3Rvci5maW5kKHIgPT4gcmVnaXN0cmF0aW9uLl9pZC5lcXVhbHMoci5SZWdpc3RyYXRpb25JZCkpO1xuICAgICAgICBjb25zdCBpc011bHRpQWxsb3dlZCA9IHZvdGVyUmVnaXN0cmF0aW9uLlN0YXR1cyA9PT0gJ0FkbWluJyB8fCB2b3RlclJlZ2lzdHJhdGlvbi5Wb3RlRmFjdG9yID09PSAwLjk5O1xuICAgICAgICBpZiAoYm9keS5sZW5ndGggPT09IDYpIHtcbiAgICAgICAgICAgIC8vIGhhbmRsZSBzaXggZGlnaXQgc2VjcmV0IGNvZGVcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBoYW5kbGVTZWNyZXRDb2RlKGJvZHksIGV2ZW50LCB2b3RlclJlZ2lzdHJhdGlvbiwgZm9ybWF0LCByZXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFldmVudC5FbmFibGVkICYmICFzZWxlY3RlZFJvdW5kKSB7XG4gICAgICAgICAgICBsb2cuU3RhdHVzID0gJ1ZPVElOR19DTE9TRUQnO1xuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKGZvcm1hdCwgcmVzLCAnVk9USU5HX0NMT1NFRCcpO1xuICAgICAgICAgICAgLy8gSW50ZW50aW9uYWxseSBub3Qgd2FpdGluZyBmb3IgdGhlIGxvZyBlbnRyeSB0byBjb21wbGV0ZVxuICAgICAgICAgICAgbG9nLnNhdmUoKS5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5pbmZvKGVycik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICghc2VsZWN0ZWRSb3VuZCkge1xuICAgICAgICAgICAgbG9nLlN0YXR1cyA9ICdOT19ST1VORF9TRUxFQ1RFRF9GT1JfRVZFTlQnO1xuICAgICAgICAgICAgbG9nZ2VyLmluZm8oYE5vIHJvdW5kIGlzIGN1cnJlbnRseSBzZWxlY3RlZCBmb3IgZXZlbnQ6ICR7ZXZlbnQuTmFtZX1gKTtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZShmb3JtYXQsIHJlcywgJ05PX1JPVU5EX1NFTEVDVEVEX0ZPUl9FVkVOVCcpO1xuICAgICAgICAgICAgLy8gSW50ZW50aW9uYWxseSBub3Qgd2FpdGluZyBmb3IgdGhlIGxvZyBlbnRyeSB0byBjb21wbGV0ZVxuICAgICAgICAgICAgbG9nLnNhdmUoKS5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5pbmZvKGVycik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCB2b3RlZENvbnRlc3RhbnQgPSBldmVudC5oYXNWb3RlZChmcm9tLCBzZWxlY3RlZFJvdW5kKTtcbiAgICAgICAgaWYgKHZvdGVkQ29udGVzdGFudCAmJiAhaXNNdWx0aUFsbG93ZWQpIHtcbiAgICAgICAgICAgIGxvZy5TdGF0dXMgPSAnQUxSRUFEWV9WT1RFRCc7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbygnRGVueWluZyB2b3RlOiAnICsgZXZlbnQuTmFtZSArICcsICcgKyBmcm9tICsgJyAtIEFscmVhZHkgdm90ZWQnKTtcbiAgICAgICAgICAgIGxldCBwbGFjZWhvbGRlciA9ICd0aGlzIGFydGlzdCc7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHZvdGVkQ29udGVzdGFudCA9PT0gJ29iamVjdCcgJiYgJ0RldGFpbCcgaW4gdm90ZWRDb250ZXN0YW50KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVzdGFudE1vZGVsID0gYXdhaXQgQ29udGVzdGFudE1vZGVsLmZpbmRCeUlkKHZvdGVkQ29udGVzdGFudC5EZXRhaWwpO1xuICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyID0gY29udGVzdGFudE1vZGVsICYmIGNvbnRlc3RhbnRNb2RlbC5OYW1lIHx8IHBsYWNlaG9sZGVyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc2VuZFJlc3BvbnNlKGZvcm1hdCwgcmVzLCAnQUxSRUFEWV9WT1RFRCcsICcnLCAwLCBwbGFjZWhvbGRlcik7XG4gICAgICAgICAgICAvLyBJbnRlbnRpb25hbGx5IG5vdCB3YWl0aW5nIGZvciB0aGUgbG9nIGVudHJ5IHRvIGNvbXBsZXRlXG4gICAgICAgICAgICBsb2cuc2F2ZSgpLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGxldCBhdmFpbGFibGVPcHRpb25zO1xuICAgICAgICBsZXQgYXZhaWxhYmxlT3B0aW9uc1N0cmluZztcbiAgICAgICAgaWYgKHNlbGVjdGVkUm91bmQpIHtcbiAgICAgICAgICAgIGF2YWlsYWJsZU9wdGlvbnMgPSBzZWxlY3RlZFJvdW5kLkNvbnRlc3RhbnRzXG4gICAgICAgICAgICAgICAgLmZpbHRlcihjID0+IGMuRW5hYmxlZCAmJiBjLkVhc2VsTnVtYmVyKVxuICAgICAgICAgICAgICAgIC5tYXAoYyA9PiBjLkVhc2VsTnVtYmVyKTtcbiAgICAgICAgICAgIGF2YWlsYWJsZU9wdGlvbnNTdHJpbmcgPSBhdmFpbGFibGVPcHRpb25zLmpvaW4oJywgJyk7XG4gICAgICAgIH1cblxuXG5cbiAgICAgICAgY29uc3QgY2hvaWNlOiBudW1iZXJbXSA9IFtdO1xuICAgICAgICBjb25zdCBsb2dNb2RlbHMgPSBbXTtcbiAgICAgICAgaWYgKGJvZHkubGVuZ3RoID4gMSAmJiBpc011bHRpQWxsb3dlZCAmJiAhYXZhaWxhYmxlT3B0aW9ucy5jb250YWlucyhwYXJzZUludChib2R5KSkpIHtcbiAgICAgICAgICAgIC8vIE11bHRpcGxlIGlmIGJvZHkncyBsZW5ndGggaXMgZ3JlYXRlciB0aGFuIHplcm8sIHZvdGUgZmFjdG9yIGlzIDAuOTkgb3Igc3RhdHVzIGlzIGFkbWluXG4gICAgICAgICAgICAvLyBhbmQgdm90aW5nIG9wdGlvbiBpcyBub3QgaW4gZXhpc3RpbmcgY29udGVzdGFudCBsaXN0XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJvZHkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhcnRpc3RJbnQgPSBwYXJzZUludChib2R5W2ldKTtcbiAgICAgICAgICAgICAgICBpZiAoIWlzTmFOKGFydGlzdEludCkgJiYgYXJ0aXN0SW50ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBsb2dNb2RlbCA9IG5ldyBWb3RpbmdMb2dNb2RlbCgpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmICghYXZhaWxhYmxlT3B0aW9ucy5jb250YWlucyhhcnRpc3RJbnQpICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nTW9kZWwuU3RhdHVzID0gJ0JBRF9WT1RFX0lOVkFMSURfT1BUSU9OJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ2dlci5pbmZvKCdCYWQgdm90ZTogJyArIGV2ZW50Lk5hbWUgKyAnLCAnICsgZnJvbSArICcsICcgKyBib2R5ICsgJywgQXZhaWxhYmxlIE9wdGlvbnM6ICcgKyBhdmFpbGFibGVPcHRpb25zU3RyaW5nKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNob2ljZS5wdXNoKGFydGlzdEludCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgbG9nTW9kZWwuUGhvbmVOdW1iZXIgPSBsb2cuUGhvbmVOdW1iZXI7XG4gICAgICAgICAgICAgICAgICAgIGxvZ01vZGVsLkV2ZW50SWQgPSBsb2cuRXZlbnRJZDtcbiAgICAgICAgICAgICAgICAgICAgbG9nTW9kZWwuRXZlbnROYW1lID0gbG9nLkV2ZW50TmFtZTtcbiAgICAgICAgICAgICAgICAgICAgbG9nTW9kZWwuUm91bmROdW1iZXIgPSBsb2cuUm91bmROdW1iZXI7XG4gICAgICAgICAgICAgICAgICAgIGxvZ01vZGVscy5wdXNoKGxvZ01vZGVsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBTSU5HTEVcbiAgICAgICAgICAgIGlmICghdXRpbHMudGVzdGludChib2R5KSkge1xuICAgICAgICAgICAgICAgIGxvZy5TdGF0dXMgPSAnQkFEX1ZPVEVfSU5WQUxJRF9PUFRJT04nO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5pbmZvKCdCYWQgdm90ZTogJyArIGV2ZW50Lk5hbWUgKyAnLCAnICsgZnJvbSArICcsICcgKyBib2R5KTtcbiAgICAgICAgICAgICAgICBzZW5kUmVzcG9uc2UoZm9ybWF0LCByZXMsICdCQURfVk9URV9JTlZBTElEX09QVElPTicsIGF2YWlsYWJsZU9wdGlvbnNTdHJpbmcpO1xuICAgICAgICAgICAgICAgIC8vIEludGVudGlvbmFsbHkgbm90IHdhaXRpbmcgZm9yIHRoZSBsb2cgZW50cnkgdG8gY29tcGxldGVcbiAgICAgICAgICAgICAgICBsb2cuc2F2ZSgpLmNhdGNoKGVyciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxvZ2dlci5pbmZvKGVycik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYXJ0aXN0SW50ID0gcGFyc2VJbnQoYm9keSk7XG4gICAgICAgICAgICBpZiAoIWF2YWlsYWJsZU9wdGlvbnMuY29udGFpbnMoYXJ0aXN0SW50KSApIHtcbiAgICAgICAgICAgICAgICBsb2cuU3RhdHVzID0gJ0JBRF9WT1RFX0lOVkFMSURfT1BUSU9OJztcbiAgICAgICAgICAgICAgICBsb2dnZXIuaW5mbygnQmFkIHZvdGU6ICcgKyBldmVudC5OYW1lICsgJywgJyArIGZyb20gKyAnLCAnICsgYm9keSArICcsIEF2YWlsYWJsZSBPcHRpb25zOiAnICsgYXZhaWxhYmxlT3B0aW9uc1N0cmluZyk7XG4gICAgICAgICAgICAgICAgc2VuZFJlc3BvbnNlKGZvcm1hdCwgcmVzLCAnQkFEX1ZPVEVfSU5WQUxJRF9PUFRJT04nLCBhdmFpbGFibGVPcHRpb25zU3RyaW5nKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2dNb2RlbHMucHVzaChsb2cpO1xuICAgICAgICAgICAgICAgIGNob2ljZS5wdXNoKGFydGlzdEludCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuXG5cbiAgICAgICAgY29uc3QgYXJ0aXN0TmFtZXMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaG9pY2UubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGxvZ01vZGVsc1tpXS5EaXNwbGF5UGhvbmUgPSByZWdpc3RyYXRpb24uRGlzcGxheVBob25lO1xuICAgICAgICAgICAgbG9nTW9kZWxzW2ldLlBob25lSGFzaCA9IHJlZ2lzdHJhdGlvbi5IYXNoO1xuICAgICAgICAgICAgbGV0IHZvdGVkRm9yOiBSb3VuZENvbnRlc3RhbnREVE87XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHNlbGVjdGVkUm91bmQuQ29udGVzdGFudHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZXN0YW50ID0gc2VsZWN0ZWRSb3VuZC5Db250ZXN0YW50c1tqXTtcbiAgICAgICAgICAgICAgICBpZiAoY29udGVzdGFudC5FYXNlbE51bWJlciA9PT0gY2hvaWNlW2ldICYmIGNvbnRlc3RhbnQuRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICB2b3RlZEZvciA9IGNvbnRlc3RhbnQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlc3RhbnRNb2RlbCA9IGF3YWl0IENvbnRlc3RhbnRNb2RlbC5maW5kQnlJZCh2b3RlZEZvci5EZXRhaWwpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNvbnRlc3RhbnRNb2RlbC5Wb3Rlc0NvdW50IHx8IGlzTmFOKGNvbnRlc3RhbnRNb2RlbC5Wb3Rlc0NvdW50KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29udGVzdGFudE1vZGVsLlZvdGVzQ291bnQgPSAwO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlc3RhbnRNb2RlbC5Wb3Rlc0NvdW50ID0gY29udGVzdGFudE1vZGVsLlZvdGVzQ291bnQgKyAxO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIWNvbnRlc3RhbnRNb2RlbC5TY29yZSB8fCBpc05hTihjb250ZXN0YW50TW9kZWwuU2NvcmUpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZXN0YW50TW9kZWwuU2NvcmUgPSAwO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmICghY29udGVzdGFudE1vZGVsLkZvbGxvd2Vyc0NvdW50IHx8IGlzTmFOKGNvbnRlc3RhbnRNb2RlbC5Gb2xsb3dlcnNDb3VudCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlc3RhbnRNb2RlbC5Gb2xsb3dlcnNDb3VudCA9IDA7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29udGVzdGFudE1vZGVsLlNjb3JlID0gY29udGVzdGFudE1vZGVsLlZvdGVzQ291bnQgKyBjb250ZXN0YW50TW9kZWwuRm9sbG93ZXJzQ291bnQ7XG5cbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgY29udGVzdGFudE1vZGVsLnNhdmUoKTtcbiAgICAgICAgICAgICAgICAgICAgdm90ZWRGb3IuRGV0YWlsID0gY29udGVzdGFudE1vZGVsO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2b3RlZEZvci5Wb3Rlcy5wdXNoKHJlZ2lzdHJhdGlvbik7XG4gICAgICAgICAgICB2b3RlZEZvci5Wb3Rlc0RldGFpbC5wdXNoKHtcbiAgICAgICAgICAgICAgICBSZWdpc3RyYXRpb25JZDogcmVnaXN0cmF0aW9uLl9pZCxcbiAgICAgICAgICAgICAgICBWb3RlRmFjdG9yOiB2b3RlckluZm8uVm90ZUZhY3RvcixcbiAgICAgICAgICAgICAgICBQaG9uZU51bWJlcjogdm90ZXJJbmZvLlBob25lTnVtYmVyLFxuICAgICAgICAgICAgICAgIFZvdGVGYWN0b3JJbmZvOiB2b3RlckluZm8uVm90ZUZhY3RvckluZm8sXG4gICAgICAgICAgICAgICAgSGFzaDogdm90ZXJJbmZvLkhhc2gsXG4gICAgICAgICAgICAgICAgVm90ZVVybDogdm90ZXJJbmZvLlZvdGVVcmwsXG4gICAgICAgICAgICAgICAgUmVnaW9uQ29kZTogdm90ZXJJbmZvLlJlZ2lvbkNvZGUsXG4gICAgICAgICAgICAgICAgRW1haWw6IHZvdGVySW5mby5FbWFpbCxcbiAgICAgICAgICAgICAgICBTdGF0dXM6IHZvdGVySW5mby5TdGF0dXMsXG4gICAgICAgICAgICAgICAgQXVjdGlvblVybDogdm90ZXJJbmZvLkF1Y3Rpb25VcmxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgbG9nTW9kZWxzW2ldLkFydGlzdE5hbWUgPSB2b3RlZEZvci5EZXRhaWwuTmFtZTtcbiAgICAgICAgICAgIGxvZ01vZGVsc1tpXS5FYXNlbE51bWJlciA9IHZvdGVkRm9yLkVhc2VsTnVtYmVyO1xuICAgICAgICAgICAgbG9nTW9kZWxzW2ldLlZvdGVGYWN0b3IgPSB2b3RlckluZm8uVm90ZUZhY3RvcjtcbiAgICAgICAgICAgIGxvZ01vZGVsc1tpXS5Wb3RlRmFjdG9ySW5mbyA9IHZvdGVySW5mby5Wb3RlRmFjdG9ySW5mbztcbiAgICAgICAgICAgIGxvZ01vZGVsc1tpXS5Wb3RlQ2hhbm5lbC5UeXBlID0gdm90ZXJJbmZvLlZvdGVGYWN0b3JJbmZvLlR5cGU7XG4gICAgICAgICAgICAvKkZvbGxvdy9Gb2xsb3dpbmcgU3RhcnQqL1xuICAgICAgICAgICAgbG9nTW9kZWxzW2ldLlN0YXR1cyA9ICdWT1RFX0FDQ0VQVEVEJztcbiAgICAgICAgICAgIGxvZ01vZGVsc1tpXS5SZWdpc3RyYXRpb24gPSByZWdpc3RyYXRpb247XG4gICAgICAgICAgICBsb2dNb2RlbHNbaV0uQ29udGVzdGFudCA9IHZvdGVkRm9yLkRldGFpbDtcbiAgICAgICAgICAgIC8qRm9sbG93L0ZvbGxvd2luZyBFbmQqL1xuICAgICAgICAgICAgbG9nTW9kZWxzW2ldLkxvdCA9IHZvdGVkRm9yLkxvdDtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKCdBY2NlcHRpbmcgdm90ZTogJyArIHZvdGVkRm9yLkRldGFpbC5OYW1lICsgJywgJyArIGZyb20pO1xuICAgICAgICAgICAgYXJ0aXN0TmFtZXMucHVzaCh2b3RlZEZvci5EZXRhaWwuTmFtZSk7XG4gICAgICAgICAgICBhd2FpdCBsb2dNb2RlbHNbaV0uc2F2ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGV2ZW50LnNhdmUoKTtcbiAgICAgICAgICAgIGlmIChhcnRpc3ROYW1lcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICBzZW5kUmVzcG9uc2UoZm9ybWF0LCByZXMsICdWT1RFX0FDQ0VQVEVEJywgYCR7YXJ0aXN0TmFtZXNbMF19LmAsIG9wZW5BdWN0aW9uQ291bnQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzZW5kUmVzcG9uc2UoZm9ybWF0LCByZXMsICdWT1RFX0FDQ0VQVEVEX01VTFRJJywgYCR7YXJ0aXN0TmFtZXMubGVuZ3RofWAsIG9wZW5BdWN0aW9uQ291bnQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgbG9nLlN0YXR1cyA9ICdTRVJWRVJfRVJST1InO1xuICAgICAgICAgICAgYXdhaXQgbG9nLnNhdmUoKTtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZShmb3JtYXQsIHJlcywgJ1NFUlZFUl9FUlJPUicpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGNhdGNoIChlKSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKGBFcnJvciBpbiB2b3RlU01TICR7ZS5zdGFja30gQm9keTogJHtib2R5fSwgRnJvbTogJHtmcm9tfSwgVG86ICR7dG99YCk7XG4gICAgICAgIHNlbmRSZXNwb25zZShmb3JtYXQsIHJlcywgJ1NFUlZFUl9FUlJPUl9WMicpO1xuICAgIH1cbn07XG5cbi8qKlxuICogSGFuZGxlIEV2ZW50IHNlY3JldCBjb2RlIHRvIG1hbmlwdWxhdGUgdXNlciB2b3RlIGZhY3RvclxuICogQHBhcmFtIGNvZGVcbiAqIEBwYXJhbSBldmVudFxuICogQHBhcmFtIHZvdGVSZWdpc3RyYXRpb25cbiAqIEBwYXJhbSByZXNcbiAqIEBwYXJhbSBmb3JtYXRcbiAqIEByZXR1cm4gRGF0YU9wZXJhdGlvblJlc3VsdDxTdHJpbmc+IHx8IHZvaWRcbiAqL1xuZXhwb3J0IGNvbnN0IGhhbmRsZVNlY3JldENvZGUgPSBhc3luYyAoY29kZTogU3RyaW5nLCBldmVudDogRXZlbnREb2N1bWVudCwgdm90ZVJlZ2lzdHJhdGlvbjogUmVnaXN0cmF0aW9uVm90ZUZhY3RvckRUTywgZm9ybWF0OiBzdHJpbmcsIHJlcz86IFJlc3BvbnNlKTogUHJvbWlzZTxEYXRhT3BlcmF0aW9uUmVzdWx0PHN0cmluZz4gfCBSZXNwb25zZT4gPT4ge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICBhd2FpdCBDb2RlTW9kZWwuZmluZE9uZSh7XG4gICAgICAgICAgICAgICAgY29kZTogY29kZS50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgICAgIC8vIHVzZWQ6ICcwJ1xuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBSZWdpc3RyYXRpb25Mb2dNb2RlbC5maW5kT25lKHtcbiAgICAgICAgICAgICAgICAnRXZlbnRJZCc6IGV2ZW50Ll9pZCxcbiAgICAgICAgICAgICAgICAnUGhvbmVOdW1iZXInOiB2b3RlUmVnaXN0cmF0aW9uLlBob25lTnVtYmVyXG4gICAgICAgICAgICB9KVxuICAgICAgICBdKTtcbiAgICAgICAgY29uc3QgY29kZURvY3VtZW50ID0gcmVzdWx0c1swXTtcbiAgICAgICAgY29uc3QgbG9nT2JqID0gcmVzdWx0c1sxXTtcblxuICAgICAgICBpZiAoY29kZURvY3VtZW50ICYmIGNvZGVEb2N1bWVudC51c2VkID09PSAnMCcgJiYgbG9nT2JqKSB7XG4gICAgICAgICAgICAvLyB1cGRhdGUgZXZlbnQgdm90ZSBmYWN0b3JcbiAgICAgICAgICAgIGNvbnN0IHZvdGVGYWN0b3JJbmZvICA9IHtcbiAgICAgICAgICAgICAgICBUeXBlOiAnU2VjcmV0JyxcbiAgICAgICAgICAgICAgICBWYWx1ZTogY29kZURvY3VtZW50LmNvZGVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICB2b3RlUmVnaXN0cmF0aW9uLlZvdGVGYWN0b3IgPSBwYXJzZUZsb2F0KGNvZGVEb2N1bWVudC52YWx1ZSk7XG4gICAgICAgICAgICB2b3RlUmVnaXN0cmF0aW9uLlZvdGVGYWN0b3JJbmZvID0gdm90ZUZhY3RvckluZm87XG4gICAgICAgICAgICBjb2RlRG9jdW1lbnQudXNlZCA9ICcxJzsgLy8gbWFyayBjb2RlIGFzIHVzZWRcbiAgICAgICAgICAgIGxvZ09iai5Wb3RlRmFjdG9yID0gdm90ZVJlZ2lzdHJhdGlvbi5Wb3RlRmFjdG9yOyAvLyB1cGRhdGUgZXZlbnQgdm90ZSBmYWN0b3JcbiAgICAgICAgICAgIGxvZ09iai5Wb3RlRmFjdG9ySW5mbyA9IHZvdGVGYWN0b3JJbmZvO1xuICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgICAgICAgICAgIGxvZ09iai5zYXZlKCksXG4gICAgICAgICAgICAgICAgZXZlbnQuc2F2ZSgpLFxuICAgICAgICAgICAgICAgIGNvZGVEb2N1bWVudC5zYXZlKClcbiAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShmb3JtYXQsIHJlcywgJ0NPREVfQURERUQnKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGlmICghY29kZURvY3VtZW50KSB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oYEludmFsaWQgY29kZSBlbnRlcmVkLCBjb2RlOiR7Y29kZX0sIHBob25lOiAke3ZvdGVSZWdpc3RyYXRpb24uUGhvbmVOdW1iZXJ9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShmb3JtYXQsIHJlcywgJ0lOVkFMSURfQ09ERScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZiAoY29kZURvY3VtZW50LnVzZWQgPT09ICcxJykge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBVc2VkIGNvZGUsIGNvZGU6JHtjb2RlfSwgcGhvbmU6ICR7dm90ZVJlZ2lzdHJhdGlvbi5QaG9uZU51bWJlcn1gKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKGZvcm1hdCwgcmVzLCAnQ09ERV9FWFBJUkVEJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2dnZXIuaW5mbyhgUGhvbmUgbnVtYmVyICR7dm90ZVJlZ2lzdHJhdGlvbi5QaG9uZU51bWJlcn0gaXMgbm90IHJlZ2lzdGVyZWQgdG8gdm90ZSBpbiB0aGlzIGV2ZW50LCBjb2RlICR7Y29kZX1gKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gc2VuZFJlc3BvbnNlKGZvcm1hdCwgcmVzLCAnUEhPTkVfTk9UX1JFR0lTVEVSRUQnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBjYXRjaCAoZSkge1xuICAgICAgICBsb2dnZXIuaW5mbyhgZXJyb3IgaW4gaGFuZGxlU2VjcmV0Q29kZSwgY29kZTogJHtjb2RlfSwgcGhvbmU6ICR7dm90ZVJlZ2lzdHJhdGlvbi5QaG9uZU51bWJlcn1gLCBlKTtcbiAgICAgICAgcmV0dXJuIHNlbmRSZXNwb25zZShmb3JtYXQsIHJlcywgJ1NFUlZFUl9FUlJPUl9WMicpO1xuICAgIH1cbn07XG5cbmV4cG9ydCBjb25zdCBnZXRFdmVudEZvclNNUyA9IGFzeW5jIGZ1bmN0aW9uICh0bzogU3RyaW5nLCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24sIGxvZzogVm90aW5nTG9nRG9jdW1lbnQpIHtcbiAgICBsZXQgZXZlbnRzOiBFdmVudERvY3VtZW50W107XG4gICAgdHJ5IHtcbiAgICAgICAgZXZlbnRzID0gYXdhaXQgRXZlbnRNb2RlbFxuICAgICAgICAgICAgLmZpbmQoKCB7IFBob25lTnVtYmVyOiB0bywgRW5hYmxlZDogdHJ1ZSB9ICkpXG4gICAgICAgICAgICAucG9wdWxhdGUoJ1JlZ2lzdHJhdGlvbnMnKVxuICAgICAgICAgICAgLnBvcHVsYXRlKCdDb250ZXN0YW50cycpXG4gICAgICAgICAgICAucG9wdWxhdGUoJ1JvdW5kcy5Db250ZXN0YW50cy5EZXRhaWwnKVxuICAgICAgICAgICAgLnBvcHVsYXRlKCdSb3VuZHMuQ29udGVzdGFudHMuVm90ZXMnKVxuICAgICAgICAgICAgLnBvcHVsYXRlKCdDdXJyZW50Um91bmQuQ29udGVzdGFudHMuRGV0YWlsJylcbiAgICAgICAgICAgIC5wb3B1bGF0ZSgnQ3VycmVudFJvdW5kLkNvbnRlc3RhbnRzLlZvdGVzJylcbiAgICAgICAgICAgIC5zb3J0KHtfaWQ6IC0xfSlcbiAgICAgICAgICAgIC5leGVjKCk7XG4gICAgICAgIHJldHVybiAgZXZlbnRzWzBdO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBsb2dnZXIuaW5mbyhlcnIpO1xuICAgICAgICBzZW5kUmVzcG9uc2UoJ3htbCcsIHJlcywgJ1NFUlZFUl9FUlJPUl9WMicpO1xuICAgICAgICAvLyBJbnRlbnRpb25hbGx5IG5vdCB3YWl0aW5nIGZvciB0aGUgbG9nIGVudHJ5IHRvIGNvbXBsZXRlXG4gICAgICAgIGxvZy5zYXZlKCkuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKGVycik7XG4gICAgICAgIH0pO1xuICAgIH1cbn07XG5cbmV4cG9ydCBjb25zdCBnZXRFdmVudEZvckZvcm0gID0gYXN5bmMgZnVuY3Rpb24gKHJlczogUmVzcG9uc2UsIGhhc2g6IHN0cmluZywgbmV4dDogTmV4dEZ1bmN0aW9uLCBsb2c6IFZvdGluZ0xvZ0RvY3VtZW50KSB7XG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuICBhd2FpdCBFdmVudE1vZGVsLmZpbmRPbmUoe1xuICAgICAgICAgICAgJ1JlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yLlZvdGVVcmwnOiBgL3YvJHtoYXNofWAsXG4gICAgICAgIH0pLnNlbGVjdChbJ05hbWUnLCAnX2lkJywgJ1ZvdGVCeUxpbmsnLCAnUm91bmRzJywgJ1JlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yJywgJ0VuYWJsZWQnLCAnUGhvbmVOdW1iZXInLCAnQ3VycmVudFJvdW5kJywgJ1JlZ2lzdHJhdGlvbnMnLCAnRW1haWwnXSlcbiAgICAgICAgICAgIC5wb3B1bGF0ZSgnUmVnaXN0cmF0aW9ucycpXG4gICAgICAgICAgICAucG9wdWxhdGUoJ0N1cnJlbnRSb3VuZC5Db250ZXN0YW50cy5EZXRhaWwnKVxuICAgICAgICAgICAgLnBvcHVsYXRlKCdDdXJyZW50Um91bmQuQ29udGVzdGFudHMuVm90ZXMnKVxuICAgICAgICAgICAgLnBvcHVsYXRlKCdSb3VuZHMuQ29udGVzdGFudHMuVm90ZXMnKVxuICAgICAgICAgICAgLnBvcHVsYXRlKCdSb3VuZHMuQ29udGVzdGFudHMuRGV0YWlsJylcbiAgICAgICAgICAgIC5zb3J0KHtfaWQ6IC0xfSk7XG4gICAgfVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nZ2VyLmluZm8oZXJyKTtcbiAgICAgICAgc2VuZFJlc3BvbnNlKCdqc29uJywgcmVzLCAnU0VSVkVSX0VSUk9SX1YyJyk7XG4gICAgICAgIC8vIEludGVudGlvbmFsbHkgbm90IHdhaXRpbmcgZm9yIHRoZSBsb2cgZW50cnkgdG8gY29tcGxldGVcbiAgICAgICAgbG9nLnNhdmUoKS5jYXRjaChlcnIgPT4ge1xuICAgICAgICAgICAgbG9nZ2VyLmluZm8oZXJyKTtcbiAgICAgICAgfSk7XG4gICAgfVxufTsiXX0=
