import { Request, Response, NextFunction } from 'express';
import { sign } from 'jsonwebtoken';
const uniqueId = require('uniqid');
import RegistrationDTO from '../../../shared/RegistrationDTO';
import { DataOperationResult } from '../../../shared/OperationResult';
import { EventDocument } from '../models/Event';
import EventModel from '../models/Event';
import * as Twilio from 'twilio';

import { default as RegistrationLogModel } from '../models/RegistrationLog';
import VotingLogModel from '../models/VotingLog';
import { RegistrationVoteFactorDTO } from '../../../shared/RoundContestantDTO';


import { RegistrationsResponse } from '../../../shared/RegistrationsReponse';
import RegistrationModel  from '../models/Registration';
import PreferenceModel from '../models/Preference';
import { handleSecretCode } from '../common/voteProcessor';
import { States, StateVoteFactorMap } from '../common/States';
import logger from '../config/logger';
import { RegisterByVoteFactor, RegisterVoter } from '../common/RegistrationProcessor';
import { getProfile } from '../common/Profile';
import sendNotification from '../common/Apns';
import PreferenceDTO from '../../../shared/PreferenceDto';
import { MultiCastIgnoreErr } from '../common/FCM';
import { RegisterVoterV2 } from '../common/RegisterVoterV2';
import { StatsD } from 'hot-shots';
import { postToSlackSMSFlood } from '../common/Slack';


/**
 * GET /
 * Event/{eventId}/Register
 */
export const index = async (req: Request, res: Response, next: NextFunction) => {
    let event: EventDocument;
    try {
        event = await EventModel
            .findById(req.params.eventId)
            .select(['Name', 'VoteByLink', 'EmailRegistration', 'Country', 'EventStartDateTime'])
            .populate('Country')
            .exec();
    } catch (err) {
        logger.info(err);
        return next(err);
    }
    let inputLabel = 'Phone Number';
    let inputType = 'tel';
    let inputPlaceholder = 'Phone Number';

    if (event.VoteByLink && event.EmailRegistration) {
        inputLabel =  'Phone/Email';
        inputType =  'text';
        inputPlaceholder = inputPlaceholder + '/Email';
    }

    let date = '';
    if (event.EventStartDateTime) {
        const eventDateObj = new Date(event.EventStartDateTime);
        date = `${eventDateObj.getMonth()}-${eventDateObj.getDate()}-${eventDateObj.getFullYear()}`;
    }

    res.render('register', {
        title: 'Register voters',
        EventName: event.Name,
        VoteByLink: event.VoteByLink,
        inputType: inputType,
        inputLabel: inputLabel,
        inputPlaceholder: inputPlaceholder,
        countryCode: event.Country && event.Country.phone_code,
        countryFlag: event.Country && event.Country.country_image,
        user: req.user,
        date: date
    });
};

/**
 * GET /
 * api/Event/{eventId}/Registrations
 */
export const getRegistrations = async (req: Request, res: Response, next: NextFunction) => {
    logger.info('getRegistrations()...');

    const dataset: RegistrationsResponse[] = [];
    try {
        const event = await EventModel.findById(req.params.eventId)
            .select(['Registrations', 'Country', 'RegistrationsVoteFactor', 'Rounds'])
            .populate('Country')
            .populate('Registrations');
        let toSaveEvent = false;
        const regIdMap: {
            [key: string]: RegistrationDTO
        } = {};
        const regVotedMap: {
            [key: string]: {
                HasVoted: number;
                VoteCount: number[];
            }
        } = {};
        for (let i = 0; i < event.Registrations.length; i++) {
            regIdMap[event.Registrations[i]._id] = event.Registrations[i];
        }
        for (let k = 0; k < event.Rounds.length; k++) {
            const Round = event.Rounds[k];
            for (let l = 0; l < Round.Contestants.length; l++) {
                const Contestant = Round.Contestants[l];
                for (let m = 0; m < Contestant.VotesDetail.length; m++) {
                    const vote =  Contestant.VotesDetail[m];
                    if (!regVotedMap[vote.RegistrationId]) {
                        regVotedMap[vote.RegistrationId] = {
                            HasVoted: 0,
                            VoteCount: []
                        };
                    }
                    regVotedMap[vote.RegistrationId].HasVoted++;
                    regVotedMap[vote.RegistrationId].VoteCount.push(Round.RoundNumber);
                }
            }
        }

        const alreadyPushedRegIds = [];
        for (let i = 0; i < event.RegistrationsVoteFactor.length; i++) {
            const regFactor = event.RegistrationsVoteFactor[i];
            if (alreadyPushedRegIds.indexOf(regFactor.RegistrationId) === -1) {
                if (!regIdMap[regFactor.RegistrationId.toString()]) {
                    // handle worst case, if a user is here but not not in registration collection
                    logger.info(`registering ${JSON.stringify(regFactor, null, 1)}
                    again because they do not exist in registration collection`);
                    regIdMap[regFactor.RegistrationId.toString()] = await RegisterByVoteFactor(regFactor);
                }
                if (!regFactor.VoteUrl || !(typeof regFactor.NickName !== 'undefined') || !regFactor.Preferences) {
                    logger.info(`manipulating a reg factor due to lack of detail ${regFactor.PhoneNumber}, ${regFactor.RegistrationId}`);
                    const voteUrl = `/v/${uniqueId.time()}`;
                    const logModel = await RegistrationLogModel.findOne({
                        'PhoneNumber': regFactor.PhoneNumber,
                        'EventId': event._id,
                        'AlreadyRegisteredForEvent': false
                    });
                    if (logModel && (!logModel.VoteUrl || logModel.VoteUrl.length === 0)) {
                        logModel.VoteUrl = voteUrl;
                        regFactor.VoteUrl = logModel.VoteUrl;
                        await logModel.save();
                    }

                    regFactor.NickName = regIdMap[regFactor.RegistrationId.toString()].NickName || '';
                    regFactor.Preferences = regIdMap[regFactor.RegistrationId.toString()].Preferences || [];
                    toSaveEvent = true;
                }
                if (regFactor.PhoneNumber === null) {
                    regFactor.PhoneNumber = regFactor.Email;
                }

                let regionImage = null;
                if (regFactor.RegionCode &&
                    (event.Country && event.Country.country_code.toLowerCase() != regFactor.RegionCode.toLowerCase())) {
                    regionImage = `/images/countries/4x3/${regFactor.RegionCode.toLowerCase()}.svg`;
                }

                dataset.push({
                    RegionImage: regionImage,
                    PhoneNumber: regFactor.PhoneNumber,
                    VoteFactor: regFactor.VoteFactor,
                    VoteUrl: regFactor.VoteUrl,
                    Hash: regFactor.Hash,
                    Email: regFactor.Email,
                    NickName: regFactor.NickName || '',
                    Preferences: regFactor.Preferences,
                    Status: regFactor.Status || '',
                    Id: regFactor.RegistrationId,
                    HasVoted:  regVotedMap[regFactor.RegistrationId.toString()] &&
                        regVotedMap[regFactor.RegistrationId.toString()].HasVoted,
                    VoteCount:  regVotedMap[regFactor.RegistrationId.toString()] &&
                        regVotedMap[regFactor.RegistrationId.toString()].VoteCount,
                    PeopleUrl: `${process.env.SITE_URL}/p/${regFactor.PhoneNumber}`
                });
                alreadyPushedRegIds.push(regFactor.RegistrationId);
            }
        }
        if (toSaveEvent) {
            await event.save();
        }
        res.json(dataset);
    } catch (err) {
        logger.info(err);
        return next(err);
    }
};

