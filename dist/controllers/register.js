"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicRegistrationPost = exports.publicRegistration = exports.appRedirect = exports.jwtLogin = exports.verifyLoginOtp = exports.login = exports.findUserByPhone = exports.preferences = exports.testNotification = exports.profile = exports.admin = exports.changeStatusInEvent = exports.logout = exports.secretCode = exports.aboutMe = exports.getSettings = exports.saveSettings = exports.setNickName = exports.verifyOtp = exports.selfRegister = exports.calculateUserVoteFactor = exports.voterProfile = exports.registerVoter = exports.getRegistrations = exports.index = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
const uniqueId = require('uniqid');
const Event_1 = require("../models/Event");
const Twilio = require("twilio");
const RegistrationLog_1 = require("../models/RegistrationLog");
const VotingLog_1 = require("../models/VotingLog");
const Registration_1 = require("../models/Registration");
const Preference_1 = require("../models/Preference");
const voteProcessor_1 = require("../common/voteProcessor");
const States_1 = require("../common/States");
const logger_1 = require("../config/logger");
const RegistrationProcessor_1 = require("../common/RegistrationProcessor");
const Profile_1 = require("../common/Profile");
const Apns_1 = require("../common/Apns");
const FCM_1 = require("../common/FCM");
const RegisterVoterV2_1 = require("../common/RegisterVoterV2");
const hot_shots_1 = require("hot-shots");
const Slack_1 = require("../common/Slack");
/**
 * GET /
 * Event/{eventId}/Register
 */