/**
 * PUT /
 * api/Event/{eventId}/Registration
 */
export const registerVoter = async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await RegisterVoter(req.body, req.params.eventId, false, 1, true));
    } catch (err) {
        return next(err);
    }
};

/**
 * Profile of a user
 * @param req
 * @param res
 * @param next
 */
export const voterProfile = async function(req: Request, res: Response, next: NextFunction) {
    try {
        const profileOutput = await getProfile(req.params.voterHash);
        const registration = await RegistrationModel.findOne({Hash: req.params.voterHash});
        res.render('app_profile', {
            title: 'Profile',
            phoneNumber: registration && registration.PhoneNumber,
            nickName: registration && registration.NickName,
            EventsAttended: profileOutput.totalEvents,
            VotesCast: profileOutput.totalVotes,
            Bids: '-',
            Events: profileOutput.Events,
            HideLogout: true
        });
    }
    catch (e) {
        return next(e);
    }
};



/**
 * Calculate user's vote factor
 * @param phoneNumber
 */
export const calculateUserVoteFactor = async function (phoneNumber: String) {
    const voteCount = await VotingLogModel.find({
        'PhoneNumber': phoneNumber,
        'Status': 'VOTE_ACCEPTED'
    }).countDocuments();
    // Make it editable by admin
    const calculateVoteFactor = function(pastVote: number) {
        return Math.round((1 + (pastVote / 14)) * 100) / 100;
    };

    let voteFactorVal = calculateVoteFactor(voteCount);
    if (voteFactorVal > 5) {
        voteFactorVal = 5;
    }
    return {
        result: voteFactorVal,
        voteCount: voteCount
    };
};

export const selfRegister = async function (req: Request, res: Response, next: NextFunction) {
    let serverNumber;
    try {
        // "POST /api/register HTTP/1.1\" 200 - \"-\" \"Art%20Battle/23 CFNetwork/1107.1 Darwin/19.0.0\""
        // {"message":"::ffff:127.0.0.1 - - [10/Oct/2019:14:50:56 +0000] \"POST /api/register HTTP/1.1\" 200 - \"-\" \"okhttp/3.3.0\"","level":"info"}
        const userAgentHeader = req.header('user-agent');
        let isWeb = false;
        let isIos = false;
        let isAndroid = false;
        if (userAgentHeader.indexOf('Battle') > -1) {
            isIos = true;
        } else if (userAgentHeader.indexOf('okhttp') > -1) {
            isAndroid = true;
        } else {
            isWeb = true;
        }
        const eventId = req.body.eventId;
        const userId = req.user && req.user._id;
        const body = req.body;
        let verified = false;
        if (userId) {
            verified = true;
            body.PhoneNumber = req.user.PhoneNumber;
        }
        const registrationResponse = await RegisterVoter(body, eventId, true, 0.1, verified, userId);
        if (registrationResponse.Data.VerificationCode > 0) {
            logger.info(`sending otp sms ${registrationResponse.Data.VerificationCode}`);
            let body = `Please use ${registrationResponse.Data.VerificationCode} to login`;
            if (isAndroid) {
                body = `<#> ${body} YOIpYCJPwnV`;
            }
            serverNumber = registrationResponse.Data.ServerPhoneNumber;
            const twilioClient = Twilio();
            await twilioClient.messages.create({
                from: serverNumber,
                to: registrationResponse.Data.PhoneNumber,
                body: body,
            });
            postToSlackSMSFlood({
                'text': `${registrationResponse.Data.NickName}(${registrationResponse.Data.PhoneNumber}) (sms) \n${body}  source: register.ts.selfRegister`
            }).catch(() => logger.error(`self register slack flood call failed ${ body } source: register.ts.selfRegister`));
        }
        // don't send otp to client
        registrationResponse.Data.VerificationCode = null;
        registrationResponse.Data.VerificationCodeExp = null;
        // if exp time not defined then 1 year
        registrationResponse.Data.JWT = sign({
            registrationId: registrationResponse.Data.RegistrationId,
        }, process.env.JWT_SECRET,  { expiresIn: process.env.JWT_EXP_TIME || '1y'});
        res.json(registrationResponse);
    } catch (e) {
        if (!e.message) {
            e = {
                message: e,
                status: 500
            };
        }
        next(e);
    }
};

export const verifyOtp = async function (req: Request, res: Response, next: NextFunction) {
    try {
        console.log('verifyOTPBody', JSON.stringify(req.body, null, 1));
        const registrationId = req.body.registrationId;
        const otp = parseInt(req.body.otp);
        // const deviceToken = req.body.deviceToken;
        const eventId = req.body.eventId;
        const registration = await RegistrationModel.findById(registrationId);
        if (req.body.androidDeviceToken) {
            if (!Array.isArray(registration.AndroidDeviceTokens)) {
                registration.AndroidDeviceTokens = registration.AndroidDeviceTokens || [];
            }
            registration.AndroidDeviceTokens.push(req.body.androidDeviceToken);
            await registration.save();
        }
        if (!registration) {
            next({
                status: 403,
                message: 'Invalid Registration id'
            });
            return ;
        }
        logger.info(registration.VerificationCodeExp);
        if ( new Date(registration.VerificationCodeExp).getTime() < new Date().getTime()) {
            next({
                status: 403,
                message: 'OTP expired'
            });
            return ;
        }
        if ( registration.VerificationCode !== otp ) {
            logger.info(registration.VerificationCode.toString(), otp);
            next({
                status: 403,
                message: 'Invalid OTP'
            });
            return ;
        }
        interface ResponseDto {
            Message: String;
            JWT: String;
            NickName: String;
            Email: String;
            FirstName: String;
            LastName: String;
            Name: String;
            ArtBattleNews: boolean;
            NotificationEmails: boolean;
            LoyaltyOffers: boolean;
        }
        const firstName = registration.FirstName || '';
        const lastName = registration.LastName || '';
        let name = '';
        if (firstName && firstName.length > 0) {
            name += firstName + ' ';
        }
        if (lastName && lastName.length > 0) {
            name += lastName;
        }


        const result: DataOperationResult<ResponseDto> = {
            Success: true,
            Data: {
                Message: 'Verification Successful',
                JWT: sign({
                    registrationId: registrationId
                }, process.env.JWT_SECRET),
                NickName: firstName || lastName || registration.NickName || registration.DisplayPhone,
                FirstName: firstName,
                LastName: lastName,
                Name: name.trim(),
                Email: registration.Email || '',
                ArtBattleNews: registration.ArtBattleNews || false,
                NotificationEmails: registration.NotificationEmails || false,
                LoyaltyOffers: registration.LoyaltyOffers || false
            }
        };
        res.cookie('jwt', result.Data.JWT, {
            httpOnly: true,
            sameSite: true,
            signed: true,
            secure: true,
            domain: 'artbattle.com',
            path: '/'
        });
        res.json(result); // response sent
        // post processing
        if (eventId !== 'dummy') {
            const event = await EventModel.findById(eventId);
            const logObj =  new RegistrationLogModel();
            logObj.FirstName = registration.FirstName;
            logObj.LastName = registration.LastName;
            logObj.Email = registration.Email;
            logObj.PhoneNumber = registration.PhoneNumber;
            logObj.PhoneNumberHash = registration.Hash;
            logObj.DisplayPhone = registration.DisplayPhone;
            logObj.VoteUrl = `/v/${uniqueId.time()}`;
            logObj.AuctionUrl = `${process.env.SHORT_SITE_URL}/a/r/${registration.Hash}`;
            logObj.RegisteredAt = 'app';

            // registration.DeviceTokens.push(deviceToken);
            registration.VerificationCode = null;
            registration.VerificationCodeExp = null;
            await registration.save();

            const eventRegistration = event.Registrations.find(rid => {
                return registration._id.equals(rid);
            });
            if (eventRegistration) {
                // user is already registered in the event
                return ;
            }
            const userVoteFactor = {
                RegistrationId: registration._id,
                VoteFactor: 0.1,
                VoteFactorInfo: {
                    Type: 'App-Offshore',
                    Value: `${0.1}`
                },
                PhoneNumber: registration.PhoneNumber,
                Hash: registration.Hash,
                VoteUrl: logObj.VoteUrl,
                Email: registration.Email,
                RegionCode: registration.RegionCode,
                From: 'app-global',
                NickName: registration.NickName,
                Preferences: registration.Preferences,
                Status: '',
                AuctionUrl: logObj.AuctionUrl
            };
            if (!event.RegistrationsVoteFactor) {
                event.RegistrationsVoteFactor = [];
            }
            event.RegistrationsVoteFactor.push(userVoteFactor);
            event.Registrations.push(registration);
            logObj.AlreadyRegisteredForEvent = false;
            await event.save(); // user is now registered in event
            await logObj.save(); // user's info is in registration log now
        }
    } catch (e) {
        next(e);
    }
};