exports.index = async (req, res, next) => {
    let event;
    try {
        event = await Event_1.default
            .findById(req.params.eventId)
            .select(['Name', 'VoteByLink', 'EmailRegistration', 'Country', 'EventStartDateTime'])
            .populate('Country')
            .exec();
    }
    catch (err) {
        logger_1.default.info(err);
        return next(err);
    }
    let inputLabel = 'Phone Number';
    let inputType = 'tel';
    let inputPlaceholder = 'Phone Number';
    if (event.VoteByLink && event.EmailRegistration) {
        inputLabel = 'Phone/Email';
        inputType = 'text';
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
exports.getRegistrations = async (req, res, next) => {
    logger_1.default.info('getRegistrations()...');
    const dataset = [];
    try {
        const event = await Event_1.default.findById(req.params.eventId)
            .select(['Registrations', 'Country', 'RegistrationsVoteFactor', 'Rounds'])
            .populate('Country')
            .populate('Registrations');
        let toSaveEvent = false;
        const regIdMap = {};
        const regVotedMap = {};
        for (let i = 0; i < event.Registrations.length; i++) {
            regIdMap[event.Registrations[i]._id] = event.Registrations[i];
        }
        for (let k = 0; k < event.Rounds.length; k++) {
            const Round = event.Rounds[k];
            for (let l = 0; l < Round.Contestants.length; l++) {
                const Contestant = Round.Contestants[l];
                for (let m = 0; m < Contestant.VotesDetail.length; m++) {
                    const vote = Contestant.VotesDetail[m];
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
                    logger_1.default.info(`registering ${JSON.stringify(regFactor, null, 1)}
                    again because they do not exist in registration collection`);
                    regIdMap[regFactor.RegistrationId.toString()] = await RegistrationProcessor_1.RegisterByVoteFactor(regFactor);
                }
                if (!regFactor.VoteUrl || !(typeof regFactor.NickName !== 'undefined') || !regFactor.Preferences) {
                    logger_1.default.info(`manipulating a reg factor due to lack of detail ${regFactor.PhoneNumber}, ${regFactor.RegistrationId}`);
                    const voteUrl = `/v/${uniqueId.time()}`;
                    const logModel = await RegistrationLog_1.default.findOne({
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
                    HasVoted: regVotedMap[regFactor.RegistrationId.toString()] &&
                        regVotedMap[regFactor.RegistrationId.toString()].HasVoted,
                    VoteCount: regVotedMap[regFactor.RegistrationId.toString()] &&
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
    }
    catch (err) {
        logger_1.default.info(err);
        return next(err);
    }
};
/**
 * PUT /
 * api/Event/{eventId}/Registration
 */
exports.registerVoter = async (req, res, next) => {
    try {
        res.json(await RegistrationProcessor_1.RegisterVoter(req.body, req.params.eventId, false, 1, true));
    }
    catch (err) {
        return next(err);
    }
};
/**
 * Profile of a user
 * @param req
 * @param res
 * @param next
 */
exports.voterProfile = async function (req, res, next) {
    try {
        const profileOutput = await Profile_1.getProfile(req.params.voterHash);
        const registration = await Registration_1.default.findOne({ Hash: req.params.voterHash });
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
exports.calculateUserVoteFactor = async function (phoneNumber) {
    const voteCount = await VotingLog_1.default.find({
        'PhoneNumber': phoneNumber,
        'Status': 'VOTE_ACCEPTED'
    }).countDocuments();
    // Make it editable by admin
    const calculateVoteFactor = function (pastVote) {
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
exports.selfRegister = async function (req, res, next) {
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
        }
        else if (userAgentHeader.indexOf('okhttp') > -1) {
            isAndroid = true;
        }
        else {
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
        const registrationResponse = await RegistrationProcessor_1.RegisterVoter(body, eventId, true, 0.1, verified, userId);
        if (registrationResponse.Data.VerificationCode > 0) {
            logger_1.default.info(`sending otp sms ${registrationResponse.Data.VerificationCode}`);
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
            Slack_1.postToSlackSMSFlood({
                'text': `${registrationResponse.Data.NickName}(${registrationResponse.Data.PhoneNumber}) (sms) \n${body}  source: register.ts.selfRegister`
            }).catch(() => logger_1.default.error(`self register slack flood call failed ${body} source: register.ts.selfRegister`));
        }
        // don't send otp to client
        registrationResponse.Data.VerificationCode = null;
        registrationResponse.Data.VerificationCodeExp = null;
        // if exp time not defined then 1 year
        registrationResponse.Data.JWT = jsonwebtoken_1.sign({
            registrationId: registrationResponse.Data.RegistrationId,
        }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXP_TIME || '1y' });
        res.json(registrationResponse);
    }
    catch (e) {
        if (!e.message) {
            e = {
                message: e,
                status: 500
            };
        }
        next(e);
    }
};
exports.verifyOtp = async function (req, res, next) {
    try {
        console.log('verifyOTPBody', JSON.stringify(req.body, null, 1));
        const registrationId = req.body.registrationId;
        const otp = parseInt(req.body.otp);
        // const deviceToken = req.body.deviceToken;
        const eventId = req.body.eventId;
        const registration = await Registration_1.default.findById(registrationId);
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
            return;
        }
        logger_1.default.info(registration.VerificationCodeExp);
        if (new Date(registration.VerificationCodeExp).getTime() < new Date().getTime()) {
            next({
                status: 403,
                message: 'OTP expired'
            });
            return;
        }
        if (registration.VerificationCode !== otp) {
            logger_1.default.info(registration.VerificationCode.toString(), otp);
            next({
                status: 403,
                message: 'Invalid OTP'
            });
            return;
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
        const result = {
            Success: true,
            Data: {
                Message: 'Verification Successful',
                JWT: jsonwebtoken_1.sign({
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
            const event = await Event_1.default.findById(eventId);
            const logObj = new RegistrationLog_1.default();
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
                return;
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
    }
    catch (e) {
        next(e);
    }
};
exports.setNickName = async function (req, res, next) {
    logger_1.default.info(`setNickName body ${req.body ? JSON.stringify(req.body, null, 1) : req.body}
    user ${req.user ? JSON.stringify(req.user, null, 1) : ''}`);
    try {
        if (req.body /*&& req.body.nickName && req.body.nickName.length > 0*/ && req.user) {
            logger_1.default.info(`saving ${req.body.nickName} of ${req.user}`);
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
            const result = {
                Success: true,
                Data: {
                    Message: 'Profile saved'
                }
            };
            res.json(result);
        }
        else {
            next({
                status: 400,
                message: 'Invalid payload'
            });
        }
    }
    catch (e) {
        e.status = e.status || 500;
        next(e);
    }
};
exports.saveSettings = async function (req, res, next) {
    try {
        const preferences = req.body;
        const userPreferences = req.user.Preferences;
        const preferenceLength = preferences.data.length;
        if (preferenceLength > 0) {
            for (let i = 0; i < preferenceLength; i++) {
                const preferenceIndex = userPreferences.indexOf(preferences.data[i].id);
                const isPreferenceExist = preferenceIndex > -1;
                if (preferences.data[i].enabled && !isPreferenceExist) {
                    userPreferences.push(preferences.data[i].id);
                }
                else if (isPreferenceExist && !preferences.data[i].enabled) {
                    userPreferences.splice(userPreferences.indexOf(preferences.data[i].id), 1);
                }
            }
            if (preferences.deviceToken && preferences.deviceToken !== 'null' &&
                req.user.DeviceTokens.indexOf(preferences.deviceToken) === -1) {
                // if it does not exist then insert it
                logger_1.default.info(`valid preferences.deviceToken, ${preferences.deviceToken}`);
                req.user.DeviceTokens.push(preferences.deviceToken);
            }
            else if (preferences.androidDeviceToken && preferences.androidDeviceToken !== 'null' &&
                req.user.AndroidDeviceTokens.indexOf(preferences.androidDeviceToken) === -1) {
                // if it does not exist then insert it
                logger_1.default.info(`valid preferences.AndroidDeviceToken, ${preferences.androidDeviceToken}`);
                req.user.AndroidDeviceTokens.push(preferences.androidDeviceToken);
            }
            else {
                logger_1.default.info(`invalid preferences.deviceToken, ${preferences.deviceToken || preferences.androidDeviceToken}`);
            }
            await req.user.save();
        }
        const resp = {
            Success: true,
            Data: {
                Message: 'Preferences saved successfully'
            }
        };
        res.json(resp);
    }
    catch (e) {
        next(e);
    }
};
exports.getSettings = async function (req, res, next) {
    try {
        const userPreferences = req.user.Preferences;
        const eventId = req.query.eventId;
        let country = 'Canada';
        let title = '';
        if (eventId) {
            const event = await Event_1.default.findById(eventId).select(['Country', 'Name']).populate('Country');
            country = event.Country && event.Country.country_name || country;
            title = event.Name;
        }
        const preferences = await Preference_1.default.find({
            Enabled: true
        });
        const result = {
            Message: 'Preferences fetched successfully',
            Preferences: []
        };
        for (let i = 0; i < preferences.length; i++) {
            if (preferences[i].Type === 'CountryRegistered') {
                preferences[i].Preference = preferences[i].Preference.replace('{EventCountry}', country);
            }
            else if (preferences[i].Type === 'EventRegistered' && title.length > 0) {
                preferences[i].Preference = `Voting in ${title}`;
            }
            result.Preferences[i] = {
                preference: preferences[i].Preference,
                id: preferences[i].id,
                enabled: userPreferences.indexOf(preferences[i].id) > -1
            };
        }
        const resp = {
            Success: true,
            Data: result
        };
        res.json(resp);
    }
    catch (e) {
        next(e);
    }
};
exports.aboutMe = async function (req, res, next) {
    // nick name, events attended, votesCast, paintings won, vote weight
    try {
        const profileOutput = await Profile_1.getProfile(req.user.Hash);
        req.user.VerificationCode = undefined;
        req.user.VerificationCodeExp = undefined;
        // @ts-ignore
        // @ts-ignore
        const resp = {
            Success: true,
            Data: {
                Message: 'About me fetched successfully',
                NickName: req.user.NickName,
                EventsAttended: profileOutput.totalEvents,
                VotesCast: profileOutput.totalVotes,
                // @ts-ignore
                VoteWeight: profileOutput.VoteFactor && profileOutput.VoteFactor[0],
                User: req.user
            }
        };
        res.json(resp);
    }
    catch (e) {
        return next(e);
    }
};
exports.secretCode = async function (req, res, next) {
    // apply secret code
    try {
        const eventId = req.body.eventId;
        const code = req.body.code;
        if (eventId && code) {
            const event = await Event_1.default.findById(eventId);
            if (event) {
                const voterRegistration = event.RegistrationsVoteFactor.find(r => {
                    return (r.RegistrationId == req.user.id);
                });
                if (voterRegistration) {
                    const response = await voteProcessor_1.handleSecretCode(code, event, voterRegistration, '');
                    // @ts-ignore
                    const resp = {
                        Success: response.Success,
                        Data: {
                            Message: response.Data
                        }
                    };
                    res.json(resp);
                    return;
                }
            }
        }
        next({
            status: 400,
            message: 'Invalid parameters'
        });
    }
    catch (e) {
        next(e);
    }
};
exports.logout = async function (req, res, next) {
    // apply logout
    try {
        if (!req.user) {
            const dogStatsD = new hot_shots_1.StatsD();
            dogStatsD.increment('auto-logout', 1, [`jwt: ${req.header('Authorization')}`]);
        }
        const deviceToken = req.body.deviceToken;
        const androidToken = req.body.androidDeviceToken;
        logger_1.default.info('logout device token', deviceToken);
        if (deviceToken && req.user) {
            const toRemoveDeviceTokenIndex = req.user.DeviceTokens.indexOf(deviceToken);
            if (toRemoveDeviceTokenIndex > -1) {
                req.user.DeviceTokens.splice(toRemoveDeviceTokenIndex, 1);
                await req.user.save();
            }
        }
        else if (androidToken && req.user) {
            const toRemoveDeviceTokenIndex = req.user.AndroidDeviceTokens.indexOf(androidToken);
            if (toRemoveDeviceTokenIndex > -1) {
                req.user.AndroidDeviceTokens.splice(toRemoveDeviceTokenIndex, 1);
                await req.user.save();
            }
        }
        res.clearCookie('jwt');
        if (deviceToken || androidToken) {
            const resp = {
                Success: true,
                Data: {
                    Message: 'Logout successful'
                }
            };
            res.json(resp);
            return;
        }
        next({
            status: 400,
            message: 'Invalid parameters'
        });
    }
    catch (e) {
        next(e);
    }
};
exports.changeStatusInEvent = async function (req, res, next) {
    try {
        const eventId = req.params.eventId;
        const registrationId = req.params.registrationId;
        let statusIndex = req.params.statusIndex;
        let status = '';
        let voteFactor = 0;
        if (!isNaN(statusIndex) && statusIndex >= -1 && registrationId && eventId) {
            const event = await Event_1.default.findById(eventId).select('RegistrationsVoteFactor');
            let phoneNumber = '';
            let userVoteFactor;
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
                        const result = await exports.calculateUserVoteFactor(phoneNumber);
                        userVoteFactor.VoteFactor = result.result;
                        voteFactor = result.result;
                        status = `${voteFactor}`;
                    }
                    else {
                        // all elements other than last
                        status = States_1.States[statusIndex];
                        if (status.toLowerCase() === 'artist') {
                            const registration = await Registration_1.default.findOne({ _id: registrationId });
                            registration.IsArtist = true;
                            await registration.save();
                        }
                        voteFactor = States_1.StateVoteFactorMap[statusIndex];
                        if (voteFactor !== -1) {
                            // for admin and photo we are not touching it
                            userVoteFactor.VoteFactor = voteFactor;
                        }
                    }
                    userVoteFactor.Status = status;
                    const updateObj = {
                        Status: status
                    };
                    if (voteFactor !== -1) {
                        updateObj['VoteFactor'] = voteFactor;
                    }
                    const results = await Promise.all([
                        RegistrationLog_1.default.findOneAndUpdate({
                            'EventId': eventId,
                            'PhoneNumber': phoneNumber
                        }, {
                            '$set': updateObj
                        }).exec(),
                        event.save()
                    ]);
                    if (results[0] && results[1]) {
                        const resp = {
                            Success: true,
                            Data: {
                                Message: 'Done',
                                Status: status,
                                StatusIndex: statusIndex
                            }
                        };
                        res.json(resp);
                    }
                    else {
                        next({
                            status: 500,
                            message: 'error in saving data'
                        });
                    }
                }
                else {
                    next({
                        status: 400,
                        message: 'Invalid registration id'
                    });
                }
            }
            else {
                next({
                    status: 400,
                    message: 'Invalid event id'
                });
            }
        }
        else {
            next({
                status: 400,
                message: 'Invalid parameters'
            });
        }
    }
    catch (e) {
        next(e);
    }
};
exports.admin = async (req, res, next) => {
    try {
        const phoneHash = req.params.phoneHash;
        let registration;
        if (phoneHash) {
            registration = await Registration_1.default.findOne({
                Hash: phoneHash
            });
        }
        if (req.user && !registration) {
            const authHeader = req.header('Authorization');
            const token = authHeader && authHeader.replace('Bearer ', '').trim();
            if (token) {
                res.cookie('jwt', token, {
                    httpOnly: true,
                    sameSite: true,
                    signed: true,
                    secure: false
                });
            }
            res.redirect(307, `${process.env.ADMIN_URL}`);
        }
        else if (registration) {
            const cacheGet = req.app.get('cacheGet');
            const cacheSet = req.app.get('cacheSet');
            const regVoter = new RegisterVoterV2_1.RegisterVoterV2(registration.PhoneNumber, req.get('user-agent'), cacheGet, cacheSet, registration, false);
            const token = regVoter.GetToken();
            res.cookie('jwt', token, {
                httpOnly: true,
                sameSite: true,
                signed: true,
                secure: false
            });
            const events = await Event_1.default.find({
                $and: [
                    {
                        'RegistrationsVoteFactor.Status': 'Admin',
                        'Enabled': true
                    }
                ]
            }).select(['_id', 'RegistrationsVoteFactor']).sort({ _id: -1 });
            const eventIds = [];
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
            }
            else {
                res.redirect(307, `${process.env.ADMIN_URL}`);
            }
        }
        else {
            const Event = await Event_1.default.findOne().sort({ _id: -1 }).populate('Country');
            const obj = {
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
    }
    catch (e) {
        next(e);
    }
};
exports.profile = async (req, res, next) => {
    logger_1.default.info(`req.headers', ${JSON.stringify(req.headers)}`);
    if (req.user) {
        try {
            const profileOutput = await Profile_1.getProfile(req.user.Hash);
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
    }
    else {
        res.redirect('ios::logout::{}');
    }
};
exports.testNotification = async (req, res, next) => {
    try {
        const globalRegistrations = await Registration_1.default.find({ 'DeviceTokens': { $exists: true, $ne: [] } });
        const deviceTokens = [];
        const androidTokens = [];
        for (let a = 0; a < globalRegistrations.length; a++) {
            const userTokens = globalRegistrations[a].DeviceTokens;
            const userAndroidTokens = globalRegistrations[a].AndroidDeviceTokens;
            if (userTokens) {
                for (let k = 0; k < userTokens.length; k++) {
                    // sbfvhjfbvdfh489tijkufggvn is test token
                    if (userTokens[k] && deviceTokens.indexOf(userTokens[k]) === -1 && userTokens[k] !== 'null' && userTokens[k] !== 'sbfvhjfbvdfh489tijkufggvn') {
                        deviceTokens.push(userTokens[k]);
                    }
                }
            }
            if (userAndroidTokens) {
                for (let k = 0; k < userAndroidTokens.length; k++) {
                    // sbfvhjfbvdfh489tijkufggvn is test token
                    if (userAndroidTokens[k] && androidTokens.indexOf(userAndroidTokens[k]) === -1 && userAndroidTokens[k] !== 'null') {
                        androidTokens.push(userTokens[k]);
                    }
                }
            }
        }
        if (deviceTokens.length > 0) {
            const badDeviceTokens = await Apns_1.default(deviceTokens, 'Clicking on me would send you to a webview', 'WebView Test', {
                url: 'https://app.artbattle.com/profile',
                title: 'Profile'
            });
            logger_1.default.info('badDeviceTokens', badDeviceTokens);
        }
        if (androidTokens.length > 0) {
            const badAndroidTokens = await FCM_1.MultiCastIgnoreErr({
                DeviceTokens: androidTokens,
                link: 'https://app.artbattle.com/profile',
                title: 'WebView Test',
                message: 'Clicking on me would send you to a webview',
                priority: 'normal',
                analyticsLabel: 'WebView Test'
            });
            logger_1.default.info('badDeviceTokens', badAndroidTokens);
        }
        res.json({
            message: 'Notifications send successfully'
        });
    }
    catch (e) {
        next(e);
    }
};
exports.preferences = async (req, res, next) => {
    try {
        const profileOutput = await Profile_1.getProfile(req.user.Hash);
        const preferences = await Preference_1.default.find({});
        const preferenceIdMap = {};
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
    }
    catch (e) {
        next(e);
    }
};
async function findUserByPhone(req, res, next) {
    try {
        let phone = req.params.phone;
        if (!phone.startsWith('+')) {
            // If phone number is without plus add it
            const eventId = req.params.eventId;
            const event = await Event_1.default.findOne({ _id: eventId }).select(['Country']).populate(['Country']);
            if (!event) {
                res.status(400);
                next({ Message: 'Event not found' });
                return;
            }
            phone = `${event.Country.phone_code}${phone}`;
        }
        const registration = await Registration_1.default.findOne({ PhoneNumber: phone });
        if (registration && registration.Email && registration.FirstName) {
            const result = {
                'Success': true,
                Data: registration
            };
            res.json(result);
        }
        else {
            next({ Status: 404, Message: 'User not found', Registration: registration });
        }
    }
    catch (e) {
        next(e);
    }
}
exports.findUserByPhone = findUserByPhone;
async function login(req, res, next) {
    try {
        const cacheGet = req.app.get('cacheGet');
        const cacheSet = req.app.get('cacheSet');
        const phoneNumber = req.body.PhoneNumber;
        const registration = await Registration_1.default.findOne({ PhoneNumber: phoneNumber });
        const userAgentHeader = req.header('user-agent');
        const registerVoteObj = new RegisterVoterV2_1.RegisterVoterV2(phoneNumber, userAgentHeader, cacheSet, cacheGet, registration, true);
        const Message = 'Please enter verification code';
        if (!registration) {
            // register
            await registerVoteObj.Register();
        }
        else {
            await registerVoteObj.Login();
        }
        const result = {
            Success: true,
            Data: {
                Message: Message
            }
        };
        res.json(result);
        // send otp in sms
    }
    catch (e) {
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
exports.login = login;
async function verifyLoginOtp(req, res, next) {
    try {
        const cacheGet = req.app.get('cacheGet');
        const cacheSet = req.app.get('cacheSet');
        const phoneNumber = req.body.PhoneNumber;
        console.log('otp body', req.body);
        const userAgentHeader = req.header('user-agent');
        const verificationCode = req.body.otp;
        const registration = await Registration_1.default.findOne({ PhoneNumber: phoneNumber });
        const registerVoteObj = new RegisterVoterV2_1.RegisterVoterV2(phoneNumber, userAgentHeader, cacheSet, cacheGet, registration);
        if (!(registration.DisplayPhone)) {
            registration.DisplayPhone = `*******${registration.PhoneNumber.slice(-4)}`;
            await registration.save();
        }
        if (!registration) {
            next({
                status: 403,
                Message: 'Invalid phone number passed'
            });
            return;
        }
        const isVerified = await registerVoteObj.VerifyCode('' + verificationCode);
        if (isVerified === 1) {
            const result = {
                Success: true,
                Data: {
                    Message: 'Verification Successful!',
                    Token: registerVoteObj.GetToken(),
                    NickName: (registration.NickName || registration.DisplayPhone).toString()
                }
            };
            res.json(result);
        }
        else if (isVerified === -1) {
            next({
                status: 403,
                Message: 'Expired OTP'
            });
        }
        else {
            next({
                status: 403,
                Message: 'Invalid OTP'
            });
        }
    }
    catch (e) {
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
exports.verifyLoginOtp = verifyLoginOtp;
exports.jwtLogin = async (req, res, next) => {
    const redirectUrl = req.query.redirectTo;
    const cacheGet = req.app.get('cacheGet');
    const cacheSet = req.app.get('cacheSet');
    const phoneNumber = req.body.PhoneNumber;
    const userAgentHeader = req.header('user-agent');
    const registerVoteObj = new RegisterVoterV2_1.RegisterVoterV2(phoneNumber, userAgentHeader, cacheSet, cacheGet, req.user);
    const token = registerVoteObj.GetToken();
    res.cookie('jwt', token, {
        httpOnly: true,
        sameSite: true,
        signed: true,
        secure: false
    });
    if (!redirectUrl) {
        const result = {
            Success: true,
            Data: {
                Message: 'Login Successful!',
                Token: token,
                NickName: (req.user.NickName || req.user.DisplayPhone).toString()
            }
        };
        res.json(result);
        return;
    }
    else {
        res.redirect(307, redirectUrl);
    }
};
exports.appRedirect = async (req, res, next) => {
    const country = req.query.country;
    const cacheGet = req.app.get('cacheGet');
    const cacheSet = req.app.get('cacheSet');
    const platform = typeof req.query.platform === 'string' ? req.query.platform.toLowerCase() : '';
    console.log('appRedirect', req.query, req.headers);
    if (req.user) {
        const phoneNumber = req.user.PhoneNumber;
        const userAgentHeader = req.header('user-agent');
        const registerVoteObj = new RegisterVoterV2_1.RegisterVoterV2(phoneNumber, userAgentHeader, cacheSet, cacheGet, req.user);
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
        return;
    }
    else {
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
        }
        else if (platform === 'android') {
            // res.render('appRedirect');
            res.redirect(307, `ios::closepayment::${JSON.stringify(dummyEvent)}`);
        }
        else {
            res.json('wrong platform passed');
        }
    }
};
exports.publicRegistration = async (req, res, next) => {
    const eventId = req.params.eventId;
    const event = await Event_1.default
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
exports.publicRegistrationPost = async (req, res, next) => {
    const eventId = req.params.eventId;
    const event = await Event_1.default
        .findById(eventId)
        .select(['Name']);
    if (!event) {
        return;
    }
    const registrationResponse = await RegistrationProcessor_1.RegisterVoter(req.body, eventId, true, 0.1, true, false);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbnRyb2xsZXJzL3JlZ2lzdGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUNBLCtDQUFvQztBQUNwQyxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7QUFJbkMsMkNBQXlDO0FBQ3pDLGlDQUFpQztBQUVqQywrREFBNEU7QUFDNUUsbURBQWlEO0FBS2pELHlEQUF3RDtBQUN4RCxxREFBbUQ7QUFDbkQsMkRBQTJEO0FBQzNELDZDQUE4RDtBQUM5RCw2Q0FBc0M7QUFDdEMsMkVBQXNGO0FBQ3RGLCtDQUErQztBQUMvQyx5Q0FBOEM7QUFFOUMsdUNBQW1EO0FBQ25ELCtEQUE0RDtBQUM1RCx5Q0FBbUM7QUFDbkMsMkNBQXNEO0FBR3REOzs7R0FHRztBQUNVLFFBQUEsS0FBSyxHQUFHLEtBQUssRUFBRSxHQUFZLEVBQUUsR0FBYSxFQUFFLElBQWtCLEVBQUUsRUFBRTtJQUMzRSxJQUFJLEtBQW9CLENBQUM7SUFDekIsSUFBSTtRQUNBLEtBQUssR0FBRyxNQUFNLGVBQVU7YUFDbkIsUUFBUSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO2FBQzVCLE1BQU0sQ0FBQyxDQUFDLE1BQU0sRUFBRSxZQUFZLEVBQUUsbUJBQW1CLEVBQUUsU0FBUyxFQUFFLG9CQUFvQixDQUFDLENBQUM7YUFDcEYsUUFBUSxDQUFDLFNBQVMsQ0FBQzthQUNuQixJQUFJLEVBQUUsQ0FBQztLQUNmO0lBQUMsT0FBTyxHQUFHLEVBQUU7UUFDVixnQkFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNqQixPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUNwQjtJQUNELElBQUksVUFBVSxHQUFHLGNBQWMsQ0FBQztJQUNoQyxJQUFJLFNBQVMsR0FBRyxLQUFLLENBQUM7SUFDdEIsSUFBSSxnQkFBZ0IsR0FBRyxjQUFjLENBQUM7SUFFdEMsSUFBSSxLQUFLLENBQUMsVUFBVSxJQUFJLEtBQUssQ0FBQyxpQkFB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U0FDakIsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUN0QixJQUFJLENBQUMsS0FBSyxFQUFFO1FBQ1IsT0FBTztLQUNWO0lBQ0QsTUFBTSxvQkFBb0IsR0FBRyxNQUFNLHFDQUFhLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDNUYsb0JBQW9CLENBQUMsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQztJQUNsRCxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDO0lBQ3JELHNDQUFzQztJQUN0Qzs7a0ZBRThFO0lBQzlFLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLEVBQUUsR0FBRyxFQUFFLG9CQUFvQixFQUFFLENBQUMsQ0FBQztJQUNqRCxHQUFHLENBQUMsTUFBTSxDQUFDLHFCQUFxQixFQUFFO1FBQzlCLFNBQVMsRUFBRSxLQUFLLENBQUMsSUFBSTtRQUNyQixPQUFPLEVBQUUsT0FBTztRQUNoQixLQUFLLEVBQUUsZ0JBQWdCLEtBQUssQ0FBQyxJQUFJLEVBQUU7UUFDbkMsY0FBYyxFQUFFLG9CQUFvQixDQUFDLElBQUksQ0FBQyxjQUFjO0tBQzNELENBQUMsQ0FBQztBQUNQLENBQUMsQ0FBQyIsImZpbGUiOiJjb250cm9sbGVycy9yZWdpc3Rlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFJlcXVlc3QsIFJlc3BvbnNlLCBOZXh0RnVuY3Rpb24gfSBmcm9tICdleHByZXNzJztcbmltcG9ydCB7IHNpZ24gfSBmcm9tICdqc29ud2VidG9rZW4nO1xuY29uc3QgdW5pcXVlSWQgPSByZXF1aXJlKCd1bmlxaWQnKTtcbmltcG9ydCBSZWdpc3RyYXRpb25EVE8gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL1JlZ2lzdHJhdGlvbkRUTyc7XG5pbXBvcnQgeyBEYXRhT3BlcmF0aW9uUmVzdWx0IH0gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL09wZXJhdGlvblJlc3VsdCc7XG5pbXBvcnQgeyBFdmVudERvY3VtZW50IH0gZnJvbSAnLi4vbW9kZWxzL0V2ZW50JztcbmltcG9ydCBFdmVudE1vZGVsIGZyb20gJy4uL21vZGVscy9FdmVudCc7XG5pbXBvcnQgKiBhcyBUd2lsaW8gZnJvbSAndHdpbGlvJztcblxuaW1wb3J0IHsgZGVmYXVsdCBhcyBSZWdpc3RyYXRpb25Mb2dNb2RlbCB9IGZyb20gJy4uL21vZGVscy9SZWdpc3RyYXRpb25Mb2cnO1xuaW1wb3J0IFZvdGluZ0xvZ01vZGVsIGZyb20gJy4uL21vZGVscy9Wb3RpbmdMb2cnO1xuaW1wb3J0IHsgUmVnaXN0cmF0aW9uVm90ZUZhY3RvckRUTyB9IGZyb20gJy4uLy4uLy4uL3NoYXJlZC9Sb3VuZENvbnRlc3RhbnREVE8nO1xuXG5cbmltcG9ydCB7IFJlZ2lzdHJhdGlvbnNSZXNwb25zZSB9IGZyb20gJy4uLy4uLy4uL3NoYXJlZC9SZWdpc3RyYXRpb25zUmVwb25zZSc7XG5pbXBvcnQgUmVnaXN0cmF0aW9uTW9kZWwgIGZyb20gJy4uL21vZGVscy9SZWdpc3RyYXRpb24nO1xuaW1wb3J0IFByZWZlcmVuY2VNb2RlbCBmcm9tICcuLi9tb2RlbHMvUHJlZmVyZW5jZSc7XG5pbXBvcnQgeyBoYW5kbGVTZWNyZXRDb2RlIH0gZnJvbSAnLi4vY29tbW9uL3ZvdGVQcm9jZXNzb3InO1xuaW1wb3J0IHsgU3RhdGVzLCBTdGF0ZVZvdGVGYWN0b3JNYXAgfSBmcm9tICcuLi9jb21tb24vU3RhdGVzJztcbmltcG9ydCBsb2dnZXIgZnJvbSAnLi4vY29uZmlnL2xvZ2dlcic7XG5pbXBvcnQgeyBSZWdpc3RlckJ5Vm90ZUZhY3RvciwgUmVnaXN0ZXJWb3RlciB9IGZyb20gJy4uL2NvbW1vbi9SZWdpc3RyYXRpb25Qcm9jZXNzb3InO1xuaW1wb3J0IHsgZ2V0UHJvZmlsZSB9IGZyb20gJy4uL2NvbW1vbi9Qcm9maWxlJztcbmltcG9ydCBzZW5kTm90aWZpY2F0aW9uIGZyb20gJy4uL2NvbW1vbi9BcG5zJztcbmltcG9ydCBQcmVmZXJlbmNlRFRPIGZyb20gJy4uLy4uLy4uL3NoYXJlZC9QcmVmZXJlbmNlRHRvJztcbmltcG9ydCB7IE11bHRpQ2FzdElnbm9yZUVyciB9IGZyb20gJy4uL2NvbW1vbi9GQ00nO1xuaW1wb3J0IHsgUmVnaXN0ZXJWb3RlclYyIH0gZnJvbSAnLi4vY29tbW9uL1JlZ2lzdGVyVm90ZXJWMic7XG5pbXBvcnQgeyBTdGF0c0QgfSBmcm9tICdob3Qtc2hvdHMnO1xuaW1wb3J0IHsgcG9zdFRvU2xhY2tTTVNGbG9vZCB9IGZyb20gJy4uL2NvbW1vbi9TbGFjayc7XG5cblxuLyoqXG4gKiBHRVQgL1xuICogRXZlbnQve2V2ZW50SWR9L1JlZ2lzdGVyXG4gKi9cbmV4cG9ydCBjb25zdCBpbmRleCA9IGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGxldCBldmVudDogRXZlbnREb2N1bWVudDtcbiAgICB0cnkge1xuICAgICAgICBldmVudCA9IGF3YWl0IEV2ZW50TW9kZWxcbiAgICAgICAgICAgIC5maW5kQnlJZChyZXEucGFyYW1zLmV2ZW50SWQpXG4gICAgICAgICAgICAuc2VsZWN0KFsnTmFtZScsICdWb3RlQnlMaW5rJywgJ0VtYWlsUmVnaXN0cmF0aW9uJywgJ0NvdW50cnknLCAnRXZlbnRTdGFydERhdGVUaW1lJ10pXG4gICAgICAgICAgICAucG9wdWxhdGUoJ0NvdW50cnknKVxuICAgICAgICAgICAgLmV4ZWMoKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgbG9nZ2VyLmluZm8oZXJyKTtcbiAgICAgICAgcmV0dXJuIG5leHQoZXJyKTtcbiAgICB9XG4gICAgbGV0IGlucHV0TGFiZWwgPSAnUGhvbmUgTnVtYmVyJztcbiAgICBsZXQgaW5wdXRUeXBlID0gJ3RlbCc7XG4gICAgbGV0IGlucHV0UGxhY2Vob2xkZXIgPSAnUGhvbmUgTnVtYmVyJztcblxuICAgIGlmIChldmVudC5Wb3RlQnlMaW5rICYmIGV2ZW50LkVtYWlsUmVnaXN0cmF0aW9uKSB7XG4gICAgICAgIGlucHV0TGFiZWwgPSAgJ1Bob25lL0VtYWlsJztcbiAgICAgICAgaW5wdXRUeXBlID0gICd0ZXh0JztcbiAgICAgICAgaW5wdXRQbGFjZWhvbGRlciA9IGlucHV0UGxhY2Vob2xkZXIgKyAnL0VtYWlsJztcbiAgICB9XG5cbiAgICBsZXQgZGF0ZSA9ICcnO1xuICAgIGlmIChldmVudC5FdmVudFN0YXJ0RGF0ZVRpbWUpIHtcbiAgICAgICAgY29uc3QgZXZlbnREYXRlT2JqID0gbmV3IERhdGUoZXZlbnQuRXZlbnRTdGFydERhdGVUaW1lKTtcbiAgICAgICAgZGF0ZSA9IGAke2V2ZW50RGF0ZU9iai5nZXRNb250aCgpfS0ke2V2ZW50RGF0ZU9iai5nZXREYXRlKCl9LSR7ZXZlbnREYXRlT2JqLmdldEZ1bGxZZWFyKCl9YDtcbiAgICB9XG5cbiAgICByZXMucmVuZGVyKCdyZWdpc3RlcicsIHtcbiAgICAgICAgdGl0bGU6ICdSZWdpc3RlciB2b3RlcnMnLFxuICAgICAgICBFdmVudE5hbWU6IGV2ZW50Lk5hbWUsXG4gICAgICAgIFZvdGVCeUxpbms6IGV2ZW50LlZvdGVCeUxpbmssXG4gICAgICAgIGlucHV0VHlwZTogaW5wdXRUeXBlLFxuICAgICAgICBpbnB1dExhYmVsOiBpbnB1dExhYmVsLFxuICAgICAgICBpbnB1dFBsYWNlaG9sZGVyOiBpbnB1dFBsYWNlaG9sZGVyLFxuICAgICAgICBjb3VudHJ5Q29kZTogZXZlbnQuQ291bnRyeSAmJiBldmVudC5Db3VudHJ5LnBob25lX2NvZGUsXG4gICAgICAgIGNvdW50cnlGbGFnOiBldmVudC5Db3VudHJ5ICYmIGV2ZW50LkNvdW50cnkuY291bnRyeV9pbWFnZSxcbiAgICAgICAgdXNlcjogcmVxLnVzZXIsXG4gICAgICAgIGRhdGU6IGRhdGVcbiAgICB9KTtcbn07XG5cbi8qKlxuICogR0VUIC9cbiAqIGFwaS9FdmVudC97ZXZlbnRJZH0vUmVnaXN0cmF0aW9uc1xuICovXG5leHBvcnQgY29uc3QgZ2V0UmVnaXN0cmF0aW9ucyA9IGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgIGxvZ2dlci5pbmZvKCdnZXRSZWdpc3RyYXRpb25zKCkuLi4nKTtcblxuICAgIGNvbnN0IGRhdGFzZXQ6IFJlZ2lzdHJhdGlvbnNSZXNwb25zZVtdID0gW107XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZXZlbnQgPSBhd2FpdCBFdmVudE1vZGVsLmZpbmRCeUlkKHJlcS5wYXJhbXMuZXZlbnRJZClcbiAgICAgICAgICAgIC5zZWxlY3QoWydSZWdpc3RyYXRpb25zJywgJ0NvdW50cnknLCAnUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3InLCAnUm91bmRzJ10pXG4gICAgICAgICAgICAucG9wdWxhdGUoJ0NvdW50cnknKVxuICAgICAgICAgICAgLnBvcHVsYXRlKCdSZWdpc3RyYXRpb25zJyk7XG4gICAgICAgIGxldCB0b1NhdmVFdmVudCA9IGZhbHNlO1xuICAgICAgICBjb25zdCByZWdJZE1hcDoge1xuICAgICAgICAgICAgW2tleTogc3RyaW5nXTogUmVnaXN0cmF0aW9uRFRPXG4gICAgICAgIH0gPSB7fTtcbiAgICAgICAgY29uc3QgcmVnVm90ZWRNYXA6IHtcbiAgICAgICAgICAgIFtrZXk6IHN0cmluZ106IHtcbiAgICAgICAgICAgICAgICBIYXNWb3RlZDogbnVtYmVyO1xuICAgICAgICAgICAgICAgIFZvdGVDb3VudDogbnVtYmVyW107XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gPSB7fTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBldmVudC5SZWdpc3RyYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICByZWdJZE1hcFtldmVudC5SZWdpc3RyYXRpb25zW2ldLl9pZF0gPSBldmVudC5SZWdpc3RyYXRpb25zW2ldO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgZXZlbnQuUm91bmRzLmxlbmd0aDsgaysrKSB7XG4gICAgICAgICAgICBjb25zdCBSb3VuZCA9IGV2ZW50LlJvdW5kc1trXTtcbiAgICAgICAgICAgIGZvciAobGV0IGwgPSAwOyBsIDwgUm91bmQuQ29udGVzdGFudHMubGVuZ3RoOyBsKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBDb250ZXN0YW50ID0gUm91bmQuQ29udGVzdGFudHNbbF07XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgbSA9IDA7IG0gPCBDb250ZXN0YW50LlZvdGVzRGV0YWlsLmxlbmd0aDsgbSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZvdGUgPSAgQ29udGVzdGFudC5Wb3Rlc0RldGFpbFttXTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFyZWdWb3RlZE1hcFt2b3RlLlJlZ2lzdHJhdGlvbklkXSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVnVm90ZWRNYXBbdm90ZS5SZWdpc3RyYXRpb25JZF0gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgSGFzVm90ZWQ6IDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgVm90ZUNvdW50OiBbXVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZWdWb3RlZE1hcFt2b3RlLlJlZ2lzdHJhdGlvbklkXS5IYXNWb3RlZCsrO1xuICAgICAgICAgICAgICAgICAgICByZWdWb3RlZE1hcFt2b3RlLlJlZ2lzdHJhdGlvbklkXS5Wb3RlQ291bnQucHVzaChSb3VuZC5Sb3VuZE51bWJlcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYWxyZWFkeVB1c2hlZFJlZ0lkcyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV2ZW50LlJlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCByZWdGYWN0b3IgPSBldmVudC5SZWdpc3RyYXRpb25zVm90ZUZhY3RvcltpXTtcbiAgICAgICAgICAgIGlmIChhbHJlYWR5UHVzaGVkUmVnSWRzLmluZGV4T2YocmVnRmFjdG9yLlJlZ2lzdHJhdGlvbklkKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICBpZiAoIXJlZ0lkTWFwW3JlZ0ZhY3Rvci5SZWdpc3RyYXRpb25JZC50b1N0cmluZygpXSkge1xuICAgICAgICAgICAgICAgICAgICAvLyBoYW5kbGUgd29yc3QgY2FzZSwgaWYgYSB1c2VyIGlzIGhlcmUgYnV0IG5vdCBub3QgaW4gcmVnaXN0cmF0aW9uIGNvbGxlY3Rpb25cbiAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oYHJlZ2lzdGVyaW5nICR7SlNPTi5zdHJpbmdpZnkocmVnRmFjdG9yLCBudWxsLCAxKX1cbiAgICAgICAgICAgICAgICAgICAgYWdhaW4gYmVjYXVzZSB0aGV5IGRvIG5vdCBleGlzdCBpbiByZWdpc3RyYXRpb24gY29sbGVjdGlvbmApO1xuICAgICAgICAgICAgICAgICAgICByZWdJZE1hcFtyZWdGYWN0b3IuUmVnaXN0cmF0aW9uSWQudG9TdHJpbmcoKV0gPSBhd2FpdCBSZWdpc3RlckJ5Vm90ZUZhY3RvcihyZWdGYWN0b3IpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIXJlZ0ZhY3Rvci5Wb3RlVXJsIHx8ICEodHlwZW9mIHJlZ0ZhY3Rvci5OaWNrTmFtZSAhPT0gJ3VuZGVmaW5lZCcpIHx8ICFyZWdGYWN0b3IuUHJlZmVyZW5jZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oYG1hbmlwdWxhdGluZyBhIHJlZyBmYWN0b3IgZHVlIHRvIGxhY2sgb2YgZGV0YWlsICR7cmVnRmFjdG9yLlBob25lTnVtYmVyfSwgJHtyZWdGYWN0b3IuUmVnaXN0cmF0aW9uSWR9YCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZvdGVVcmwgPSBgL3YvJHt1bmlxdWVJZC50aW1lKCl9YDtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9nTW9kZWwgPSBhd2FpdCBSZWdpc3RyYXRpb25Mb2dNb2RlbC5maW5kT25lKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdQaG9uZU51bWJlcic6IHJlZ0ZhY3Rvci5QaG9uZU51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICdFdmVudElkJzogZXZlbnQuX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ0FscmVhZHlSZWdpc3RlcmVkRm9yRXZlbnQnOiBmYWxzZVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxvZ01vZGVsICYmICghbG9nTW9kZWwuVm90ZVVybCB8fCBsb2dNb2RlbC5Wb3RlVXJsLmxlbmd0aCA9PT0gMCkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ01vZGVsLlZvdGVVcmwgPSB2b3RlVXJsO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVnRmFjdG9yLlZvdGVVcmwgPSBsb2dNb2RlbC5Wb3RlVXJsO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgbG9nTW9kZWwuc2F2ZSgpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgcmVnRmFjdG9yLk5pY2tOYW1lID0gcmVnSWRNYXBbcmVnRmFjdG9yLlJlZ2lzdHJhdGlvbklkLnRvU3RyaW5nKCldLk5pY2tOYW1lIHx8ICcnO1xuICAgICAgICAgICAgICAgICAgICByZWdGYWN0b3IuUHJlZmVyZW5jZXMgPSByZWdJZE1hcFtyZWdGYWN0b3IuUmVnaXN0cmF0aW9uSWQudG9TdHJpbmcoKV0uUHJlZmVyZW5jZXMgfHwgW107XG4gICAgICAgICAgICAgICAgICAgIHRvU2F2ZUV2ZW50ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHJlZ0ZhY3Rvci5QaG9uZU51bWJlciA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICByZWdGYWN0b3IuUGhvbmVOdW1iZXIgPSByZWdGYWN0b3IuRW1haWw7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgbGV0IHJlZ2lvbkltYWdlID0gbnVsbDtcbiAgICAgICAgICAgICAgICBpZiAocmVnRmFjdG9yLlJlZ2lvbkNvZGUgJiZcbiAgICAgICAgICAgICAgICAgICAgKGV2ZW50LkNvdW50cnkgJiYgZXZlbnQuQ291bnRyeS5jb3VudHJ5X2NvZGUudG9Mb3dlckNhc2UoKSAhPSByZWdGYWN0b3IuUmVnaW9uQ29kZS50b0xvd2VyQ2FzZSgpKSkge1xuICAgICAgICAgICAgICAgICAgICByZWdpb25JbWFnZSA9IGAvaW1hZ2VzL2NvdW50cmllcy80eDMvJHtyZWdGYWN0b3IuUmVnaW9uQ29kZS50b0xvd2VyQ2FzZSgpfS5zdmdgO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGRhdGFzZXQucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIFJlZ2lvbkltYWdlOiByZWdpb25JbWFnZSxcbiAgICAgICAgICAgICAgICAgICAgUGhvbmVOdW1iZXI6IHJlZ0ZhY3Rvci5QaG9uZU51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgVm90ZUZhY3RvcjogcmVnRmFjdG9yLlZvdGVGYWN0b3IsXG4gICAgICAgICAgICAgICAgICAgIFZvdGVVcmw6IHJlZ0ZhY3Rvci5Wb3RlVXJsLFxuICAgICAgICAgICAgICAgICAgICBIYXNoOiByZWdGYWN0b3IuSGFzaCxcbiAgICAgICAgICAgICAgICAgICAgRW1haWw6IHJlZ0ZhY3Rvci5FbWFpbCxcbiAgICAgICAgICAgICAgICAgICAgTmlja05hbWU6IHJlZ0ZhY3Rvci5OaWNrTmFtZSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgUHJlZmVyZW5jZXM6IHJlZ0ZhY3Rvci5QcmVmZXJlbmNlcyxcbiAgICAgICAgICAgICAgICAgICAgU3RhdHVzOiByZWdGYWN0b3IuU3RhdHVzIHx8ICcnLFxuICAgICAgICAgICAgICAgICAgICBJZDogcmVnRmFjdG9yLlJlZ2lzdHJhdGlvbklkLFxuICAgICAgICAgICAgICAgICAgICBIYXNWb3RlZDogIHJlZ1ZvdGVkTWFwW3JlZ0ZhY3Rvci5SZWdpc3RyYXRpb25JZC50b1N0cmluZygpXSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgcmVnVm90ZWRNYXBbcmVnRmFjdG9yLlJlZ2lzdHJhdGlvbklkLnRvU3RyaW5nKCldLkhhc1ZvdGVkLFxuICAgICAgICAgICAgICAgICAgICBWb3RlQ291bnQ6ICByZWdWb3RlZE1hcFtyZWdGYWN0b3IuUmVnaXN0cmF0aW9uSWQudG9TdHJpbmcoKV0gJiZcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlZ1ZvdGVkTWFwW3JlZ0ZhY3Rvci5SZWdpc3RyYXRpb25JZC50b1N0cmluZygpXS5Wb3RlQ291bnQsXG4gICAgICAgICAgICAgICAgICAgIFBlb3BsZVVybDogYCR7cHJvY2Vzcy5lbnYuU0lURV9VUkx9L3AvJHtyZWdGYWN0b3IuUGhvbmVOdW1iZXJ9YFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGFscmVhZHlQdXNoZWRSZWdJZHMucHVzaChyZWdGYWN0b3IuUmVnaXN0cmF0aW9uSWQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0b1NhdmVFdmVudCkge1xuICAgICAgICAgICAgYXdhaXQgZXZlbnQuc2F2ZSgpO1xuICAgICAgICB9XG4gICAgICAgIHJlcy5qc29uKGRhdGFzZXQpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICBsb2dnZXIuaW5mbyhlcnIpO1xuICAgICAgICByZXR1cm4gbmV4dChlcnIpO1xuICAgIH1cbn07XG5cbi8qKlxuICogUFVUIC9cbiAqIGFwaS9FdmVudC97ZXZlbnRJZH0vUmVnaXN0cmF0aW9uXG4gKi9cbmV4cG9ydCBjb25zdCByZWdpc3RlclZvdGVyID0gYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgcmVzLmpzb24oYXdhaXQgUmVnaXN0ZXJWb3RlcihyZXEuYm9keSwgcmVxLnBhcmFtcy5ldmVudElkLCBmYWxzZSwgMSwgdHJ1ZSkpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICByZXR1cm4gbmV4dChlcnIpO1xuICAgIH1cbn07XG5cbi8qKlxuICogUHJvZmlsZSBvZiBhIHVzZXJcbiAqIEBwYXJhbSByZXFcbiAqIEBwYXJhbSByZXNcbiAqIEBwYXJhbSBuZXh0XG4gKi9cbmV4cG9ydCBjb25zdCB2b3RlclByb2ZpbGUgPSBhc3luYyBmdW5jdGlvbihyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHByb2ZpbGVPdXRwdXQgPSBhd2FpdCBnZXRQcm9maWxlKHJlcS5wYXJhbXMudm90ZXJIYXNoKTtcbiAgICAgICAgY29uc3QgcmVnaXN0cmF0aW9uID0gYXdhaXQgUmVnaXN0cmF0aW9uTW9kZWwuZmluZE9uZSh7SGFzaDogcmVxLnBhcmFtcy52b3Rlckhhc2h9KTtcbiAgICAgICAgcmVzLnJlbmRlcignYXBwX3Byb2ZpbGUnLCB7XG4gICAgICAgICAgICB0aXRsZTogJ1Byb2ZpbGUnLFxuICAgICAgICAgICAgcGhvbmVOdW1iZXI6IHJlZ2lzdHJhdGlvbiAmJiByZWdpc3RyYXRpb24uUGhvbmVOdW1iZXIsXG4gICAgICAgICAgICBuaWNrTmFtZTogcmVnaXN0cmF0aW9uICYmIHJlZ2lzdHJhdGlvbi5OaWNrTmFtZSxcbiAgICAgICAgICAgIEV2ZW50c0F0dGVuZGVkOiBwcm9maWxlT3V0cHV0LnRvdGFsRXZlbnRzLFxuICAgICAgICAgICAgVm90ZXNDYXN0OiBwcm9maWxlT3V0cHV0LnRvdGFsVm90ZXMsXG4gICAgICAgICAgICBCaWRzOiAnLScsXG4gICAgICAgICAgICBFdmVudHM6IHByb2ZpbGVPdXRwdXQuRXZlbnRzLFxuICAgICAgICAgICAgSGlkZUxvZ291dDogdHJ1ZVxuICAgICAgICB9KTtcbiAgICB9XG4gICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIG5leHQoZSk7XG4gICAgfVxufTtcblxuXG5cbi8qKlxuICogQ2FsY3VsYXRlIHVzZXIncyB2b3RlIGZhY3RvclxuICogQHBhcmFtIHBob25lTnVtYmVyXG4gKi9cbmV4cG9ydCBjb25zdCBjYWxjdWxhdGVVc2VyVm90ZUZhY3RvciA9IGFzeW5jIGZ1bmN0aW9uIChwaG9uZU51bWJlcjogU3RyaW5nKSB7XG4gICAgY29uc3Qgdm90ZUNvdW50ID0gYXdhaXQgVm90aW5nTG9nTW9kZWwuZmluZCh7XG4gICAgICAgICdQaG9uZU51bWJlcic6IHBob25lTnVtYmVyLFxuICAgICAgICAnU3RhdHVzJzogJ1ZPVEVfQUNDRVBURUQnXG4gICAgfSkuY291bnREb2N1bWVudHMoKTtcbiAgICAvLyBNYWtlIGl0IGVkaXRhYmxlIGJ5IGFkbWluXG4gICAgY29uc3QgY2FsY3VsYXRlVm90ZUZhY3RvciA9IGZ1bmN0aW9uKHBhc3RWb3RlOiBudW1iZXIpIHtcbiAgICAgICAgcmV0dXJuIE1hdGgucm91bmQoKDEgKyAocGFzdFZvdGUgLyAxNCkpICogMTAwKSAvIDEwMDtcbiAgICB9O1xuXG4gICAgbGV0IHZvdGVGYWN0b3JWYWwgPSBjYWxjdWxhdGVWb3RlRmFjdG9yKHZvdGVDb3VudCk7XG4gICAgaWYgKHZvdGVGYWN0b3JWYWwgPiA1KSB7XG4gICAgICAgIHZvdGVGYWN0b3JWYWwgPSA1O1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgICByZXN1bHQ6IHZvdGVGYWN0b3JWYWwsXG4gICAgICAgIHZvdGVDb3VudDogdm90ZUNvdW50XG4gICAgfTtcbn07XG5cbmV4cG9ydCBjb25zdCBzZWxmUmVnaXN0ZXIgPSBhc3luYyBmdW5jdGlvbiAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICBsZXQgc2VydmVyTnVtYmVyO1xuICAgIHRyeSB7XG4gICAgICAgIC8vIFwiUE9TVCAvYXBpL3JlZ2lzdGVyIEhUVFAvMS4xXFxcIiAyMDAgLSBcXFwiLVxcXCIgXFxcIkFydCUyMEJhdHRsZS8yMyBDRk5ldHdvcmsvMTEwNy4xIERhcndpbi8xOS4wLjBcXFwiXCJcbiAgICAgICAgLy8ge1wibWVzc2FnZVwiOlwiOjpmZmZmOjEyNy4wLjAuMSAtIC0gWzEwL09jdC8yMDE5OjE0OjUwOjU2ICswMDAwXSBcXFwiUE9TVCAvYXBpL3JlZ2lzdGVyIEhUVFAvMS4xXFxcIiAyMDAgLSBcXFwiLVxcXCIgXFxcIm9raHR0cC8zLjMuMFxcXCJcIixcImxldmVsXCI6XCJpbmZvXCJ9XG4gICAgICAgIGNvbnN0IHVzZXJBZ2VudEhlYWRlciA9IHJlcS5oZWFkZXIoJ3VzZXItYWdlbnQnKTtcbiAgICAgICAgbGV0IGlzV2ViID0gZmFsc2U7XG4gICAgICAgIGxldCBpc0lvcyA9IGZhbHNlO1xuICAgICAgICBsZXQgaXNBbmRyb2lkID0gZmFsc2U7XG4gICAgICAgIGlmICh1c2VyQWdlbnRIZWFkZXIuaW5kZXhPZignQmF0dGxlJykgPiAtMSkge1xuICAgICAgICAgICAgaXNJb3MgPSB0cnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHVzZXJBZ2VudEhlYWRlci5pbmRleE9mKCdva2h0dHAnKSA+IC0xKSB7XG4gICAgICAgICAgICBpc0FuZHJvaWQgPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaXNXZWIgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGV2ZW50SWQgPSByZXEuYm9keS5ldmVudElkO1xuICAgICAgICBjb25zdCB1c2VySWQgPSByZXEudXNlciAmJiByZXEudXNlci5faWQ7XG4gICAgICAgIGNvbnN0IGJvZHkgPSByZXEuYm9keTtcbiAgICAgICAgbGV0IHZlcmlmaWVkID0gZmFsc2U7XG4gICAgICAgIGlmICh1c2VySWQpIHtcbiAgICAgICAgICAgIHZlcmlmaWVkID0gdHJ1ZTtcbiAgICAgICAgICAgIGJvZHkuUGhvbmVOdW1iZXIgPSByZXEudXNlci5QaG9uZU51bWJlcjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZWdpc3RyYXRpb25SZXNwb25zZSA9IGF3YWl0IFJlZ2lzdGVyVm90ZXIoYm9keSwgZXZlbnRJZCwgdHJ1ZSwgMC4xLCB2ZXJpZmllZCwgdXNlcklkKTtcbiAgICAgICAgaWYgKHJlZ2lzdHJhdGlvblJlc3BvbnNlLkRhdGEuVmVyaWZpY2F0aW9uQ29kZSA+IDApIHtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBzZW5kaW5nIG90cCBzbXMgJHtyZWdpc3RyYXRpb25SZXNwb25zZS5EYXRhLlZlcmlmaWNhdGlvbkNvZGV9YCk7XG4gICAgICAgICAgICBsZXQgYm9keSA9IGBQbGVhc2UgdXNlICR7cmVnaXN0cmF0aW9uUmVzcG9uc2UuRGF0YS5WZXJpZmljYXRpb25Db2RlfSB0byBsb2dpbmA7XG4gICAgICAgICAgICBpZiAoaXNBbmRyb2lkKSB7XG4gICAgICAgICAgICAgICAgYm9keSA9IGA8Iz4gJHtib2R5fSBZT0lwWUNKUHduVmA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZXJ2ZXJOdW1iZXIgPSByZWdpc3RyYXRpb25SZXNwb25zZS5EYXRhLlNlcnZlclBob25lTnVtYmVyO1xuICAgICAgICAgICAgY29uc3QgdHdpbGlvQ2xpZW50ID0gVHdpbGlvKCk7XG4gICAgICAgICAgICBhd2FpdCB0d2lsaW9DbGllbnQubWVzc2FnZXMuY3JlYXRlKHtcbiAgICAgICAgICAgICAgICBmcm9tOiBzZXJ2ZXJOdW1iZXIsXG4gICAgICAgICAgICAgICAgdG86IHJlZ2lzdHJhdGlvblJlc3BvbnNlLkRhdGEuUGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgYm9keTogYm9keSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcG9zdFRvU2xhY2tTTVNGbG9vZCh7XG4gICAgICAgICAgICAgICAgJ3RleHQnOiBgJHtyZWdpc3RyYXRpb25SZXNwb25zZS5EYXRhLk5pY2tOYW1lfSgke3JlZ2lzdHJhdGlvblJlc3BvbnNlLkRhdGEuUGhvbmVOdW1iZXJ9KSAoc21zKSBcXG4ke2JvZHl9ICBzb3VyY2U6IHJlZ2lzdGVyLnRzLnNlbGZSZWdpc3RlcmBcbiAgICAgICAgICAgIH0pLmNhdGNoKCgpID0+IGxvZ2dlci5lcnJvcihgc2VsZiByZWdpc3RlciBzbGFjayBmbG9vZCBjYWxsIGZhaWxlZCAkeyBib2R5IH0gc291cmNlOiByZWdpc3Rlci50cy5zZWxmUmVnaXN0ZXJgKSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZG9uJ3Qgc2VuZCBvdHAgdG8gY2xpZW50XG4gICAgICAgIHJlZ2lzdHJhdGlvblJlc3BvbnNlLkRhdGEuVmVyaWZpY2F0aW9uQ29kZSA9IG51bGw7XG4gICAgICAgIHJlZ2lzdHJhdGlvblJlc3BvbnNlLkRhdGEuVmVyaWZpY2F0aW9uQ29kZUV4cCA9IG51bGw7XG4gICAgICAgIC8vIGlmIGV4cCB0aW1lIG5vdCBkZWZpbmVkIHRoZW4gMSB5ZWFyXG4gICAgICAgIHJlZ2lzdHJhdGlvblJlc3BvbnNlLkRhdGEuSldUID0gc2lnbih7XG4gICAgICAgICAgICByZWdpc3RyYXRpb25JZDogcmVnaXN0cmF0aW9uUmVzcG9uc2UuRGF0YS5SZWdpc3RyYXRpb25JZCxcbiAgICAgICAgfSwgcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVCwgIHsgZXhwaXJlc0luOiBwcm9jZXNzLmVudi5KV1RfRVhQX1RJTUUgfHwgJzF5J30pO1xuICAgICAgICByZXMuanNvbihyZWdpc3RyYXRpb25SZXNwb25zZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAoIWUubWVzc2FnZSkge1xuICAgICAgICAgICAgZSA9IHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBlLFxuICAgICAgICAgICAgICAgIHN0YXR1czogNTAwXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufTtcblxuZXhwb3J0IGNvbnN0IHZlcmlmeU90cCA9IGFzeW5jIGZ1bmN0aW9uIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCd2ZXJpZnlPVFBCb2R5JywgSlNPTi5zdHJpbmdpZnkocmVxLmJvZHksIG51bGwsIDEpKTtcbiAgICAgICAgY29uc3QgcmVnaXN0cmF0aW9uSWQgPSByZXEuYm9keS5yZWdpc3RyYXRpb25JZDtcbiAgICAgICAgY29uc3Qgb3RwID0gcGFyc2VJbnQocmVxLmJvZHkub3RwKTtcbiAgICAgICAgLy8gY29uc3QgZGV2aWNlVG9rZW4gPSByZXEuYm9keS5kZXZpY2VUb2tlbjtcbiAgICAgICAgY29uc3QgZXZlbnRJZCA9IHJlcS5ib2R5LmV2ZW50SWQ7XG4gICAgICAgIGNvbnN0IHJlZ2lzdHJhdGlvbiA9IGF3YWl0IFJlZ2lzdHJhdGlvbk1vZGVsLmZpbmRCeUlkKHJlZ2lzdHJhdGlvbklkKTtcbiAgICAgICAgaWYgKHJlcS5ib2R5LmFuZHJvaWREZXZpY2VUb2tlbikge1xuICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHJlZ2lzdHJhdGlvbi5BbmRyb2lkRGV2aWNlVG9rZW5zKSkge1xuICAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi5BbmRyb2lkRGV2aWNlVG9rZW5zID0gcmVnaXN0cmF0aW9uLkFuZHJvaWREZXZpY2VUb2tlbnMgfHwgW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZWdpc3RyYXRpb24uQW5kcm9pZERldmljZVRva2Vucy5wdXNoKHJlcS5ib2R5LmFuZHJvaWREZXZpY2VUb2tlbik7XG4gICAgICAgICAgICBhd2FpdCByZWdpc3RyYXRpb24uc2F2ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghcmVnaXN0cmF0aW9uKSB7XG4gICAgICAgICAgICBuZXh0KHtcbiAgICAgICAgICAgICAgICBzdGF0dXM6IDQwMyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnSW52YWxpZCBSZWdpc3RyYXRpb24gaWQnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiA7XG4gICAgICAgIH1cbiAgICAgICAgbG9nZ2VyLmluZm8ocmVnaXN0cmF0aW9uLlZlcmlmaWNhdGlvbkNvZGVFeHApO1xuICAgICAgICBpZiAoIG5ldyBEYXRlKHJlZ2lzdHJhdGlvbi5WZXJpZmljYXRpb25Db2RlRXhwKS5nZXRUaW1lKCkgPCBuZXcgRGF0ZSgpLmdldFRpbWUoKSkge1xuICAgICAgICAgICAgbmV4dCh7XG4gICAgICAgICAgICAgICAgc3RhdHVzOiA0MDMsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ09UUCBleHBpcmVkJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gO1xuICAgICAgICB9XG4gICAgICAgIGlmICggcmVnaXN0cmF0aW9uLlZlcmlmaWNhdGlvbkNvZGUgIT09IG90cCApIHtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKHJlZ2lzdHJhdGlvbi5WZXJpZmljYXRpb25Db2RlLnRvU3RyaW5nKCksIG90cCk7XG4gICAgICAgICAgICBuZXh0KHtcbiAgICAgICAgICAgICAgICBzdGF0dXM6IDQwMyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnSW52YWxpZCBPVFAnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiA7XG4gICAgICAgIH1cbiAgICAgICAgaW50ZXJmYWNlIFJlc3BvbnNlRHRvIHtcbiAgICAgICAgICAgIE1lc3NhZ2U6IFN0cmluZztcbiAgICAgICAgICAgIEpXVDogU3RyaW5nO1xuICAgICAgICAgICAgTmlja05hbWU6IFN0cmluZztcbiAgICAgICAgICAgIEVtYWlsOiBTdHJpbmc7XG4gICAgICAgICAgICBGaXJzdE5hbWU6IFN0cmluZztcbiAgICAgICAgICAgIExhc3ROYW1lOiBTdHJpbmc7XG4gICAgICAgICAgICBOYW1lOiBTdHJpbmc7XG4gICAgICAgICAgICBBcnRCYXR0bGVOZXdzOiBib29sZWFuO1xuICAgICAgICAgICAgTm90aWZpY2F0aW9uRW1haWxzOiBib29sZWFuO1xuICAgICAgICAgICAgTG95YWx0eU9mZmVyczogYm9vbGVhbjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBmaXJzdE5hbWUgPSByZWdpc3RyYXRpb24uRmlyc3ROYW1lIHx8ICcnO1xuICAgICAgICBjb25zdCBsYXN0TmFtZSA9IHJlZ2lzdHJhdGlvbi5MYXN0TmFtZSB8fCAnJztcbiAgICAgICAgbGV0IG5hbWUgPSAnJztcbiAgICAgICAgaWYgKGZpcnN0TmFtZSAmJiBmaXJzdE5hbWUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbmFtZSArPSBmaXJzdE5hbWUgKyAnICc7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGxhc3ROYW1lICYmIGxhc3ROYW1lLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIG5hbWUgKz0gbGFzdE5hbWU7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGNvbnN0IHJlc3VsdDogRGF0YU9wZXJhdGlvblJlc3VsdDxSZXNwb25zZUR0bz4gPSB7XG4gICAgICAgICAgICBTdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgRGF0YToge1xuICAgICAgICAgICAgICAgIE1lc3NhZ2U6ICdWZXJpZmljYXRpb24gU3VjY2Vzc2Z1bCcsXG4gICAgICAgICAgICAgICAgSldUOiBzaWduKHtcbiAgICAgICAgICAgICAgICAgICAgcmVnaXN0cmF0aW9uSWQ6IHJlZ2lzdHJhdGlvbklkXG4gICAgICAgICAgICAgICAgfSwgcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVCksXG4gICAgICAgICAgICAgICAgTmlja05hbWU6IGZpcnN0TmFtZSB8fCBsYXN0TmFtZSB8fCByZWdpc3RyYXRpb24uTmlja05hbWUgfHwgcmVnaXN0cmF0aW9uLkRpc3BsYXlQaG9uZSxcbiAgICAgICAgICAgICAgICBGaXJzdE5hbWU6IGZpcnN0TmFtZSxcbiAgICAgICAgICAgICAgICBMYXN0TmFtZTogbGFzdE5hbWUsXG4gICAgICAgICAgICAgICAgTmFtZTogbmFtZS50cmltKCksXG4gICAgICAgICAgICAgICAgRW1haWw6IHJlZ2lzdHJhdGlvbi5FbWFpbCB8fCAnJyxcbiAgICAgICAgICAgICAgICBBcnRCYXR0bGVOZXdzOiByZWdpc3RyYXRpb24uQXJ0QmF0dGxlTmV3cyB8fCBmYWxzZSxcbiAgICAgICAgICAgICAgICBOb3RpZmljYXRpb25FbWFpbHM6IHJlZ2lzdHJhdGlvbi5Ob3RpZmljYXRpb25FbWFpbHMgfHwgZmFsc2UsXG4gICAgICAgICAgICAgICAgTG95YWx0eU9mZmVyczogcmVnaXN0cmF0aW9uLkxveWFsdHlPZmZlcnMgfHwgZmFsc2VcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmVzLmNvb2tpZSgnand0JywgcmVzdWx0LkRhdGEuSldULCB7XG4gICAgICAgICAgICBodHRwT25seTogdHJ1ZSxcbiAgICAgICAgICAgIHNhbWVTaXRlOiB0cnVlLFxuICAgICAgICAgICAgc2lnbmVkOiB0cnVlLFxuICAgICAgICAgICAgc2VjdXJlOiB0cnVlLFxuICAgICAgICAgICAgZG9tYWluOiAnYXJ0YmF0dGxlLmNvbScsXG4gICAgICAgICAgICBwYXRoOiAnLydcbiAgICAgICAgfSk7XG4gICAgICAgIHJlcy5qc29uKHJlc3VsdCk7IC8vIHJlc3BvbnNlIHNlbnRcbiAgICAgICAgLy8gcG9zdCBwcm9jZXNzaW5nXG4gICAgICAgIGlmIChldmVudElkICE9PSAnZHVtbXknKSB7XG4gICAgICAgICAgICBjb25zdCBldmVudCA9IGF3YWl0IEV2ZW50TW9kZWwuZmluZEJ5SWQoZXZlbnRJZCk7XG4gICAgICAgICAgICBjb25zdCBsb2dPYmogPSAgbmV3IFJlZ2lzdHJhdGlvbkxvZ01vZGVsKCk7XG4gICAgICAgICAgICBsb2dPYmouRmlyc3ROYW1lID0gcmVnaXN0cmF0aW9uLkZpcnN0TmFtZTtcbiAgICAgICAgICAgIGxvZ09iai5MYXN0TmFtZSA9IHJlZ2lzdHJhdGlvbi5MYXN0TmFtZTtcbiAgICAgICAgICAgIGxvZ09iai5FbWFpbCA9IHJlZ2lzdHJhdGlvbi5FbWFpbDtcbiAgICAgICAgICAgIGxvZ09iai5QaG9uZU51bWJlciA9IHJlZ2lzdHJhdGlvbi5QaG9uZU51bWJlcjtcbiAgICAgICAgICAgIGxvZ09iai5QaG9uZU51bWJlckhhc2ggPSByZWdpc3RyYXRpb24uSGFzaDtcbiAgICAgICAgICAgIGxvZ09iai5EaXNwbGF5UGhvbmUgPSByZWdpc3RyYXRpb24uRGlzcGxheVBob25lO1xuICAgICAgICAgICAgbG9nT2JqLlZvdGVVcmwgPSBgL3YvJHt1bmlxdWVJZC50aW1lKCl9YDtcbiAgICAgICAgICAgIGxvZ09iai5BdWN0aW9uVXJsID0gYCR7cHJvY2Vzcy5lbnYuU0hPUlRfU0lURV9VUkx9L2Evci8ke3JlZ2lzdHJhdGlvbi5IYXNofWA7XG4gICAgICAgICAgICBsb2dPYmouUmVnaXN0ZXJlZEF0ID0gJ2FwcCc7XG5cbiAgICAgICAgICAgIC8vIHJlZ2lzdHJhdGlvbi5EZXZpY2VUb2tlbnMucHVzaChkZXZpY2VUb2tlbik7XG4gICAgICAgICAgICByZWdpc3RyYXRpb24uVmVyaWZpY2F0aW9uQ29kZSA9IG51bGw7XG4gICAgICAgICAgICByZWdpc3RyYXRpb24uVmVyaWZpY2F0aW9uQ29kZUV4cCA9IG51bGw7XG4gICAgICAgICAgICBhd2FpdCByZWdpc3RyYXRpb24uc2F2ZSgpO1xuXG4gICAgICAgICAgICBjb25zdCBldmVudFJlZ2lzdHJhdGlvbiA9IGV2ZW50LlJlZ2lzdHJhdGlvbnMuZmluZChyaWQgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWdpc3RyYXRpb24uX2lkLmVxdWFscyhyaWQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoZXZlbnRSZWdpc3RyYXRpb24pIHtcbiAgICAgICAgICAgICAgICAvLyB1c2VyIGlzIGFscmVhZHkgcmVnaXN0ZXJlZCBpbiB0aGUgZXZlbnRcbiAgICAgICAgICAgICAgICByZXR1cm4gO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgdXNlclZvdGVGYWN0b3IgPSB7XG4gICAgICAgICAgICAgICAgUmVnaXN0cmF0aW9uSWQ6IHJlZ2lzdHJhdGlvbi5faWQsXG4gICAgICAgICAgICAgICAgVm90ZUZhY3RvcjogMC4xLFxuICAgICAgICAgICAgICAgIFZvdGVGYWN0b3JJbmZvOiB7XG4gICAgICAgICAgICAgICAgICAgIFR5cGU6ICdBcHAtT2Zmc2hvcmUnLFxuICAgICAgICAgICAgICAgICAgICBWYWx1ZTogYCR7MC4xfWBcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIFBob25lTnVtYmVyOiByZWdpc3RyYXRpb24uUGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgSGFzaDogcmVnaXN0cmF0aW9uLkhhc2gsXG4gICAgICAgICAgICAgICAgVm90ZVVybDogbG9nT2JqLlZvdGVVcmwsXG4gICAgICAgICAgICAgICAgRW1haWw6IHJlZ2lzdHJhdGlvbi5FbWFpbCxcbiAgICAgICAgICAgICAgICBSZWdpb25Db2RlOiByZWdpc3RyYXRpb24uUmVnaW9uQ29kZSxcbiAgICAgICAgICAgICAgICBGcm9tOiAnYXBwLWdsb2JhbCcsXG4gICAgICAgICAgICAgICAgTmlja05hbWU6IHJlZ2lzdHJhdGlvbi5OaWNrTmFtZSxcbiAgICAgICAgICAgICAgICBQcmVmZXJlbmNlczogcmVnaXN0cmF0aW9uLlByZWZlcmVuY2VzLFxuICAgICAgICAgICAgICAgIFN0YXR1czogJycsXG4gICAgICAgICAgICAgICAgQXVjdGlvblVybDogbG9nT2JqLkF1Y3Rpb25VcmxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAoIWV2ZW50LlJlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yKSB7XG4gICAgICAgICAgICAgICAgZXZlbnQuUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3IgPSBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGV2ZW50LlJlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yLnB1c2godXNlclZvdGVGYWN0b3IpO1xuICAgICAgICAgICAgZXZlbnQuUmVnaXN0cmF0aW9ucy5wdXNoKHJlZ2lzdHJhdGlvbik7XG4gICAgICAgICAgICBsb2dPYmouQWxyZWFkeVJlZ2lzdGVyZWRGb3JFdmVudCA9IGZhbHNlO1xuICAgICAgICAgICAgYXdhaXQgZXZlbnQuc2F2ZSgpOyAvLyB1c2VyIGlzIG5vdyByZWdpc3RlcmVkIGluIGV2ZW50XG4gICAgICAgICAgICBhd2FpdCBsb2dPYmouc2F2ZSgpOyAvLyB1c2VyJ3MgaW5mbyBpcyBpbiByZWdpc3RyYXRpb24gbG9nIG5vd1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBuZXh0KGUpO1xuICAgIH1cbn07XG5cbmV4cG9ydCBjb25zdCBzZXROaWNrTmFtZSA9IGFzeW5jIGZ1bmN0aW9uIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikge1xuICAgIGxvZ2dlci5pbmZvKGBzZXROaWNrTmFtZSBib2R5ICR7cmVxLmJvZHkgPyBKU09OLnN0cmluZ2lmeShyZXEuYm9keSwgbnVsbCwgMSkgOiByZXEuYm9keX1cbiAgICB1c2VyICR7cmVxLnVzZXIgPyBKU09OLnN0cmluZ2lmeShyZXEudXNlciwgbnVsbCwgMSkgOiAnJ31gKTtcbiAgICB0cnkge1xuICAgICAgICBpZiAocmVxLmJvZHkgLyomJiByZXEuYm9keS5uaWNrTmFtZSAmJiByZXEuYm9keS5uaWNrTmFtZS5sZW5ndGggPiAwKi8gJiYgcmVxLnVzZXIpIHtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBzYXZpbmcgJHtyZXEuYm9keS5uaWNrTmFtZX0gb2YgJHtyZXEudXNlcn1gKTtcbiAgICAgICAgICAgIGNvbnN0IHJlZ2lzdHJhdGlvbiA9IHJlcS51c2VyO1xuICAgICAgICAgICAgY29uc3QgTmFtZSA9IHJlcS5ib2R5Lk5hbWUgJiYgcmVxLmJvZHkuTmFtZS5zcGxpdCgnICcpO1xuICAgICAgICAgICAgaWYgKE5hbWUpIHtcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24uRmlyc3ROYW1lID0gTmFtZVswXTtcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24uTGFzdE5hbWUgPSBOYW1lWzFdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJlcS5ib2R5Lk5pY2tOYW1lICYmIHJlcS5ib2R5Lk5pY2tOYW1lLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24uTmlja05hbWUgPSByZXEuYm9keS5uaWNrTmFtZSB8fCAnJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZXEuYm9keS5FbWFpbCAmJiByZXEuYm9keS5FbWFpbC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgcmVnaXN0cmF0aW9uLkVtYWlsID0gcmVxLmJvZHkuRW1haWw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVxLmJvZHkuQ29vcmRpbmF0ZXMgJiYgQXJyYXkuaXNBcnJheShyZXEuYm9keS5Db29yZGluYXRlcykpIHtcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24uTG9jYXRpb24uY29vcmRpbmF0ZXMgPSByZXEuYm9keS5Db29yZGluYXRlcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZXEuYm9keS5EZXZpY2VUb2tlbiAmJiByZXEuYm9keS5EZXZpY2VUeXBlID09PSAnYW5kcm9pZCcpIHtcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24uQW5kcm9pZERldmljZVRva2Vucy5wdXNoKHJlcS5ib2R5LkRldmljZVRva2VuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZXEuYm9keS5EZXZpY2VUb2tlbiAmJiByZXEuYm9keS5EZXZpY2VUeXBlID09PSAnaW9zJykge1xuICAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi5EZXZpY2VUb2tlbnMucHVzaChyZXEuYm9keS5EZXZpY2VUb2tlbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVxLmJvZHkuaGFzT3duUHJvcGVydHkoJ05vdGlmaWNhdGlvbkVtYWlscycpKSB7XG4gICAgICAgICAgICAgICAgcmVnaXN0cmF0aW9uLk5vdGlmaWNhdGlvbkVtYWlscyA9IHJlcS5ib2R5Lk5vdGlmaWNhdGlvbkVtYWlscyB8fCBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChyZXEuYm9keS5oYXNPd25Qcm9wZXJ0eSgnTG95YWx0eU9mZmVycycpKSB7XG4gICAgICAgICAgICAgICAgcmVnaXN0cmF0aW9uLkxveWFsdHlPZmZlcnMgPSByZXEuYm9keS5Mb3lhbHR5T2ZmZXJzIHx8IGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJlcS5ib2R5Lmhhc093blByb3BlcnR5KCdBcnRCYXR0bGVOZXdzJykpIHtcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24uQXJ0QmF0dGxlTmV3cyA9IHJlcS5ib2R5LkFydEJhdHRsZU5ld3MgfHwgZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhd2FpdCByZWdpc3RyYXRpb24uc2F2ZSgpO1xuICAgICAgICAgICAgaW50ZXJmYWNlIFJlc3BvbnNlRHRvIHtcbiAgICAgICAgICAgICAgICBNZXNzYWdlOiBTdHJpbmc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8UmVzcG9uc2VEdG8+ID0ge1xuICAgICAgICAgICAgICAgIFN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICAgICAgRGF0YToge1xuICAgICAgICAgICAgICAgICAgICBNZXNzYWdlOiAnUHJvZmlsZSBzYXZlZCdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmVzLmpzb24ocmVzdWx0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5leHQoe1xuICAgICAgICAgICAgICAgIHN0YXR1czogNDAwLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdJbnZhbGlkIHBheWxvYWQnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgZS5zdGF0dXMgPSBlLnN0YXR1cyB8fCA1MDA7XG4gICAgICAgIG5leHQgKGUpO1xuICAgIH1cbn07XG5cbmV4cG9ydCBjb25zdCBzYXZlU2V0dGluZ3MgPSBhc3luYyBmdW5jdGlvbiAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBwcmVmZXJlbmNlczoge1xuICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgIHByZWZlcmVuY2U6IHN0cmluZztcbiAgICAgICAgICAgICAgICBpZDogYW55O1xuICAgICAgICAgICAgICAgIGVuYWJsZWQ6IGJvb2xlYW47XG4gICAgICAgICAgICB9W107XG4gICAgICAgICAgICBkZXZpY2VUb2tlbjogc3RyaW5nO1xuICAgICAgICAgICAgYW5kcm9pZERldmljZVRva2VuOiBzdHJpbmc7XG4gICAgICAgIH0gPSByZXEuYm9keTtcbiAgICAgICAgY29uc3QgdXNlclByZWZlcmVuY2VzID0gcmVxLnVzZXIuUHJlZmVyZW5jZXM7XG4gICAgICAgIGNvbnN0IHByZWZlcmVuY2VMZW5ndGggPSBwcmVmZXJlbmNlcy5kYXRhLmxlbmd0aDtcbiAgICAgICAgaWYgKHByZWZlcmVuY2VMZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByZWZlcmVuY2VMZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHByZWZlcmVuY2VJbmRleCA9IHVzZXJQcmVmZXJlbmNlcy5pbmRleE9mKHByZWZlcmVuY2VzLmRhdGFbaV0uaWQpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGlzUHJlZmVyZW5jZUV4aXN0ID0gcHJlZmVyZW5jZUluZGV4ID4gLTE7XG4gICAgICAgICAgICAgICAgaWYgKHByZWZlcmVuY2VzLmRhdGFbaV0uZW5hYmxlZCAmJiAhaXNQcmVmZXJlbmNlRXhpc3QpIHtcbiAgICAgICAgICAgICAgICAgICAgdXNlclByZWZlcmVuY2VzLnB1c2gocHJlZmVyZW5jZXMuZGF0YVtpXS5pZCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpc1ByZWZlcmVuY2VFeGlzdCAmJiAhcHJlZmVyZW5jZXMuZGF0YVtpXS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHVzZXJQcmVmZXJlbmNlcy5zcGxpY2UodXNlclByZWZlcmVuY2VzLmluZGV4T2YocHJlZmVyZW5jZXMuZGF0YVtpXS5pZCksIDEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChwcmVmZXJlbmNlcy5kZXZpY2VUb2tlbiAmJiBwcmVmZXJlbmNlcy5kZXZpY2VUb2tlbiAhPT0gJ251bGwnICYmXG4gICAgICAgICAgICAgICAgcmVxLnVzZXIuRGV2aWNlVG9rZW5zLmluZGV4T2YocHJlZmVyZW5jZXMuZGV2aWNlVG9rZW4pID09PSAtMSkge1xuICAgICAgICAgICAgICAgIC8vIGlmIGl0IGRvZXMgbm90IGV4aXN0IHRoZW4gaW5zZXJ0IGl0XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oYHZhbGlkIHByZWZlcmVuY2VzLmRldmljZVRva2VuLCAke3ByZWZlcmVuY2VzLmRldmljZVRva2VufWApO1xuICAgICAgICAgICAgICAgIHJlcS51c2VyLkRldmljZVRva2Vucy5wdXNoKHByZWZlcmVuY2VzLmRldmljZVRva2VuKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHJlZmVyZW5jZXMuYW5kcm9pZERldmljZVRva2VuICYmIHByZWZlcmVuY2VzLmFuZHJvaWREZXZpY2VUb2tlbiAhPT0gJ251bGwnICYmXG4gICAgICAgICAgICAgICAgcmVxLnVzZXIuQW5kcm9pZERldmljZVRva2Vucy5pbmRleE9mKHByZWZlcmVuY2VzLmFuZHJvaWREZXZpY2VUb2tlbikgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgLy8gaWYgaXQgZG9lcyBub3QgZXhpc3QgdGhlbiBpbnNlcnQgaXRcbiAgICAgICAgICAgICAgICBsb2dnZXIuaW5mbyhgdmFsaWQgcHJlZmVyZW5jZXMuQW5kcm9pZERldmljZVRva2VuLCAke3ByZWZlcmVuY2VzLmFuZHJvaWREZXZpY2VUb2tlbn1gKTtcbiAgICAgICAgICAgICAgICByZXEudXNlci5BbmRyb2lkRGV2aWNlVG9rZW5zLnB1c2gocHJlZmVyZW5jZXMuYW5kcm9pZERldmljZVRva2VuKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oYGludmFsaWQgcHJlZmVyZW5jZXMuZGV2aWNlVG9rZW4sICR7cHJlZmVyZW5jZXMuZGV2aWNlVG9rZW4gfHwgcHJlZmVyZW5jZXMuYW5kcm9pZERldmljZVRva2VufWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXdhaXQgcmVxLnVzZXIuc2F2ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlc3A6IERhdGFPcGVyYXRpb25SZXN1bHQ8e1xuICAgICAgICAgICAgTWVzc2FnZTogU3RyaW5nXG4gICAgICAgIH0+ID0ge1xuICAgICAgICAgICAgU3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgIERhdGE6IHtcbiAgICAgICAgICAgICAgICBNZXNzYWdlOiAnUHJlZmVyZW5jZXMgc2F2ZWQgc3VjY2Vzc2Z1bGx5J1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICByZXMuanNvbihyZXNwKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGdldFNldHRpbmdzID0gYXN5bmMgZnVuY3Rpb24gKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgdXNlclByZWZlcmVuY2VzID0gcmVxLnVzZXIuUHJlZmVyZW5jZXM7XG4gICAgICAgIGNvbnN0IGV2ZW50SWQgPSByZXEucXVlcnkuZXZlbnRJZDtcbiAgICAgICAgbGV0IGNvdW50cnkgPSAnQ2FuYWRhJztcbiAgICAgICAgbGV0IHRpdGxlID0gJyc7XG4gICAgICAgIGlmIChldmVudElkKSB7XG4gICAgICAgICAgICBjb25zdCBldmVudCA9IGF3YWl0IEV2ZW50TW9kZWwuZmluZEJ5SWQoZXZlbnRJZCkuc2VsZWN0KFsnQ291bnRyeScsICdOYW1lJ10pLnBvcHVsYXRlKCdDb3VudHJ5Jyk7XG4gICAgICAgICAgICBjb3VudHJ5ID0gZXZlbnQuQ291bnRyeSAmJiBldmVudC5Db3VudHJ5LmNvdW50cnlfbmFtZSB8fCBjb3VudHJ5O1xuICAgICAgICAgICAgdGl0bGUgPSBldmVudC5OYW1lO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHByZWZlcmVuY2VzID0gYXdhaXQgUHJlZmVyZW5jZU1vZGVsLmZpbmQoe1xuICAgICAgICAgICAgRW5hYmxlZDogdHJ1ZVxuICAgICAgICB9KTtcbiAgICAgICAgaW50ZXJmYWNlIFJlc3BvbnNlRHRvIHtcbiAgICAgICAgICAgIE1lc3NhZ2U6IHN0cmluZztcbiAgICAgICAgICAgIFByZWZlcmVuY2VzOiB7XG4gICAgICAgICAgICAgICAgcHJlZmVyZW5jZTogc3RyaW5nO1xuICAgICAgICAgICAgICAgIGlkOiBzdHJpbmc7XG4gICAgICAgICAgICAgICAgZW5hYmxlZDogYm9vbGVhbjtcbiAgICAgICAgICAgIH1bXTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHQ6IFJlc3BvbnNlRHRvID0ge1xuICAgICAgICAgICAgTWVzc2FnZTogJ1ByZWZlcmVuY2VzIGZldGNoZWQgc3VjY2Vzc2Z1bGx5JyxcbiAgICAgICAgICAgIFByZWZlcmVuY2VzOiBbXVxuICAgICAgICB9O1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByZWZlcmVuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAocHJlZmVyZW5jZXNbaV0uVHlwZSA9PT0gJ0NvdW50cnlSZWdpc3RlcmVkJykge1xuICAgICAgICAgICAgICAgIHByZWZlcmVuY2VzW2ldLlByZWZlcmVuY2UgPSBwcmVmZXJlbmNlc1tpXS5QcmVmZXJlbmNlLnJlcGxhY2UoJ3tFdmVudENvdW50cnl9JywgY291bnRyeSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHByZWZlcmVuY2VzW2ldLlR5cGUgPT09ICdFdmVudFJlZ2lzdGVyZWQnICYmIHRpdGxlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBwcmVmZXJlbmNlc1tpXS5QcmVmZXJlbmNlID0gYFZvdGluZyBpbiAke3RpdGxlfWA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHQuUHJlZmVyZW5jZXNbaV0gPSB7XG4gICAgICAgICAgICAgICAgcHJlZmVyZW5jZTogcHJlZmVyZW5jZXNbaV0uUHJlZmVyZW5jZSxcbiAgICAgICAgICAgICAgICBpZDogcHJlZmVyZW5jZXNbaV0uaWQsXG4gICAgICAgICAgICAgICAgZW5hYmxlZDogdXNlclByZWZlcmVuY2VzLmluZGV4T2YocHJlZmVyZW5jZXNbaV0uaWQpID4gLTFcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVzcDogRGF0YU9wZXJhdGlvblJlc3VsdDxSZXNwb25zZUR0bz4gPSB7XG4gICAgICAgICAgICBTdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgRGF0YTogcmVzdWx0XG4gICAgICAgIH07XG4gICAgICAgIHJlcy5qc29uKHJlc3ApO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgbmV4dChlKTtcbiAgICB9XG59O1xuXG5leHBvcnQgY29uc3QgYWJvdXRNZSA9IGFzeW5jIGZ1bmN0aW9uIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikge1xuICAgIC8vIG5pY2sgbmFtZSwgZXZlbnRzIGF0dGVuZGVkLCB2b3Rlc0Nhc3QsIHBhaW50aW5ncyB3b24sIHZvdGUgd2VpZ2h0XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcHJvZmlsZU91dHB1dCA9IGF3YWl0IGdldFByb2ZpbGUocmVxLnVzZXIuSGFzaCk7XG5cbiAgICAgICAgaW50ZXJmYWNlIFJlc3BvbnNlRHRvIHtcbiAgICAgICAgICAgIE1lc3NhZ2U6IHN0cmluZztcbiAgICAgICAgICAgIE5pY2tOYW1lOiBzdHJpbmc7XG4gICAgICAgICAgICBFdmVudHNBdHRlbmRlZDogTnVtYmVyO1xuICAgICAgICAgICAgVm90ZXNDYXN0OiBOdW1iZXI7XG4gICAgICAgICAgICBWb3RlV2VpZ2h0OiBudW1iZXI7XG4gICAgICAgICAgICBVc2VyOiBSZWdpc3RyYXRpb25EVE87XG4gICAgICAgIH1cbiAgICAgICAgcmVxLnVzZXIuVmVyaWZpY2F0aW9uQ29kZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgcmVxLnVzZXIuVmVyaWZpY2F0aW9uQ29kZUV4cCA9IHVuZGVmaW5lZDtcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGNvbnN0IHJlc3A6IERhdGFPcGVyYXRpb25SZXN1bHQ8UmVzcG9uc2VEdG8+ID0ge1xuICAgICAgICAgICAgU3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgIERhdGE6IHtcbiAgICAgICAgICAgICAgICBNZXNzYWdlOiAnQWJvdXQgbWUgZmV0Y2hlZCBzdWNjZXNzZnVsbHknLFxuICAgICAgICAgICAgICAgIE5pY2tOYW1lOiByZXEudXNlci5OaWNrTmFtZSxcbiAgICAgICAgICAgICAgICBFdmVudHNBdHRlbmRlZDogcHJvZmlsZU91dHB1dC50b3RhbEV2ZW50cyxcbiAgICAgICAgICAgICAgICBWb3Rlc0Nhc3Q6IHByb2ZpbGVPdXRwdXQudG90YWxWb3RlcyxcbiAgICAgICAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgICAgICAgVm90ZVdlaWdodDogcHJvZmlsZU91dHB1dC5Wb3RlRmFjdG9yICYmICBwcm9maWxlT3V0cHV0LlZvdGVGYWN0b3JbMF0sXG4gICAgICAgICAgICAgICAgVXNlcjogcmVxLnVzZXJcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmVzLmpzb24ocmVzcCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICByZXR1cm4gbmV4dChlKTtcbiAgICB9XG59O1xuXG5leHBvcnQgY29uc3Qgc2VjcmV0Q29kZSA9IGFzeW5jIGZ1bmN0aW9uIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikge1xuICAgIC8vIGFwcGx5IHNlY3JldCBjb2RlXG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZXZlbnRJZCA9IHJlcS5ib2R5LmV2ZW50SWQ7XG4gICAgICAgIGNvbnN0IGNvZGUgPSByZXEuYm9keS5jb2RlO1xuICAgICAgICBpZiAoZXZlbnRJZCAmJiBjb2RlKSB7XG4gICAgICAgICAgICBjb25zdCBldmVudCA9IGF3YWl0IEV2ZW50TW9kZWwuZmluZEJ5SWQoZXZlbnRJZCk7XG4gICAgICAgICAgICBpZiAoZXZlbnQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB2b3RlclJlZ2lzdHJhdGlvbiA9IGV2ZW50LlJlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yLmZpbmQociA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAoci5SZWdpc3RyYXRpb25JZCA9PSByZXEudXNlci5pZCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYgKHZvdGVyUmVnaXN0cmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgaGFuZGxlU2VjcmV0Q29kZShjb2RlLCBldmVudCwgdm90ZXJSZWdpc3RyYXRpb24sICcnKSBhcyBEYXRhT3BlcmF0aW9uUmVzdWx0PHN0cmluZz47XG4gICAgICAgICAgICAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzcDogRGF0YU9wZXJhdGlvblJlc3VsdDx7TWVzc2FnZTogU3RyaW5nfT4gPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBTdWNjZXNzOiByZXNwb25zZS5TdWNjZXNzLFxuICAgICAgICAgICAgICAgICAgICAgICAgRGF0YToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1lc3NhZ2U6IHJlc3BvbnNlLkRhdGFcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgcmVzLmpzb24ocmVzcCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG5leHQoe1xuICAgICAgICAgICAgc3RhdHVzOiA0MDAsXG4gICAgICAgICAgICBtZXNzYWdlOiAnSW52YWxpZCBwYXJhbWV0ZXJzJ1xuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGxvZ291dCA9IGFzeW5jIGZ1bmN0aW9uIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikge1xuICAgIC8vIGFwcGx5IGxvZ291dFxuICAgIHRyeSB7XG4gICAgICAgIGlmICghcmVxLnVzZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IGRvZ1N0YXRzRCA9IG5ldyBTdGF0c0QoKTtcbiAgICAgICAgICAgIGRvZ1N0YXRzRC5pbmNyZW1lbnQoJ2F1dG8tbG9nb3V0JywgMSwgW2Bqd3Q6ICR7cmVxLmhlYWRlcignQXV0aG9yaXphdGlvbicpfWBdKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBkZXZpY2VUb2tlbiA9IHJlcS5ib2R5LmRldmljZVRva2VuO1xuICAgICAgICBjb25zdCBhbmRyb2lkVG9rZW4gPSByZXEuYm9keS5hbmRyb2lkRGV2aWNlVG9rZW47XG4gICAgICAgIGxvZ2dlci5pbmZvKCdsb2dvdXQgZGV2aWNlIHRva2VuJywgZGV2aWNlVG9rZW4pO1xuICAgICAgICBpZiAoZGV2aWNlVG9rZW4gJiYgcmVxLnVzZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IHRvUmVtb3ZlRGV2aWNlVG9rZW5JbmRleCA9IHJlcS51c2VyLkRldmljZVRva2Vucy5pbmRleE9mKGRldmljZVRva2VuKTtcbiAgICAgICAgICAgIGlmICh0b1JlbW92ZURldmljZVRva2VuSW5kZXggPiAtMSkge1xuICAgICAgICAgICAgICAgIHJlcS51c2VyLkRldmljZVRva2Vucy5zcGxpY2UodG9SZW1vdmVEZXZpY2VUb2tlbkluZGV4LCAxKTtcbiAgICAgICAgICAgICAgICBhd2FpdCByZXEudXNlci5zYXZlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoYW5kcm9pZFRva2VuICYmIHJlcS51c2VyKSB7XG4gICAgICAgICAgICBjb25zdCB0b1JlbW92ZURldmljZVRva2VuSW5kZXggPSByZXEudXNlci5BbmRyb2lkRGV2aWNlVG9rZW5zLmluZGV4T2YoYW5kcm9pZFRva2VuKTtcbiAgICAgICAgICAgIGlmICh0b1JlbW92ZURldmljZVRva2VuSW5kZXggPiAtMSkge1xuICAgICAgICAgICAgICAgIHJlcS51c2VyLkFuZHJvaWREZXZpY2VUb2tlbnMuc3BsaWNlKHRvUmVtb3ZlRGV2aWNlVG9rZW5JbmRleCwgMSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgcmVxLnVzZXIuc2F2ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJlcy5jbGVhckNvb2tpZSgnand0Jyk7XG5cbiAgICAgICAgaWYgKGRldmljZVRva2VuIHx8IGFuZHJvaWRUb2tlbikge1xuICAgICAgICAgICAgY29uc3QgcmVzcDogRGF0YU9wZXJhdGlvblJlc3VsdDx7TWVzc2FnZTogU3RyaW5nfT4gPSB7XG4gICAgICAgICAgICAgICAgU3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBEYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIE1lc3NhZ2U6ICdMb2dvdXQgc3VjY2Vzc2Z1bCdcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmVzLmpzb24ocmVzcCk7XG4gICAgICAgICAgICByZXR1cm4gO1xuICAgICAgICB9XG4gICAgICAgIG5leHQoe1xuICAgICAgICAgICAgc3RhdHVzOiA0MDAsXG4gICAgICAgICAgICBtZXNzYWdlOiAnSW52YWxpZCBwYXJhbWV0ZXJzJ1xuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGNoYW5nZVN0YXR1c0luRXZlbnQgPSBhc3luYyBmdW5jdGlvbiAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBldmVudElkID0gcmVxLnBhcmFtcy5ldmVudElkO1xuICAgICAgICBjb25zdCByZWdpc3RyYXRpb25JZCA9IHJlcS5wYXJhbXMucmVnaXN0cmF0aW9uSWQ7XG4gICAgICAgIGxldCBzdGF0dXNJbmRleCA9IHJlcS5wYXJhbXMuc3RhdHVzSW5kZXg7XG4gICAgICAgIGxldCBzdGF0dXMgPSAnJztcbiAgICAgICAgbGV0IHZvdGVGYWN0b3IgPSAwO1xuXG4gICAgICAgIGlmICghaXNOYU4oc3RhdHVzSW5kZXgpICYmIHN0YXR1c0luZGV4ID49IC0xICYmIHJlZ2lzdHJhdGlvbklkICYmIGV2ZW50SWQpIHtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50ID0gYXdhaXQgRXZlbnRNb2RlbC5maW5kQnlJZChldmVudElkKS5zZWxlY3QoJ1JlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yJyk7XG4gICAgICAgICAgICBsZXQgcGhvbmVOdW1iZXIgPSAnJztcbiAgICAgICAgICAgIGxldCB1c2VyVm90ZUZhY3RvcjogUmVnaXN0cmF0aW9uVm90ZUZhY3RvckRUTztcbiAgICAgICAgICAgIGlmIChldmVudCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlZ1ZvdGVGYWN0b3JzID0gZXZlbnQuUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3I7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZWdWb3RlRmFjdG9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVnVm90ZUZhY3RvcnNbaV0uUmVnaXN0cmF0aW9uSWQgPT0gcmVnaXN0cmF0aW9uSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHVzZXJWb3RlRmFjdG9yID0gcmVnVm90ZUZhY3RvcnNbaV07XG4gICAgICAgICAgICAgICAgICAgICAgICBwaG9uZU51bWJlciA9IHJlZ1ZvdGVGYWN0b3JzW2ldLlBob25lTnVtYmVyO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAocGhvbmVOdW1iZXIubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXNJbmRleCA9IHBhcnNlSW50KHN0YXR1c0luZGV4KTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0YXR1c0luZGV4ID09PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gZm9yIGxhc3QgZWxlbWVudCBmcm9udGVuZCB3aWxsIHNlbmQgdGhpc1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2FsY3VsYXRlVXNlclZvdGVGYWN0b3IocGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdXNlclZvdGVGYWN0b3IuVm90ZUZhY3RvciA9IHJlc3VsdC5yZXN1bHQ7XG4gICAgICAgICAgICAgICAgICAgICAgICB2b3RlRmFjdG9yID0gcmVzdWx0LnJlc3VsdDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1cyA9IGAke3ZvdGVGYWN0b3J9YDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGFsbCBlbGVtZW50cyBvdGhlciB0aGFuIGxhc3RcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1cyA9IFN0YXRlc1tzdGF0dXNJbmRleF07XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdHVzLnRvTG93ZXJDYXNlKCkgPT09ICdhcnRpc3QnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVnaXN0cmF0aW9uID0gYXdhaXQgUmVnaXN0cmF0aW9uTW9kZWwuZmluZE9uZSh7X2lkOiByZWdpc3RyYXRpb25JZH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi5Jc0FydGlzdCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgcmVnaXN0cmF0aW9uLnNhdmUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHZvdGVGYWN0b3IgPSBTdGF0ZVZvdGVGYWN0b3JNYXBbc3RhdHVzSW5kZXhdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZvdGVGYWN0b3IgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gZm9yIGFkbWluIGFuZCBwaG90byB3ZSBhcmUgbm90IHRvdWNoaW5nIGl0XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdXNlclZvdGVGYWN0b3IuVm90ZUZhY3RvciA9IHZvdGVGYWN0b3I7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgdXNlclZvdGVGYWN0b3IuU3RhdHVzID0gc3RhdHVzO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVPYmo6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFN0YXR1czogc3RyaW5nO1xuICAgICAgICAgICAgICAgICAgICAgICAgVm90ZUZhY3Rvcj86IG51bWJlclxuICAgICAgICAgICAgICAgICAgICB9ID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgU3RhdHVzOiBzdGF0dXNcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZvdGVGYWN0b3IgIT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVPYmpbJ1ZvdGVGYWN0b3InXSA9IHZvdGVGYWN0b3I7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgICAgICAgICAgICAgICAgIFJlZ2lzdHJhdGlvbkxvZ01vZGVsLmZpbmRPbmVBbmRVcGRhdGUoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdFdmVudElkJzogZXZlbnRJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnUGhvbmVOdW1iZXInOiBwaG9uZU51bWJlclxuICAgICAgICAgICAgICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICckc2V0JzogdXBkYXRlT2JqXG4gICAgICAgICAgICAgICAgICAgICAgICB9KS5leGVjKCksXG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudC5zYXZlKClcbiAgICAgICAgICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXN1bHRzWzBdICYmIHJlc3VsdHNbMV0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc3A6IERhdGFPcGVyYXRpb25SZXN1bHQ8e01lc3NhZ2U6IFN0cmluZywgU3RhdHVzOiBTdHJpbmcsIFN0YXR1c0luZGV4OiBOdW1iZXJ9PiA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBTdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIERhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWVzc2FnZTogJ0RvbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBTdGF0dXM6IHN0YXR1cyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgU3RhdHVzSW5kZXg6IHN0YXR1c0luZGV4XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcy5qc29uKHJlc3ApO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmV4dCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiA1MDAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJ2Vycm9yIGluIHNhdmluZyBkYXRhJ1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBuZXh0KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1czogNDAwLFxuICAgICAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJ0ludmFsaWQgcmVnaXN0cmF0aW9uIGlkJ1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5leHQoe1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6IDQwMCxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJ0ludmFsaWQgZXZlbnQgaWQnXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBuZXh0KHtcbiAgICAgICAgICAgICAgICBzdGF0dXM6IDQwMCxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnSW52YWxpZCBwYXJhbWV0ZXJzJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufTtcblxuZXhwb3J0IGNvbnN0IGFkbWluID0gYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcGhvbmVIYXNoID0gcmVxLnBhcmFtcy5waG9uZUhhc2g7XG4gICAgICAgIGxldCByZWdpc3RyYXRpb246IFJlZ2lzdHJhdGlvbkRUTztcbiAgICAgICAgaWYgKHBob25lSGFzaCkge1xuICAgICAgICAgICAgcmVnaXN0cmF0aW9uID0gYXdhaXQgUmVnaXN0cmF0aW9uTW9kZWwuZmluZE9uZSh7XG4gICAgICAgICAgICAgICAgSGFzaDogcGhvbmVIYXNoXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVxLnVzZXIgJiYgIXJlZ2lzdHJhdGlvbikge1xuICAgICAgICAgICAgY29uc3QgYXV0aEhlYWRlciA9IHJlcS5oZWFkZXIoJ0F1dGhvcml6YXRpb24nKTtcbiAgICAgICAgICAgIGNvbnN0IHRva2VuID0gIGF1dGhIZWFkZXIgJiYgYXV0aEhlYWRlci5yZXBsYWNlKCdCZWFyZXIgJywgJycpLnRyaW0oKTtcbiAgICAgICAgICAgIGlmICh0b2tlbikge1xuICAgICAgICAgICAgICAgIHJlcy5jb29raWUoJ2p3dCcsIHRva2VuLCB7XG4gICAgICAgICAgICAgICAgICAgIGh0dHBPbmx5OiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBzYW1lU2l0ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgc2lnbmVkOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBzZWN1cmU6IGZhbHNlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXMucmVkaXJlY3QoMzA3LCBgJHtwcm9jZXNzLmVudi5BRE1JTl9VUkx9YCk7XG4gICAgICAgIH0gZWxzZSBpZiAocmVnaXN0cmF0aW9uKSB7XG4gICAgICAgICAgICBjb25zdCBjYWNoZUdldCA9IHJlcS5hcHAuZ2V0KCdjYWNoZUdldCcpO1xuICAgICAgICAgICAgY29uc3QgY2FjaGVTZXQgPSByZXEuYXBwLmdldCgnY2FjaGVTZXQnKTtcbiAgICAgICAgICAgICAgICBjb25zdCByZWdWb3RlciA9IG5ldyBSZWdpc3RlclZvdGVyVjIocmVnaXN0cmF0aW9uLlBob25lTnVtYmVyLCByZXEuZ2V0KCd1c2VyLWFnZW50JyksIGNhY2hlR2V0LCBjYWNoZVNldCxcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24sIGZhbHNlKTtcbiAgICAgICAgICAgIGNvbnN0IHRva2VuID0gcmVnVm90ZXIuR2V0VG9rZW4oKTtcbiAgICAgICAgICAgIHJlcy5jb29raWUoJ2p3dCcsIHRva2VuLCB7XG4gICAgICAgICAgICAgICAgaHR0cE9ubHk6IHRydWUsXG4gICAgICAgICAgICAgICAgc2FtZVNpdGU6IHRydWUsXG4gICAgICAgICAgICAgICAgc2lnbmVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIHNlY3VyZTogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY29uc3QgZXZlbnRzID0gYXdhaXQgRXZlbnRNb2RlbC5maW5kKHtcbiAgICAgICAgICAgICAgICAkYW5kOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdSZWdpc3RyYXRpb25zVm90ZUZhY3Rvci5TdGF0dXMnOiAnQWRtaW4nLCAvLyBhdCBsZWFzdCBoYXZlIG9uZSBhZG1pblxuICAgICAgICAgICAgICAgICAgICAgICAgJ0VuYWJsZWQnOiB0cnVlXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9KS5zZWxlY3QoWydfaWQnLCAnUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3InXSkuc29ydCh7X2lkOiAtMX0pO1xuICAgICAgICAgICAgY29uc3QgZXZlbnRJZHM6IHN0cmluZ1tdID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV2ZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IGV2ZW50ID0gZXZlbnRzW2ldO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZXZlbnQuUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3IubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgdm90ZUZhY3RvciA9IGV2ZW50LlJlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yW2pdO1xuICAgICAgICAgICAgICAgICAgICBpZiAodm90ZUZhY3Rvci5SZWdpc3RyYXRpb25JZC50b1N0cmluZygpID09PSByZWdpc3RyYXRpb24uX2lkLnRvU3RyaW5nKCkgJiYgdm90ZUZhY3Rvci5TdGF0dXMgPT09ICdBZG1pbicpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50SWRzLnB1c2goZXZlbnRzW2ldLl9pZCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGV2ZW50SWQgPSBBcnJheS5pc0FycmF5KGV2ZW50SWRzKSAmJiBldmVudElkc1swXTtcbiAgICAgICAgICAgIGlmIChldmVudElkKSB7XG4gICAgICAgICAgICAgICAgcmVzLnJlZGlyZWN0KDMwNywgYCR7cHJvY2Vzcy5lbnYuQURNSU5fVVJMfS9ldmVudC8ke2V2ZW50SWR9L3Jlc3VsdHNgKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzLnJlZGlyZWN0KDMwNywgYCR7cHJvY2Vzcy5lbnYuQURNSU5fVVJMfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgRXZlbnQgPSBhd2FpdCBFdmVudE1vZGVsLmZpbmRPbmUoKS5zb3J0KHtfaWQ6IC0xfSkucG9wdWxhdGUoJ0NvdW50cnknKTtcbiAgICAgICAgICAgIGNvbnN0IG9iajogYW55ID0ge1xuICAgICAgICAgICAgICAgIGV2ZW50SWQ6IEV2ZW50Ll9pZCxcbiAgICAgICAgICAgICAgICBmbGFnOiBFdmVudC5Db3VudHJ5ID8gYCR7cHJvY2Vzcy5lbnYuU0lURV9VUkx9L2ltYWdlcy9jb3VudHJpZXMvNHgzLyR7RXZlbnQuQ291bnRyeS5jb3VudHJ5X2ltYWdlfWAgOiAnJyxcbiAgICAgICAgICAgICAgICBmbGFnUG5nOiBFdmVudC5Db3VudHJ5ID8gYCR7cHJvY2Vzcy5lbnYuU0lURV9VUkx9L2ltYWdlcy9jb3VudHJpZXMvNHgzX3BuZy8ke0V2ZW50LkNvdW50cnkuY291bnRyeV9pbWFnZS5yZXBsYWNlKCdzdmcnLCAncG5nJyl9YCA6ICcnLFxuICAgICAgICAgICAgICAgIG9wZW5TdGF0dXM6IHRydWUsXG4gICAgICAgICAgICAgICAgb3BlblZvdGluZzogdHJ1ZSxcbiAgICAgICAgICAgICAgICBzdGF0dXNDb2xvcjogJycsXG4gICAgICAgICAgICAgICAgc3RhdHVzVGV4dDogJ09wZW4nLFxuICAgICAgICAgICAgICAgIHN0YXR1c1RleHRDb2xvcjogJycsXG4gICAgICAgICAgICAgICAgdGl0bGU6IEV2ZW50Lk5hbWUsXG4gICAgICAgICAgICAgICAgVm90ZXM6IDAsXG4gICAgICAgICAgICAgICAgYmFja0luSG9tZTogMVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJlcy5yZWRpcmVjdChgaW9zOjpjbG9zZXBheW1lbnQ6OiR7SlNPTi5zdHJpbmdpZnkob2JqKX1gKTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgbmV4dChlKTtcbiAgICB9XG59O1xuZXhwb3J0IGNvbnN0IHByb2ZpbGUgPSBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBsb2dnZXIuaW5mbyhgcmVxLmhlYWRlcnMnLCAke0pTT04uc3RyaW5naWZ5KHJlcS5oZWFkZXJzKX1gKTtcbiAgICBpZiAocmVxLnVzZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHByb2ZpbGVPdXRwdXQgPSBhd2FpdCBnZXRQcm9maWxlKHJlcS51c2VyLkhhc2gpO1xuICAgICAgICAgICAgcmVzLnJlbmRlcignYXBwX3Byb2ZpbGUnLCB7XG4gICAgICAgICAgICAgICAgdGl0bGU6ICdQcm9maWxlJyxcbiAgICAgICAgICAgICAgICBwaG9uZU51bWJlcjogcmVxLnVzZXIgJiYgcmVxLnVzZXIuUGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgbmlja05hbWU6IHJlcS51c2VyICYmIHJlcS51c2VyLk5pY2tOYW1lLFxuICAgICAgICAgICAgICAgIEV2ZW50c0F0dGVuZGVkOiBwcm9maWxlT3V0cHV0LnRvdGFsRXZlbnRzLFxuICAgICAgICAgICAgICAgIFZvdGVzQ2FzdDogcHJvZmlsZU91dHB1dC50b3RhbFZvdGVzLFxuICAgICAgICAgICAgICAgIEJpZHM6ICctJyxcbiAgICAgICAgICAgICAgICBFdmVudHM6IHByb2ZpbGVPdXRwdXQuRXZlbnRzXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgbmV4dChlKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHJlcy5yZWRpcmVjdCgnaW9zOjpsb2dvdXQ6Ont9Jyk7XG4gICAgfVxufTtcblxuZXhwb3J0IGNvbnN0IHRlc3ROb3RpZmljYXRpb24gPSBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBnbG9iYWxSZWdpc3RyYXRpb25zOiBSZWdpc3RyYXRpb25EVE9bXSA9IGF3YWl0IFJlZ2lzdHJhdGlvbk1vZGVsLmZpbmQoeydEZXZpY2VUb2tlbnMnOiB7ICRleGlzdHM6IHRydWUsICRuZTogW10gfSB9KTtcbiAgICAgICAgY29uc3QgZGV2aWNlVG9rZW5zOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBjb25zdCBhbmRyb2lkVG9rZW5zOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICBmb3IgKGxldCBhID0gMDsgYSA8IGdsb2JhbFJlZ2lzdHJhdGlvbnMubGVuZ3RoOyBhKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHVzZXJUb2tlbnMgPSBnbG9iYWxSZWdpc3RyYXRpb25zW2FdLkRldmljZVRva2VucztcbiAgICAgICAgICAgIGNvbnN0IHVzZXJBbmRyb2lkVG9rZW5zID0gZ2xvYmFsUmVnaXN0cmF0aW9uc1thXS5BbmRyb2lkRGV2aWNlVG9rZW5zO1xuICAgICAgICAgICAgaWYgKHVzZXJUb2tlbnMpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IHVzZXJUb2tlbnMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gc2JmdmhqZmJ2ZGZoNDg5dGlqa3VmZ2d2biBpcyB0ZXN0IHRva2VuXG4gICAgICAgICAgICAgICAgICAgIGlmICh1c2VyVG9rZW5zW2tdICYmIGRldmljZVRva2Vucy5pbmRleE9mKHVzZXJUb2tlbnNba10pID09PSAtMSAmJiB1c2VyVG9rZW5zW2tdICE9PSAnbnVsbCcgJiYgdXNlclRva2Vuc1trXSAhPT0gJ3NiZnZoamZidmRmaDQ4OXRpamt1Zmdndm4nKSAge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGV2aWNlVG9rZW5zLnB1c2godXNlclRva2Vuc1trXSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodXNlckFuZHJvaWRUb2tlbnMpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IHVzZXJBbmRyb2lkVG9rZW5zLmxlbmd0aDsgaysrKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIHNiZnZoamZidmRmaDQ4OXRpamt1Zmdndm4gaXMgdGVzdCB0b2tlblxuICAgICAgICAgICAgICAgICAgICBpZiAodXNlckFuZHJvaWRUb2tlbnNba10gJiYgYW5kcm9pZFRva2Vucy5pbmRleE9mKHVzZXJBbmRyb2lkVG9rZW5zW2tdKSA9PT0gLTEgJiYgdXNlckFuZHJvaWRUb2tlbnNba10gIT09ICdudWxsJykgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFuZHJvaWRUb2tlbnMucHVzaCh1c2VyVG9rZW5zW2tdKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZGV2aWNlVG9rZW5zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGJhZERldmljZVRva2VucyA9IGF3YWl0IHNlbmROb3RpZmljYXRpb24oZGV2aWNlVG9rZW5zLCAnQ2xpY2tpbmcgb24gbWUgd291bGQgc2VuZCB5b3UgdG8gYSB3ZWJ2aWV3JywgJ1dlYlZpZXcgVGVzdCcsXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB1cmw6ICdodHRwczovL2FwcC5hcnRiYXR0bGUuY29tL3Byb2ZpbGUnLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1Byb2ZpbGUnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKCdiYWREZXZpY2VUb2tlbnMnLCBiYWREZXZpY2VUb2tlbnMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChhbmRyb2lkVG9rZW5zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGJhZEFuZHJvaWRUb2tlbnMgPSBhd2FpdCBNdWx0aUNhc3RJZ25vcmVFcnIoe1xuICAgICAgICAgICAgICAgIERldmljZVRva2VuczogYW5kcm9pZFRva2VucyxcbiAgICAgICAgICAgICAgICBsaW5rOiAnaHR0cHM6Ly9hcHAuYXJ0YmF0dGxlLmNvbS9wcm9maWxlJyxcbiAgICAgICAgICAgICAgICB0aXRsZTogJ1dlYlZpZXcgVGVzdCcsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ0NsaWNraW5nIG9uIG1lIHdvdWxkIHNlbmQgeW91IHRvIGEgd2VidmlldycsXG4gICAgICAgICAgICAgICAgcHJpb3JpdHk6ICdub3JtYWwnLFxuICAgICAgICAgICAgICAgIGFuYWx5dGljc0xhYmVsOiAnV2ViVmlldyBUZXN0J1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbygnYmFkRGV2aWNlVG9rZW5zJywgYmFkQW5kcm9pZFRva2Vucyk7XG4gICAgICAgIH1cbiAgICAgICAgcmVzLmpzb24oe1xuICAgICAgICAgICAgbWVzc2FnZTogJ05vdGlmaWNhdGlvbnMgc2VuZCBzdWNjZXNzZnVsbHknXG4gICAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgbmV4dChlKTtcbiAgICB9XG59O1xuXG5leHBvcnQgY29uc3QgcHJlZmVyZW5jZXMgPSBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBwcm9maWxlT3V0cHV0ID0gYXdhaXQgZ2V0UHJvZmlsZShyZXEudXNlci5IYXNoKTtcbiAgICAgICAgY29uc3QgcHJlZmVyZW5jZXMgPSBhd2FpdCBQcmVmZXJlbmNlTW9kZWwuZmluZCh7fSk7XG4gICAgICAgIGludGVyZmFjZSBVc2VyUHJlZmVyZW5jZUR0byBleHRlbmRzIFByZWZlcmVuY2VEVE8ge1xuICAgICAgICAgICAgRW5hYmxlZDogYm9vbGVhbjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwcmVmZXJlbmNlSWRNYXA6IHtba2V5OiBzdHJpbmddOiBVc2VyUHJlZmVyZW5jZUR0b30gPSB7fTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmVmZXJlbmNlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgcHJlZmVyZW5jZUlkTWFwW3ByZWZlcmVuY2VzW2ldLl9pZF0gPSBwcmVmZXJlbmNlc1tpXTtcbiAgICAgICAgICAgIHByZWZlcmVuY2VJZE1hcFtwcmVmZXJlbmNlc1tpXS5faWRdLkVuYWJsZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlcS51c2VyLlByZWZlcmVuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAocHJlZmVyZW5jZUlkTWFwW3JlcS51c2VyLlByZWZlcmVuY2VzW2ldLl9pZF0pIHtcbiAgICAgICAgICAgICAgICBwcmVmZXJlbmNlSWRNYXBbcmVxLnVzZXIuUHJlZmVyZW5jZXNbaV0uX2lkXS5FbmFibGVkID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXMucmVuZGVyKCdwcmVmZXJlbmNlcycsIHtcbiAgICAgICAgICAgIHRpdGxlOiAnUHJvZmlsZScsXG4gICAgICAgICAgICBwaG9uZU51bWJlcjogcmVxLnVzZXIgJiYgcmVxLnVzZXIuUGhvbmVOdW1iZXIsXG4gICAgICAgICAgICBuaWNrTmFtZTogcmVxLnVzZXIgJiYgcmVxLnVzZXIuTmlja05hbWUsXG4gICAgICAgICAgICBFdmVudHNBdHRlbmRlZDogcHJvZmlsZU91dHB1dC50b3RhbEV2ZW50cyxcbiAgICAgICAgICAgIFZvdGVzQ2FzdDogcHJvZmlsZU91dHB1dC50b3RhbFZvdGVzLFxuICAgICAgICAgICAgQmlkczogJy0nLFxuICAgICAgICAgICAgRXZlbnRzOiBwcm9maWxlT3V0cHV0LkV2ZW50cyxcbiAgICAgICAgICAgIFByZWZlcmVuY2VzOiBPYmplY3QudmFsdWVzKHByZWZlcmVuY2VJZE1hcClcbiAgICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBuZXh0KGUpO1xuICAgIH1cbn07XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmaW5kVXNlckJ5UGhvbmUocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICB0cnkge1xuICAgICAgICBsZXQgcGhvbmUgPSByZXEucGFyYW1zLnBob25lO1xuICAgICAgICBpZiAoIXBob25lLnN0YXJ0c1dpdGgoJysnKSkge1xuICAgICAgICAgICAgLy8gSWYgcGhvbmUgbnVtYmVyIGlzIHdpdGhvdXQgcGx1cyBhZGQgaXRcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50SWQgPSByZXEucGFyYW1zLmV2ZW50SWQ7XG4gICAgICAgICAgICBjb25zdCBldmVudCA9IGF3YWl0IEV2ZW50TW9kZWwuZmluZE9uZSh7X2lkOiBldmVudElkfSkuc2VsZWN0KFsnQ291bnRyeSddKS5wb3B1bGF0ZShbJ0NvdW50cnknXSk7XG4gICAgICAgICAgICBpZiAoIWV2ZW50KSB7XG4gICAgICAgICAgICAgICAgcmVzLnN0YXR1cyg0MDApO1xuICAgICAgICAgICAgICAgIG5leHQoe01lc3NhZ2U6ICdFdmVudCBub3QgZm91bmQnfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBob25lID0gYCR7ZXZlbnQuQ291bnRyeS5waG9uZV9jb2RlfSR7cGhvbmV9YDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZWdpc3RyYXRpb24gPSBhd2FpdCBSZWdpc3RyYXRpb25Nb2RlbC5maW5kT25lKHtQaG9uZU51bWJlcjogcGhvbmV9KTtcbiAgICAgICAgaWYgKHJlZ2lzdHJhdGlvbiAmJiByZWdpc3RyYXRpb24uRW1haWwgJiYgcmVnaXN0cmF0aW9uLkZpcnN0TmFtZSkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBEYXRhT3BlcmF0aW9uUmVzdWx0PFJlZ2lzdHJhdGlvbkRUTz4gPSB7XG4gICAgICAgICAgICAgICAgJ1N1Y2Nlc3MnOiB0cnVlLFxuICAgICAgICAgICAgICAgIERhdGE6IHJlZ2lzdHJhdGlvblxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJlcy5qc29uKHJlc3VsdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBuZXh0KHtTdGF0dXM6IDQwNCwgTWVzc2FnZTogJ1VzZXIgbm90IGZvdW5kJywgUmVnaXN0cmF0aW9uOiByZWdpc3RyYXRpb259KTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgbmV4dChlKTtcbiAgICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2dpbihyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNhY2hlR2V0ID0gcmVxLmFwcC5nZXQoJ2NhY2hlR2V0Jyk7XG4gICAgICAgIGNvbnN0IGNhY2hlU2V0ID0gcmVxLmFwcC5nZXQoJ2NhY2hlU2V0Jyk7XG4gICAgICAgIGNvbnN0IHBob25lTnVtYmVyID0gcmVxLmJvZHkuUGhvbmVOdW1iZXI7XG4gICAgICAgIGNvbnN0IHJlZ2lzdHJhdGlvbiA9IGF3YWl0IFJlZ2lzdHJhdGlvbk1vZGVsLmZpbmRPbmUoe1Bob25lTnVtYmVyOiBwaG9uZU51bWJlcn0pO1xuICAgICAgICBjb25zdCB1c2VyQWdlbnRIZWFkZXIgPSByZXEuaGVhZGVyKCd1c2VyLWFnZW50Jyk7XG4gICAgICAgIGNvbnN0IHJlZ2lzdGVyVm90ZU9iaiA9IG5ldyBSZWdpc3RlclZvdGVyVjIocGhvbmVOdW1iZXIsIHVzZXJBZ2VudEhlYWRlciwgY2FjaGVTZXQsIGNhY2hlR2V0LCByZWdpc3RyYXRpb24sIHRydWUpO1xuICAgICAgICBjb25zdCBNZXNzYWdlID0gJ1BsZWFzZSBlbnRlciB2ZXJpZmljYXRpb24gY29kZSc7XG4gICAgICAgIGlmICghcmVnaXN0cmF0aW9uKSB7XG4gICAgICAgICAgICAvLyByZWdpc3RlclxuICAgICAgICAgICAgYXdhaXQgcmVnaXN0ZXJWb3RlT2JqLlJlZ2lzdGVyKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhd2FpdCByZWdpc3RlclZvdGVPYmouTG9naW4oKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8e1xuICAgICAgICAgICAgTWVzc2FnZTogc3RyaW5nO1xuICAgICAgICB9PiA9IHtcbiAgICAgICAgICAgIFN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICBEYXRhOiB7XG4gICAgICAgICAgICAgICAgTWVzc2FnZTogTWVzc2FnZVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICByZXMuanNvbihyZXN1bHQpO1xuICAgICAgICAvLyBzZW5kIG90cCBpbiBzbXNcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGlmICghZS5tZXNzYWdlKSB7XG4gICAgICAgICAgICBlID0ge1xuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGUsXG4gICAgICAgICAgICAgICAgc3RhdHVzOiA1MDBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgZS5zdGF0dXMgPSBlLnN0YXR1cyB8fCA1MDA7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdmVyaWZ5TG9naW5PdHAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBjYWNoZUdldCA9IHJlcS5hcHAuZ2V0KCdjYWNoZUdldCcpO1xuICAgICAgICBjb25zdCBjYWNoZVNldCA9IHJlcS5hcHAuZ2V0KCdjYWNoZVNldCcpO1xuICAgICAgICBjb25zdCBwaG9uZU51bWJlciA9IHJlcS5ib2R5LlBob25lTnVtYmVyO1xuICAgICAgICBjb25zb2xlLmxvZygnb3RwIGJvZHknLCByZXEuYm9keSk7XG4gICAgICAgIGNvbnN0IHVzZXJBZ2VudEhlYWRlciA9IHJlcS5oZWFkZXIoJ3VzZXItYWdlbnQnKTtcbiAgICAgICAgY29uc3QgdmVyaWZpY2F0aW9uQ29kZSA9IHJlcS5ib2R5Lm90cDtcbiAgICAgICAgY29uc3QgcmVnaXN0cmF0aW9uID0gYXdhaXQgUmVnaXN0cmF0aW9uTW9kZWwuZmluZE9uZSh7UGhvbmVOdW1iZXI6IHBob25lTnVtYmVyfSk7XG4gICAgICAgIGNvbnN0IHJlZ2lzdGVyVm90ZU9iaiA9IG5ldyBSZWdpc3RlclZvdGVyVjIocGhvbmVOdW1iZXIsIHVzZXJBZ2VudEhlYWRlciwgY2FjaGVTZXQsIGNhY2hlR2V0LCByZWdpc3RyYXRpb24pO1xuICAgICAgICBpZiAoIShyZWdpc3RyYXRpb24uRGlzcGxheVBob25lKSkge1xuICAgICAgICAgICAgcmVnaXN0cmF0aW9uLkRpc3BsYXlQaG9uZSA9IGAqKioqKioqJHtyZWdpc3RyYXRpb24uUGhvbmVOdW1iZXIuc2xpY2UoLTQpfWA7XG4gICAgICAgICAgICBhd2FpdCByZWdpc3RyYXRpb24uc2F2ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghcmVnaXN0cmF0aW9uKSB7XG4gICAgICAgICAgICBuZXh0KHtcbiAgICAgICAgICAgICAgICBzdGF0dXM6IDQwMyxcbiAgICAgICAgICAgICAgICBNZXNzYWdlOiAnSW52YWxpZCBwaG9uZSBudW1iZXIgcGFzc2VkJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGlzVmVyaWZpZWQgPSBhd2FpdCByZWdpc3RlclZvdGVPYmouVmVyaWZ5Q29kZSgnJyArIHZlcmlmaWNhdGlvbkNvZGUpO1xuICAgICAgICBpZiAoaXNWZXJpZmllZCA9PT0gMSkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBEYXRhT3BlcmF0aW9uUmVzdWx0PHtcbiAgICAgICAgICAgICAgICBNZXNzYWdlOiBzdHJpbmc7XG4gICAgICAgICAgICAgICAgVG9rZW46IHN0cmluZztcbiAgICAgICAgICAgICAgICBOaWNrTmFtZTogc3RyaW5nO1xuICAgICAgICAgICAgfT4gPSB7XG4gICAgICAgICAgICAgICAgU3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBEYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIE1lc3NhZ2U6ICdWZXJpZmljYXRpb24gU3VjY2Vzc2Z1bCEnLFxuICAgICAgICAgICAgICAgICAgICBUb2tlbjogcmVnaXN0ZXJWb3RlT2JqLkdldFRva2VuKCksXG4gICAgICAgICAgICAgICAgICAgIE5pY2tOYW1lOiAocmVnaXN0cmF0aW9uLk5pY2tOYW1lIHx8IHJlZ2lzdHJhdGlvbi5EaXNwbGF5UGhvbmUpLnRvU3RyaW5nKClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgcmVzLmpzb24ocmVzdWx0KTtcbiAgICAgICAgfSBlbHNlIGlmIChpc1ZlcmlmaWVkID09PSAtMSkge1xuICAgICAgICAgICAgbmV4dCh7XG4gICAgICAgICAgICAgICAgc3RhdHVzOiA0MDMsXG4gICAgICAgICAgICAgICAgTWVzc2FnZTogJ0V4cGlyZWQgT1RQJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBuZXh0KHtcbiAgICAgICAgICAgICAgICBzdGF0dXM6IDQwMyxcbiAgICAgICAgICAgICAgICBNZXNzYWdlOiAnSW52YWxpZCBPVFAnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAoIWUubWVzc2FnZSkge1xuICAgICAgICAgICAgZSA9IHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBlLFxuICAgICAgICAgICAgICAgIHN0YXR1czogNTAwXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGUuc3RhdHVzID0gZS5zdGF0dXMgfHwgNTAwO1xuICAgICAgICBuZXh0KGUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGNvbnN0IGp3dExvZ2luID0gYXN5bmMocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCByZWRpcmVjdFVybCA9IHJlcS5xdWVyeS5yZWRpcmVjdFRvO1xuICAgIGNvbnN0IGNhY2hlR2V0ID0gcmVxLmFwcC5nZXQoJ2NhY2hlR2V0Jyk7XG4gICAgY29uc3QgY2FjaGVTZXQgPSByZXEuYXBwLmdldCgnY2FjaGVTZXQnKTtcbiAgICBjb25zdCBwaG9uZU51bWJlciA9IHJlcS5ib2R5LlBob25lTnVtYmVyO1xuICAgIGNvbnN0IHVzZXJBZ2VudEhlYWRlciA9IHJlcS5oZWFkZXIoJ3VzZXItYWdlbnQnKTtcbiAgICBjb25zdCByZWdpc3RlclZvdGVPYmogPSBuZXcgUmVnaXN0ZXJWb3RlclYyKHBob25lTnVtYmVyLCB1c2VyQWdlbnRIZWFkZXIsIGNhY2hlU2V0LCBjYWNoZUdldCwgcmVxLnVzZXIpO1xuICAgIGNvbnN0IHRva2VuID0gcmVnaXN0ZXJWb3RlT2JqLkdldFRva2VuKCk7XG4gICAgcmVzLmNvb2tpZSgnand0JywgdG9rZW4sIHtcbiAgICAgICAgaHR0cE9ubHk6IHRydWUsXG4gICAgICAgIHNhbWVTaXRlOiB0cnVlLFxuICAgICAgICBzaWduZWQ6IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2VcbiAgICB9KTtcbiAgICBpZiAoIXJlZGlyZWN0VXJsKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdDogRGF0YU9wZXJhdGlvblJlc3VsdDx7XG4gICAgICAgICAgICBNZXNzYWdlOiBzdHJpbmc7XG4gICAgICAgICAgICBUb2tlbjogc3RyaW5nO1xuICAgICAgICAgICAgTmlja05hbWU6IHN0cmluZztcbiAgICAgICAgfT4gPSB7XG4gICAgICAgICAgICBTdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgRGF0YToge1xuICAgICAgICAgICAgICAgIE1lc3NhZ2U6ICdMb2dpbiBTdWNjZXNzZnVsIScsXG4gICAgICAgICAgICAgICAgVG9rZW46IHRva2VuLFxuICAgICAgICAgICAgICAgIE5pY2tOYW1lOiAocmVxLnVzZXIuTmlja05hbWUgfHwgcmVxLnVzZXIuRGlzcGxheVBob25lKS50b1N0cmluZygpXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHJlcy5qc29uKHJlc3VsdCk7XG4gICAgICAgIHJldHVybiA7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmVzLnJlZGlyZWN0KDMwNywgcmVkaXJlY3RVcmwpO1xuICAgIH1cbn07XG5cbmV4cG9ydCBjb25zdCBhcHBSZWRpcmVjdCA9IGFzeW5jKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICAgY29uc3QgY291bnRyeSA9IHJlcS5xdWVyeS5jb3VudHJ5O1xuICAgIGNvbnN0IGNhY2hlR2V0ID0gcmVxLmFwcC5nZXQoJ2NhY2hlR2V0Jyk7XG4gICAgY29uc3QgY2FjaGVTZXQgPSByZXEuYXBwLmdldCgnY2FjaGVTZXQnKTtcbiAgICBjb25zdCBwbGF0Zm9ybSA9IHR5cGVvZiByZXEucXVlcnkucGxhdGZvcm0gPT09ICdzdHJpbmcnID8gcmVxLnF1ZXJ5LnBsYXRmb3JtLnRvTG93ZXJDYXNlKCkgOiAnJztcbiAgICBjb25zb2xlLmxvZygnYXBwUmVkaXJlY3QnLCByZXEucXVlcnksIHJlcS5oZWFkZXJzKTtcbiAgICBpZiAocmVxLnVzZXIpIHtcbiAgICAgICAgY29uc3QgcGhvbmVOdW1iZXIgPSByZXEudXNlci5QaG9uZU51bWJlcjtcbiAgICAgICAgY29uc3QgdXNlckFnZW50SGVhZGVyID0gcmVxLmhlYWRlcigndXNlci1hZ2VudCcpO1xuICAgICAgICBjb25zdCByZWdpc3RlclZvdGVPYmogPSBuZXcgUmVnaXN0ZXJWb3RlclYyKHBob25lTnVtYmVyLCB1c2VyQWdlbnRIZWFkZXIsIGNhY2hlU2V0LCBjYWNoZUdldCwgcmVxLnVzZXIpO1xuICAgICAgICBjb25zdCB0b2tlbiA9IHJlZ2lzdGVyVm90ZU9iai5HZXRUb2tlbigpO1xuICAgICAgICByZXMuY29va2llKCdqd3QnLCB0b2tlbiwge1xuICAgICAgICAgICAgaHR0cE9ubHk6IHRydWUsXG4gICAgICAgICAgICBzYW1lU2l0ZTogdHJ1ZSxcbiAgICAgICAgICAgIHNpZ25lZDogdHJ1ZSxcbiAgICAgICAgICAgIHNlY3VyZTogdHJ1ZSxcbiAgICAgICAgICAgIGRvbWFpbjogJ2FydGIuYXJ0JyxcbiAgICAgICAgICAgIHBhdGg6ICcvJ1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc29sZS5sb2coJ3JlZGlyZWN0aW5nIHRvICcsIGAke3Byb2Nlc3MuZW52LkZST05URU5EX0xJTkt9L2FsbD9jb3VudHJ5PSR7Y291bnRyeX1gKTtcbiAgICAgICAgcmVzLnJlZGlyZWN0KDMwNywgYCR7cHJvY2Vzcy5lbnYuRlJPTlRFTkRfTElOS30vYWxsP2NvdW50cnk9JHtjb3VudHJ5fWApO1xuICAgICAgICByZXR1cm4gO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdyZWRpcmVjdGluZyB0bycsICduYXRpdmUgbG9naW4nKTtcbiAgICAgICAgY29uc3QgZHVtbXlFdmVudCA9IHtcbiAgICAgICAgICAgIGV2ZW50SWQ6ICdkdW1teScsXG4gICAgICAgICAgICBmbGFnOiAnJyxcbiAgICAgICAgICAgIGZsYWdQbmc6ICcnLFxuICAgICAgICAgICAgb3BlblN0YXR1czogdHJ1ZSxcbiAgICAgICAgICAgIG9wZW5Wb3Rpbmc6IHRydWUsXG4gICAgICAgICAgICBzdGF0dXNUZXh0OiAnb3BlbicsXG4gICAgICAgICAgICB0aXRsZTogJydcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKHBsYXRmb3JtID09PSAnaW9zJykge1xuICAgICAgICAgICAgcmVzLnJlZGlyZWN0KDMwNywgYGlvczo6Y2xvc2VwYXltZW50Ojoke0pTT04uc3RyaW5naWZ5KGR1bW15RXZlbnQpfWApO1xuICAgICAgICB9IGVsc2UgaWYgKHBsYXRmb3JtID09PSAnYW5kcm9pZCcpIHtcbiAgICAgICAgICAgIC8vIHJlcy5yZW5kZXIoJ2FwcFJlZGlyZWN0Jyk7XG4gICAgICAgICAgICByZXMucmVkaXJlY3QoMzA3LCBgaW9zOjpjbG9zZXBheW1lbnQ6OiR7SlNPTi5zdHJpbmdpZnkoZHVtbXlFdmVudCl9YCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXMuanNvbignd3JvbmcgcGxhdGZvcm0gcGFzc2VkJyk7XG4gICAgICAgIH1cbiAgICB9XG59O1xuXG5leHBvcnQgY29uc3QgcHVibGljUmVnaXN0cmF0aW9uID0gYXN5bmMocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBldmVudElkID0gcmVxLnBhcmFtcy5ldmVudElkO1xuICAgIGNvbnN0IGV2ZW50ID0gYXdhaXQgRXZlbnRNb2RlbFxuICAgICAgICAuZmluZEJ5SWQoZXZlbnRJZClcbiAgICAgICAgLnNlbGVjdChbJ05hbWUnXSk7XG4gICAgaWYgKCFldmVudCkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHJlcy5yZW5kZXIoJ3B1YmxpY19yZWdpc3RyYXRpb24nLCB7XG4gICAgICAgIGV2ZW50TmFtZTogZXZlbnQuTmFtZSxcbiAgICAgICAgZXZlbnRJZDogZXZlbnRJZCxcbiAgICAgICAgdGl0bGU6IGBSZWdpc3RlciBmb3IgJHtldmVudC5OYW1lfWBcbiAgICB9KTtcbn07XG5cbmV4cG9ydCBjb25zdCBwdWJsaWNSZWdpc3RyYXRpb25Qb3N0ID0gYXN5bmMocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCBldmVudElkID0gcmVxLnBhcmFtcy5ldmVudElkO1xuICAgIGNvbnN0IGV2ZW50ID0gYXdhaXQgRXZlbnRNb2RlbFxuICAgICAgICAuZmluZEJ5SWQoZXZlbnRJZClcbiAgICAgICAgLnNlbGVjdChbJ05hbWUnXSk7XG4gICAgaWYgKCFldmVudCkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHJlZ2lzdHJhdGlvblJlc3BvbnNlID0gYXdhaXQgUmVnaXN0ZXJWb3RlcihyZXEuYm9keSwgZXZlbnRJZCwgdHJ1ZSwgMC4xLCB0cnVlLCBmYWxzZSk7XG4gICAgcmVnaXN0cmF0aW9uUmVzcG9uc2UuRGF0YS5WZXJpZmljYXRpb25Db2RlID0gbnVsbDtcbiAgICByZWdpc3RyYXRpb25SZXNwb25zZS5EYXRhLlZlcmlmaWNhdGlvbkNvZGVFeHAgPSBudWxsO1xuICAgIC8vIGlmIGV4cCB0aW1lIG5vdCBkZWZpbmVkIHRoZW4gMSB5ZWFyXG4gICAgLypyZWdpc3RyYXRpb25SZXNwb25zZS5EYXRhLkpXVCA9IHNpZ24oe1xuICAgICAgICByZWdpc3RyYXRpb25JZDogcmVnaXN0cmF0aW9uUmVzcG9uc2UuRGF0YS5SZWdpc3RyYXRpb25JZCxcbiAgICB9LCBwcm9jZXNzLmVudi5KV1RfU0VDUkVULCAgeyBleHBpcmVzSW46IHByb2Nlc3MuZW52LkpXVF9FWFBfVElNRSB8fCAnMXknfSk7Ki9cbiAgICByZXEuZmxhc2goJ2luZm8nLCB7IG1zZzogJ0FjY291bnQgcmVnaXN0ZXJlZCcgfSk7XG4gICAgcmVzLnJlbmRlcigncHVibGljX3JlZ2lzdHJhdGlvbicsIHtcbiAgICAgICAgZXZlbnROYW1lOiBldmVudC5OYW1lLFxuICAgICAgICBldmVudElkOiBldmVudElkLFxuICAgICAgICB0aXRsZTogYFJlZ2lzdGVyIGZvciAke2V2ZW50Lk5hbWV9YCxcbiAgICAgICAgcmVnaXN0cmF0aW9uSWQ6IHJlZ2lzdHJhdGlvblJlc3BvbnNlLkRhdGEuUmVnaXN0cmF0aW9uSWRcbiAgICB9KTtcbn07Il19