export const setNickName = async function (req: Request, res: Response, next: NextFunction) {
    logger.info(`setNickName body ${req.body ? JSON.stringify(req.body, null, 1) : req.body}
    user ${req.user ? JSON.stringify(req.user, null, 1) : ''}`);
    try {
        if (req.body /*&& req.body.nickName && req.body.nickName.length > 0*/ && req.user) {
            logger.info(`saving ${req.body.nickName} of ${req.user}`);
            const registration = req.user;
            const Name = req.body.Name && req.body.Name.split(' ');
            if (Name) {
                registration.FirstName = Name[0];
                registration.LastName = Name[1];
            }
            if (req.body.NickName && req.body.NickName.length > 0) {
                registration.NickName = req.body.nickName || '';
            }
            if (req.body.Email && req.body.Email.length > 0) {
                registration.Email = req.body.Email;
            }
            if (req.body.Coordinates && Array.isArray(req.body.Coordinates)) {
                registration.Location.coordinates = req.body.Coordinates;
            }
            if (req.body.DeviceToken && req.body.DeviceType === 'android') {
                registration.AndroidDeviceTokens.push(req.body.DeviceToken);
            }
            if (req.body.DeviceToken && req.body.DeviceType === 'ios') {
                registration.DeviceTokens.push(req.body.DeviceToken);
            }
            if (req.body.hasOwnProperty('NotificationEmails')) {
                registration.NotificationEmails = req.body.NotificationEmails || false;
            }
            if (req.body.hasOwnProperty('LoyaltyOffers')) {
                registration.LoyaltyOffers = req.body.LoyaltyOffers || false;
            }
            if (req.body.hasOwnProperty('ArtBattleNews')) {
                registration.ArtBattleNews = req.body.ArtBattleNews || false;
            }
            await registration.save();
            interface ResponseDto {
                Message: String;
            }
            const result: DataOperationResult<ResponseDto> = {
                Success: true,
                Data: {
                    Message: 'Profile saved'
                }
            };
            res.json(result);
        } else {
            next({
                status: 400,
                message: 'Invalid payload'
            });
        }
    } catch (e) {
        e.status = e.status || 500;
        next (e);
    }
};

export const saveSettings = async function (req: Request, res: Response, next: NextFunction) {
    try {
        const preferences: {
            data: {
                preference: string;
                id: any;
                enabled: boolean;
            }[];
            deviceToken: string;
            androidDeviceToken: string;
        } = req.body;
        const userPreferences = req.user.Preferences;
        const preferenceLength = preferences.data.length;
        if (preferenceLength > 0) {
            for (let i = 0; i < preferenceLength; i++) {
                const preferenceIndex = userPreferences.indexOf(preferences.data[i].id);
                const isPreferenceExist = preferenceIndex > -1;
                if (preferences.data[i].enabled && !isPreferenceExist) {
                    userPreferences.push(preferences.data[i].id);
                } else if (isPreferenceExist && !preferences.data[i].enabled) {
                    userPreferences.splice(userPreferences.indexOf(preferences.data[i].id), 1);
                }
            }
            if (preferences.deviceToken && preferences.deviceToken !== 'null' &&
                req.user.DeviceTokens.indexOf(preferences.deviceToken) === -1) {
                // if it does not exist then insert it
                logger.info(`valid preferences.deviceToken, ${preferences.deviceToken}`);
                req.user.DeviceTokens.push(preferences.deviceToken);
            } else if (preferences.androidDeviceToken && preferences.androidDeviceToken !== 'null' &&
                req.user.AndroidDeviceTokens.indexOf(preferences.androidDeviceToken) === -1) {
                // if it does not exist then insert it
                logger.info(`valid preferences.AndroidDeviceToken, ${preferences.androidDeviceToken}`);
                req.user.AndroidDeviceTokens.push(preferences.androidDeviceToken);
            } else {
                logger.info(`invalid preferences.deviceToken, ${preferences.deviceToken || preferences.androidDeviceToken}`);
            }
            await req.user.save();
        }
        const resp: DataOperationResult<{
            Message: String
        }> = {
            Success: true,
            Data: {
                Message: 'Preferences saved successfully'
            }
        };
        res.json(resp);
    } catch (e) {
        next(e);
    }
};

export const getSettings = async function (req: Request, res: Response, next: NextFunction) {
    try {
        const userPreferences = req.user.Preferences;
        const eventId = req.query.eventId;
        let country = 'Canada';
        let title = '';
        if (eventId) {
            const event = await EventModel.findById(eventId).select(['Country', 'Name']).populate('Country');
            country = event.Country && event.Country.country_name || country;
            title = event.Name;
        }
        const preferences = await PreferenceModel.find({
            Enabled: true
        });
        interface ResponseDto {
            Message: string;
            Preferences: {
                preference: string;
                id: string;
                enabled: boolean;
            }[];
        }
        const result: ResponseDto = {
            Message: 'Preferences fetched successfully',
            Preferences: []
        };
        for (let i = 0; i < preferences.length; i++) {
            if (preferences[i].Type === 'CountryRegistered') {
                preferences[i].Preference = preferences[i].Preference.replace('{EventCountry}', country);
            } else if (preferences[i].Type === 'EventRegistered' && title.length > 0) {
                preferences[i].Preference = `Voting in ${title}`;
            }
            result.Preferences[i] = {
                preference: preferences[i].Preference,
                id: preferences[i].id,
                enabled: userPreferences.indexOf(preferences[i].id) > -1
            };
        }
        const resp: DataOperationResult<ResponseDto> = {
            Success: true,
            Data: result
        };
        res.json(resp);
    } catch (e) {
        next(e);
    }
};

export const aboutMe = async function (req: Request, res: Response, next: NextFunction) {
    // nick name, events attended, votesCast, paintings won, vote weight
    try {
        const profileOutput = await getProfile(req.user.Hash);

        interface ResponseDto {
            Message: string;
            NickName: string;
            EventsAttended: Number;
            VotesCast: Number;
            VoteWeight: number;
            User: RegistrationDTO;
        }
        req.user.VerificationCode = undefined;
        req.user.VerificationCodeExp = undefined;
        // @ts-ignore
        // @ts-ignore
        const resp: DataOperationResult<ResponseDto> = {
            Success: true,
            Data: {
                Message: 'About me fetched successfully',
                NickName: req.user.NickName,
                EventsAttended: profileOutput.totalEvents,
                VotesCast: profileOutput.totalVotes,
                // @ts-ignore
                VoteWeight: profileOutput.VoteFactor &&  profileOutput.VoteFactor[0],
                User: req.user
            }
        };
        res.json(resp);
    } catch (e) {
        return next(e);
    }
};

export const secretCode = async function (req: Request, res: Response, next: NextFunction) {
    // apply secret code
    try {
        const eventId = req.body.eventId;
        const code = req.body.code;
        if (eventId && code) {
            const event = await EventModel.findById(eventId);
            if (event) {
                const voterRegistration = event.RegistrationsVoteFactor.find(r => {
                    return (r.RegistrationId == req.user.id);
                });
                if (voterRegistration) {
                    const response = await handleSecretCode(code, event, voterRegistration, '') as DataOperationResult<string>;
                    // @ts-ignore
                    const resp: DataOperationResult<{Message: String}> = {
                        Success: response.Success,
                        Data: {
                            Message: response.Data
                        }
                    };
                    res.json(resp);
                    return ;
                }
            }
        }
        next({
            status: 400,
            message: 'Invalid parameters'
        });
    } catch (e) {
        next(e);
    }
};

export const logout = async function (req: Request, res: Response, next: NextFunction) {
    // apply logout
    try {
        if (!req.user) {
            const dogStatsD = new StatsD();
            dogStatsD.increment('auto-logout', 1, [`jwt: ${req.header('Authorization')}`]);
        }
        const deviceToken = req.body.deviceToken;
        const androidToken = req.body.androidDeviceToken;
        logger.info('logout device token', deviceToken);
        if (deviceToken && req.user) {
            const toRemoveDeviceTokenIndex = req.user.DeviceTokens.indexOf(deviceToken);
            if (toRemoveDeviceTokenIndex > -1) {
                req.user.DeviceTokens.splice(toRemoveDeviceTokenIndex, 1);
                await req.user.save();
            }
        } else if (androidToken && req.user) {
            const toRemoveDeviceTokenIndex = req.user.AndroidDeviceTokens.indexOf(androidToken);
            if (toRemoveDeviceTokenIndex > -1) {
                req.user.AndroidDeviceTokens.splice(toRemoveDeviceTokenIndex, 1);
                await req.user.save();
            }
        }
        res.clearCookie('jwt');

        if (deviceToken || androidToken) {
            const resp: DataOperationResult<{Message: String}> = {
                Success: true,
                Data: {
                    Message: 'Logout successful'
                }
            };
            res.json(resp);
            return ;
        }
        next({
            status: 400,
            message: 'Invalid parameters'
        });
    } catch (e) {
        next(e);
    }
};

export const changeStatusInEvent = async function (req: Request, res: Response, next: NextFunction) {
    try {
        const eventId = req.params.eventId;
        const registrationId = req.params.registrationId;
        let statusIndex = req.params.statusIndex;
        let status = '';
        let voteFactor = 0;

        if (!isNaN(statusIndex) && statusIndex >= -1 && registrationId && eventId) {
            const event = await EventModel.findById(eventId).select('RegistrationsVoteFactor');
            let phoneNumber = '';
            let userVoteFactor: RegistrationVoteFactorDTO;
            if (event) {
                const regVoteFactors = event.RegistrationsVoteFactor;
                for (let i = 0; i < regVoteFactors.length; i++) {
                    if (regVoteFactors[i].RegistrationId == registrationId) {
                        userVoteFactor = regVoteFactors[i];
                        phoneNumber = regVoteFactors[i].PhoneNumber;
                        break;
                    }
                }

                if (phoneNumber.length > 0) {
                    statusIndex = parseInt(statusIndex);
                    if (statusIndex === -1) {
                        // for last element frontend will send this
                        const result = await calculateUserVoteFactor(phoneNumber);
                        userVoteFactor.VoteFactor = result.result;
                        voteFactor = result.result;
                        status = `${voteFactor}`;
                    }
                    else {
                        // all elements other than last
                        status = States[statusIndex];
                        if (status.toLowerCase() === 'artist') {
                            const registration = await RegistrationModel.findOne({_id: registrationId});
                            registration.IsArtist = true;
                            await registration.save();
                        }
                        voteFactor = StateVoteFactorMap[statusIndex];
                        if (voteFactor !== -1) {
                            // for admin and photo we are not touching it
                            userVoteFactor.VoteFactor = voteFactor;
                        }
                    }
                    userVoteFactor.Status = status;
                    const updateObj: {
                        Status: string;
                        VoteFactor?: number
                    } = {
                        Status: status
                    };
                    if (voteFactor !== -1) {
                        updateObj['VoteFactor'] = voteFactor;
                    }
                    const results = await Promise.all([
                        RegistrationLogModel.findOneAndUpdate({
                            'EventId': eventId,
                            'PhoneNumber': phoneNumber
                        }, {
                            '$set': updateObj
                        }).exec(),
                        event.save()
                    ]);
                    if (results[0] && results[1]) {
                        const resp: DataOperationResult<{Message: String, Status: String, StatusIndex: Number}> = {
                            Success: true,
                            Data: {
                                Message: 'Done',
                                Status: status,
                                StatusIndex: statusIndex
                            }
                        };
                        res.json(resp);
                    } else {
                        next({
                            status: 500,
                            message: 'error in saving data'
                        });
                    }
                } else {
                    next({
                        status: 400,
                        message: 'Invalid registration id'
                    });
                }
            } else {
                next({
                    status: 400,
                    message: 'Invalid event id'
                });
            }
        } else {
            next({
                status: 400,
                message: 'Invalid parameters'
            });
        }
    } catch (e) {
        next(e);
    }
};

export const admin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const phoneHash = req.params.phoneHash;
        let registration: RegistrationDTO;
        if (phoneHash) {
            registration = await RegistrationModel.findOne({
                Hash: phoneHash
            });
        }
        if (req.user && !registration) {
            const authHeader = req.header('Authorization');
            const token =  authHeader && authHeader.replace('Bearer ', '').trim();
            if (token) {
                res.cookie('jwt', token, {
                    httpOnly: true,
                    sameSite: true,
                    signed: true,
                    secure: false
                });
            }
            res.redirect(307, `${process.env.ADMIN_URL}`);
        } else if (registration) {
            const cacheGet = req.app.get('cacheGet');
            const cacheSet = req.app.get('cacheSet');
                const regVoter = new RegisterVoterV2(registration.PhoneNumber, req.get('user-agent'), cacheGet, cacheSet,
                registration, false);
            const token = regVoter.GetToken();
            res.cookie('jwt', token, {
                httpOnly: true,
                sameSite: true,
                signed: true,
                secure: false
            });
            const events = await EventModel.find({
                $and: [
                    {
                        'RegistrationsVoteFactor.Status': 'Admin', // at least have one admin
                        'Enabled': true
                    }
                ]
            }).select(['_id', 'RegistrationsVoteFactor']).sort({_id: -1});
            const eventIds: string[] = [];
            for (let i = 0; i < events.length; i++) {
                const event = events[i];
                for (let j = 0; j < event.RegistrationsVoteFactor.length; j++) {
                    const voteFactor = event.RegistrationsVoteFactor[j];
                    if (voteFactor.RegistrationId.toString() === registration._id.toString() && voteFactor.Status === 'Admin') {
                        eventIds.push(events[i]._id);
                        break;
                    }
                }
            }
            const eventId = Array.isArray(eventIds) && eventIds[0];
            if (eventId) {
                res.redirect(307, `${process.env.ADMIN_URL}/event/${eventId}/results`);
            } else {
                res.redirect(307, `${process.env.ADMIN_URL}`);
            }
        } else {
            const Event = await EventModel.findOne().sort({_id: -1}).populate('Country');
            const obj: any = {
                eventId: Event._id,
                flag: Event.Country ? `${process.env.SITE_URL}/images/countries/4x3/${Event.Country.country_image}` : '',
                flagPng: Event.Country ? `${process.env.SITE_URL}/images/countries/4x3_png/${Event.Country.country_image.replace('svg', 'png')}` : '',
                openStatus: true,
                openVoting: true,
                statusColor: '',
                statusText: 'Open',
                statusTextColor: '',
                title: Event.Name,
                Votes: 0,
                backInHome: 1
            };
            res.redirect(`ios::closepayment::${JSON.stringify(obj)}`);
        }
    } catch (e) {
        next(e);
    }
};
export const profile = async (req: Request, res: Response, next: NextFunction) => {
    logger.info(`req.headers', ${JSON.stringify(req.headers)}`);
    if (req.user) {
        try {
            const profileOutput = await getProfile(req.user.Hash);
            res.render('app_profile', {
                title: 'Profile',
                phoneNumber: req.user && req.user.PhoneNumber,
                nickName: req.user && req.user.NickName,
                EventsAttended: profileOutput.totalEvents,
                VotesCast: profileOutput.totalVotes,
                Bids: '-',
                Events: profileOutput.Events
            });
        }
        catch (e) {
            next(e);
        }
    } else {
        res.redirect('ios::logout::{}');
    }
};

export const testNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const globalRegistrations: RegistrationDTO[] = await RegistrationModel.find({'DeviceTokens': { $exists: true, $ne: [] } });
        const deviceTokens: string[] = [];
        const androidTokens: string[] = [];
        for (let a = 0; a < globalRegistrations.length; a++) {
            const userTokens = globalRegistrations[a].DeviceTokens;
            const userAndroidTokens = globalRegistrations[a].AndroidDeviceTokens;
            if (userTokens) {
                for (let k = 0; k < userTokens.length; k++) {
                    // sbfvhjfbvdfh489tijkufggvn is test token
                    if (userTokens[k] && deviceTokens.indexOf(userTokens[k]) === -1 && userTokens[k] !== 'null' && userTokens[k] !== 'sbfvhjfbvdfh489tijkufggvn')  {
                        deviceTokens.push(userTokens[k]);
                    }
                }
            }
            if (userAndroidTokens) {
                for (let k = 0; k < userAndroidTokens.length; k++) {
                    // sbfvhjfbvdfh489tijkufggvn is test token
                    if (userAndroidTokens[k] && androidTokens.indexOf(userAndroidTokens[k]) === -1 && userAndroidTokens[k] !== 'null')  {
                        androidTokens.push(userTokens[k]);
                    }
                }
            }
        }
        if (deviceTokens.length > 0) {
            const badDeviceTokens = await sendNotification(deviceTokens, 'Clicking on me would send you to a webview', 'WebView Test',
                {
                    url: 'https://app.artbattle.com/profile',
                    title: 'Profile'
                }
            );
            logger.info('badDeviceTokens', badDeviceTokens);
        }
        if (androidTokens.length > 0) {
            const badAndroidTokens = await MultiCastIgnoreErr({
                DeviceTokens: androidTokens,
                link: 'https://app.artbattle.com/profile',
                title: 'WebView Test',
                message: 'Clicking on me would send you to a webview',
                priority: 'normal',
                analyticsLabel: 'WebView Test'
            });
            logger.info('badDeviceTokens', badAndroidTokens);
        }
        res.json({
            message: 'Notifications send successfully'
        });
    } catch (e) {
        next(e);
    }
};

export const preferences = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const profileOutput = await getProfile(req.user.Hash);
        const preferences = await PreferenceModel.find({});
        interface UserPreferenceDto extends PreferenceDTO {
            Enabled: boolean;
        }
        const preferenceIdMap: {[key: string]: UserPreferenceDto} = {};
        for (let i = 0; i < preferences.length; i++) {
            preferenceIdMap[preferences[i]._id] = preferences[i];
            preferenceIdMap[preferences[i]._id].Enabled = false;
        }
        for (let i = 0; i < req.user.Preferences.length; i++) {
            if (preferenceIdMap[req.user.Preferences[i]._id]) {
                preferenceIdMap[req.user.Preferences[i]._id].Enabled = true;
            }
        }
        res.render('preferences', {
            title: 'Profile',
            phoneNumber: req.user && req.user.PhoneNumber,
            nickName: req.user && req.user.NickName,
            EventsAttended: profileOutput.totalEvents,
            VotesCast: profileOutput.totalVotes,
            Bids: '-',
            Events: profileOutput.Events,
            Preferences: Object.values(preferenceIdMap)
        });
    } catch (e) {
        next(e);
    }
};

export async function findUserByPhone(req: Request, res: Response, next: NextFunction) {
    try {
        let phone = req.params.phone;
        if (!phone.startsWith('+')) {
            // If phone number is without plus add it
            const eventId = req.params.eventId;
            const event = await EventModel.findOne({_id: eventId}).select(['Country']).populate(['Country']);
            if (!event) {
                res.status(400);
                next({Message: 'Event not found'});
                return ;
            }
            phone = `${event.Country.phone_code}${phone}`;
        }
        const registration = await RegistrationModel.findOne({PhoneNumber: phone});
        if (registration && registration.Email && registration.FirstName) {
            const result: DataOperationResult<RegistrationDTO> = {
                'Success': true,
                Data: registration
            };
            res.json(result);
        } else {
            next({Status: 404, Message: 'User not found', Registration: registration});
        }
    } catch (e) {
        next(e);
    }
}

export async function login(req: Request, res: Response, next: NextFunction) {
    try {
        const cacheGet = req.app.get('cacheGet');
        const cacheSet = req.app.get('cacheSet');
        const phoneNumber = req.body.PhoneNumber;
        const registration = await RegistrationModel.findOne({PhoneNumber: phoneNumber});
        const userAgentHeader = req.header('user-agent');
        const registerVoteObj = new RegisterVoterV2(phoneNumber, userAgentHeader, cacheSet, cacheGet, registration, true);
        const Message = 'Please enter verification code';
        if (!registration) {
            // register
            await registerVoteObj.Register();
        } else {
            await registerVoteObj.Login();
        }
        const result: DataOperationResult<{
            Message: string;
        }> = {
            Success: true,
            Data: {
                Message: Message
            }
        };
        res.json(result);
        // send otp in sms
    } catch (e) {
        if (!e.message) {
            e = {
                message: e,
                status: 500
            };
        }
        e.status = e.status || 500;
        next(e);
    }
}

export async function verifyLoginOtp(req: Request, res: Response, next: NextFunction) {
    try {
        const cacheGet = req.app.get('cacheGet');
        const cacheSet = req.app.get('cacheSet');
        const phoneNumber = req.body.PhoneNumber;
        console.log('otp body', req.body);
        const userAgentHeader = req.header('user-agent');
        const verificationCode = req.body.otp;
        const registration = await RegistrationModel.findOne({PhoneNumber: phoneNumber});
        const registerVoteObj = new RegisterVoterV2(phoneNumber, userAgentHeader, cacheSet, cacheGet, registration);
        if (!(registration.DisplayPhone)) {
            registration.DisplayPhone = `*******${registration.PhoneNumber.slice(-4)}`;
            await registration.save();
        }
        if (!registration) {
            next({
                status: 403,
                Message: 'Invalid phone number passed'
            });
            return ;
        }
        const isVerified = await registerVoteObj.VerifyCode('' + verificationCode);
        if (isVerified === 1) {
            const result: DataOperationResult<{
                Message: string;
                Token: string;
                NickName: string;
            }> = {
                Success: true,
                Data: {
                    Message: 'Verification Successful!',
                    Token: registerVoteObj.GetToken(),
                    NickName: (registration.NickName || registration.DisplayPhone).toString()
                }
            };
            res.json(result);
        } else if (isVerified === -1) {
            next({
                status: 403,
                Message: 'Expired OTP'
            });
        } else {
            next({
                status: 403,
                Message: 'Invalid OTP'
            });
        }

    } catch (e) {
        if (!e.message) {
            e = {
                message: e,
                status: 500
            };
        }
        e.status = e.status || 500;
        next(e);
    }
}

export const jwtLogin = async(req: Request, res: Response, next: NextFunction) => {
    const redirectUrl = req.query.redirectTo;
    const cacheGet = req.app.get('cacheGet');
    const cacheSet = req.app.get('cacheSet');
    const phoneNumber = req.body.PhoneNumber;
    const userAgentHeader = req.header('user-agent');
    const registerVoteObj = new RegisterVoterV2(phoneNumber, userAgentHeader, cacheSet, cacheGet, req.user);
    const token = registerVoteObj.GetToken();
    res.cookie('jwt', token, {
        httpOnly: true,
        sameSite: true,
        signed: true,
        secure: false
    });
    if (!redirectUrl) {
        const result: DataOperationResult<{
            Message: string;
            Token: string;
            NickName: string;
        }> = {
            Success: true,
            Data: {
                Message: 'Login Successful!',
                Token: token,
                NickName: (req.user.NickName || req.user.DisplayPhone).toString()
            }
        };
        res.json(result);
        return ;
    } else {
        res.redirect(307, redirectUrl);
    }
};

export const appRedirect = async(req: Request, res: Response, next: NextFunction) => {
    const country = req.query.country;
    const cacheGet = req.app.get('cacheGet');
    const cacheSet = req.app.get('cacheSet');
    const platform = typeof req.query.platform === 'string' ? req.query.platform.toLowerCase() : '';
    console.log('appRedirect', req.query, req.headers);
    if (req.user) {
        const phoneNumber = req.user.PhoneNumber;
        const userAgentHeader = req.header('user-agent');
        const registerVoteObj = new RegisterVoterV2(phoneNumber, userAgentHeader, cacheSet, cacheGet, req.user);
        const token = registerVoteObj.GetToken();
        res.cookie('jwt', token, {
            httpOnly: true,
            sameSite: true,
            signed: true,
            secure: true,
            domain: 'artb.art',
            path: '/'
        });
        console.log('redirecting to ', `${process.env.FRONTEND_LINK}/all?country=${country}`);
        res.redirect(307, `${process.env.FRONTEND_LINK}/all?country=${country}`);
        return ;
    } else {
        console.log('redirecting to', 'native login');
        const dummyEvent = {
            eventId: 'dummy',
            flag: '',
            flagPng: '',
            openStatus: true,
            openVoting: true,
            statusText: 'open',
            title: ''
        };
        if (platform === 'ios') {
            res.redirect(307, `ios::closepayment::${JSON.stringify(dummyEvent)}`);
        } else if (platform === 'android') {
            // res.render('appRedirect');
            res.redirect(307, `ios::closepayment::${JSON.stringify(dummyEvent)}`);
        } else {
            res.json('wrong platform passed');
        }
    }
};

export const publicRegistration = async(req: Request, res: Response, next: NextFunction) => {
    const eventId = req.params.eventId;
    const event = await EventModel
        .findById(eventId)
        .select(['Name']);
    if (!event) {
        return;
    }
    res.render('public_registration', {
        eventName: event.Name,
        eventId: eventId,
        title: `Register for ${event.Name}`
    });
};

export const publicRegistrationPost = async(req: Request, res: Response, next: NextFunction) => {
    const eventId = req.params.eventId;
    const event = await EventModel
        .findById(eventId)
        .select(['Name']);
    if (!event) {
        return;
    }
    const registrationResponse = await RegisterVoter(req.body, eventId, true, 0.1, true, false);
    registrationResponse.Data.VerificationCode = null;
    registrationResponse.Data.VerificationCodeExp = null;
    // if exp time not defined then 1 year
    /*registrationResponse.Data.JWT = sign({
        registrationId: registrationResponse.Data.RegistrationId,
    }, process.env.JWT_SECRET,  { expiresIn: process.env.JWT_EXP_TIME || '1y'});*/
    req.flash('info', { msg: 'Account registered' });
    res.render('public_registration', {
        eventName: event.Name,
        eventId: eventId,
        title: `Register for ${event.Name}`,
        registrationId: registrationResponse.Data.RegistrationId
    });
};