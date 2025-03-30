"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomVoteUrl = exports.getEventFilterGuestCount = exports.getEventGuestCount = exports.appVote = exports.viewEvent = exports.eventStats = exports.makeWinner = exports.eventList = exports.eventListHtml = exports.voteBarGraph = exports.handleVoteForm = exports.voteLink = exports.voteRoundSeries = exports.voteRegistrationsSeries = exports.registrationLogs = exports.voterLogs = exports.incrementRound = exports.getEvent = exports.getEvents = exports.archiveEvent = exports.saveEvent = exports.voteSMS = exports.announce = exports.getAnnounce = void 0;
// @ts-ignore
const date_fns_timezone_1 = require("date-fns-timezone");
// @ts-ignore
const date_fns_1 = require("date-fns");
const Event_1 = require("../models/Event");
const Twilio = require("twilio");
const User_1 = require("../models/User");
const VotingLog_1 = require("../models/VotingLog");
const RegistrationLog_1 = require("../models/RegistrationLog");
// Slack HTTPS call
const Slack_1 = require("../common/Slack");
const voteProcessor_1 = require("../common/voteProcessor");
const Announcement_1 = require("../models/Announcement");
const EventPhoneNumber_1 = require("../models/EventPhoneNumber");
const Timezone_1 = require("../models/Timezone");
const Apns_1 = require("../common/Apns");
const ArtistWiseImages_1 = require("../common/ArtistWiseImages");
const Registration_1 = require("../models/Registration");
const Preference_1 = require("../models/Preference");
const logger_1 = require("../config/logger");
const RegistrationProcessor_1 = require("../common/RegistrationProcessor");
const Lot_1 = require("../models/Lot");
const FCM_1 = require("../common/FCM");
const eventRoundIncrement_1 = require("../common/eventRoundIncrement");
const bson_1 = require("bson");
const jsonwebtoken_1 = require("jsonwebtoken");
const Media_1 = require("../models/Media");
const sharp = require("sharp");
const fs = require("fs-extra");
const messageProcessor_1 = require("../common/messageProcessor");
const States_1 = require("../common/States");
async function getAnnounce(req, res) {
    const event = await Event_1.default.findById(req.params.eventId).populate('Registrations');
    const registrations = event.Registrations;
    const voteFactors = event.RegistrationsVoteFactor;
    let smsVotersCount = 0;
    let appVotersCount = 0;
    const registrationIdMap = [];
    for (let i = 0; i < registrations.length; i++) {
        registrationIdMap[registrations[i]._id] = registrations[i];
    }
    const announcementOptions = [
        {
            label: `SMS`,
            index: `sms-voters`,
            checked: true
        },
        {
            label: `App: local`,
            index: `app-voters`,
            checked: true
        },
        {
            label: `App: global`,
            index: `global-app-voters`,
            checked: false
        }
    ];
    for (let i = 0; i < voteFactors.length; i++) {
        if (voteFactors[i].From === 'sms') {
            smsVotersCount++;
        }
        else if (voteFactors[i].From === 'app' || voteFactors[i].From === 'app-global') {
            appVotersCount++;
        }
    }
    const globalAppVotersCount = await Registration_1.default.countDocuments({ 'DeviceTokens': { $exists: true, $ne: [] } });
    announcementOptions[0].label += ` (${smsVotersCount})`;
    announcementOptions[1].label += ` (${appVotersCount})`;
    announcementOptions[2].label += ` (${globalAppVotersCount})`;
    const topAnnouncements = await Announcement_1.default.find({ firedTimes: { '$gt': 1 } }).sort({ firedTimes: -1 }).limit(10);
    res.render('announce', {
        title: 'Announcement',
        EventName: event.Name,
        EventId: event._id,
        topAnnouncements: topAnnouncements,
        options: announcementOptions
    });
}
exports.getAnnounce = getAnnounce;
exports.announce = async (req, res, next) => {
    logger_1.default.info(`announce() called at ${new Date().toISOString()}`, req.body);
    const message = req.body['Message'] && req.body['Message'].trim();
    const smsVote = req.body['sms-voters'] && req.body['sms-voters'].trim() === 'on';
    const appVote = req.body['app-voters'] && req.body['app-voters'].trim() === 'on';
    const appGlobalVote = req.body['global-app-voters'] && req.body['global-app-voters'].trim() === 'on';
    let globalRegistrations = [];
    if (appGlobalVote) {
        // Fetch all registrant with device token
        globalRegistrations = await Registration_1.default.find({ 'DeviceTokens': { $exists: true, $ne: [] } });
    }
    // logger.debug(`appVote ${appVote}, smsVote ${smsVote}, appGlobalVote ${appGlobalVote}`);
    try {
        const event = await Event_1.default
            .findById(req.params.eventId)
            .populate('Registrations');
        if (!event.PhoneNumber) {
            req.flash('failure', { msg: 'Failed! Server Phonenumber is missing in event Setting, please define it.' });
            res.redirect(`${process.env.ADMIN_URL}/event/${req.params.eventId}/results`);
            return;
        }
        const preferences = await Preference_1.default.find();
        const preferenceMap = {};
        for (let i = 0; i < preferences.length; i++) {
            preferenceMap[preferences[i]._id] = preferences[i];
        }
        const twilioClient = Twilio();
        const RegistrantTokens = {};
        const RegistrantAndroidTokens = {};
        const RegistrationsById = {};
        const RegistrationChannels = {};
        event.RegistrationsVoteFactor.forEach(registrant => {
            // old event don't have From in registrants
            RegistrationChannels[registrant.RegistrationId.toString()] = (registrant.From || 'sms');
        });
        const isSmsAndAppBothChecked = (smsVote && (appVote || appGlobalVote));
        event.Registrations.forEach(registrant => {
            if ((smsVote && (RegistrationChannels[registrant._id] === 'sms')) || (smsVote && RegistrationChannels[registrant._id] !== 'sms' && !isSmsAndAppBothChecked)) {
                // if sms and app both are checked then sms should not be sent to a app number
                logger_1.default.info(`Sending message: ${message} From: ${event.PhoneNumber} To: ${registrant.PhoneNumber}`);
                twilioClient.messages.create({
                    from: event.PhoneNumber,
                    to: registrant.PhoneNumber,
                    body: message
                }).then((res) => {
                    logger_1.default.info(`sent message: ${message} From: ${event.PhoneNumber} To: ${registrant.PhoneNumber}, SID: ${res.sid}`);
                    Slack_1.postToSlackSMSFlood({
                        'text': `${registrant.NickName}(${registrant.PhoneNumber}) (sms) \n${message} source: event.ts.announce`
                    }).catch(() => logger_1.default.error(`auction slack flood call failed ${message} source: event.ts.announce`));
                }).catch(e => {
                    logger_1.default.error(`Failed Message: ${message} From: ${event.PhoneNumber} To: ${registrant.PhoneNumber}, ${e}`);
                });
            }
            let hasSubscribedToEvent = false;
            const userPreference = registrant.Preferences || [];
            if (userPreference) {
                for (let i = 0; i < userPreference.length; i++) {
                    // logger.info('userPreference[i]._id', userPreference[i]._id);
                    if (preferenceMap[userPreference[i]._id].Type === 'EventRegistered') {
                        hasSubscribedToEvent = true;
                    }
                }
            }
            if ((appVote || appGlobalVote) && hasSubscribedToEvent) {
                RegistrantTokens[registrant._id] = registrant.DeviceTokens;
                RegistrantAndroidTokens[registrant._id] = registrant.AndroidDeviceTokens;
                RegistrationsById[registrant._id] = registrant;
            }
        });
        req.flash('success', { msg: 'Success! Message sent to all participants!' });
        res.redirect(`${process.env.ADMIN_URL}/event/${req.params.eventId}/results`);
        // After sending response send message to slack channel
        const user = await User_1.default.findById(req.user.id);
        const slackMessage = `${event.Name} announcement made by ${user && user.email}.\nMessage: ${message}`;
        Slack_1.default({
            'text': slackMessage
        }).catch(() => logger_1.default.info('event announcement slack call failed ', message));
        // send push notifications
        const deviceTokens = [];
        const androidTokens = [];
        const voteFactors = event.RegistrationsVoteFactor;
        for (let j = 0; j < voteFactors.length; j++) {
            // logger.debug('voteFactors[j].From', voteFactors[j].From, 'voteFactors[j].RegistrationId', voteFactors[j].RegistrationId, RegistrantTokens[voteFactors[j].RegistrationId + ''], RegistrantTokens);
            if (appVote && voteFactors[j].From === 'app') {
                console.debug('appVote', appVote, 'voteFactors[j].From', voteFactors[j].From);
                if (appVote) {
                    const userTokens = RegistrantTokens[voteFactors[j].RegistrationId + ''];
                    if (userTokens) {
                        for (let k = 0; k < userTokens.length; k++) {
                            deviceTokens.push(userTokens[k]);
                        }
                    }
                    const androidDeviceTokens = RegistrantAndroidTokens[voteFactors[j].RegistrationId + ''];
                    if (androidDeviceTokens) {
                        for (let k = 0; k < androidDeviceTokens.length; k++) {
                            androidTokens.push(androidDeviceTokens[k]);
                        }
                    }
                }
            }
        }
        // global notification need to be sent to everyone
        for (let a = 0; a < globalRegistrations.length; a++) {
            const userTokens = globalRegistrations[a].DeviceTokens;
            const androidUserTokens = globalRegistrations[a].AndroidDeviceTokens;
            if (userTokens) {
                for (let k = 0; k < userTokens.length; k++) {
                    // sbfvhjfbvdfh489tijkufggvn is test token
                    if (userTokens[k] && deviceTokens.indexOf(userTokens[k]) === -1 && userTokens[k] !== 'null' && userTokens[k] !== 'sbfvhjfbvdfh489tijkufggvn') {
                        deviceTokens.push(userTokens[k]);
                    }
                }
            }
            if (androidUserTokens) {
                for (let k = 0; k < androidUserTokens.length; k++) {
                    // sbfvhjfbvdfh489tijkufggvn is test token
                    if (androidUserTokens[k] && deviceTokens.indexOf(androidUserTokens[k]) === -1 && androidUserTokens[k] !== 'null' && androidUserTokens[k] !== 'sbfvhjfbvdfh489tijkufggvn') {
                        androidTokens.push(androidUserTokens[k]);
                    }
                }
            }
        }
        if (deviceTokens.length > 0) {
            const badDeviceTokens = await Apns_1.default(deviceTokens, message, event.Name).catch(e => logger_1.default.info(`push notification failed`, e));
            try {
                // handle bad device tokens
                const toBeCorrectedRegs = {};
                if (Array.isArray(badDeviceTokens)) {
                    const registrationIds = Object.keys(RegistrantTokens);
                    for (let i = 0; i < badDeviceTokens.length; i++) {
                        const badToken = badDeviceTokens[i].device;
                        for (let j = 0; j < registrationIds.length; j++) {
                            const indexOfBadToken = RegistrantTokens[registrationIds[j]].indexOf(badToken);
                            if (indexOfBadToken > -1) {
                                RegistrationsById[registrationIds[j]].DeviceTokens.splice(indexOfBadToken, 1);
                                toBeCorrectedRegs[registrationIds[j]] = RegistrationsById[registrationIds[j]];
                                break;
                            }
                        }
                    }
                }
                const toBeCorrectedRegIds = Object.keys(toBeCorrectedRegs);
                const promises = [];
                for (let i = 0; i < toBeCorrectedRegIds.length; i++) {
                    // toBeCorrectedRegs[toBeCorrectedRegIds[i]].save()
                    promises.push(Registration_1.default.findByIdAndUpdate(toBeCorrectedRegIds[i], {
                        '$set': {
                            'DeviceTokens': toBeCorrectedRegs[toBeCorrectedRegIds[i]].DeviceTokens
                        }
                    }).exec);
                }
                await Promise.all(promises);
            }
            catch (e) {
                logger_1.default.info(e);
            }
        }
        if (androidTokens.length > 0) {
            const androidPushRes = await FCM_1.MultiCastIgnoreErr({
                DeviceTokens: androidTokens,
                link: undefined,
                title: event.Name,
                message: message,
                priority: 'normal',
                analyticsLabel: `announce-push ${event.EID}`
            });
            logger_1.default.info(`androidPushRes ${JSON.stringify(androidPushRes)}`);
        }
        event.Logs.push({
            Message: slackMessage,
            CreatedDate: new Date()
        });
        event.save().catch(e => logger_1.default.info('Unable to store log message of slack related to announcement', e));
        let announcement = await Announcement_1.default.findOne({ message: message });
        if (!announcement) {
            announcement = new Announcement_1.default();
            announcement.message = message;
            announcement.announcements.push({
                event: event,
                createdBy: user,
            });
            announcement.firedTimes = 1;
        }
        else {
            announcement.firedTimes++;
            announcement.announcements.push({
                event: event,
                createdBy: user,
            });
        }
        await announcement.save();
    }
    catch (err) {
        logger_1.default.info(err);
        return next(err);
    }
};
exports.voteSMS = async (req, res, next) => {
    try {
        res.header('Content-Type', 'text/xml');
        logger_1.default.info('original from', req.params.From, 'Original to', req.params.To);
        const log = new VotingLog_1.default();
        let body = req.param('Body').trim();
        // the number the vote it being sent to (this should match an Event)
        const to = '+' + req.param('To').slice(1);
        // log.EaselNumber = body;
        // the voter, use this to keep people from voting more than once
        const from = '+' + req.param('From').replace(/\D/g, '');
        const event = await voteProcessor_1.getEventForSMS(to, res, next, log);
        logger_1.default.info('debug: body', body, to, from);
        const lowerCasedBody = body.toLowerCase().trim();
        if (lowerCasedBody.startsWith('easel')) {
            // handle wrong spelling
            body = `${parseInt(lowerCasedBody.replace('easel', ''))}`;
        }
        else if (lowerCasedBody === 'vote' && (event && event.RegisterAtSMSVote)) {
            return await RegistrationProcessor_1.RegisterVoter({
                ArtBattleNews: false,
                DisplayPhone: '',
                Email: '',
                FirstName: '',
                Hash: '',
                LastName: '',
                LoyaltyOffers: false,
                NotificationEmails: false,
                Preferences: [],
                RegionCode: '',
                _id: undefined,
                PhoneNumber: from,
                RegisteredAt: 'phone'
            }, event._id, false, States_1.StateVoteFactorMap[8], true);
        }
        if (!isNaN(parseInt(body))) {
            return await voteProcessor_1.processVote('xml', body, from, event, res, log, 0, 0, 'phone');
        }
        else {
            return await messageProcessor_1.processMessage(req.param('Body'), from, to, res);
        }
    }
    catch (e) {
        logger_1.default.info(`Error in voteSMS ${e.stack} Body: ${req.param('Body')}, From: ${req.param('From')}, To: ${req.param('To')}`);
        res.send('<Response><Sms>Sorry! Our system encountered an error. Please try again.</Sms></Response>');
    }
};
exports.saveEvent = async (req, res, next) => {
    const dto = req.body;
    logger_1.default.info(`Saving event: ${dto.Name}`);
    const cacheKey = `app-event-list-`;
    const cacheDel = req.app.get('cacheDel');
    const cacheDelPromises = [];
    cacheDelPromises.push(cacheDel(cacheKey));
    const preDeterminedId = new bson_1.ObjectId().toHexString();
    let savedEvent;
    try {
        if (!dto.EID) {
            throw 'EID is required';
        }
        if (dto.SponsorLogo && dto.SponsorLogo.Url.length > 0) {
            const media = new Media_1.default();
            media.UploadStart = new Date();
            await media.save();
            const fileName = `${dto.Name.replace(/[\W_]+/g, '')}-${media.id}`;
            const originalPath = `${fileName}`;
            const result = await _upload(dto.SponsorLogo.Url, originalPath);
            media.UploadFinish = result.mainEnd;
            media.Name = fileName;
            media.Url = result.main;
            media.Dimension = {
                width: result.mainWidth,
                height: result.mainHeight
            };
            media.Size = result.mainSize;
            media.UploadedBy = req.user._id;
            await media.save();
            dto.SponsorLogo = media;
        }
        else {
            dto.SponsorLogo = undefined;
        }
        const user = await User_1.default.findById(req.user.id);
        let message = '';
        /*
        Phone validation is no longer needed
        if (!dto.PhoneNumber) {
            const error = 'Invalid event record. No PhoneNumber provided.';
            logger.info(error);
            throw error;
        }*/
        /*
        Intentionally disabled phone number validation because we have predefined list for the admin
        if (!IsPhoneNumber(dto.PhoneNumber)) {
            const error = `Invalid event record. Phone Number in the wrong format ${dto.PhoneNumber}.`;
            logger.info(error);
            throw error;
        }
        */
        // For international number, this sanitization is wrong
        // dto.PhoneNumber = SanitizePhoneNumber(dto.PhoneNumber);
        const queryObj = {
            PhoneNumber: dto.PhoneNumber,
            Enabled: true,
            _id: undefined
        };
        const eidQueryObj = {
            EID: dto.EID,
        };
        if (dto._id) {
            queryObj._id = {
                '$ne': dto._id
            };
            eidQueryObj._id = {
                '$ne': dto._id
            };
        }
        else {
            dto._id = preDeterminedId;
        }
        const tasks = [
            Event_1.default.find(queryObj).countDocuments(),
            Event_1.default
                .findById(dto._id)
                .exec(),
            Event_1.default.countDocuments(eidQueryObj)
        ];
        if (dto.TimeZone) {
            tasks.push(Timezone_1.default.findById(dto.TimeZone));
        }
        const combinedData = await Promise.all(tasks);
        let event = combinedData[1];
        const dupPhoneServerCount = combinedData[0];
        const eventEidCount = combinedData[2];
        if (eventEidCount > 0) {
            throw `This EID is being Used in another event`;
        }
        if (dto.PhoneNumber && dupPhoneServerCount > 0) {
            // if phonenumber is not sent then this validation don't run
            throw 'Duplicate Server phone number found across multiple events';
        }
        let roundStr = '';
        let artistRounds = '';
        if (Array.isArray(dto.Rounds)) {
            for (let i = 0; i < dto.Rounds.length; i++) {
                const r = dto.Rounds[i];
                r.IsFinished = false;
                roundStr += `Round ${r.RoundNumber},`;
                artistRounds += `\nArtists in Round: ${r.RoundNumber} :\n`;
                for (let i = 0; i < r.Contestants.length; i++) {
                    r.Contestants[i].IsWinner = 0;
                    if (r.Contestants[i].Enabled) {
                        artistRounds += `${r.Contestants[i].EaselNumber} => ${r.Contestants[i].Detail.Name} (${r.Contestants[i].Detail.EntryId})\n`;
                        cacheDelPromises.push(cacheDel(`auction-detail-${dto.EID}-${r.RoundNumber}-${r.Contestants[i].EaselNumber}`));
                    }
                    if (!r.Contestants[i].Lot) {
                        const easelNo = r.Contestants[i].EaselNumber || (99 + i);
                        const artId = `${dto.EID}-${r.RoundNumber}-${easelNo}`;
                        const lot = await Lot_1.default.findOne({ ArtId: artId });
                        if (!lot) {
                            // link lot on rounds.contestants
                            const lotModel = new Lot_1.default();
                            lotModel.ArtId = artId;
                            lotModel.EaselNumber = r.Contestants[i].EaselNumber;
                            lotModel.Event = dto._id;
                            lotModel.Round = r.RoundNumber;
                            lotModel.Bids = [];
                            lotModel.Status = 0;
                            lotModel.Contestant = r.Contestants[i].Detail._id;
                            lotModel.ArtistId = r.Contestants[i].Detail.EntryId;
                            // lotModel.Images = [];
                            // lotModel.Videos = [];
                            r.Contestants[i].Lot = await lotModel.save();
                        }
                        else {
                            r.Contestants[i].Lot = lot;
                            // if the contestant is changed then reflect it.
                            lot.Contestant = r.Contestants[i].Detail._id;
                            lot.ArtistId = r.Contestants[i].Detail.EntryId;
                            await lot.save();
                        }
                    }
                    else {
                        logger_1.default.info(`lot exists ${r.Contestants[i].Lot}`);
                    }
                }
            }
        }
        /* In db GMT date */
        dto.TimeZoneICANN = combinedData[3] && combinedData[3].icann_name;
        const startDate = date_fns_timezone_1.parseFromTimeZone(dto.EventStartDateTime, 'M/D/Y HH:mm A', { timeZone: dto.TimeZoneICANN });
        const endDate = date_fns_timezone_1.parseFromTimeZone(dto.EventEndDateTime, 'M/D/Y HH:mm A', { timeZone: dto.TimeZoneICANN });
        dto.EventStartDateTime = startDate.toISOString();
        dto.EventEndDateTime = endDate.toISOString();
        /* In db GMT date end */
        if (!event) {
            const eventDTO = dto;
            eventDTO.Rounds = eventDTO.Rounds.map(r => {
                r.IsFinished = false;
                return r;
            });
            event = new Event_1.default(eventDTO);
            event._id = eventDTO._id;
            // After sending response send message to slack channel
            message += `${event.Name} was created by ${user && user.email} \n`;
            message += `Rounds : ${roundStr}`;
            message += artistRounds;
            event.Logs.push({
                Message: message,
                CreatedDate: new Date()
            });
            savedEvent = await event.save();
            const result = {
                Success: true,
                Data: savedEvent
            };
            res.json(result);
            // After sending response send message to slack channel
            Slack_1.default({
                'text': message
            }).catch(() => logger_1.default.info('event create slack call failed ', message));
        }
        else {
            // After sending response send message to slack channel
            message += `${event.Name} was edited by ${user && user.email} \n`;
            message += `Rounds : ${roundStr}`;
            message += artistRounds;
            event.edit(dto);
            event.Logs.push({
                Message: message,
                CreatedDate: new Date()
            });
            savedEvent = await event.save();
            const result = {
                Success: true,
                Data: savedEvent
            };
            res.json(result);
            // Delete cache
            cacheDelPromises.push(cacheDel(`${cacheKey}${savedEvent._id}`));
            Slack_1.default({
                'text': message
            }).catch(() => logger_1.default.info('event edit slack call failed ', message));
        }
        logger_1.default.info(`removing auction details/event-list cache`);
        await Promise.all(cacheDelPromises);
        logger_1.default.info(`removed auction details/event-list cache`);
    }
    catch (e) {
        if (typeof e === 'string') {
            logger_1.default.error(e);
            e = {
                Message: e,
                status: 403,
                message: e
            };
            return next(e);
        }
        if (!e.status) {
            e.status = 500;
        }
        if (!e.message) {
            logger_1.default.error(e);
            e = {
                status: 403,
            };
            e.message = 'Server error occurred!';
        }
        e.Message = e.message;
        return next(e);
    }
};
async function _upload(rawImage, originalPath) {
    const base64Data = rawImage.replace(/^data:image\/([\w+]+);base64/, '');
    const filePath = `${__dirname}/../public/uploads/images/sponsors/${originalPath}`;
    const imgBuffer = Buffer.from(base64Data, 'base64');
    const result = await Promise.all([
        _writeFile(filePath, imgBuffer),
    ]);
    return {
        main: `${process.env.MEDIA_SITE_URL}${result[0].file.substr(result[0].file.indexOf('public') + 'public'.length)}`,
        mainStart: result[0].startDate,
        mainEnd: result[0].endDate,
        mainHeight: result[0].height,
        mainWidth: result[0].width,
        mainSize: result[0].size,
        mainFile: result[0].file,
    };
}
async function _writeFile(filePath, binary) {
    const startDate = new Date();
    const imageMeta = await sharp(binary).metadata();
    const file = `${filePath}.${imageMeta.format}`;
    await fs.writeFile(file, binary);
    const endDate = new Date();
    return {
        startDate: startDate,
        endDate: endDate,
        height: imageMeta.height,
        width: imageMeta.width,
        size: imageMeta.size,
        file: file
    };
}
exports.archiveEvent = async (req, res, next) => {
    const event = await Event_1.default.findById(req.params.eventId);
    event.Enabled = false;
    await event.save();
    const result = {
        Success: true
    };
    res.json(result);
};
exports.getEvents = async (req, res, next) => {
    try {
        const user = await User_1.default.findById(req.user.id);
        const eventIds = req.user.eventIds;
        logger_1.default.info(`eventList is event admin ${req.user.IsEventAdmin}, allowed event ids ${JSON.stringify(req.user.eventIds || [])}, is guest ${req.user.IsGuestUser} dont have password ${!req.user.password}`);
        if ((!req.user.password && !req.user.IsGuestUser) ||
            (req.user.IsGuestUser && !req.user.IsEventAdmin) ||
            (req.user.IsGuestUser && req.user.IsEventAdmin && req.user.eventIds && req.user.eventIds.length === 0)) {
            res.json({
                status: 404,
                message: 'No event found'
            });
            return;
        }
        const condition = {
            'Enabled': (req.query.enabled && parseInt(req.query.enabled) === 1) || false,
        };
        if (eventIds && eventIds.length > 0) {
            // @ts-ignore
            condition._id = { $in: eventIds };
        }
        let query = Event_1.default.find(condition)
            .select([
            '_id',
            'Name',
            'PhoneNumber',
            'Rounds',
            'CurrentRound',
            'Country'
        ])
            .populate('Country')
            .sort({
            '_id': -1
        });
        if (!(req.user && req.user.IsEventAdmin || (user && user.isAdmin))) {
            // to non admin show enabled event only
            query = query.where('Enabled').equals(true);
        }
        const events = await query.exec();
        const filterRoundFn = (roundObj) => {
            return {
                IsFinished: roundObj.IsFinished,
                RoundNumber: roundObj.RoundNumber
            };
        };
        const filteredEvents = []; // Reduce Payload size
        for (let i = 0; i < events.length; i++) {
            const filteredEventObj = {
                _id: events[i]._id,
                Name: events[i].Name,
                PhoneNumber: events[i].PhoneNumber,
                Enabled: events[i].Enabled,
                Rounds: [],
                CurrentRound: events[i].CurrentRound ? filterRoundFn(events[i].CurrentRound) : null,
                countryFlag: events[i].Country && events[i].Country.country_image
            };
            const filteredRounds = [];
            for (let j = 0; j < events[i].Rounds.length; j++) {
                filteredRounds.push(filterRoundFn(events[i].Rounds[j]));
            }
            filteredEventObj.Rounds = filteredRounds;
            filteredEvents.push(filteredEventObj);
        }
        res.json(filteredEvents);
    }
    catch (err) {
        return next(err);
    }
};
exports.getEvent = async (req, res, next) => {
    let event;
    const body = {
        ReportLinks: [],
        PhoneNumbers: await EventPhoneNumber_1.default.find({
            type: 'vote',
            status: 1
        })
    };
    try {
        const user = await User_1.default.findById(req.user.id);
        event = await Event_1.default
            .findById(req.params.eventId)
            .populate('Contestants')
            .populate('Rounds.Contestants.Detail')
            .populate('Rounds.Contestants.Votes')
            .populate('CurrentRound.Contestants.Detail')
            .populate('CurrentRound.Contestants.Votes')
            .populate('SponsorLogo')
            .exec();
        if (req.user && req.user.IsEventAdmin || (user && user.isAdmin)) {
            // @ts-ignore
            body.ReportLinks = [
                {
                    label: 'Download Votes report',
                    link: `/event/${req.params.eventId}/votes`
                },
                {
                    label: 'Download Registrations report',
                    link: `/event/${req.params.eventId}/registrations`
                }
            ];
        }
        if (event.Enabled || ((req.user && req.user.IsEventAdmin || (user && user.isAdmin)) && !event.Enabled)) {
            const eventObj = event.toObject();
            if (!event.TimeZoneICANN) {
                event.TimeZoneICANN = 'America/Los_Angeles';
            }
            eventObj.EventStartDateTime = date_fns_timezone_1.formatToTimeZone(new Date(event.EventStartDateTime), 'MM/DD/YYYY hh:mm A', { timeZone: event.TimeZoneICANN }).toString();
            eventObj.EventEndDateTime = date_fns_timezone_1.formatToTimeZone(new Date(event.EventEndDateTime), 'MM/DD/YYYY hh:mm A', { timeZone: event.TimeZoneICANN });
            eventObj.AuctionCloseStartsAt = date_fns_timezone_1.formatToTimeZone(new Date(event.AuctionCloseStartsAt), 'MM/DD/YYYY hh:mm A', { timeZone: event.TimeZoneICANN }).toString();
            logger_1.default.info(eventObj.EventStartDateTime, eventObj.TimeZoneICANN);
            res.json(Object.assign(Object.assign({}, body), eventObj));
        }
    }
    catch (err) {
        return next(err);
    }
};
/**
 * Increment Round
 * @param req
 * @param res
 * @param next
 */
exports.incrementRound = async (req, res, next) => {
    try {
        res.json(await eventRoundIncrement_1.EventIncrementRound(req, req.params.eventId, req.user.id));
    }
    catch (e) {
        return next(e);
    }
};
/**
 * Download Voter logs
 * @param req
 * @param res
 * @param next
 */
exports.voterLogs = async (req, res, next) => {
    const eventId = req.params.eventId;
    res.setHeader('Content-disposition', `attachment; filename=voterLogs_${eventId}.csv`);
    res.writeHead(200, {
        'Content-Type': 'text/csv'
    });
    res.write(`"EventId","EventName","EaselNumber","RoundNumber","Status","ArtistName","PhoneNumber","createdAtUnix","createdAt"\n`);
    VotingLog_1.default.find({
        EventId: req.params.eventId
    }).cursor({
        transform: (doc) => {
            return `"${doc.EventId}","${doc.EventName}","${doc.EaselNumber}","${doc.RoundNumber}","${doc.Status}","${doc.ArtistName}","${doc.PhoneNumber}","${new Date(doc.createdAt).getTime()}","${date_fns_timezone_1.formatToTimeZone(new Date(doc.createdAt), 'MM/DD/YYYY hh:mm:ss', {
                timeZone: 'America/Los_Angeles'
            })}"\n`;
        }
    }).pipe(res);
};
/**
 * Download Registration Logs
 * @param req
 * @param res
 * @param next
 */
exports.registrationLogs = async (req, res, next) => {
    const eventId = req.params.eventId;
    res.setHeader('Content-disposition', `attachment; filename=registrationLogs_${eventId}.csv`);
    res.writeHead(200, {
        'Content-Type': 'text/csv'
    });
    res.write(`"PhoneNumber","NumberExists","EventId","EventName","AlreadyRegisteredForEvent","Email","FirstName","LastName","createdAtUnix","createdAt"\n`);
    RegistrationLog_1.default.find({
        EventId: req.params.eventId
    }).cursor({
        transform: (doc) => {
            return `"${doc.PhoneNumber}","${doc.NumberExists}","${doc.EventId}","${doc.EventName}","${doc.AlreadyRegisteredForEvent}","${doc.Email}","${doc.FirstName}","${doc.LastName}","${new Date(doc.createdAt).getTime()}","${date_fns_timezone_1.formatToTimeZone(new Date(doc.createdAt), 'MM/DD/YYYY hh:mm:ss', {
                timeZone: 'America/Los_Angeles'
            })}"\n`;
        }
    }).pipe(res);
};
/**
 * Time series of registration done for a event and Voting for contestants per round
 * @param req
 * @param res
 * @param next
 */
exports.voteRegistrationsSeries = async (req, res, next) => {
    const event = await Event_1.default.findById(req.params.eventId).select('Contestants').populate('Contestants');
    const contestantsCount = event && event.Contestants.length;
    try {
        const results = await Promise.all([
            RegistrationLog_1.default.aggregate([
                {
                    '$match': {
                        'EventId': req.params.eventId,
                        'AlreadyRegisteredForEvent': false
                    }
                },
                {
                    '$skip': contestantsCount
                },
                {
                    '$group': {
                        '_id': {
                            '$subtract': [
                                { '$subtract': ['$createdAt', new Date(0)] },
                                {
                                    '$mod': [
                                        { '$subtract': ['$createdAt', new Date(0)] },
                                        1000 * 60
                                    ]
                                }
                            ]
                        },
                        'total': { '$sum': 1 }
                    },
                },
                {
                    '$sort': { '_id': 1 }
                },
            ]).exec(),
            VotingLog_1.default.aggregate([
                {
                    '$match': {
                        'EventId': req.params.eventId,
                        'Status': 'VOTE_ACCEPTED'
                    }
                },
                {
                    '$group': {
                        '_id': {
                            'EaselNumber': '$EaselNumber',
                            'RoundNumber': '$RoundNumber',
                            'time': {
                                '$subtract': [
                                    { '$subtract': ['$createdAt', new Date(0)] },
                                    {
                                        '$mod': [
                                            { '$subtract': ['$createdAt', new Date(0)] },
                                            1000 * 60
                                        ]
                                    }
                                ]
                            }
                        },
                        'total': { '$sum': '$VoteFactor' }
                    },
                },
                {
                    '$sort': { '_id.time': 1 }
                }
            ]).exec()
        ]);
        const registrationDataSet = results[0];
        const votingDataSet = results[1];
        const series = [];
        const registrationSeries = [];
        let cumulativeSum = 0;
        for (let i = 0; i < registrationDataSet.length; i++) {
            cumulativeSum = cumulativeSum + registrationDataSet[i].total;
            registrationSeries.push([
                registrationDataSet[i]._id,
                cumulativeSum // sum cumulative registrations
            ]);
        }
        series.push({
            name: 'Registration Series',
            data: registrationSeries,
            type: 'spline'
        });
        const votingSeriesMap = ['reg']; // reg for registration
        const votingSeriesCumulativeSum = [-10]; // 10 for registration
        for (let j = 0; j < votingDataSet.length; j++) {
            const uniqueProp = `Votes-R${votingDataSet[j]._id.RoundNumber}E${votingDataSet[j]._id.EaselNumber}`;
            let indexOfSeries = votingSeriesMap.indexOf(uniqueProp);
            if (indexOfSeries === -1) {
                const arrLen = votingSeriesMap.push(uniqueProp);
                indexOfSeries = arrLen - 1;
                series[indexOfSeries] = {
                    name: `${uniqueProp}`,
                    data: [],
                    type: 'spline'
                };
                votingSeriesCumulativeSum[indexOfSeries] = 0;
            }
            // cumulative sum
            votingSeriesCumulativeSum[indexOfSeries] = votingSeriesCumulativeSum[indexOfSeries] + votingDataSet[j].total;
            series[indexOfSeries].data.push([
                votingDataSet[j]._id.time,
                Math.round(votingSeriesCumulativeSum[indexOfSeries] * 10) / 10
            ]);
        }
        res.json(series);
    }
    catch (e) {
        next(e);
    }
};
/**
 * Time series of voting done per round.
 * @param req
 * @param res
 * @param next
 */
exports.voteRoundSeries = async (req, res, next) => {
    try {
        const results = await VotingLog_1.default.aggregate([
            {
                '$match': {
                    'EventId': req.params.eventId,
                    'Status': 'VOTE_ACCEPTED'
                }
            },
            {
                '$group': {
                    '_id': {
                        'RoundNumber': '$RoundNumber',
                        'time': {
                            '$subtract': [
                                { '$subtract': ['$createdAt', new Date(0)] },
                                {
                                    '$mod': [
                                        { '$subtract': ['$createdAt', new Date(0)] },
                                        1000 * 60
                                    ]
                                }
                            ]
                        }
                    },
                    'total': { '$sum': 1 }
                },
            },
            {
                '$sort': { '_id.time': 1 }
            }
        ]).allowDiskUse(true);
        const votingSeriesMap = [];
        const series = [];
        for (let i = 0; i < results.length; i++) {
            const uniqueProp = `Round${results[i]._id.RoundNumber}`;
            let indexOfSeries = votingSeriesMap.indexOf(uniqueProp);
            if (indexOfSeries === -1) {
                indexOfSeries = (votingSeriesMap.push(uniqueProp)) - 1;
                series[indexOfSeries] = {
                    name: `${uniqueProp}`,
                    data: [],
                    type: 'spline'
                };
            }
            series[indexOfSeries].data.push([
                results[i]._id.time,
                results[i].total
            ]);
        }
        res.json(series);
    }
    catch (e) {
        next(e);
    }
};
exports.voteLink = async (req, res, next) => {
    try {
        const voteHash = req.params.voteHash;
        const eventDoc = await Event_1.default.findOne({
            'RegistrationsVoteFactor.VoteUrl': `/v/${voteHash}`,
        })
            .select(['Name', 'Description', '_id', 'VoteByLink', 'Rounds', 'CurrentRound', 'RegistrationsVoteFactor', 'Contestants', 'Images', 'EnableAuction', 'EID', 'AdminControlInAuctionPage'])
            .populate('Rounds.Contestants.Detail')
            .populate('Country');
        if (!eventDoc) {
            return next(new Error('Invalid link'));
        }
        const openAuctionCount = await Lot_1.default.countDocuments({
            'Event': eventDoc._id,
            'Status': 1
        });
        const userAgentHeader = req.header('user-agent');
        const isIos = userAgentHeader.indexOf('Battle') > -1;
        const isAndroid = userAgentHeader.indexOf('okhttp') > -1;
        const isWeb = !(isAndroid || isIos);
        const totalRounds = eventDoc.Rounds.length;
        const currentRound = eventDoc.CurrentRound;
        let currentRoundNumber = currentRound && currentRound.RoundNumber;
        let currentRoundIndex;
        const roundWiseImages = [];
        for (let j = 0; j < totalRounds; j++) {
            const artistsInRound = eventDoc.Rounds[j].Contestants;
            const artistsImages = ArtistWiseImages_1.default(artistsInRound);
            const response = {
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
        const registrationObj = eventDoc.RegistrationsVoteFactor.find((reg) => {
            return reg.VoteUrl === `/v/${voteHash}`;
        });
        /*const token = sign({
           registrationId: registrationObj.RegistrationId
        }, process.env.JWT_SECRET,  { expiresIn: process.env.JWT_EXP_TIME || '1y'});
        res.cookie('jwt', token, {
           httpOnly: true,
           sameSite: true,
           signed: true,
           secure: true
        });*/
        const votesCount = await VotingLog_1.default.countDocuments({
            'PhoneHash': registrationObj.Hash,
            'Status': 'VOTE_ACCEPTED'
        });
        if (!currentRoundNumber) {
            currentRoundNumber = 0;
        }
        res.render('vote_link', {
            title: eventDoc.Name,
            VoterHash: registrationObj.Hash,
            voteHash: voteHash,
            Description: eventDoc.Description,
            countryFlag: eventDoc.Country && eventDoc.Country.country_image,
            votesCount: votesCount,
            voteFactor: registrationObj.VoteFactor,
            roundWiseImages: roundWiseImages,
            CurrentRoundNumber: currentRoundNumber,
            userStatus: registrationObj.Status,
            openAuctionCount: openAuctionCount,
            EID: eventDoc.EID
        });
    }
    catch (e) {
        next(e);
    }
};
exports.handleVoteForm = async (req, res, next) => {
    try {
        const roundNumber = req.params.RoundNumber;
        const log = new VotingLog_1.default();
        const vote = req.params.text;
        const hash = req.params.urlHash;
        const event = await voteProcessor_1.getEventForForm(res, hash, next, log);
        let from = '';
        for (let i = 0; i < event.RegistrationsVoteFactor.length; i++) {
            if (event.RegistrationsVoteFactor[i].VoteUrl === `/v/${hash}`) {
                from = event.RegistrationsVoteFactor[i].PhoneNumber || event.RegistrationsVoteFactor[i].Email;
                break;
            }
        } // from check is in processVote
        if (event && !event.VoteByLink) {
            // voting by link disabled
            voteProcessor_1.sendResponse('json', res, 'VOTING_WEB_DISABLED');
        }
        if (from) {
            return await voteProcessor_1.processVote('json', vote, from, event, res, log, roundNumber, 0, 'online');
        }
        else {
            next({
                message: 'Something went wrong',
                status: 500
            });
            return;
        }
    }
    catch (e) {
        next(e);
    }
};
/**
 * Bar chart that shows vote source (web-new exp-sms etc) per round.
 * @param req
 * @param res
 * @param next
 */
exports.voteBarGraph = async (req, res, next) => {
    try {
        const results = await Promise.all([
            VotingLog_1.default.aggregate([
                {
                    '$match': {
                        'EventId': req.params.eventId,
                        'Status': 'VOTE_ACCEPTED',
                        'VoteFactor': {
                            '$lte': 1
                        }
                    }
                },
                {
                    '$group': {
                        '_id': {
                            'RoundNumber': '$RoundNumber'
                        },
                        'total': { '$sum': 1 },
                        'totalVoteFactor': { '$sum': '$VoteFactor' }
                    },
                },
                {
                    '$sort': {
                        '_id.RoundNumber': 1,
                        '_id.VoteChannel.Channel': 1
                    },
                }
            ]),
            VotingLog_1.default.aggregate([
                {
                    '$match': {
                        'EventId': req.params.eventId,
                        'Status': 'VOTE_ACCEPTED',
                        'VoteFactor': {
                            '$gt': 1
                        }
                    }
                },
                {
                    '$group': {
                        '_id': {
                            'RoundNumber': '$RoundNumber'
                        },
                        'total': { '$sum': 1 },
                        'totalVoteFactor': { '$sum': '$VoteFactor' }
                    },
                },
                {
                    '$sort': {
                        '_id.RoundNumber': 1,
                        '_id.VoteChannel.Channel': 1
                    },
                }
            ]).exec()
        ]);
        const series = [];
        const propMap = [
            {
                type: 'New',
                color: '#DFF1FF'
            },
            {
                type: 'Return Guests',
                color: '#486895'
            }
        ];
        const rounds = [];
        const roundWiseExp = [];
        const roundWiseExpDiff = [];
        for (let i = 0; i < results.length; i++) {
            series[i] = {
                name: `${propMap[i].type}`,
                data: [],
                color: propMap[i].color
            };
            for (let j = 0; j < results[i].length; j++) {
                // experienced and new
                let roundIndex = rounds.indexOf(`Round ${results[i][j]._id.RoundNumber}`);
                if (roundIndex === -1) {
                    roundIndex = (rounds.push(`Round ${results[i][j]._id.RoundNumber}`)) - 1;
                    roundWiseExp[roundIndex] = {
                        totalVotes: 0,
                        totalVoteFactor: 0,
                        diff: 0
                    };
                }
                series[i].data[roundIndex] = results[i][j].total;
                roundWiseExp[roundIndex].totalVotes = roundWiseExp[roundIndex].totalVotes + results[i][j].total;
                roundWiseExp[roundIndex].totalVoteFactor = roundWiseExp[roundIndex].totalVoteFactor + results[i][j].totalVoteFactor;
                roundWiseExpDiff[roundIndex] = Math.round((roundWiseExp[roundIndex].totalVoteFactor - roundWiseExp[roundIndex].totalVotes) * 10) / 10;
            }
        }
        series.push({
            name: 'exp value',
            data: roundWiseExpDiff,
            color: '#DBA11C'
        });
        res.json({
            series: series.reverse(),
            categories: rounds
        });
    }
    catch (e) {
        next(e);
    }
};
exports.eventListHtml = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        let token = authHeader && authHeader.replace('Bearer ', '');
        let selectedEvent;
        let userStatus = '';
        let phoneHash = '';
        const voteHash = req.params.voteHash;
        if (voteHash) {
            selectedEvent = await Event_1.default.findOne({
                'RegistrationsVoteFactor.VoteUrl': `/v/${voteHash}`,
            }).select(['_id', 'RegistrationsVoteFactor']);
            if (!selectedEvent) {
                return next('Invalid link');
            }
            for (let i = 0; i < selectedEvent.RegistrationsVoteFactor.length; i++) {
                const voteFactor = selectedEvent.RegistrationsVoteFactor[i];
                if (voteFactor.VoteUrl === `/v/${voteHash}`) {
                    const regId = voteFactor.RegistrationId;
                    userStatus = voteFactor.Status;
                    req.user = await Registration_1.default.findById(regId);
                    break;
                }
            }
            if (req.user) {
                token = jsonwebtoken_1.sign({
                    registrationId: req.user._id
                }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXP_TIME || '1y' });
            }
        }
        if (req.user) {
            // set cookie only for those who opened in browser.
            // dup token calculation because we are targeting cookie based req.user here
            token = jsonwebtoken_1.sign({
                registrationId: req.user._id
            }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXP_TIME || '1y' });
            res.cookie('jwt', token, {
                httpOnly: true,
                sameSite: true,
                signed: true,
                secure: true,
                domain: 'artbattle.com'
            });
            phoneHash = req.user.Hash;
        }
        res.render('eventList', {
            token: token,
            eventId: req.params.eventId || selectedEvent && selectedEvent._id,
            userStatus: userStatus,
            VoterHash: voteHash,
            Message: req.user && req.user.IsArtist ? {
                Title: `BEST ART WINS`,
                Body: `Hi ${req.user.FirstName || req.user.NickName || req.user.DisplayPhone}!, thank you for registering to paint with Art Battle. We value you participation,
         and especially in voting. As a registered artist, your vote means more - and is literally worth more - when you vote online or in person at Art Battle
         events. So vote for the best, help us make sure that the best art wins!`
            } : {},
            phoneHash: phoneHash,
            site_url: process.env.ADMIN_URL,
            title: `BEST ART WINS`,
        });
    }
    catch (e) {
        next(e);
    }
};
exports.eventList = async (req, res, next) => {
    const PhoneNumber = false;
    // const IanaTimezone = req.params.Timezone;
    /*if (req.hasOwnProperty('registration') && req.registration.PhoneNumber) {
        PhoneNumber = req.registration.PhoneNumber;
    }*/
    const eventId = req.query.eventId;
    const cacheGet = req.app.get('cacheGet');
    const cacheSet = req.app.get('cacheSet');
    const cacheKey = `app-event-list-${eventId || ''}`;
    let activeEvents;
    const activeEventsJson = await cacheGet(cacheKey);
    if (activeEventsJson) {
        logger_1.default.info(`serving event list from cache ${cacheKey}`);
        res.json(JSON.parse(activeEventsJson));
        return;
    }
    const query = {};
    if (eventId && eventId.length > 0) {
        query._id = eventId;
    }
    else {
        query.ShowInApp = true;
    }
    const promises = [];
    const promise1 = Event_1.default.find(query).select([
        '_id',
        'EID',
        'Name',
        'CurrentRound',
        'Country',
        'Rounds',
        'EventStartDateTime',
        'EventEndDateTime',
        'LiveStream',
        'VideoStream',
        'TicketLink',
        'Venue',
        'Price',
        'Description',
        'EventEndDateTime',
        'TimeZoneICANN',
        'SponsorLogo',
        'SponsorText',
        'EnableAuction'
    ])
        .populate('Country')
        // .populate('Rounds.Contestants.Votes')
        .populate('Rounds.Contestants.Detail')
        .populate('SponsorLogo')
        .sort({
        'EventStartDateTime': -1
    });
    promises.push(promise1);
    // past event list
    const results = await Promise.all(promises);
    activeEvents = results[0];
    const activeEventsList = [];
    const eventIds = [];
    const eventStrIds = [];
    let topPlayerUrl;
    for (let i = 0; i < activeEvents.length; i++) {
        const event = activeEvents[i];
        const currentRound = event.CurrentRound;
        const currentRoundNumber = currentRound && currentRound.RoundNumber;
        let winnerImage;
        let winnerName;
        let winnerId;
        let numVotes = 0;
        let roundText = '';
        let roundColor = '';
        let statusTextColor = '#FFF';
        const totalRounds = event.Rounds.length;
        let hasOpenRound = false;
        const finalRoundContestantMap = [];
        const manualWinners = [];
        const contestantsWithVotes = [];
        let roundWithSingleWinner;
        for (let j = 0; j < totalRounds; j++) {
            const Round = event.Rounds[j];
            if (!Round.IsFinished) {
                hasOpenRound = true;
            }
            const contestants = Round.Contestants;
            let numWinners = 0;
            for (let k = 0; k < contestants.length; k++) {
                if (contestants[k].IsWinner) {
                    numWinners++;
                }
                numVotes += contestants[k].Votes.length;
                /*contestantsWithVotes.push({
                   Votes: contestants[k].Votes.length,
                   Image: contestants[k].Images && contestants[k].Images[contestants[k].Images.length - 1],
                   Name: contestants[k].Detail.Name,
                   IsWinner: contestants[k].IsWinner,
                   FinalRound: totalRounds === Round.RoundNumber,
                   RoundNumber: Round.RoundNumber
                });
                if (totalRounds === Round.RoundNumber
                   && contestants[k].Enabled && contestants[k].EaselNumber > 0) {
                   // final round
                   finalRoundContestantMap[k] = {
                      Votes: contestants[k].Votes.length,
                      // Image: contestants[k].Images[contestants[k].Images.length - 1],
                      IsWinner: contestants[k].IsWinner,
                      Name: contestants[k].Detail.Name
                   };
    
                }*/
            }
            if (numWinners === 1) {
                roundWithSingleWinner = Round;
            }
        }
        if (roundWithSingleWinner) {
            for (let k = 0; k < roundWithSingleWinner.Contestants.length; k++) {
                const contestant = roundWithSingleWinner.Contestants[k];
                if (contestant.IsWinner === 1) {
                    winnerName = contestant.Detail.Name;
                    winnerImage = contestant.Images && contestant.Images[contestant.Images.length - 1];
                    winnerId = contestant.Detail._id;
                    break;
                }
            }
        }
        /*
        const winners = manualWinners.sort((a, b) => {
           return b.RoundNumber - a.RoundNumber;
        });
        const filteredWinners = [];
        let lastRoundNumber = 0;
        for (let i = 0; i < winners.length; i++) {
           lastRoundNumber = winners[i].RoundNumber;
           if (winners[i].RoundNumber < lastRoundNumber) {
              break;
           }
           filteredWinners.push(manualWinners[i]);
        }
        const sortedWinners = filteredWinners.sort((a, b) => {
           return b.Votes - a.Votes;
        });
        if (sortedWinners[0]) {
           winnerName = sortedWinners[0].Name;
           const filteredContestantImages = contestantsWithVotes.filter((contestant) => {
              if (contestant.Name === winnerName) {
                 return true;
              }
              return false;
           });
           const sortedImages = filteredContestantImages.sort((a, b) => {
              return b.Votes - a.Votes;
           });
           winnerImage = sortedImages[0].Image;
        }
  
        console.log('sortedContestants', sortedContestants);
        if (manualWinners.length > 0) {
            const sorted = manualWinners.sort((a, b) => {
                return b.Votes - a.Votes;
            });
            if (sorted[0]) {
                winnerName = sorted[0].Name;
                // winnerImage = sorted[0].Image;
            }
        }
        else {
            const sorted = finalRoundContestantMap.sort((a, b) => {
                return b.Votes - a.Votes;
            });
            if (sorted[0]) {
                winnerName = sorted[0].Name;
               //  winnerImage = sorted[0].Image;
            }
        }
        const sorted = contestantsWithVotes.sort((a, b) => {
            return b.Votes - a.Votes;
        });
  
        for (let n = 0; n < sorted.length; n++) {
            if (sorted[n].Name === winnerName) {
                winnerImage = sorted[n].Image;
                break;
            }
        }*/
        /*if (sorted[0]) {
            winnerImage = sorted[0].Image;
        }*/
        if (currentRoundNumber) {
            roundText = `LIVE`;
            roundColor = '#D14B19';
        }
        else {
            if (hasOpenRound) {
                const eventDate = new Date(event.EventStartDateTime);
                const differenceInMs = date_fns_1.differenceInMilliseconds(eventDate, new Date());
                const distanceInWord = date_fns_1.distanceInWordsStrict(eventDate, new Date());
                if (differenceInMs > 0) {
                    roundText = `In ${distanceInWord}`;
                    roundColor = '#1975D1';
                    roundText = roundText.replace('days', 'd');
                    roundText = roundText.replace('seconds', 's');
                    roundText = roundText.replace('hours', 'h');
                    roundText = roundText.replace('minutes', 'm');
                    roundText = roundText.replace('months', 'mo');
                    roundText = roundText.replace('years', 'y');
                }
                else {
                    roundText = `Starting soon`;
                    roundColor = '#1975D1';
                }
            }
            else {
                roundText = 'FINAL';
                roundColor = '#FFF';
                statusTextColor = '#000';
            }
        }
        eventIds.push(event._id);
        eventStrIds.push(event._id.toString());
        let streamUrl;
        const currentTime = new Date().getTime();
        const startTime = new Date(event.EventStartDateTime).getTime();
        const endTime = new Date(event.EventEndDateTime).getTime();
        if ((currentTime > startTime && currentTime < endTime) && event.LiveStream) {
            streamUrl = event.LiveStream;
            if (!topPlayerUrl) {
                topPlayerUrl = streamUrl;
            }
        }
        else {
            streamUrl = event.VideoStream;
        }
        const eventObj = {
            EID: event.EID || '',
            eventId: event._id.toString(),
            title: event.Name,
            flag: event.Country ? `${process.env.SITE_URL}/images/countries/4x3/${event.Country.country_image}` : '',
            flagPng: event.Country ? `${process.env.SITE_URL}/images/countries/4x3_png/${event.Country.country_image.replace('svg', 'png')}` : '',
            statusText: roundText,
            statusColor: roundColor,
            statusTextColor: statusTextColor,
            openVoting: false,
            openStatus: false,
            TicketLink: event.TicketLink || '',
            Venue: event.Venue || '',
            Price: event.Price || '',
            Description: event.Description,
            DataTimeRange: date_fns_timezone_1.formatToTimeZone(new Date(event.EventStartDateTime), 'MMMMDo-hmmaz', { timeZone: event.TimeZoneICANN || 'America/Toronto' }),
            Votes: numVotes,
            EventNo: i + 1,
            openAuctionCount: 0,
            winnerImage: winnerImage,
            winnerName: winnerName,
            winnerId: winnerId,
            sponsorLogo: event.SponsorLogo,
            sponsorText: event.SponsorText,
            EnableAuction: event.EnableAuction,
            StreamUrl: streamUrl
        };
        activeEventsList.push(eventObj);
    }
    /*const openAuctionCountPerEvents = await LotModel.aggregate([
       {
          $match: {
             'Event': { $in: eventIds },
             'Status': 2,
          }
       },
       {
          $group: {
             _id: { Event: '$Event' },
             count: { $sum: 1 }
          }
       }
    ]);
 
    for (let i = 0; i < openAuctionCountPerEvents.length; i++) {
       const id = openAuctionCountPerEvents[i]._id.Event;
       const eventIdIndex = eventStrIds.indexOf(id.toString());
       activeEventsList[eventIdIndex].openAuctionCount = openAuctionCountPerEvents[i].count;
    }*/
    const eventList = [
        {
            label: 'ACTIVE EVENTS',
            items: activeEventsList,
            topPlayerUrl: topPlayerUrl
        }
    ];
    const result = {
        'Success': true,
        Data: eventList
    };
    logger_1.default.info(`saving events list in cache ${cacheKey}`);
    await cacheSet(cacheKey, JSON.stringify(result)); // auto expire in 10 minutes
    logger_1.default.info(`saved events list in cache ${cacheKey}`);
    res.json(result);
};
exports.makeWinner = async function (req, res, next) {
    // /:eventId/:contestantId/:RoundNumber/:IsWinner
    try {
        const eventId = req.params.eventId;
        const contestantId = req.params.contestantId;
        const roundNumber = parseInt(req.params.roundNumber);
        const isWinner = parseInt(req.params.IsWinner);
        if (!(isWinner === 0 || isWinner === 1)) {
            res.status(403);
            logger_1.default.info(`Is Winner should be 0 or 1`, req.params.IsWinner);
            const result = {
                'Success': false,
                Data: 'Invalid'
            };
            res.json(result);
            return;
        }
        const event = await Event_1.default.findOne({
            _id: eventId
        });
        let isModified = false;
        if (event) {
            const updateContestant = function (contestants, contestantId) {
                for (let j = 0; j < contestants.length; j++) {
                    const contestant = contestants[j];
                    if (contestant._id == contestantId) {
                        contestant.IsWinner = isWinner;
                        isModified = true;
                        return contestants;
                    }
                }
            };
            for (let i = 0; i < event.Rounds.length; i++) {
                const round = event.Rounds[i];
                if (round.RoundNumber === roundNumber) {
                    round.Contestants = updateContestant(round.Contestants, contestantId);
                    isModified = !!(round.Contestants);
                    const currentRoundNumber = event.CurrentRound && event.CurrentRound.RoundNumber;
                    if (isModified && round.RoundNumber === currentRoundNumber) {
                        event.CurrentRound.Contestants = updateContestant(event.CurrentRound.Contestants, contestantId);
                    }
                    break;
                }
            }
            if (isModified) {
                await event.save();
                const result = {
                    'Success': true,
                    Data: isWinner === 0 ? '' : 'Winner'
                };
                const cacheKey = `app-event-list-`;
                const cacheDel = req.app.get('cacheDel');
                const cacheDelPromises = [];
                cacheDelPromises.push(cacheDel(`${cacheKey}${eventId}`));
                cacheDelPromises.push(cacheDel(cacheKey));
                await Promise.all(cacheDelPromises);
                res.json(result);
                return;
            }
            else {
                logger_1.default.info(`nothing modified ${eventId}`);
                res.status(403);
                const result = {
                    'Success': false,
                    Data: 'Invalid'
                };
                res.json(result);
                return;
            }
        }
        else {
            logger_1.default.info(`matching event not found ${eventId}`);
            res.status(403);
            const result = {
                'Success': false,
                Data: 'Invalid'
            };
            res.json(result);
            return;
        }
    }
    catch (e) {
        logger_1.default.info(e);
        const result = {
            'Success': false,
            Data: 'Internal Server Error'
        };
        res.status(500);
        res.json(result);
    }
};
exports.eventStats = async function (req, res, next) {
    try {
        const eventIds = req.user.eventIds;
        const condition = {};
        if (eventIds && eventIds.length > 0) {
            // @ts-ignore
            condition._id = { $in: eventIds };
        }
        const events = await Event_1.default.find(condition)
            .select(['_id', 'Name', 'RegistrationsVoteFactor'])
            .sort({ '_id': -1 });
        const eventStates = [];
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const eventState = {
                EventId: event._id,
                Name: event.Name,
                Registered: 0,
                Door: 0,
                Online: 0
            };
            for (let j = 0; j < event.RegistrationsVoteFactor.length; j++) {
                const voter = event.RegistrationsVoteFactor[j];
                eventState.Registered++;
                if (!voter.From || voter.From === 'sms') {
                    eventState.Door++;
                }
                else {
                    eventState.Online++;
                }
            }
            eventStates.push(eventState);
        }
        const result = {
            'Success': true,
            Data: eventStates
        };
        res.json(result);
        return;
    }
    catch (e) {
        logger_1.default.info(e);
        const result = {
            'Success': false,
            Data: 'Internal Server Error'
        };
        res.status(500);
        res.json(result);
    }
};
exports.viewEvent = async function (req, res, next) {
    try {
        const eventDoc = await Event_1.default.findById(req.params.eventId).select(['_id', 'EID', 'VoteByLink', 'Rounds', 'CurrentRound', 'RegistrationsVoteFactor', 'Contestants', 'Images'])
            .populate('Rounds.Contestants.Detail')
            .populate('Rounds.Contestants.Votes')
            .populate('CurrentRound.Contestants.Votes')
            .populate('Country');
        if (!eventDoc) {
            return next({
                message: 'Invalid link',
                status: 404
            });
        }
        const totalRounds = eventDoc.Rounds.length;
        const currentRound = eventDoc.CurrentRound;
        let currentRoundNumber = currentRound && currentRound.RoundNumber;
        let currentRoundIndex;
        const roundWiseImages = [];
        for (let j = 0; j < totalRounds; j++) {
            const artistsInRound = eventDoc.Rounds[j].Contestants;
            const artistsImages = ArtistWiseImages_1.default(artistsInRound, req.user);
            const response = {
                EventId: eventDoc.id,
                EID: eventDoc.EID || '',
                RoundNumber: eventDoc.Rounds[j].RoundNumber,
                Artists: artistsImages.artists,
                IsCurrentRound: currentRoundNumber === eventDoc.Rounds[j].RoundNumber,
                HasOpenRound: !eventDoc.Rounds[j].IsFinished,
                HasImages: artistsImages.hasImages,
                EnableAuction: eventDoc.EnableAuction,
                HasVoted: (!!eventDoc.hasVoted(req.user.PhoneNumber || req.user.Email, eventDoc.Rounds[j]))
            };
            roundWiseImages.push(response);
            let round = eventDoc.Rounds[j];
            if (response.IsCurrentRound) {
                currentRoundIndex = j;
                round = eventDoc.CurrentRound;
            }
            const numbers = [];
            round.Contestants.forEach((cur) => {
                cur.Votes.forEach((v) => {
                    numbers.push(v.PhoneNumber || v.Email);
                });
            });
        }
        if (!currentRoundNumber) {
            currentRoundNumber = 0;
        }
        const result = {
            'Success': true,
            Data: {
                roundWiseImages: roundWiseImages,
                CurrentRoundNumber: currentRoundNumber,
            }
        };
        res.json(result);
    }
    catch (e) {
        next(e);
    }
};
exports.appVote = async (req, res, next) => {
    try {
        const log = new VotingLog_1.default();
        const vote = req.params.easelNumber;
        const roundNumber = req.params.RoundNumber;
        const results = await Promise.all([Event_1.default.findOne({
                '_id': req.params.eventId,
            }).select(['Name', '_id', 'VoteByLink', 'Rounds', 'RegistrationsVoteFactor', 'Enabled', 'PhoneNumber', 'CurrentRound', 'Registrations', 'Email'])
                .populate('Registrations')
                .populate('Rounds.Contestants.Votes')
                .populate('CurrentRound.Contestants.Detail')
                .populate('CurrentRound.Contestants.Votes'),
            Lot_1.default.countDocuments({
                'Event': req.params.eventId,
                'Status': 1
            })]);
        const event = results[0];
        const openAuctionCount = results[1];
        if (!event) {
            next({
                message: 'Event not found',
                status: 404
            });
            return;
        }
        if (event && !event.VoteByLink) {
            // voting by link disabled
            voteProcessor_1.sendResponse('json', res, 'VOTING_WEB_DISABLED');
            return;
        }
        let from = '';
        for (let i = 0; i < event.Registrations.length; i++) {
            if (event.Registrations[i]._id.toString() === req.user._id.toString()) {
                from = event.Registrations[i].PhoneNumber || event.Registrations[i].Email;
                break;
            }
        } // from check is in processVote
        if (from) {
            return await voteProcessor_1.processVote('json', vote, from, event, res, log, roundNumber, openAuctionCount, 'online');
        }
        else {
            logger_1.default.info(req.user, ' is not registered in event, registering');
            await RegistrationProcessor_1.RegisterVoter(req.user, req.params.eventId, true, 0.1, true, req.user._id);
            // updated event after registration
            const updatedEvent = await Event_1.default.findOne({
                '_id': req.params.eventId,
            }).select(['Name', '_id', 'VoteByLink', 'Rounds', 'RegistrationsVoteFactor', 'Enabled', 'PhoneNumber', 'CurrentRound', 'Registrations', 'Email'])
                .populate('Registrations');
            return await voteProcessor_1.processVote('json', vote, req.user.PhoneNumber || req.user.Email, updatedEvent, res, log, roundNumber, openAuctionCount, 'online');
        }
    }
    catch (e) {
        next(e);
    }
};
exports.getEventGuestCount = async function (req, res, next) {
    try {
        const data = req.body;
        const eventIds = [];
        const eventNames = data;
        for (let i = 0; i < eventNames.length; i++) {
            eventIds.push(eventNames[i].eventId);
        }
        // console.log('Events List ===>>>>>', eventList);
        const query = {};
        query._id = { $in: eventIds };
        const promises = [];
        const promise1 = Event_1.default.find(query).select([
            'Name',
            'RegistrationsVoteFactor'
        ]).sort({
            'EventStartDateTime': -1
        }).exec();
        promises.push(promise1);
        const results = await Promise.all(promises);
        const activeEvents = results[0];
        let totalGuestCount = 0;
        let registrationIds = [];
        for (let i = 0; i < activeEvents.length; i++) {
            totalGuestCount += activeEvents[i].RegistrationsVoteFactor.length;
            const registrationsDataList = activeEvents[i].RegistrationsVoteFactor;
            for (let i = 0; i < registrationsDataList.length; i++) {
                // console.log('RegistrationsVoteFactor ===>>>', registrationsDataList[0]._id);
                registrationIds.push(registrationsDataList[i].RegistrationId.toString());
            }
        }
        registrationIds = [...new Set(registrationIds)];
        const rest = {
            'Success': true,
            'guest': registrationIds.length,
            'registerationIDs': registrationIds
        };
        res.json(rest);
        return;
    }
    catch (e) {
        console.error(e);
        // logger.error(`${e.message} ${e.stack}`);
        const result = {
            'Success': false,
            Data: 'Internal Server Error'
        };
        res.status(500);
        next(result);
    }
};
exports.getEventFilterGuestCount = async function (req, res, next) {
    try {
        const data = req.body;
        let smsReg = req.body['sms-reg'];
        const appReg = req.body['app-reg'];
        let voteCount = req.body['voteCount'] || '0';
        voteCount = parseInt(voteCount);
        if (isNaN(voteCount)) {
            voteCount = 0;
        }
        if (!smsReg && !appReg) {
            smsReg = true;
        }
        const eventLists = [];
        const timelogs = data.timelogs;
        const eventData = data.data;
        for (let i = 0; i < eventData.length; i++) {
            eventLists.push(new bson_1.ObjectId(eventData[i].id));
        }
        const bid = parseInt(data.bids);
        let results = [];
        const registrationIds = [];
        const registrationHash = [];
        if (bid == 0) {
            const condition = {};
            // @ts-ignore
            condition._id = { $in: eventLists };
            results = await Event_1.default.find(condition).select([
                'Name',
                'RegistrationsVoteFactor'
            ]).sort({
                'EventStartDateTime': -1
            }).exec();
            for (let i = 0; i < results.length; i++) {
                const rest = results[i].RegistrationsVoteFactor;
                for (let j = 0; j < rest.length; j++) {
                    let allowReg = false;
                    if (smsReg && (rest[j].From === 'sms' || !rest[j].From)) {
                        // to handle old number or sms number
                        allowReg = true;
                    }
                    if (appReg && (rest[j].From === 'app' || rest[j].From === 'app-global')) {
                        allowReg = true;
                    }
                    if (allowReg) {
                        registrationIds.push(rest[j].RegistrationId);
                    }
                }
            }
            results = [];
        }
        else if (bid > 0) {
            const evtData = await Lot_1.default.aggregate([
                {
                    $match: {
                        'Bids.Amount': {
                            '$gte': bid
                        },
                        'Event': {
                            $in: eventLists
                        }
                    }
                },
                {
                    $project: {
                        Event: '$Event',
                        lotId: '$_id',
                        Bids: {
                            $filter: {
                                input: '$Bids',
                                as: 'item',
                                cond: { $gte: ['$$item.Amount', bid] }
                            }
                        }
                    }
                }
            ]).exec();
            let bidCount = 0;
            for (let i = 0; i < evtData.length; i++) {
                // console.log('Event ===>>>', evtData[i].Event);
                const bids = evtData[i].Bids;
                // console.log('Bid Count ===>>>', bids.length);
                bidCount += bids.length;
                for (let j = 0; j < bids.length; j++) {
                    // console.log('Regis ===>>', bids[j].Registration);
                    registrationIds.push(bids[j].Registration);
                }
            }
        }
        let registrationIdsUnique = [...new Set(registrationIds)];
        if (voteCount > 0) {
            const registrationHashObjs = await Registration_1.default.find({ _id: { '$in': registrationIdsUnique } }).select(['Hash']);
            registrationIdsUnique = [];
            for (let i = 0; i < registrationHashObjs.length; i++) {
                registrationHash.push(registrationHashObjs[i].Hash);
            }
            if (registrationHash.length > 0) {
                const logs = await VotingLog_1.default.aggregate([
                    {
                        $match: {
                            'PhoneHash': { '$in': registrationHash },
                            'Status': 'VOTE_ACCEPTED',
                        }
                    },
                    {
                        $group: {
                            '_id': {
                                'PhoneHash': '$PhoneHash'
                            },
                            'voteCount': { $sum: 1 }
                        }
                    },
                    {
                        $match: {
                            'voteCount': { '$gte': voteCount }
                        }
                    },
                    {
                        $lookup: {
                            from: 'registrations',
                            localField: '_id.PhoneHash',
                            foreignField: 'Hash',
                            as: 'registration'
                        }
                    }
                ]).allowDiskUse(true).exec();
                for (let k = 0; k < logs.length; k++) {
                    const log = logs[k];
                    if (log.registration && log.registration[0]) {
                        registrationIdsUnique.push(log.registration[0]._id);
                    }
                }
            }
        }
        // console.log('registrationIdsUnique ===>>>>', JSON.stringify(registrationIdsUnique));
        // console.log('Curent ==>>>', (parseInt(timelogs) * 60 * 60 * 1000));
        // console.log('timelogs ===>>>>>', new Date(Date.now() - ((parseInt(timelogs) * 60 * 60 * 1000))));
        // condition.createdAt = { $gt: new Date(Date.now() - 1 * 60 * 60 * 1000) };
        const query = {
            _id: {
                $in: registrationIdsUnique
            },
        };
        if (!isNaN(parseInt(timelogs)) && parseInt(timelogs) !== 0) {
            query.lastPromoSentAt = {
                $lt: new Date(Date.now() - (parseInt(timelogs) * 60 * 60 * 1000))
            };
        }
        const registrations = await Registration_1.default.find(query).select([
            '_id'
        ]);
        logger_1.default.info(`query ${JSON.stringify(query)}`);
        logger_1.default.info(`filtered registrations ${JSON.stringify(registrations)}`);
        const promotionLogsRegIDs = [];
        for (let i = 0; i < registrations.length; i++) {
            promotionLogsRegIDs.push(registrations[i]._id);
        }
        // console.log('promotionLogsData ===>>>>', promotionLogsData);
        // console.log(registrationIdsUnique.length + ' ===>>>' + promotionLogsRegIDs.length);
        // registrationIds = registrationIds.concat(promotionLogsRegIDs);
        // console.log('finalRegistrationIdsUnique ===>>>>', finalRegistrationIdsUnique); )
        const rest = {
            'Success': true,
            'guest': results,
            'guestcount': promotionLogsRegIDs.length,
            'registrationids': promotionLogsRegIDs
        };
        res.json(rest);
        return;
    }
    catch (e) {
        logger_1.default.error(e);
        res.status(500);
        next(e);
    }
};
exports.randomVoteUrl = async function (req, res, next) {
    const offset = Math.floor(Math.random() * 5000) + 1; // between 1 and 5000
    const regLog = await RegistrationLog_1.default.findOne().sort({
        _id: -1
    }).skip(offset);
    if (regLog && regLog.VoteUrl) {
        res.redirect(302, `${process.env.SITE_URL}/${regLog.VoteUrl.toString()}`);
    }
    else {
        next({
            message: 'unable to find the vote url'
        });
    }
};

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFDLENBQUM7UUFDZixPQUFPO0tBRVQ7SUFDRCxPQUFPLENBQUMsRUFBRTtRQUNQLGdCQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2hCLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDaEIsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ1Y7QUFFSixDQUFDLENBQUM7QUFFVyxRQUFBLGFBQWEsR0FBRyxLQUFLLFdBQVcsR0FBWSxFQUFFLEdBQWEsRUFBRSxJQUFrQjtJQUN6RixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxxQkFBcUI7SUFDMUUsTUFBTSxNQUFNLEdBQUcsTUFBTSx5QkFBb0IsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUM7UUFDdEQsR0FBRyxFQUFFLENBQUMsQ0FBQztLQUNULENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDaEIsSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLE9BQU8sRUFBRTtRQUMzQixHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0tBQzVFO1NBQU07UUFDSixJQUFJLENBQUM7WUFDRixPQUFPLEVBQUUsNkJBQTZCO1NBQ3hDLENBQUMsQ0FBQztLQUNMO0FBQ0osQ0FBQyxDQUFDIiwiZmlsZSI6ImNvbnRyb2xsZXJzL2V2ZW50LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gJ2V4cHJlc3MnO1xuLy8gQHRzLWlnbm9yZVxuaW1wb3J0IHsgZm9ybWF0VG9UaW1lWm9uZSwgcGFyc2VGcm9tVGltZVpvbmUgfSBmcm9tICdkYXRlLWZucy10aW1lem9uZSc7XG4vLyBAdHMtaWdub3JlXG5pbXBvcnQgeyBkaWZmZXJlbmNlSW5NaWxsaXNlY29uZHMsIGRpc3RhbmNlSW5Xb3Jkc1N0cmljdCB9IGZyb20gJ2RhdGUtZm5zJztcblxuaW1wb3J0IHsgZGVmYXVsdCBhcyBFdmVudE1vZGVsLCBFdmVudERvY3VtZW50IH0gZnJvbSAnLi4vbW9kZWxzL0V2ZW50JztcbmltcG9ydCB7IEV2ZW50RFRPLCBFdmVudEhvbWVEdG8sIFJvdW5kSG9tZUR0bywgU2VyaWVzIH0gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL0V2ZW50RFRPJztcbmltcG9ydCB7IERhdGFPcGVyYXRpb25SZXN1bHQsIE9wZXJhdGlvblJlc3VsdCB9IGZyb20gJy4uLy4uLy4uL3NoYXJlZC9PcGVyYXRpb25SZXN1bHQnO1xuaW1wb3J0ICogYXMgVHdpbGlvIGZyb20gJ3R3aWxpbyc7XG5pbXBvcnQgeyBkZWZhdWx0IGFzIFVzZXIsIFVzZXJEb2N1bWVudCB9IGZyb20gJy4uL21vZGVscy9Vc2VyJztcbmltcG9ydCB7IGRlZmF1bHQgYXMgVm90aW5nTG9nTW9kZWwsIFZvdGluZ0xvZ0RvY3VtZW50IH0gZnJvbSAnLi4vbW9kZWxzL1ZvdGluZ0xvZyc7XG5pbXBvcnQgUmVnaXN0cmF0aW9uTG9nTW9kZWwsIHsgUmVnaXN0cmF0aW9uTG9nRG9jdW1lbnQgfSBmcm9tICcuLi9tb2RlbHMvUmVnaXN0cmF0aW9uTG9nJztcbi8vIFNsYWNrIEhUVFBTIGNhbGxcbmltcG9ydCBwb3N0VG9TbGFjaywgeyBwb3N0VG9TbGFja1NNU0Zsb29kIH0gZnJvbSAnLi4vY29tbW9uL1NsYWNrJztcbmltcG9ydCBSb3VuZERUTyBmcm9tICcuLi8uLi8uLi9zaGFyZWQvUm91bmREVE8nO1xuaW1wb3J0IHsgZ2V0RXZlbnRGb3JGb3JtLCBnZXRFdmVudEZvclNNUywgcHJvY2Vzc1ZvdGUsIHNlbmRSZXNwb25zZSB9IGZyb20gJy4uL2NvbW1vbi92b3RlUHJvY2Vzc29yJztcbmltcG9ydCBBbm5vdW5jZW1lbnRNb2RlbCBmcm9tICcuLi9tb2RlbHMvQW5ub3VuY2VtZW50JztcbmltcG9ydCBFdmVudFBob25lTnVtYmVyTW9kZWwsIHsgRXZlbnRQaG9uZU51bWJlckRvY3VtZW50IH0gZnJvbSAnLi4vbW9kZWxzL0V2ZW50UGhvbmVOdW1iZXInO1xuaW1wb3J0IFRpbWV6b25lTW9kZWwgZnJvbSAnLi4vbW9kZWxzL1RpbWV6b25lJztcbmltcG9ydCB7IEV2ZW50TGlzdCwgRXZlbnRzSW50ZXJmYWNlIH0gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL0V2ZW50TGlzdFJlc3BvbnNlRFRPJztcbmltcG9ydCBzZW5kTm90aWZpY2F0aW9uIGZyb20gJy4uL2NvbW1vbi9BcG5zJztcbmltcG9ydCBhcnRpc3RXaXNlSW1hZ2VzIGZyb20gJy4uL2NvbW1vbi9BcnRpc3RXaXNlSW1hZ2VzJztcbmltcG9ydCBBcnRpc3RJbWFnZUR0bywgeyBSb3VuZEFydGlzdHNJbnRlcmZhY2UgfSBmcm9tICcuLi8uLi8uLi9zaGFyZWQvQXJ0aXN0SW1hZ2VEVE8nO1xuaW1wb3J0IFJlZ2lzdHJhdGlvbkRUTyBmcm9tICcuLi8uLi8uLi9zaGFyZWQvUmVnaXN0cmF0aW9uRFRPJztcbmltcG9ydCBSZWdpc3RyYXRpb25Nb2RlbCBmcm9tICcuLi9tb2RlbHMvUmVnaXN0cmF0aW9uJztcbmltcG9ydCBSb3VuZENvbnRlc3RhbnREVE8gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL1JvdW5kQ29udGVzdGFudERUTyc7XG5pbXBvcnQgUHJlZmVyZW5jZU1vZGVsLCB7IFByZWZlcmVuY2VEb2N1bWVudCB9IGZyb20gJy4uL21vZGVscy9QcmVmZXJlbmNlJztcbmltcG9ydCB7IEV2ZW50U3RhdERUTyB9IGZyb20gJy4uLy4uLy4uL3NoYXJlZC9FdmVudFN0YXREVE8nO1xuaW1wb3J0IGxvZ2dlciBmcm9tICcuLi9jb25maWcvbG9nZ2VyJztcbmltcG9ydCB7IFJlZ2lzdGVyVm90ZXIgfSBmcm9tICcuLi9jb21tb24vUmVnaXN0cmF0aW9uUHJvY2Vzc29yJztcbmltcG9ydCBMb3RNb2RlbCBmcm9tICcuLi9tb2RlbHMvTG90JztcbmltcG9ydCB7IE11bHRpQ2FzdElnbm9yZUVyciB9IGZyb20gJy4uL2NvbW1vbi9GQ00nO1xuaW1wb3J0IHsgRXZlbnRJbmNyZW1lbnRSb3VuZCB9IGZyb20gJy4uL2NvbW1vbi9ldmVudFJvdW5kSW5jcmVtZW50JztcbmltcG9ydCB7IE9iamVjdElkIH0gZnJvbSAnYnNvbic7XG5cbmltcG9ydCB7IHNpZ24gfSBmcm9tICdqc29ud2VidG9rZW4nO1xuaW1wb3J0IE1lZGlhTW9kZWwgZnJvbSAnLi4vbW9kZWxzL01lZGlhJztcbmltcG9ydCAqIGFzIHNoYXJwIGZyb20gJ3NoYXJwJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzLWV4dHJhJztcbmltcG9ydCB7IHByb2Nlc3NNZXNzYWdlIH0gZnJvbSAnLi4vY29tbW9uL21lc3NhZ2VQcm9jZXNzb3InO1xuaW1wb3J0IHsgU3RhdGVWb3RlRmFjdG9yTWFwIH0gZnJvbSAnLi4vY29tbW9uL1N0YXRlcyc7XG5cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEFubm91bmNlKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSkge1xuICAgY29uc3QgZXZlbnQgPSBhd2FpdCBFdmVudE1vZGVsLmZpbmRCeUlkKHJlcS5wYXJhbXMuZXZlbnRJZCkucG9wdWxhdGUoJ1JlZ2lzdHJhdGlvbnMnKTtcbiAgIGNvbnN0IHJlZ2lzdHJhdGlvbnMgPSBldmVudC5SZWdpc3RyYXRpb25zO1xuICAgY29uc3Qgdm90ZUZhY3RvcnMgPSBldmVudC5SZWdpc3RyYXRpb25zVm90ZUZhY3RvcjtcbiAgIGxldCBzbXNWb3RlcnNDb3VudCA9IDA7XG4gICBsZXQgYXBwVm90ZXJzQ291bnQgPSAwO1xuICAgY29uc3QgcmVnaXN0cmF0aW9uSWRNYXAgPSBbXTtcbiAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVnaXN0cmF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgcmVnaXN0cmF0aW9uSWRNYXBbcmVnaXN0cmF0aW9uc1tpXS5faWRdID0gcmVnaXN0cmF0aW9uc1tpXTtcbiAgIH1cblxuICAgY29uc3QgYW5ub3VuY2VtZW50T3B0aW9ucyA9IFtcbiAgICAgIHtcbiAgICAgICAgIGxhYmVsOiBgU01TYCxcbiAgICAgICAgIGluZGV4OiBgc21zLXZvdGVyc2AsXG4gICAgICAgICBjaGVja2VkOiB0cnVlXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICAgbGFiZWw6IGBBcHA6IGxvY2FsYCxcbiAgICAgICAgIGluZGV4OiBgYXBwLXZvdGVyc2AsXG4gICAgICAgICBjaGVja2VkOiB0cnVlXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICAgbGFiZWw6IGBBcHA6IGdsb2JhbGAsXG4gICAgICAgICBpbmRleDogYGdsb2JhbC1hcHAtdm90ZXJzYCxcbiAgICAgICAgIGNoZWNrZWQ6IGZhbHNlXG4gICAgICB9XG4gICBdO1xuICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2b3RlRmFjdG9ycy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHZvdGVGYWN0b3JzW2ldLkZyb20gPT09ICdzbXMnKSB7XG4gICAgICAgICBzbXNWb3RlcnNDb3VudCsrO1xuICAgICAgfSBlbHNlIGlmICh2b3RlRmFjdG9yc1tpXS5Gcm9tID09PSAnYXBwJyB8fCB2b3RlRmFjdG9yc1tpXS5Gcm9tID09PSAnYXBwLWdsb2JhbCcpIHtcbiAgICAgICAgIGFwcFZvdGVyc0NvdW50Kys7XG4gICAgICB9XG4gICB9XG4gICBjb25zdCBnbG9iYWxBcHBWb3RlcnNDb3VudCA9IGF3YWl0IFJlZ2lzdHJhdGlvbk1vZGVsLmNvdW50RG9jdW1lbnRzKHsgJ0RldmljZVRva2Vucyc6IHsgJGV4aXN0czogdHJ1ZSwgJG5lOiBbXSB9IH0pO1xuICAgYW5ub3VuY2VtZW50T3B0aW9uc1swXS5sYWJlbCArPSBgICgke3Ntc1ZvdGVyc0NvdW50fSlgO1xuICAgYW5ub3VuY2VtZW50T3B0aW9uc1sxXS5sYWJlbCArPSBgICgke2FwcFZvdGVyc0NvdW50fSlgO1xuICAgYW5ub3VuY2VtZW50T3B0aW9uc1syXS5sYWJlbCArPSBgICgke2dsb2JhbEFwcFZvdGVyc0NvdW50fSlgO1xuICAgY29uc3QgdG9wQW5ub3VuY2VtZW50cyA9IGF3YWl0IEFubm91bmNlbWVudE1vZGVsLmZpbmQoeyBmaXJlZFRpbWVzOiB7ICckZ3QnOiAxIH0gfSkuc29ydCh7IGZpcmVkVGltZXM6IC0xIH0pLmxpbWl0KDEwKTtcbiAgIHJlcy5yZW5kZXIoJ2Fubm91bmNlJywge1xuICAgICAgdGl0bGU6ICdBbm5vdW5jZW1lbnQnLFxuICAgICAgRXZlbnROYW1lOiBldmVudC5OYW1lLFxuICAgICAgRXZlbnRJZDogZXZlbnQuX2lkLFxuICAgICAgdG9wQW5ub3VuY2VtZW50czogdG9wQW5ub3VuY2VtZW50cyxcbiAgICAgIG9wdGlvbnM6IGFubm91bmNlbWVudE9wdGlvbnNcbiAgIH0pO1xufVxuXG5leHBvcnQgY29uc3QgYW5ub3VuY2UgPSBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgIGxvZ2dlci5pbmZvKGBhbm5vdW5jZSgpIGNhbGxlZCBhdCAke25ldyBEYXRlKCkudG9JU09TdHJpbmcoKX1gLCByZXEuYm9keSk7XG4gICBjb25zdCBtZXNzYWdlID0gcmVxLmJvZHlbJ01lc3NhZ2UnXSAmJiByZXEuYm9keVsnTWVzc2FnZSddLnRyaW0oKTtcbiAgIGNvbnN0IHNtc1ZvdGUgPSByZXEuYm9keVsnc21zLXZvdGVycyddICYmIHJlcS5ib2R5WydzbXMtdm90ZXJzJ10udHJpbSgpID09PSAnb24nO1xuICAgY29uc3QgYXBwVm90ZSA9IHJlcS5ib2R5WydhcHAtdm90ZXJzJ10gJiYgcmVxLmJvZHlbJ2FwcC12b3RlcnMnXS50cmltKCkgPT09ICdvbic7XG4gICBjb25zdCBhcHBHbG9iYWxWb3RlID0gcmVxLmJvZHlbJ2dsb2JhbC1hcHAtdm90ZXJzJ10gJiYgcmVxLmJvZHlbJ2dsb2JhbC1hcHAtdm90ZXJzJ10udHJpbSgpID09PSAnb24nO1xuICAgbGV0IGdsb2JhbFJlZ2lzdHJhdGlvbnM6IFJlZ2lzdHJhdGlvbkRUT1tdID0gW107XG4gICBpZiAoYXBwR2xvYmFsVm90ZSkge1xuICAgICAgLy8gRmV0Y2ggYWxsIHJlZ2lzdHJhbnQgd2l0aCBkZXZpY2UgdG9rZW5cbiAgICAgIGdsb2JhbFJlZ2lzdHJhdGlvbnMgPSBhd2FpdCBSZWdpc3RyYXRpb25Nb2RlbC5maW5kKHsgJ0RldmljZVRva2Vucyc6IHsgJGV4aXN0czogdHJ1ZSwgJG5lOiBbXSB9IH0pO1xuICAgfVxuICAgLy8gbG9nZ2VyLmRlYnVnKGBhcHBWb3RlICR7YXBwVm90ZX0sIHNtc1ZvdGUgJHtzbXNWb3RlfSwgYXBwR2xvYmFsVm90ZSAke2FwcEdsb2JhbFZvdGV9YCk7XG4gICB0cnkge1xuICAgICAgY29uc3QgZXZlbnQgPSBhd2FpdCBFdmVudE1vZGVsXG4gICAgICAgICAgLmZpbmRCeUlkKHJlcS5wYXJhbXMuZXZlbnRJZClcbiAgICAgICAgICAucG9wdWxhdGUoJ1JlZ2lzdHJhdGlvbnMnKTtcbiAgICAgIGlmICghZXZlbnQuUGhvbmVOdW1iZXIpIHtcbiAgICAgICAgIHJlcS5mbGFzaCgnZmFpbHVyZScsIHsgbXNnOiAnRmFpbGVkISBTZXJ2ZXIgUGhvbmVudW1iZXIgaXMgbWlzc2luZyBpbiBldmVudCBTZXR0aW5nLCBwbGVhc2UgZGVmaW5lIGl0LicgfSk7XG4gICAgICAgICByZXMucmVkaXJlY3QoYCR7cHJvY2Vzcy5lbnYuQURNSU5fVVJMfS9ldmVudC8ke3JlcS5wYXJhbXMuZXZlbnRJZH0vcmVzdWx0c2ApO1xuICAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgcHJlZmVyZW5jZXMgPSBhd2FpdCBQcmVmZXJlbmNlTW9kZWwuZmluZCgpO1xuICAgICAgY29uc3QgcHJlZmVyZW5jZU1hcDoge1xuICAgICAgICAgW2tleTogc3RyaW5nXTogUHJlZmVyZW5jZURvY3VtZW50XG4gICAgICB9ID0ge307XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByZWZlcmVuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICBwcmVmZXJlbmNlTWFwW3ByZWZlcmVuY2VzW2ldLl9pZF0gPSBwcmVmZXJlbmNlc1tpXTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdHdpbGlvQ2xpZW50ID0gVHdpbGlvKCk7XG4gICAgICBjb25zdCBSZWdpc3RyYW50VG9rZW5zOiB7XG4gICAgICAgICBba2V5OiBzdHJpbmddOiBTdHJpbmdbXVxuICAgICAgfSA9IHt9O1xuICAgICAgY29uc3QgUmVnaXN0cmFudEFuZHJvaWRUb2tlbnM6IHtcbiAgICAgICAgIFtrZXk6IHN0cmluZ106IHN0cmluZ1tdXG4gICAgICB9ID0ge307XG4gICAgICBjb25zdCBSZWdpc3RyYXRpb25zQnlJZDoge1xuICAgICAgICAgW2tleTogc3RyaW5nXTogUmVnaXN0cmF0aW9uRFRPXG4gICAgICB9ID0ge307XG4gICAgICBjb25zdCBSZWdpc3RyYXRpb25DaGFubmVsczoge1xuICAgICAgICAgW2tleTogc3RyaW5nXTogc3RyaW5nXG4gICAgICB9ID0ge307XG4gICAgICBldmVudC5SZWdpc3RyYXRpb25zVm90ZUZhY3Rvci5mb3JFYWNoKHJlZ2lzdHJhbnQgPT4ge1xuICAgICAgICAgLy8gb2xkIGV2ZW50IGRvbid0IGhhdmUgRnJvbSBpbiByZWdpc3RyYW50c1xuICAgICAgICAgUmVnaXN0cmF0aW9uQ2hhbm5lbHNbcmVnaXN0cmFudC5SZWdpc3RyYXRpb25JZC50b1N0cmluZygpXSA9IChyZWdpc3RyYW50LkZyb20gfHwgJ3NtcycpO1xuICAgICAgfSk7XG4gICAgICBjb25zdCBpc1Ntc0FuZEFwcEJvdGhDaGVja2VkID0gKHNtc1ZvdGUgJiYgKGFwcFZvdGUgfHwgYXBwR2xvYmFsVm90ZSkpO1xuICAgICAgZXZlbnQuUmVnaXN0cmF0aW9ucy5mb3JFYWNoKHJlZ2lzdHJhbnQgPT4ge1xuICAgICAgICAgaWYgKChzbXNWb3RlICYmIChSZWdpc3RyYXRpb25DaGFubmVsc1tyZWdpc3RyYW50Ll9pZF0gPT09ICdzbXMnKSkgfHwgKHNtc1ZvdGUgJiYgUmVnaXN0cmF0aW9uQ2hhbm5lbHNbcmVnaXN0cmFudC5faWRdICE9PSAnc21zJyAmJiAhaXNTbXNBbmRBcHBCb3RoQ2hlY2tlZCkpIHtcbiAgICAgICAgICAgIC8vIGlmIHNtcyBhbmQgYXBwIGJvdGggYXJlIGNoZWNrZWQgdGhlbiBzbXMgc2hvdWxkIG5vdCBiZSBzZW50IHRvIGEgYXBwIG51bWJlclxuICAgICAgICAgICAgbG9nZ2VyLmluZm8oYFNlbmRpbmcgbWVzc2FnZTogJHttZXNzYWdlfSBGcm9tOiAke2V2ZW50LlBob25lTnVtYmVyfSBUbzogJHtyZWdpc3RyYW50LlBob25lTnVtYmVyfWApO1xuICAgICAgICAgICAgdHdpbGlvQ2xpZW50Lm1lc3NhZ2VzLmNyZWF0ZSh7XG4gICAgICAgICAgICAgICBmcm9tOiBldmVudC5QaG9uZU51bWJlcixcbiAgICAgICAgICAgICAgIHRvOiByZWdpc3RyYW50LlBob25lTnVtYmVyLFxuICAgICAgICAgICAgICAgYm9keTogbWVzc2FnZVxuICAgICAgICAgICAgfSkudGhlbigocmVzKSA9PiB7XG4gICAgICAgICAgICAgICBsb2dnZXIuaW5mbyhgc2VudCBtZXNzYWdlOiAke21lc3NhZ2V9IEZyb206ICR7ZXZlbnQuUGhvbmVOdW1iZXJ9IFRvOiAke3JlZ2lzdHJhbnQuUGhvbmVOdW1iZXJ9LCBTSUQ6ICR7cmVzLnNpZH1gKTtcbiAgICAgICAgICAgICAgIHBvc3RUb1NsYWNrU01TRmxvb2Qoe1xuICAgICAgICAgICAgICAgICAgJ3RleHQnOiBgJHtyZWdpc3RyYW50Lk5pY2tOYW1lfSgke3JlZ2lzdHJhbnQuUGhvbmVOdW1iZXJ9KSAoc21zKSBcXG4ke21lc3NhZ2V9IHNvdXJjZTogZXZlbnQudHMuYW5ub3VuY2VgXG4gICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiBsb2dnZXIuZXJyb3IoYGF1Y3Rpb24gc2xhY2sgZmxvb2QgY2FsbCBmYWlsZWQgJHsgbWVzc2FnZSB9IHNvdXJjZTogZXZlbnQudHMuYW5ub3VuY2VgKSk7XG4gICAgICAgICAgICB9KS5jYXRjaChlID0+IHtcbiAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihgRmFpbGVkIE1lc3NhZ2U6ICR7bWVzc2FnZX0gRnJvbTogJHtldmVudC5QaG9uZU51bWJlcn0gVG86ICR7cmVnaXN0cmFudC5QaG9uZU51bWJlcn0sICR7ZX1gKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgfVxuICAgICAgICAgbGV0IGhhc1N1YnNjcmliZWRUb0V2ZW50ID0gZmFsc2U7XG4gICAgICAgICBjb25zdCB1c2VyUHJlZmVyZW5jZSA9IHJlZ2lzdHJhbnQuUHJlZmVyZW5jZXMgfHwgW107XG4gICAgICAgICBpZiAodXNlclByZWZlcmVuY2UpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdXNlclByZWZlcmVuY2UubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgIC8vIGxvZ2dlci5pbmZvKCd1c2VyUHJlZmVyZW5jZVtpXS5faWQnLCB1c2VyUHJlZmVyZW5jZVtpXS5faWQpO1xuICAgICAgICAgICAgICAgaWYgKHByZWZlcmVuY2VNYXBbdXNlclByZWZlcmVuY2VbaV0uX2lkXS5UeXBlID09PSAnRXZlbnRSZWdpc3RlcmVkJykge1xuICAgICAgICAgICAgICAgICAgaGFzU3Vic2NyaWJlZFRvRXZlbnQgPSB0cnVlO1xuICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgfVxuXG4gICAgICAgICBpZiAoKGFwcFZvdGUgfHwgYXBwR2xvYmFsVm90ZSkgJiYgaGFzU3Vic2NyaWJlZFRvRXZlbnQpIHtcbiAgICAgICAgICAgIFJlZ2lzdHJhbnRUb2tlbnNbcmVnaXN0cmFudC5faWRdID0gcmVnaXN0cmFudC5EZXZpY2VUb2tlbnM7XG4gICAgICAgICAgICBSZWdpc3RyYW50QW5kcm9pZFRva2Vuc1tyZWdpc3RyYW50Ll9pZF0gPSByZWdpc3RyYW50LkFuZHJvaWREZXZpY2VUb2tlbnM7XG4gICAgICAgICAgICBSZWdpc3RyYXRpb25zQnlJZFtyZWdpc3RyYW50Ll9pZF0gPSByZWdpc3RyYW50O1xuICAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIHJlcS5mbGFzaCgnc3VjY2VzcycsIHsgbXNnOiAnU3VjY2VzcyEgTWVzc2FnZSBzZW50IHRvIGFsbCBwYXJ0aWNpcGFudHMhJyB9KTtcbiAgICAgIHJlcy5yZWRpcmVjdChgJHtwcm9jZXNzLmVudi5BRE1JTl9VUkx9L2V2ZW50LyR7cmVxLnBhcmFtcy5ldmVudElkfS9yZXN1bHRzYCk7XG4gICAgICAvLyBBZnRlciBzZW5kaW5nIHJlc3BvbnNlIHNlbmQgbWVzc2FnZSB0byBzbGFjayBjaGFubmVsXG4gICAgICBjb25zdCB1c2VyOiBVc2VyRG9jdW1lbnQgPSBhd2FpdCBVc2VyLmZpbmRCeUlkKHJlcS51c2VyLmlkKTtcbiAgICAgIGNvbnN0IHNsYWNrTWVzc2FnZSA9IGAke2V2ZW50Lk5hbWV9IGFubm91bmNlbWVudCBtYWRlIGJ5ICR7dXNlciAmJiB1c2VyLmVtYWlsfS5cXG5NZXNzYWdlOiAke21lc3NhZ2V9YDtcbiAgICAgIHBvc3RUb1NsYWNrKHtcbiAgICAgICAgICd0ZXh0Jzogc2xhY2tNZXNzYWdlXG4gICAgICB9KS5jYXRjaCgoKSA9PiBsb2dnZXIuaW5mbygnZXZlbnQgYW5ub3VuY2VtZW50IHNsYWNrIGNhbGwgZmFpbGVkICcsIG1lc3NhZ2UpKTtcblxuICAgICAgLy8gc2VuZCBwdXNoIG5vdGlmaWNhdGlvbnNcbiAgICAgIGNvbnN0IGRldmljZVRva2VuczogU3RyaW5nW10gPSBbXTtcbiAgICAgIGNvbnN0IGFuZHJvaWRUb2tlbnM6IHN0cmluZ1tdID0gW107XG4gICAgICBjb25zdCB2b3RlRmFjdG9ycyA9IGV2ZW50LlJlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yO1xuICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCB2b3RlRmFjdG9ycy5sZW5ndGg7IGorKykge1xuICAgICAgICAgLy8gbG9nZ2VyLmRlYnVnKCd2b3RlRmFjdG9yc1tqXS5Gcm9tJywgdm90ZUZhY3RvcnNbal0uRnJvbSwgJ3ZvdGVGYWN0b3JzW2pdLlJlZ2lzdHJhdGlvbklkJywgdm90ZUZhY3RvcnNbal0uUmVnaXN0cmF0aW9uSWQsIFJlZ2lzdHJhbnRUb2tlbnNbdm90ZUZhY3RvcnNbal0uUmVnaXN0cmF0aW9uSWQgKyAnJ10sIFJlZ2lzdHJhbnRUb2tlbnMpO1xuICAgICAgICAgaWYgKGFwcFZvdGUgJiYgdm90ZUZhY3RvcnNbal0uRnJvbSA9PT0gJ2FwcCcpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZGVidWcoJ2FwcFZvdGUnLCBhcHBWb3RlLCAndm90ZUZhY3RvcnNbal0uRnJvbScsIHZvdGVGYWN0b3JzW2pdLkZyb20pO1xuICAgICAgICAgICAgaWYgKGFwcFZvdGUpIHtcbiAgICAgICAgICAgICAgIGNvbnN0IHVzZXJUb2tlbnMgPSBSZWdpc3RyYW50VG9rZW5zW3ZvdGVGYWN0b3JzW2pdLlJlZ2lzdHJhdGlvbklkICsgJyddO1xuICAgICAgICAgICAgICAgaWYgKHVzZXJUb2tlbnMpIHtcbiAgICAgICAgICAgICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgdXNlclRva2Vucy5sZW5ndGg7IGsrKykge1xuICAgICAgICAgICAgICAgICAgICAgZGV2aWNlVG9rZW5zLnB1c2godXNlclRva2Vuc1trXSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICBjb25zdCBhbmRyb2lkRGV2aWNlVG9rZW5zID0gUmVnaXN0cmFudEFuZHJvaWRUb2tlbnNbdm90ZUZhY3RvcnNbal0uUmVnaXN0cmF0aW9uSWQgKyAnJ107XG4gICAgICAgICAgICAgICBpZiAoYW5kcm9pZERldmljZVRva2Vucykge1xuICAgICAgICAgICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBhbmRyb2lkRGV2aWNlVG9rZW5zLmxlbmd0aDsgaysrKSB7XG4gICAgICAgICAgICAgICAgICAgICBhbmRyb2lkVG9rZW5zLnB1c2goYW5kcm9pZERldmljZVRva2Vuc1trXSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBnbG9iYWwgbm90aWZpY2F0aW9uIG5lZWQgdG8gYmUgc2VudCB0byBldmVyeW9uZVxuICAgICAgZm9yIChsZXQgYSA9IDA7IGEgPCBnbG9iYWxSZWdpc3RyYXRpb25zLmxlbmd0aDsgYSsrKSB7XG4gICAgICAgICBjb25zdCB1c2VyVG9rZW5zID0gZ2xvYmFsUmVnaXN0cmF0aW9uc1thXS5EZXZpY2VUb2tlbnM7XG4gICAgICAgICBjb25zdCBhbmRyb2lkVXNlclRva2VucyA9IGdsb2JhbFJlZ2lzdHJhdGlvbnNbYV0uQW5kcm9pZERldmljZVRva2VucztcbiAgICAgICAgIGlmICh1c2VyVG9rZW5zKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IHVzZXJUb2tlbnMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgICAgIC8vIHNiZnZoamZidmRmaDQ4OXRpamt1Zmdndm4gaXMgdGVzdCB0b2tlblxuICAgICAgICAgICAgICAgaWYgKHVzZXJUb2tlbnNba10gJiYgZGV2aWNlVG9rZW5zLmluZGV4T2YodXNlclRva2Vuc1trXSkgPT09IC0xICYmIHVzZXJUb2tlbnNba10gIT09ICdudWxsJyAmJiB1c2VyVG9rZW5zW2tdICE9PSAnc2JmdmhqZmJ2ZGZoNDg5dGlqa3VmZ2d2bicpIHtcbiAgICAgICAgICAgICAgICAgIGRldmljZVRva2Vucy5wdXNoKHVzZXJUb2tlbnNba10pO1xuICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgfVxuICAgICAgICAgaWYgKGFuZHJvaWRVc2VyVG9rZW5zKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IGFuZHJvaWRVc2VyVG9rZW5zLmxlbmd0aDsgaysrKSB7XG4gICAgICAgICAgICAgICAvLyBzYmZ2aGpmYnZkZmg0ODl0aWprdWZnZ3ZuIGlzIHRlc3QgdG9rZW5cbiAgICAgICAgICAgICAgIGlmIChhbmRyb2lkVXNlclRva2Vuc1trXSAmJiBkZXZpY2VUb2tlbnMuaW5kZXhPZihhbmRyb2lkVXNlclRva2Vuc1trXSkgPT09IC0xICYmIGFuZHJvaWRVc2VyVG9rZW5zW2tdICE9PSAnbnVsbCcgJiYgYW5kcm9pZFVzZXJUb2tlbnNba10gIT09ICdzYmZ2aGpmYnZkZmg0ODl0aWprdWZnZ3ZuJykge1xuICAgICAgICAgICAgICAgICAgYW5kcm9pZFRva2Vucy5wdXNoKGFuZHJvaWRVc2VyVG9rZW5zW2tdKTtcbiAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChkZXZpY2VUb2tlbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgY29uc3QgYmFkRGV2aWNlVG9rZW5zID0gYXdhaXQgc2VuZE5vdGlmaWNhdGlvbihkZXZpY2VUb2tlbnMsIG1lc3NhZ2UsIGV2ZW50Lk5hbWUpLmNhdGNoKGUgPT4gbG9nZ2VyLmluZm8oYHB1c2ggbm90aWZpY2F0aW9uIGZhaWxlZGAsIGUpKTtcbiAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBoYW5kbGUgYmFkIGRldmljZSB0b2tlbnNcbiAgICAgICAgICAgIGNvbnN0IHRvQmVDb3JyZWN0ZWRSZWdzOiB7XG4gICAgICAgICAgICAgICBba2V5OiBzdHJpbmddOiBSZWdpc3RyYXRpb25EVE9cbiAgICAgICAgICAgIH0gPSB7fTtcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGJhZERldmljZVRva2VucykpIHtcbiAgICAgICAgICAgICAgIGNvbnN0IHJlZ2lzdHJhdGlvbklkcyA9IE9iamVjdC5rZXlzKFJlZ2lzdHJhbnRUb2tlbnMpO1xuICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBiYWREZXZpY2VUb2tlbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGJhZFRva2VuID0gYmFkRGV2aWNlVG9rZW5zW2ldLmRldmljZTtcbiAgICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgcmVnaXN0cmF0aW9uSWRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmRleE9mQmFkVG9rZW4gPSBSZWdpc3RyYW50VG9rZW5zW3JlZ2lzdHJhdGlvbklkc1tqXV0uaW5kZXhPZihiYWRUb2tlbik7XG4gICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXhPZkJhZFRva2VuID4gLSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBSZWdpc3RyYXRpb25zQnlJZFtyZWdpc3RyYXRpb25JZHNbal1dLkRldmljZVRva2Vucy5zcGxpY2UoaW5kZXhPZkJhZFRva2VuLCAxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvQmVDb3JyZWN0ZWRSZWdzW3JlZ2lzdHJhdGlvbklkc1tqXV0gPSBSZWdpc3RyYXRpb25zQnlJZFtyZWdpc3RyYXRpb25JZHNbal1dO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB0b0JlQ29ycmVjdGVkUmVnSWRzID0gT2JqZWN0LmtleXModG9CZUNvcnJlY3RlZFJlZ3MpO1xuICAgICAgICAgICAgY29uc3QgcHJvbWlzZXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdG9CZUNvcnJlY3RlZFJlZ0lkcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgLy8gdG9CZUNvcnJlY3RlZFJlZ3NbdG9CZUNvcnJlY3RlZFJlZ0lkc1tpXV0uc2F2ZSgpXG4gICAgICAgICAgICAgICBwcm9taXNlcy5wdXNoKFJlZ2lzdHJhdGlvbk1vZGVsLmZpbmRCeUlkQW5kVXBkYXRlKHRvQmVDb3JyZWN0ZWRSZWdJZHNbaV0sIHtcbiAgICAgICAgICAgICAgICAgICckc2V0Jzoge1xuICAgICAgICAgICAgICAgICAgICAgJ0RldmljZVRva2Vucyc6IHRvQmVDb3JyZWN0ZWRSZWdzW3RvQmVDb3JyZWN0ZWRSZWdJZHNbaV1dLkRldmljZVRva2Vuc1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgfSkuZXhlYyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG4gICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyhlKTtcbiAgICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChhbmRyb2lkVG9rZW5zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgIGNvbnN0IGFuZHJvaWRQdXNoUmVzID0gYXdhaXQgTXVsdGlDYXN0SWdub3JlRXJyKHtcbiAgICAgICAgICAgIERldmljZVRva2VuczogYW5kcm9pZFRva2VucyxcbiAgICAgICAgICAgIGxpbms6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIHRpdGxlOiBldmVudC5OYW1lLFxuICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICAgICAgICAgIHByaW9yaXR5OiAnbm9ybWFsJyxcbiAgICAgICAgICAgIGFuYWx5dGljc0xhYmVsOiBgYW5ub3VuY2UtcHVzaCAke2V2ZW50LkVJRH1gXG4gICAgICAgICB9KTtcbiAgICAgICAgIGxvZ2dlci5pbmZvKGBhbmRyb2lkUHVzaFJlcyAke0pTT04uc3RyaW5naWZ5KGFuZHJvaWRQdXNoUmVzKX1gKTtcbiAgICAgIH1cbiAgICAgIGV2ZW50LkxvZ3MucHVzaCh7XG4gICAgICAgICBNZXNzYWdlOiBzbGFja01lc3NhZ2UsXG4gICAgICAgICBDcmVhdGVkRGF0ZTogbmV3IERhdGUoKVxuICAgICAgfSk7XG4gICAgICBldmVudC5zYXZlKCkuY2F0Y2goZSA9PiBsb2dnZXIuaW5mbygnVW5hYmxlIHRvIHN0b3JlIGxvZyBtZXNzYWdlIG9mIHNsYWNrIHJlbGF0ZWQgdG8gYW5ub3VuY2VtZW50JywgZSkpO1xuXG4gICAgICBsZXQgYW5ub3VuY2VtZW50ID0gYXdhaXQgQW5ub3VuY2VtZW50TW9kZWwuZmluZE9uZSh7IG1lc3NhZ2U6IG1lc3NhZ2UgfSk7XG4gICAgICBpZiAoIWFubm91bmNlbWVudCkge1xuICAgICAgICAgYW5ub3VuY2VtZW50ID0gbmV3IEFubm91bmNlbWVudE1vZGVsKCk7XG4gICAgICAgICBhbm5vdW5jZW1lbnQubWVzc2FnZSA9IG1lc3NhZ2U7XG4gICAgICAgICBhbm5vdW5jZW1lbnQuYW5ub3VuY2VtZW50cy5wdXNoKHtcbiAgICAgICAgICAgIGV2ZW50OiBldmVudCxcbiAgICAgICAgICAgIGNyZWF0ZWRCeTogdXNlcixcbiAgICAgICAgIH0pO1xuICAgICAgICAgYW5ub3VuY2VtZW50LmZpcmVkVGltZXMgPSAxO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgICBhbm5vdW5jZW1lbnQuZmlyZWRUaW1lcysrO1xuICAgICAgICAgYW5ub3VuY2VtZW50LmFubm91bmNlbWVudHMucHVzaCh7XG4gICAgICAgICAgICBldmVudDogZXZlbnQsXG4gICAgICAgICAgICBjcmVhdGVkQnk6IHVzZXIsXG4gICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGF3YWl0IGFubm91bmNlbWVudC5zYXZlKCk7XG5cbiAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgbG9nZ2VyLmluZm8oZXJyKTtcbiAgICAgIHJldHVybiBuZXh0KGVycik7XG4gICB9XG5cbn07XG5cblxuZXhwb3J0IGNvbnN0IHZvdGVTTVMgPSBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgIHRyeSB7XG4gICAgICByZXMuaGVhZGVyKCdDb250ZW50LVR5cGUnLCAndGV4dC94bWwnKTtcbiAgICAgIGxvZ2dlci5pbmZvKCdvcmlnaW5hbCBmcm9tJywgcmVxLnBhcmFtcy5Gcm9tLCAnT3JpZ2luYWwgdG8nLCByZXEucGFyYW1zLlRvKTtcbiAgICAgIGNvbnN0IGxvZyA9IG5ldyBWb3RpbmdMb2dNb2RlbCgpO1xuICAgICAgbGV0IGJvZHkgPSByZXEucGFyYW0oJ0JvZHknKS50cmltKCk7XG4gICAgICAvLyB0aGUgbnVtYmVyIHRoZSB2b3RlIGl0IGJlaW5nIHNlbnQgdG8gKHRoaXMgc2hvdWxkIG1hdGNoIGFuIEV2ZW50KVxuICAgICAgY29uc3QgdG8gPSAnKycgKyByZXEucGFyYW0oJ1RvJykuc2xpY2UoMSk7XG4gICAgICAvLyBsb2cuRWFzZWxOdW1iZXIgPSBib2R5O1xuICAgICAgLy8gdGhlIHZvdGVyLCB1c2UgdGhpcyB0byBrZWVwIHBlb3BsZSBmcm9tIHZvdGluZyBtb3JlIHRoYW4gb25jZVxuICAgICAgY29uc3QgZnJvbSA9ICcrJyArIHJlcS5wYXJhbSgnRnJvbScpLnJlcGxhY2UoL1xcRC9nLCAnJyk7XG4gICAgICBjb25zdCBldmVudCA9IGF3YWl0IGdldEV2ZW50Rm9yU01TKHRvLCByZXMsIG5leHQsIGxvZyk7XG4gICAgICBsb2dnZXIuaW5mbygnZGVidWc6IGJvZHknLCBib2R5LCB0bywgZnJvbSk7XG4gICAgICBjb25zdCBsb3dlckNhc2VkQm9keSA9IGJvZHkudG9Mb3dlckNhc2UoKS50cmltKCk7XG4gICAgICBpZiAobG93ZXJDYXNlZEJvZHkuc3RhcnRzV2l0aCgnZWFzZWwnKSkge1xuICAgICAgICAgLy8gaGFuZGxlIHdyb25nIHNwZWxsaW5nXG4gICAgICAgICBib2R5ID0gYCR7cGFyc2VJbnQobG93ZXJDYXNlZEJvZHkucmVwbGFjZSgnZWFzZWwnLCAnJykpfWA7XG4gICAgICB9IGVsc2UgaWYgKGxvd2VyQ2FzZWRCb2R5ID09PSAndm90ZScgJiYgKGV2ZW50ICYmIGV2ZW50LlJlZ2lzdGVyQXRTTVNWb3RlKSkge1xuICAgICAgICAgcmV0dXJuIGF3YWl0IFJlZ2lzdGVyVm90ZXIoe1xuICAgICAgICAgICAgQXJ0QmF0dGxlTmV3czogZmFsc2UsXG4gICAgICAgICAgICBEaXNwbGF5UGhvbmU6ICcnLFxuICAgICAgICAgICAgRW1haWw6ICcnLFxuICAgICAgICAgICAgRmlyc3ROYW1lOiAnJyxcbiAgICAgICAgICAgIEhhc2g6ICcnLFxuICAgICAgICAgICAgTGFzdE5hbWU6ICcnLFxuICAgICAgICAgICAgTG95YWx0eU9mZmVyczogZmFsc2UsXG4gICAgICAgICAgICBOb3RpZmljYXRpb25FbWFpbHM6IGZhbHNlLFxuICAgICAgICAgICAgUHJlZmVyZW5jZXM6IFtdLFxuICAgICAgICAgICAgUmVnaW9uQ29kZTogJycsXG4gICAgICAgICAgICBfaWQ6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIFBob25lTnVtYmVyOiBmcm9tLFxuICAgICAgICAgICAgUmVnaXN0ZXJlZEF0OiAncGhvbmUnXG4gICAgICAgICB9LCBldmVudC5faWQsIGZhbHNlLCBTdGF0ZVZvdGVGYWN0b3JNYXBbOF0sIHRydWUpO1xuICAgICAgfVxuICAgICAgaWYgKCFpc05hTihwYXJzZUludChib2R5KSkpIHtcbiAgICAgICAgIHJldHVybiBhd2FpdCBwcm9jZXNzVm90ZSgneG1sJywgYm9keSwgZnJvbSwgZXZlbnQsIHJlcywgbG9nLCAwLCAwLCAncGhvbmUnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICByZXR1cm4gYXdhaXQgcHJvY2Vzc01lc3NhZ2UocmVxLnBhcmFtKCdCb2R5JyksIGZyb20sIHRvLCByZXMpO1xuICAgICAgfVxuICAgfVxuICAgY2F0Y2ggKGUpIHtcbiAgICAgIGxvZ2dlci5pbmZvKGBFcnJvciBpbiB2b3RlU01TICR7ZS5zdGFja30gQm9keTogJHtyZXEucGFyYW0oJ0JvZHknKX0sIEZyb206ICR7cmVxLnBhcmFtKCdGcm9tJyl9LCBUbzogJHtyZXEucGFyYW0oJ1RvJyl9YCk7XG4gICAgICByZXMuc2VuZCgnPFJlc3BvbnNlPjxTbXM+U29ycnkhIE91ciBzeXN0ZW0gZW5jb3VudGVyZWQgYW4gZXJyb3IuIFBsZWFzZSB0cnkgYWdhaW4uPC9TbXM+PC9SZXNwb25zZT4nKTtcbiAgIH1cbn07XG5cbmV4cG9ydCBjb25zdCBzYXZlRXZlbnQgPSBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgIGNvbnN0IGR0bzogRXZlbnREVE8gPSByZXEuYm9keTtcbiAgIGxvZ2dlci5pbmZvKGBTYXZpbmcgZXZlbnQ6ICR7ZHRvLk5hbWV9YCk7XG4gICBjb25zdCBjYWNoZUtleSA9IGBhcHAtZXZlbnQtbGlzdC1gO1xuICAgY29uc3QgY2FjaGVEZWwgPSByZXEuYXBwLmdldCgnY2FjaGVEZWwnKTtcbiAgIGNvbnN0IGNhY2hlRGVsUHJvbWlzZXM6IGFueVtdID0gW107XG4gICBjYWNoZURlbFByb21pc2VzLnB1c2goY2FjaGVEZWwoY2FjaGVLZXkpKTtcbiAgIGNvbnN0IHByZURldGVybWluZWRJZCA9IG5ldyBPYmplY3RJZCgpLnRvSGV4U3RyaW5nKCk7XG4gICBsZXQgc2F2ZWRFdmVudDogRXZlbnREb2N1bWVudDtcbiAgIHRyeSB7XG4gICAgICBpZiAoIWR0by5FSUQpIHtcbiAgICAgICAgIHRocm93ICdFSUQgaXMgcmVxdWlyZWQnO1xuICAgICAgfVxuICAgICAgaWYgKGR0by5TcG9uc29yTG9nbyAmJiBkdG8uU3BvbnNvckxvZ28uVXJsLmxlbmd0aCA+IDApIHtcbiAgICAgICAgIGNvbnN0IG1lZGlhID0gbmV3IE1lZGlhTW9kZWwoKTtcbiAgICAgICAgIG1lZGlhLlVwbG9hZFN0YXJ0ID0gbmV3IERhdGUoKTtcbiAgICAgICAgIGF3YWl0IG1lZGlhLnNhdmUoKTtcbiAgICAgICAgIGNvbnN0IGZpbGVOYW1lID0gYCR7ZHRvLk5hbWUucmVwbGFjZSgvW1xcV19dKy9nLCAnJyl9LSR7bWVkaWEuaWR9YDtcbiAgICAgICAgIGNvbnN0IG9yaWdpbmFsUGF0aCA9IGAke2ZpbGVOYW1lfWA7XG4gICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBfdXBsb2FkKGR0by5TcG9uc29yTG9nby5VcmwsIG9yaWdpbmFsUGF0aCk7XG4gICAgICAgICBtZWRpYS5VcGxvYWRGaW5pc2ggPSByZXN1bHQubWFpbkVuZDtcbiAgICAgICAgIG1lZGlhLk5hbWUgPSBmaWxlTmFtZTtcbiAgICAgICAgIG1lZGlhLlVybCA9IHJlc3VsdC5tYWluO1xuICAgICAgICAgbWVkaWEuRGltZW5zaW9uID0ge1xuICAgICAgICAgICAgd2lkdGg6IHJlc3VsdC5tYWluV2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQ6IHJlc3VsdC5tYWluSGVpZ2h0XG4gICAgICAgICB9O1xuICAgICAgICAgbWVkaWEuU2l6ZSA9IHJlc3VsdC5tYWluU2l6ZTtcbiAgICAgICAgIG1lZGlhLlVwbG9hZGVkQnkgPSByZXEudXNlci5faWQ7XG4gICAgICAgICBhd2FpdCBtZWRpYS5zYXZlKCk7XG4gICAgICAgICBkdG8uU3BvbnNvckxvZ28gPSBtZWRpYTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICBkdG8uU3BvbnNvckxvZ28gPSB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICBjb25zdCB1c2VyOiBVc2VyRG9jdW1lbnQgPSBhd2FpdCBVc2VyLmZpbmRCeUlkKHJlcS51c2VyLmlkKTtcbiAgICAgIGxldCBtZXNzYWdlID0gJyc7XG5cbiAgICAgIC8qXG4gICAgICBQaG9uZSB2YWxpZGF0aW9uIGlzIG5vIGxvbmdlciBuZWVkZWRcbiAgICAgIGlmICghZHRvLlBob25lTnVtYmVyKSB7XG4gICAgICAgICAgY29uc3QgZXJyb3IgPSAnSW52YWxpZCBldmVudCByZWNvcmQuIE5vIFBob25lTnVtYmVyIHByb3ZpZGVkLic7XG4gICAgICAgICAgbG9nZ2VyLmluZm8oZXJyb3IpO1xuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfSovXG5cbiAgICAgIC8qXG4gICAgICBJbnRlbnRpb25hbGx5IGRpc2FibGVkIHBob25lIG51bWJlciB2YWxpZGF0aW9uIGJlY2F1c2Ugd2UgaGF2ZSBwcmVkZWZpbmVkIGxpc3QgZm9yIHRoZSBhZG1pblxuICAgICAgaWYgKCFJc1Bob25lTnVtYmVyKGR0by5QaG9uZU51bWJlcikpIHtcbiAgICAgICAgICBjb25zdCBlcnJvciA9IGBJbnZhbGlkIGV2ZW50IHJlY29yZC4gUGhvbmUgTnVtYmVyIGluIHRoZSB3cm9uZyBmb3JtYXQgJHtkdG8uUGhvbmVOdW1iZXJ9LmA7XG4gICAgICAgICAgbG9nZ2VyLmluZm8oZXJyb3IpO1xuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfVxuICAgICAgKi9cbiAgICAgIC8vIEZvciBpbnRlcm5hdGlvbmFsIG51bWJlciwgdGhpcyBzYW5pdGl6YXRpb24gaXMgd3JvbmdcbiAgICAgIC8vIGR0by5QaG9uZU51bWJlciA9IFNhbml0aXplUGhvbmVOdW1iZXIoZHRvLlBob25lTnVtYmVyKTtcbiAgICAgIGNvbnN0IHF1ZXJ5T2JqOiB7XG4gICAgICAgICBQaG9uZU51bWJlcjogU3RyaW5nLFxuICAgICAgICAgRW5hYmxlZDogQm9vbGVhbixcbiAgICAgICAgIF9pZDogYW55XG4gICAgICB9ID0ge1xuICAgICAgICAgUGhvbmVOdW1iZXI6IGR0by5QaG9uZU51bWJlcixcbiAgICAgICAgIEVuYWJsZWQ6IHRydWUsXG4gICAgICAgICBfaWQ6IHVuZGVmaW5lZFxuICAgICAgfTtcbiAgICAgIGNvbnN0IGVpZFF1ZXJ5T2JqOiB7XG4gICAgICAgICBFSUQ6IHN0cmluZztcbiAgICAgICAgIF9pZD86IGFueTtcbiAgICAgIH0gPSB7XG4gICAgICAgICBFSUQ6IGR0by5FSUQsXG4gICAgICB9O1xuICAgICAgaWYgKGR0by5faWQpIHtcbiAgICAgICAgIHF1ZXJ5T2JqLl9pZCA9IHtcbiAgICAgICAgICAgICckbmUnOiBkdG8uX2lkXG4gICAgICAgICB9O1xuICAgICAgICAgZWlkUXVlcnlPYmouX2lkID0ge1xuICAgICAgICAgICAgJyRuZSc6IGR0by5faWRcbiAgICAgICAgIH07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAgZHRvLl9pZCA9IHByZURldGVybWluZWRJZDtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHRhc2tzOiBhbnlbXSA9IFtcbiAgICAgICAgIEV2ZW50TW9kZWwuZmluZChxdWVyeU9iaikuY291bnREb2N1bWVudHMoKSxcbiAgICAgICAgIEV2ZW50TW9kZWxcbiAgICAgICAgICAgICAuZmluZEJ5SWQoZHRvLl9pZClcbiAgICAgICAgICAgICAuZXhlYygpLFxuICAgICAgICAgIEV2ZW50TW9kZWwuY291bnREb2N1bWVudHMoZWlkUXVlcnlPYmopXG4gICAgICBdO1xuICAgICAgaWYgKGR0by5UaW1lWm9uZSkge1xuICAgICAgICAgdGFza3MucHVzaChUaW1lem9uZU1vZGVsLmZpbmRCeUlkKGR0by5UaW1lWm9uZSkpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBjb21iaW5lZERhdGEgPSBhd2FpdCBQcm9taXNlLmFsbCh0YXNrcyk7XG4gICAgICBsZXQgZXZlbnQ6IEV2ZW50RG9jdW1lbnQgPSBjb21iaW5lZERhdGFbMV07XG4gICAgICBjb25zdCBkdXBQaG9uZVNlcnZlckNvdW50ID0gY29tYmluZWREYXRhWzBdO1xuICAgICAgY29uc3QgZXZlbnRFaWRDb3VudCA9IGNvbWJpbmVkRGF0YVsyXTtcbiAgICAgIGlmIChldmVudEVpZENvdW50ID4gMCkge1xuICAgICAgICAgdGhyb3cgYFRoaXMgRUlEIGlzIGJlaW5nIFVzZWQgaW4gYW5vdGhlciBldmVudGA7XG4gICAgICB9XG4gICAgICBpZiAoZHRvLlBob25lTnVtYmVyICYmIGR1cFBob25lU2VydmVyQ291bnQgPiAwKSB7XG4gICAgICAgICAvLyBpZiBwaG9uZW51bWJlciBpcyBub3Qgc2VudCB0aGVuIHRoaXMgdmFsaWRhdGlvbiBkb24ndCBydW5cbiAgICAgICAgIHRocm93ICdEdXBsaWNhdGUgU2VydmVyIHBob25lIG51bWJlciBmb3VuZCBhY3Jvc3MgbXVsdGlwbGUgZXZlbnRzJztcbiAgICAgIH1cbiAgICAgIGxldCByb3VuZFN0ciA9ICcnO1xuICAgICAgbGV0IGFydGlzdFJvdW5kcyA9ICcnO1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZHRvLlJvdW5kcykpIHtcbiAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZHRvLlJvdW5kcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgciA9IGR0by5Sb3VuZHNbaV07XG4gICAgICAgICAgICByLklzRmluaXNoZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIHJvdW5kU3RyICs9IGBSb3VuZCAke3IuUm91bmROdW1iZXJ9LGA7XG4gICAgICAgICAgICBhcnRpc3RSb3VuZHMgKz0gYFxcbkFydGlzdHMgaW4gUm91bmQ6ICR7ci5Sb3VuZE51bWJlcn0gOlxcbmA7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHIuQ29udGVzdGFudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgIHIuQ29udGVzdGFudHNbaV0uSXNXaW5uZXIgPSAwO1xuICAgICAgICAgICAgICAgaWYgKHIuQ29udGVzdGFudHNbaV0uRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgYXJ0aXN0Um91bmRzICs9IGAke3IuQ29udGVzdGFudHNbaV0uRWFzZWxOdW1iZXJ9ID0+ICR7ci5Db250ZXN0YW50c1tpXS5EZXRhaWwuTmFtZX0gKCR7ci5Db250ZXN0YW50c1tpXS5EZXRhaWwuRW50cnlJZH0pXFxuYDtcbiAgICAgICAgICAgICAgICAgIGNhY2hlRGVsUHJvbWlzZXMucHVzaChjYWNoZURlbChgYXVjdGlvbi1kZXRhaWwtJHtkdG8uRUlEfS0ke3IuUm91bmROdW1iZXJ9LSR7ci5Db250ZXN0YW50c1tpXS5FYXNlbE51bWJlcn1gKSk7XG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICBpZiAoIXIuQ29udGVzdGFudHNbaV0uTG90KSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBlYXNlbE5vID0gci5Db250ZXN0YW50c1tpXS5FYXNlbE51bWJlciB8fCAoOTkgKyBpKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGFydElkID0gYCR7ZHRvLkVJRH0tJHtyLlJvdW5kTnVtYmVyfS0ke2Vhc2VsTm99YDtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGxvdCA9ICBhd2FpdCBMb3RNb2RlbC5maW5kT25lKHtBcnRJZDogYXJ0SWR9KTtcbiAgICAgICAgICAgICAgICAgIGlmICghbG90KSB7XG4gICAgICAgICAgICAgICAgICAgICAvLyBsaW5rIGxvdCBvbiByb3VuZHMuY29udGVzdGFudHNcbiAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxvdE1vZGVsID0gbmV3IExvdE1vZGVsKCk7XG4gICAgICAgICAgICAgICAgICAgICBsb3RNb2RlbC5BcnRJZCA9IGFydElkO1xuICAgICAgICAgICAgICAgICAgICAgbG90TW9kZWwuRWFzZWxOdW1iZXIgPSByLkNvbnRlc3RhbnRzW2ldLkVhc2VsTnVtYmVyO1xuICAgICAgICAgICAgICAgICAgICAgbG90TW9kZWwuRXZlbnQgPSBkdG8uX2lkO1xuICAgICAgICAgICAgICAgICAgICAgbG90TW9kZWwuUm91bmQgPSByLlJvdW5kTnVtYmVyO1xuICAgICAgICAgICAgICAgICAgICAgbG90TW9kZWwuQmlkcyA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgbG90TW9kZWwuU3RhdHVzID0gMDtcbiAgICAgICAgICAgICAgICAgICAgIGxvdE1vZGVsLkNvbnRlc3RhbnQgPSByLkNvbnRlc3RhbnRzW2ldLkRldGFpbC5faWQ7XG4gICAgICAgICAgICAgICAgICAgICBsb3RNb2RlbC5BcnRpc3RJZCA9IHIuQ29udGVzdGFudHNbaV0uRGV0YWlsLkVudHJ5SWQ7XG4gICAgICAgICAgICAgICAgICAgICAvLyBsb3RNb2RlbC5JbWFnZXMgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgIC8vIGxvdE1vZGVsLlZpZGVvcyA9IFtdO1xuICAgICAgICAgICAgICAgICAgICAgci5Db250ZXN0YW50c1tpXS5Mb3QgPSBhd2FpdCBsb3RNb2RlbC5zYXZlKCk7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgci5Db250ZXN0YW50c1tpXS5Mb3QgPSBsb3Q7XG4gICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgY29udGVzdGFudCBpcyBjaGFuZ2VkIHRoZW4gcmVmbGVjdCBpdC5cbiAgICAgICAgICAgICAgICAgICAgIGxvdC5Db250ZXN0YW50ID0gci5Db250ZXN0YW50c1tpXS5EZXRhaWwuX2lkO1xuICAgICAgICAgICAgICAgICAgICAgbG90LkFydGlzdElkID0gci5Db250ZXN0YW50c1tpXS5EZXRhaWwuRW50cnlJZDtcbiAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGxvdC5zYXZlKCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oYGxvdCBleGlzdHMgJHtyLkNvbnRlc3RhbnRzW2ldLkxvdH1gKTtcbiAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLyogSW4gZGIgR01UIGRhdGUgKi9cbiAgICAgIGR0by5UaW1lWm9uZUlDQU5OID0gY29tYmluZWREYXRhWzNdICYmIGNvbWJpbmVkRGF0YVszXS5pY2Fubl9uYW1lO1xuICAgICAgY29uc3Qgc3RhcnREYXRlID0gcGFyc2VGcm9tVGltZVpvbmUoZHRvLkV2ZW50U3RhcnREYXRlVGltZSwgJ00vRC9ZIEhIOm1tIEEnLCB7IHRpbWVab25lOiBkdG8uVGltZVpvbmVJQ0FOTiB9KTtcbiAgICAgIGNvbnN0IGVuZERhdGUgPSBwYXJzZUZyb21UaW1lWm9uZShkdG8uRXZlbnRFbmREYXRlVGltZSwgJ00vRC9ZIEhIOm1tIEEnLCB7IHRpbWVab25lOiBkdG8uVGltZVpvbmVJQ0FOTiB9KTtcbiAgICAgIGR0by5FdmVudFN0YXJ0RGF0ZVRpbWUgPSBzdGFydERhdGUudG9JU09TdHJpbmcoKTtcbiAgICAgIGR0by5FdmVudEVuZERhdGVUaW1lID0gZW5kRGF0ZS50b0lTT1N0cmluZygpO1xuICAgICAgLyogSW4gZGIgR01UIGRhdGUgZW5kICovXG4gICAgICBpZiAoIWV2ZW50KSB7XG4gICAgICAgICBjb25zdCBldmVudERUTzogRXZlbnREVE8gPSBkdG8gYXMgRXZlbnREVE87XG4gICAgICAgICBldmVudERUTy5Sb3VuZHMgPSBldmVudERUTy5Sb3VuZHMubWFwKHIgPT4ge1xuICAgICAgICAgICAgICAgIHIuSXNGaW5pc2hlZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIHJldHVybiByO1xuICAgICAgICAgICAgIH1cbiAgICAgICAgICk7XG4gICAgICAgICBldmVudCA9IG5ldyBFdmVudE1vZGVsKGV2ZW50RFRPKTtcbiAgICAgICAgIGV2ZW50Ll9pZCA9IGV2ZW50RFRPLl9pZDtcbiAgICAgICAgIC8vIEFmdGVyIHNlbmRpbmcgcmVzcG9uc2Ugc2VuZCBtZXNzYWdlIHRvIHNsYWNrIGNoYW5uZWxcbiAgICAgICAgIG1lc3NhZ2UgKz0gYCR7ZXZlbnQuTmFtZX0gd2FzIGNyZWF0ZWQgYnkgJHt1c2VyICYmIHVzZXIuZW1haWx9IFxcbmA7XG4gICAgICAgICBtZXNzYWdlICs9IGBSb3VuZHMgOiAke3JvdW5kU3RyfWA7XG4gICAgICAgICBtZXNzYWdlICs9IGFydGlzdFJvdW5kcztcbiAgICAgICAgIGV2ZW50LkxvZ3MucHVzaCh7XG4gICAgICAgICAgICBNZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgICAgICAgQ3JlYXRlZERhdGU6IG5ldyBEYXRlKClcbiAgICAgICAgIH0pO1xuICAgICAgICAgc2F2ZWRFdmVudCA9IGF3YWl0IGV2ZW50LnNhdmUoKTtcbiAgICAgICAgIGNvbnN0IHJlc3VsdDogRGF0YU9wZXJhdGlvblJlc3VsdDxFdmVudERUTz4gPSB7XG4gICAgICAgICAgICBTdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgRGF0YTogc2F2ZWRFdmVudFxuICAgICAgICAgfTtcbiAgICAgICAgIHJlcy5qc29uKHJlc3VsdCk7XG5cbiAgICAgICAgIC8vIEFmdGVyIHNlbmRpbmcgcmVzcG9uc2Ugc2VuZCBtZXNzYWdlIHRvIHNsYWNrIGNoYW5uZWxcbiAgICAgICAgIHBvc3RUb1NsYWNrKHtcbiAgICAgICAgICAgICd0ZXh0JzogbWVzc2FnZVxuICAgICAgICAgfSkuY2F0Y2goKCkgPT4gbG9nZ2VyLmluZm8oJ2V2ZW50IGNyZWF0ZSBzbGFjayBjYWxsIGZhaWxlZCAnLCBtZXNzYWdlKSk7XG5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICAvLyBBZnRlciBzZW5kaW5nIHJlc3BvbnNlIHNlbmQgbWVzc2FnZSB0byBzbGFjayBjaGFubmVsXG4gICAgICAgICBtZXNzYWdlICs9IGAke2V2ZW50Lk5hbWV9IHdhcyBlZGl0ZWQgYnkgJHt1c2VyICYmIHVzZXIuZW1haWx9IFxcbmA7XG4gICAgICAgICBtZXNzYWdlICs9IGBSb3VuZHMgOiAke3JvdW5kU3RyfWA7XG4gICAgICAgICBtZXNzYWdlICs9IGFydGlzdFJvdW5kcztcbiAgICAgICAgIGV2ZW50LmVkaXQoZHRvKTtcbiAgICAgICAgIGV2ZW50LkxvZ3MucHVzaCh7XG4gICAgICAgICAgICBNZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgICAgICAgQ3JlYXRlZERhdGU6IG5ldyBEYXRlKClcbiAgICAgICAgIH0pO1xuICAgICAgICAgc2F2ZWRFdmVudCA9IGF3YWl0IGV2ZW50LnNhdmUoKTtcbiAgICAgICAgIGNvbnN0IHJlc3VsdDogRGF0YU9wZXJhdGlvblJlc3VsdDxFdmVudERUTz4gPSB7XG4gICAgICAgICAgICBTdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgRGF0YTogc2F2ZWRFdmVudFxuICAgICAgICAgfTtcbiAgICAgICAgIHJlcy5qc29uKHJlc3VsdCk7XG4gICAgICAgICAvLyBEZWxldGUgY2FjaGVcbiAgICAgICAgIGNhY2hlRGVsUHJvbWlzZXMucHVzaChjYWNoZURlbChgJHtjYWNoZUtleX0ke3NhdmVkRXZlbnQuX2lkfWApKTtcblxuICAgICAgICAgcG9zdFRvU2xhY2soe1xuICAgICAgICAgICAgJ3RleHQnOiBtZXNzYWdlXG4gICAgICAgICB9KS5jYXRjaCgoKSA9PiBsb2dnZXIuaW5mbygnZXZlbnQgZWRpdCBzbGFjayBjYWxsIGZhaWxlZCAnLCBtZXNzYWdlKSk7XG4gICAgICB9XG4gICAgICBsb2dnZXIuaW5mbyhgcmVtb3ZpbmcgYXVjdGlvbiBkZXRhaWxzL2V2ZW50LWxpc3QgY2FjaGVgKTtcbiAgICAgIGF3YWl0IFByb21pc2UuYWxsKGNhY2hlRGVsUHJvbWlzZXMpO1xuICAgICAgbG9nZ2VyLmluZm8oYHJlbW92ZWQgYXVjdGlvbiBkZXRhaWxzL2V2ZW50LWxpc3QgY2FjaGVgKTtcbiAgIH1cbiAgIGNhdGNoIChlKSB7XG4gICAgICBpZiAodHlwZW9mIGUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICBsb2dnZXIuZXJyb3IoZSk7XG4gICAgICAgICBlID0ge1xuICAgICAgICAgICAgTWVzc2FnZTogZSxcbiAgICAgICAgICAgIHN0YXR1czogNDAzLFxuICAgICAgICAgICAgbWVzc2FnZTogZVxuICAgICAgICAgfTtcbiAgICAgICAgIHJldHVybiBuZXh0KGUpO1xuICAgICAgfVxuICAgICAgaWYgKCFlLnN0YXR1cykge1xuICAgICAgICAgZS5zdGF0dXMgPSA1MDA7XG4gICAgICB9XG4gICAgICBpZiAoIWUubWVzc2FnZSkge1xuICAgICAgICAgbG9nZ2VyLmVycm9yKGUpO1xuICAgICAgICAgZSA9IHtcbiAgICAgICAgICAgIHN0YXR1czogNDAzLFxuICAgICAgICAgfTtcbiAgICAgICAgIGUubWVzc2FnZSA9ICdTZXJ2ZXIgZXJyb3Igb2NjdXJyZWQhJztcbiAgICAgIH1cbiAgICAgIGUuTWVzc2FnZSA9IGUubWVzc2FnZTtcbiAgICAgIHJldHVybiBuZXh0KGUpO1xuICAgfVxufTtcblxuYXN5bmMgZnVuY3Rpb24gX3VwbG9hZChyYXdJbWFnZTogc3RyaW5nLCBvcmlnaW5hbFBhdGg6IHN0cmluZyk6IFByb21pc2U8e1xuICAgbWFpbjogc3RyaW5nLFxuICAgbWFpblN0YXJ0OiBEYXRlLFxuICAgbWFpbkVuZDogRGF0ZSxcbiAgIG1haW5IZWlnaHQ6IG51bWJlcixcbiAgIG1haW5XaWR0aDogbnVtYmVyLFxuICAgbWFpblNpemU6IG51bWJlcixcbiAgIG1haW5GaWxlOiBzdHJpbmcsXG59PiB7XG4gICBjb25zdCBiYXNlNjREYXRhID0gcmF3SW1hZ2UucmVwbGFjZSgvXmRhdGE6aW1hZ2VcXC8oW1xcdytdKyk7YmFzZTY0LywgJycpO1xuICAgY29uc3QgZmlsZVBhdGg6IHN0cmluZyA9IGAke19fZGlybmFtZX0vLi4vcHVibGljL3VwbG9hZHMvaW1hZ2VzL3Nwb25zb3JzLyR7b3JpZ2luYWxQYXRofWA7XG4gICBjb25zdCBpbWdCdWZmZXIgPSBCdWZmZXIuZnJvbShiYXNlNjREYXRhLCAnYmFzZTY0Jyk7XG4gICBjb25zdCByZXN1bHQgPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBfd3JpdGVGaWxlKGZpbGVQYXRoLCBpbWdCdWZmZXIpLFxuICAgXSk7XG4gICByZXR1cm4ge1xuICAgICAgbWFpbjogYCR7cHJvY2Vzcy5lbnYuTUVESUFfU0lURV9VUkx9JHtyZXN1bHRbMF0uZmlsZS5zdWJzdHIocmVzdWx0WzBdLmZpbGUuaW5kZXhPZigncHVibGljJykgKyAncHVibGljJy5sZW5ndGgpfWAsXG4gICAgICBtYWluU3RhcnQ6IHJlc3VsdFswXS5zdGFydERhdGUsXG4gICAgICBtYWluRW5kOiByZXN1bHRbMF0uZW5kRGF0ZSxcbiAgICAgIG1haW5IZWlnaHQ6IHJlc3VsdFswXS5oZWlnaHQsXG4gICAgICBtYWluV2lkdGg6IHJlc3VsdFswXS53aWR0aCxcbiAgICAgIG1haW5TaXplOiByZXN1bHRbMF0uc2l6ZSxcbiAgICAgIG1haW5GaWxlOiByZXN1bHRbMF0uZmlsZSxcbiAgIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF93cml0ZUZpbGUoZmlsZVBhdGg6IHN0cmluZywgYmluYXJ5OiBCdWZmZXIpIHtcbiAgIGNvbnN0IHN0YXJ0RGF0ZSA9IG5ldyBEYXRlKCk7XG4gICBjb25zdCBpbWFnZU1ldGEgPSBhd2FpdCBzaGFycChiaW5hcnkpLm1ldGFkYXRhKCk7XG4gICBjb25zdCBmaWxlID0gYCR7ZmlsZVBhdGh9LiR7aW1hZ2VNZXRhLmZvcm1hdH1gO1xuICAgYXdhaXQgZnMud3JpdGVGaWxlKGZpbGUsIGJpbmFyeSk7XG4gICBjb25zdCBlbmREYXRlID0gbmV3IERhdGUoKTtcbiAgIHJldHVybiB7XG4gICAgICBzdGFydERhdGU6IHN0YXJ0RGF0ZSxcbiAgICAgIGVuZERhdGU6IGVuZERhdGUsXG4gICAgICBoZWlnaHQ6IGltYWdlTWV0YS5oZWlnaHQsXG4gICAgICB3aWR0aDogaW1hZ2VNZXRhLndpZHRoLFxuICAgICAgc2l6ZTogaW1hZ2VNZXRhLnNpemUsXG4gICAgICBmaWxlOiBmaWxlXG4gICB9O1xufVxuZXhwb3J0IGNvbnN0IGFyY2hpdmVFdmVudCA9IGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgY29uc3QgZXZlbnQgPSBhd2FpdCBFdmVudE1vZGVsLmZpbmRCeUlkKHJlcS5wYXJhbXMuZXZlbnRJZCk7XG5cbiAgIGV2ZW50LkVuYWJsZWQgPSBmYWxzZTtcblxuICAgYXdhaXQgZXZlbnQuc2F2ZSgpO1xuXG4gICBjb25zdCByZXN1bHQ6IE9wZXJhdGlvblJlc3VsdCA9IHtcbiAgICAgIFN1Y2Nlc3M6IHRydWVcbiAgIH07XG5cbiAgIHJlcy5qc29uKHJlc3VsdCk7XG59O1xuXG5leHBvcnQgY29uc3QgZ2V0RXZlbnRzID0gYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICB0cnkge1xuICAgICAgY29uc3QgdXNlcjogVXNlckRvY3VtZW50ID0gYXdhaXQgVXNlci5maW5kQnlJZChyZXEudXNlci5pZCk7XG4gICAgICBjb25zdCBldmVudElkcyA9IHJlcS51c2VyLmV2ZW50SWRzO1xuICAgICAgbG9nZ2VyLmluZm8oYGV2ZW50TGlzdCBpcyBldmVudCBhZG1pbiAke3JlcS51c2VyLklzRXZlbnRBZG1pbn0sIGFsbG93ZWQgZXZlbnQgaWRzICR7SlNPTi5zdHJpbmdpZnkocmVxLnVzZXIuZXZlbnRJZHMgfHwgW10pfSwgaXMgZ3Vlc3QgJHtyZXEudXNlci5Jc0d1ZXN0VXNlcn0gZG9udCBoYXZlIHBhc3N3b3JkICR7IXJlcS51c2VyLnBhc3N3b3JkfWApO1xuICAgICAgaWYgKFxuICAgICAgICAgICghcmVxLnVzZXIucGFzc3dvcmQgJiYgIXJlcS51c2VyLklzR3Vlc3RVc2VyKSB8fFxuICAgICAgICAgIChyZXEudXNlci5Jc0d1ZXN0VXNlciAmJiAhcmVxLnVzZXIuSXNFdmVudEFkbWluKSB8fFxuICAgICAgICAgIChyZXEudXNlci5Jc0d1ZXN0VXNlciAmJiByZXEudXNlci5Jc0V2ZW50QWRtaW4gJiYgcmVxLnVzZXIuZXZlbnRJZHMgJiYgcmVxLnVzZXIuZXZlbnRJZHMubGVuZ3RoID09PSAwKVxuICAgICAgKSB7XG4gICAgICAgICByZXMuanNvbih7XG4gICAgICAgICAgICBzdGF0dXM6IDQwNCxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdObyBldmVudCBmb3VuZCdcbiAgICAgICAgIH0pO1xuICAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgY29uZGl0aW9uID0ge1xuICAgICAgICAgJ0VuYWJsZWQnOiAocmVxLnF1ZXJ5LmVuYWJsZWQgJiYgcGFyc2VJbnQocmVxLnF1ZXJ5LmVuYWJsZWQpID09PSAxKSB8fCBmYWxzZSxcbiAgICAgIH07XG4gICAgICBpZiAoZXZlbnRJZHMgJiYgZXZlbnRJZHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgY29uZGl0aW9uLl9pZCA9IHsgJGluOiBldmVudElkcyB9O1xuICAgICAgfVxuICAgICAgbGV0IHF1ZXJ5ID0gRXZlbnRNb2RlbC5maW5kKGNvbmRpdGlvbilcbiAgICAgICAgICAuc2VsZWN0KFtcbiAgICAgICAgICAgICAnX2lkJyxcbiAgICAgICAgICAgICAnTmFtZScsXG4gICAgICAgICAgICAgJ1Bob25lTnVtYmVyJyxcbiAgICAgICAgICAgICAnUm91bmRzJyxcbiAgICAgICAgICAgICAnQ3VycmVudFJvdW5kJyxcbiAgICAgICAgICAgICAnQ291bnRyeSdcbiAgICAgICAgICBdKVxuICAgICAgICAgIC5wb3B1bGF0ZSgnQ291bnRyeScpXG4gICAgICAgICAgLnNvcnQoe1xuICAgICAgICAgICAgICdfaWQnOiAtMVxuICAgICAgICAgIH0pO1xuXG4gICAgICBpZiAoIShyZXEudXNlciAmJiByZXEudXNlci5Jc0V2ZW50QWRtaW4gfHwgKHVzZXIgJiYgdXNlci5pc0FkbWluKSkpIHtcbiAgICAgICAgIC8vIHRvIG5vbiBhZG1pbiBzaG93IGVuYWJsZWQgZXZlbnQgb25seVxuICAgICAgICAgcXVlcnkgPSBxdWVyeS53aGVyZSgnRW5hYmxlZCcpLmVxdWFscyh0cnVlKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGV2ZW50czogRXZlbnREb2N1bWVudFtdID0gYXdhaXQgcXVlcnkuZXhlYygpO1xuXG4gICAgICBjb25zdCBmaWx0ZXJSb3VuZEZuID0gKHJvdW5kT2JqOiBSb3VuZERUTykgPT4ge1xuICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIElzRmluaXNoZWQ6IHJvdW5kT2JqLklzRmluaXNoZWQsXG4gICAgICAgICAgICBSb3VuZE51bWJlcjogcm91bmRPYmouUm91bmROdW1iZXJcbiAgICAgICAgIH07XG4gICAgICB9O1xuXG4gICAgICBjb25zdCBmaWx0ZXJlZEV2ZW50cyA9IFtdOyAvLyBSZWR1Y2UgUGF5bG9hZCBzaXplXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV2ZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgY29uc3QgZmlsdGVyZWRFdmVudE9iajogRXZlbnRIb21lRHRvID0ge1xuICAgICAgICAgICAgX2lkOiBldmVudHNbaV0uX2lkLFxuICAgICAgICAgICAgTmFtZTogZXZlbnRzW2ldLk5hbWUsXG4gICAgICAgICAgICBQaG9uZU51bWJlcjogZXZlbnRzW2ldLlBob25lTnVtYmVyLFxuICAgICAgICAgICAgRW5hYmxlZDogZXZlbnRzW2ldLkVuYWJsZWQsXG4gICAgICAgICAgICBSb3VuZHM6IFtdLFxuICAgICAgICAgICAgQ3VycmVudFJvdW5kOiBldmVudHNbaV0uQ3VycmVudFJvdW5kID8gZmlsdGVyUm91bmRGbihldmVudHNbaV0uQ3VycmVudFJvdW5kKSA6IG51bGwsXG4gICAgICAgICAgICBjb3VudHJ5RmxhZzogZXZlbnRzW2ldLkNvdW50cnkgJiYgZXZlbnRzW2ldLkNvdW50cnkuY291bnRyeV9pbWFnZVxuICAgICAgICAgfTtcbiAgICAgICAgIGNvbnN0IGZpbHRlcmVkUm91bmRzOiBSb3VuZEhvbWVEdG9bXSA9IFtdO1xuXG4gICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGV2ZW50c1tpXS5Sb3VuZHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIGZpbHRlcmVkUm91bmRzLnB1c2goZmlsdGVyUm91bmRGbihldmVudHNbaV0uUm91bmRzW2pdKSk7XG4gICAgICAgICB9XG4gICAgICAgICBmaWx0ZXJlZEV2ZW50T2JqLlJvdW5kcyA9IGZpbHRlcmVkUm91bmRzO1xuICAgICAgICAgZmlsdGVyZWRFdmVudHMucHVzaChmaWx0ZXJlZEV2ZW50T2JqKTtcbiAgICAgIH1cbiAgICAgIHJlcy5qc29uKGZpbHRlcmVkRXZlbnRzKTtcbiAgIH1cbiAgIGNhdGNoIChlcnIpIHtcbiAgICAgIHJldHVybiBuZXh0KGVycik7XG4gICB9XG59O1xuXG5leHBvcnQgY29uc3QgZ2V0RXZlbnQgPSBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgIGxldCBldmVudDogRXZlbnREb2N1bWVudDtcbiAgIGludGVyZmFjZSBCb2R5IHtcbiAgICAgIFJlcG9ydExpbmtzOiAoXG4gICAgICAgICAge1xuICAgICAgICAgICAgIGxpbms6IHN0cmluZztcbiAgICAgICAgICAgICBsYWJlbDogc3RyaW5nXG4gICAgICAgICAgfSlbXTtcbiAgICAgIFBob25lTnVtYmVyczogRXZlbnRQaG9uZU51bWJlckRvY3VtZW50W107XG4gICB9XG4gICBjb25zdCBib2R5OiBCb2R5ID0ge1xuICAgICAgUmVwb3J0TGlua3M6IFtdLFxuICAgICAgUGhvbmVOdW1iZXJzOiBhd2FpdCBFdmVudFBob25lTnVtYmVyTW9kZWwuZmluZCh7XG4gICAgICAgICB0eXBlOiAndm90ZScsXG4gICAgICAgICBzdGF0dXM6IDFcbiAgICAgIH0pXG4gICB9O1xuICAgdHJ5IHtcbiAgICAgIGNvbnN0IHVzZXI6IFVzZXJEb2N1bWVudCA9IGF3YWl0IFVzZXIuZmluZEJ5SWQocmVxLnVzZXIuaWQpO1xuICAgICAgZXZlbnQgPSBhd2FpdCBFdmVudE1vZGVsXG4gICAgICAgICAgLmZpbmRCeUlkKHJlcS5wYXJhbXMuZXZlbnRJZClcbiAgICAgICAgICAucG9wdWxhdGUoJ0NvbnRlc3RhbnRzJylcbiAgICAgICAgICAucG9wdWxhdGUoJ1JvdW5kcy5Db250ZXN0YW50cy5EZXRhaWwnKVxuICAgICAgICAgIC5wb3B1bGF0ZSgnUm91bmRzLkNvbnRlc3RhbnRzLlZvdGVzJylcbiAgICAgICAgICAucG9wdWxhdGUoJ0N1cnJlbnRSb3VuZC5Db250ZXN0YW50cy5EZXRhaWwnKVxuICAgICAgICAgIC5wb3B1bGF0ZSgnQ3VycmVudFJvdW5kLkNvbnRlc3RhbnRzLlZvdGVzJylcbiAgICAgICAgICAucG9wdWxhdGUoJ1Nwb25zb3JMb2dvJylcbiAgICAgICAgICAuZXhlYygpO1xuICAgICAgaWYgKHJlcS51c2VyICYmIHJlcS51c2VyLklzRXZlbnRBZG1pbiB8fCAodXNlciAmJiB1c2VyLmlzQWRtaW4pKSB7XG4gICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICBib2R5LlJlcG9ydExpbmtzID0gW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgbGFiZWw6ICdEb3dubG9hZCBWb3RlcyByZXBvcnQnLFxuICAgICAgICAgICAgICAgbGluazogYC9ldmVudC8ke3JlcS5wYXJhbXMuZXZlbnRJZH0vdm90ZXNgXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgbGFiZWw6ICdEb3dubG9hZCBSZWdpc3RyYXRpb25zIHJlcG9ydCcsXG4gICAgICAgICAgICAgICBsaW5rOiBgL2V2ZW50LyR7cmVxLnBhcmFtcy5ldmVudElkfS9yZWdpc3RyYXRpb25zYFxuICAgICAgICAgICAgfVxuICAgICAgICAgXTtcbiAgICAgIH1cbiAgICAgIGlmIChldmVudC5FbmFibGVkIHx8ICgocmVxLnVzZXIgJiYgcmVxLnVzZXIuSXNFdmVudEFkbWluIHx8ICh1c2VyICYmIHVzZXIuaXNBZG1pbikpICYmICFldmVudC5FbmFibGVkKSkge1xuICAgICAgICAgY29uc3QgZXZlbnRPYmogPSBldmVudC50b09iamVjdCgpO1xuICAgICAgICAgaWYgKCFldmVudC5UaW1lWm9uZUlDQU5OKSB7XG4gICAgICAgICAgICBldmVudC5UaW1lWm9uZUlDQU5OID0gJ0FtZXJpY2EvTG9zX0FuZ2VsZXMnO1xuICAgICAgICAgfVxuICAgICAgICAgZXZlbnRPYmouRXZlbnRTdGFydERhdGVUaW1lID0gZm9ybWF0VG9UaW1lWm9uZShuZXcgRGF0ZShldmVudC5FdmVudFN0YXJ0RGF0ZVRpbWUpLCAnTU0vREQvWVlZWSBoaDptbSBBJywgeyB0aW1lWm9uZTogZXZlbnQuVGltZVpvbmVJQ0FOTiB9KS50b1N0cmluZygpO1xuICAgICAgICAgZXZlbnRPYmouRXZlbnRFbmREYXRlVGltZSA9IGZvcm1hdFRvVGltZVpvbmUobmV3IERhdGUoZXZlbnQuRXZlbnRFbmREYXRlVGltZSksICdNTS9ERC9ZWVlZIGhoOm1tIEEnLCB7IHRpbWVab25lOiBldmVudC5UaW1lWm9uZUlDQU5OIH0pO1xuICAgICAgICAgZXZlbnRPYmouQXVjdGlvbkNsb3NlU3RhcnRzQXQgPSBmb3JtYXRUb1RpbWVab25lKG5ldyBEYXRlKGV2ZW50LkF1Y3Rpb25DbG9zZVN0YXJ0c0F0KSwgJ01NL0REL1lZWVkgaGg6bW0gQScsIHsgdGltZVpvbmU6IGV2ZW50LlRpbWVab25lSUNBTk4gfSkudG9TdHJpbmcoKTtcbiAgICAgICAgIGxvZ2dlci5pbmZvKGV2ZW50T2JqLkV2ZW50U3RhcnREYXRlVGltZSwgZXZlbnRPYmouVGltZVpvbmVJQ0FOTik7XG5cbiAgICAgICAgIHJlcy5qc29uKHsgLi4uYm9keSwgLi4uZXZlbnRPYmogfSk7XG4gICAgICB9XG4gICB9XG4gICBjYXRjaCAoZXJyKSB7XG4gICAgICByZXR1cm4gbmV4dChlcnIpO1xuICAgfVxufTtcblxuLyoqXG4gKiBJbmNyZW1lbnQgUm91bmRcbiAqIEBwYXJhbSByZXFcbiAqIEBwYXJhbSByZXNcbiAqIEBwYXJhbSBuZXh0XG4gKi9cbmV4cG9ydCBjb25zdCBpbmNyZW1lbnRSb3VuZCA9IGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgdHJ5IHtcbiAgICAgIHJlcy5qc29uKGF3YWl0IEV2ZW50SW5jcmVtZW50Um91bmQocmVxLCByZXEucGFyYW1zLmV2ZW50SWQsIHJlcS51c2VyLmlkKSk7XG4gICB9IGNhdGNoIChlKSB7XG4gICAgICByZXR1cm4gbmV4dChlKTtcbiAgIH1cbn07XG5cbi8qKlxuICogRG93bmxvYWQgVm90ZXIgbG9nc1xuICogQHBhcmFtIHJlcVxuICogQHBhcmFtIHJlc1xuICogQHBhcmFtIG5leHRcbiAqL1xuZXhwb3J0IGNvbnN0IHZvdGVyTG9ncyA9IGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgY29uc3QgZXZlbnRJZCA9IHJlcS5wYXJhbXMuZXZlbnRJZDtcbiAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtZGlzcG9zaXRpb24nLCBgYXR0YWNobWVudDsgZmlsZW5hbWU9dm90ZXJMb2dzXyR7ZXZlbnRJZH0uY3N2YCk7XG4gICByZXMud3JpdGVIZWFkKDIwMCwge1xuICAgICAgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L2NzdidcbiAgIH0pO1xuICAgcmVzLndyaXRlKGBcIkV2ZW50SWRcIixcIkV2ZW50TmFtZVwiLFwiRWFzZWxOdW1iZXJcIixcIlJvdW5kTnVtYmVyXCIsXCJTdGF0dXNcIixcIkFydGlzdE5hbWVcIixcIlBob25lTnVtYmVyXCIsXCJjcmVhdGVkQXRVbml4XCIsXCJjcmVhdGVkQXRcIlxcbmApO1xuICAgVm90aW5nTG9nTW9kZWwuZmluZCh7XG4gICAgICBFdmVudElkOiByZXEucGFyYW1zLmV2ZW50SWRcbiAgIH0pLmN1cnNvcih7XG4gICAgICB0cmFuc2Zvcm06IChkb2M6IFZvdGluZ0xvZ0RvY3VtZW50KSA9PiB7XG4gICAgICAgICByZXR1cm4gYFwiJHtkb2MuRXZlbnRJZH1cIixcIiR7ZG9jLkV2ZW50TmFtZX1cIixcIiR7ZG9jLkVhc2VsTnVtYmVyfVwiLFwiJHtkb2MuUm91bmROdW1iZXJ9XCIsXCIke2RvYy5TdGF0dXN9XCIsXCIke2RvYy5BcnRpc3ROYW1lfVwiLFwiJHtkb2MuUGhvbmVOdW1iZXJ9XCIsXCIke25ldyBEYXRlKGRvYy5jcmVhdGVkQXQpLmdldFRpbWUoKX1cIixcIiR7Zm9ybWF0VG9UaW1lWm9uZShcbiAgICAgICAgICAgICBuZXcgRGF0ZShkb2MuY3JlYXRlZEF0KSxcbiAgICAgICAgICAgICAnTU0vREQvWVlZWSBoaDptbTpzcycsXG4gICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHRpbWVab25lOiAnQW1lcmljYS9Mb3NfQW5nZWxlcydcbiAgICAgICAgICAgICB9XG4gICAgICAgICApfVwiXFxuYDtcbiAgICAgIH1cbiAgIH0pLnBpcGUocmVzKTtcbn07XG5cbi8qKlxuICogRG93bmxvYWQgUmVnaXN0cmF0aW9uIExvZ3NcbiAqIEBwYXJhbSByZXFcbiAqIEBwYXJhbSByZXNcbiAqIEBwYXJhbSBuZXh0XG4gKi9cbmV4cG9ydCBjb25zdCByZWdpc3RyYXRpb25Mb2dzID0gYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICBjb25zdCBldmVudElkID0gcmVxLnBhcmFtcy5ldmVudElkO1xuICAgcmVzLnNldEhlYWRlcignQ29udGVudC1kaXNwb3NpdGlvbicsIGBhdHRhY2htZW50OyBmaWxlbmFtZT1yZWdpc3RyYXRpb25Mb2dzXyR7ZXZlbnRJZH0uY3N2YCk7XG4gICByZXMud3JpdGVIZWFkKDIwMCwge1xuICAgICAgJ0NvbnRlbnQtVHlwZSc6ICd0ZXh0L2NzdidcbiAgIH0pO1xuICAgcmVzLndyaXRlKGBcIlBob25lTnVtYmVyXCIsXCJOdW1iZXJFeGlzdHNcIixcIkV2ZW50SWRcIixcIkV2ZW50TmFtZVwiLFwiQWxyZWFkeVJlZ2lzdGVyZWRGb3JFdmVudFwiLFwiRW1haWxcIixcIkZpcnN0TmFtZVwiLFwiTGFzdE5hbWVcIixcImNyZWF0ZWRBdFVuaXhcIixcImNyZWF0ZWRBdFwiXFxuYCk7XG4gICBSZWdpc3RyYXRpb25Mb2dNb2RlbC5maW5kKHtcbiAgICAgIEV2ZW50SWQ6IHJlcS5wYXJhbXMuZXZlbnRJZFxuICAgfSkuY3Vyc29yKHtcbiAgICAgIHRyYW5zZm9ybTogKGRvYzogUmVnaXN0cmF0aW9uTG9nRG9jdW1lbnQpID0+IHtcbiAgICAgICAgIHJldHVybiBgXCIke2RvYy5QaG9uZU51bWJlcn1cIixcIiR7ZG9jLk51bWJlckV4aXN0c31cIixcIiR7ZG9jLkV2ZW50SWR9XCIsXCIke2RvYy5FdmVudE5hbWV9XCIsXCIke2RvYy5BbHJlYWR5UmVnaXN0ZXJlZEZvckV2ZW50fVwiLFwiJHtkb2MuRW1haWx9XCIsXCIke2RvYy5GaXJzdE5hbWV9XCIsXCIke2RvYy5MYXN0TmFtZX1cIixcIiR7bmV3IERhdGUoZG9jLmNyZWF0ZWRBdCkuZ2V0VGltZSgpfVwiLFwiJHtmb3JtYXRUb1RpbWVab25lKFxuICAgICAgICAgICAgIG5ldyBEYXRlKGRvYy5jcmVhdGVkQXQpLFxuICAgICAgICAgICAgICdNTS9ERC9ZWVlZIGhoOm1tOnNzJyxcbiAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdGltZVpvbmU6ICdBbWVyaWNhL0xvc19BbmdlbGVzJ1xuICAgICAgICAgICAgIH1cbiAgICAgICAgICl9XCJcXG5gO1xuICAgICAgfVxuICAgfSkucGlwZShyZXMpO1xufTtcblxuLyoqXG4gKiBUaW1lIHNlcmllcyBvZiByZWdpc3RyYXRpb24gZG9uZSBmb3IgYSBldmVudCBhbmQgVm90aW5nIGZvciBjb250ZXN0YW50cyBwZXIgcm91bmRcbiAqIEBwYXJhbSByZXFcbiAqIEBwYXJhbSByZXNcbiAqIEBwYXJhbSBuZXh0XG4gKi9cbmV4cG9ydCBjb25zdCB2b3RlUmVnaXN0cmF0aW9uc1NlcmllcyA9IGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgY29uc3QgZXZlbnQgPSBhd2FpdCBFdmVudE1vZGVsLmZpbmRCeUlkKHJlcS5wYXJhbXMuZXZlbnRJZCkuc2VsZWN0KCdDb250ZXN0YW50cycpLnBvcHVsYXRlKCdDb250ZXN0YW50cycpO1xuICAgY29uc3QgY29udGVzdGFudHNDb3VudCA9IGV2ZW50ICYmIGV2ZW50LkNvbnRlc3RhbnRzLmxlbmd0aDtcblxuICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICBSZWdpc3RyYXRpb25Mb2dNb2RlbC5hZ2dyZWdhdGUoW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgJyRtYXRjaCc6IHtcbiAgICAgICAgICAgICAgICAgICdFdmVudElkJzogcmVxLnBhcmFtcy5ldmVudElkLFxuICAgICAgICAgICAgICAgICAgJ0FscmVhZHlSZWdpc3RlcmVkRm9yRXZlbnQnOiBmYWxzZVxuICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcblxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgJyRza2lwJzogY29udGVzdGFudHNDb3VudFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICckZ3JvdXAnOiB7XG4gICAgICAgICAgICAgICAgICAnX2lkJzoge1xuICAgICAgICAgICAgICAgICAgICAgJyRzdWJ0cmFjdCc6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgJyRzdWJ0cmFjdCc6IFsnJGNyZWF0ZWRBdCcsIG5ldyBEYXRlKDApXSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgJyRtb2QnOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ICckc3VidHJhY3QnOiBbJyRjcmVhdGVkQXQnLCBuZXcgRGF0ZSgwKV0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEwMDAgKiA2MFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICd0b3RhbCc6IHsgJyRzdW0nOiAxIH1cbiAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgJyRzb3J0JzogeyAnX2lkJzogMSB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgXSkuZXhlYygpLFxuICAgICAgICAgVm90aW5nTG9nTW9kZWwuYWdncmVnYXRlKFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICckbWF0Y2gnOiB7XG4gICAgICAgICAgICAgICAgICAnRXZlbnRJZCc6IHJlcS5wYXJhbXMuZXZlbnRJZCxcbiAgICAgICAgICAgICAgICAgICdTdGF0dXMnOiAnVk9URV9BQ0NFUFRFRCdcbiAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAnJGdyb3VwJzoge1xuICAgICAgICAgICAgICAgICAgJ19pZCc6IHtcbiAgICAgICAgICAgICAgICAgICAgICdFYXNlbE51bWJlcic6ICckRWFzZWxOdW1iZXInLFxuICAgICAgICAgICAgICAgICAgICAgJ1JvdW5kTnVtYmVyJzogJyRSb3VuZE51bWJlcicsXG4gICAgICAgICAgICAgICAgICAgICAndGltZSc6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICckc3VidHJhY3QnOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICB7ICckc3VidHJhY3QnOiBbJyRjcmVhdGVkQXQnLCBuZXcgRGF0ZSgwKV0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICckbW9kJzogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyAnJHN1YnRyYWN0JzogWyckY3JlYXRlZEF0JywgbmV3IERhdGUoMCldIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxMDAwICogNjBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAndG90YWwnOiB7ICckc3VtJzogJyRWb3RlRmFjdG9yJyB9XG4gICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICckc29ydCc6IHsgJ19pZC50aW1lJzogMSB9XG4gICAgICAgICAgICB9XG4gICAgICAgICBdKS5leGVjKClcbiAgICAgIF0pO1xuICAgICAgY29uc3QgcmVnaXN0cmF0aW9uRGF0YVNldCA9IHJlc3VsdHNbMF07XG4gICAgICBjb25zdCB2b3RpbmdEYXRhU2V0ID0gcmVzdWx0c1sxXTtcbiAgICAgIGNvbnN0IHNlcmllczogU2VyaWVzW10gPSBbXTtcbiAgICAgIGNvbnN0IHJlZ2lzdHJhdGlvblNlcmllcyA9IFtdO1xuICAgICAgbGV0IGN1bXVsYXRpdmVTdW0gPSAwO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZWdpc3RyYXRpb25EYXRhU2V0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICBjdW11bGF0aXZlU3VtID0gY3VtdWxhdGl2ZVN1bSArIHJlZ2lzdHJhdGlvbkRhdGFTZXRbaV0udG90YWw7XG4gICAgICAgICByZWdpc3RyYXRpb25TZXJpZXMucHVzaChbXG4gICAgICAgICAgICByZWdpc3RyYXRpb25EYXRhU2V0W2ldLl9pZCxcbiAgICAgICAgICAgIGN1bXVsYXRpdmVTdW0gLy8gc3VtIGN1bXVsYXRpdmUgcmVnaXN0cmF0aW9uc1xuICAgICAgICAgXSk7XG4gICAgICB9XG4gICAgICBzZXJpZXMucHVzaCh7XG4gICAgICAgICBuYW1lOiAnUmVnaXN0cmF0aW9uIFNlcmllcycsXG4gICAgICAgICBkYXRhOiByZWdpc3RyYXRpb25TZXJpZXMsXG4gICAgICAgICB0eXBlOiAnc3BsaW5lJ1xuICAgICAgfSk7XG4gICAgICBjb25zdCB2b3RpbmdTZXJpZXNNYXAgPSBbJ3JlZyddOyAvLyByZWcgZm9yIHJlZ2lzdHJhdGlvblxuICAgICAgY29uc3Qgdm90aW5nU2VyaWVzQ3VtdWxhdGl2ZVN1bSA9IFstMTBdOyAvLyAxMCBmb3IgcmVnaXN0cmF0aW9uXG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHZvdGluZ0RhdGFTZXQubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgIGNvbnN0IHVuaXF1ZVByb3AgPSBgVm90ZXMtUiR7dm90aW5nRGF0YVNldFtqXS5faWQuUm91bmROdW1iZXJ9RSR7dm90aW5nRGF0YVNldFtqXS5faWQuRWFzZWxOdW1iZXJ9YDtcbiAgICAgICAgIGxldCBpbmRleE9mU2VyaWVzID0gdm90aW5nU2VyaWVzTWFwLmluZGV4T2YodW5pcXVlUHJvcCk7XG4gICAgICAgICBpZiAoaW5kZXhPZlNlcmllcyA9PT0gLTEpIHtcbiAgICAgICAgICAgIGNvbnN0IGFyckxlbiA9IHZvdGluZ1Nlcmllc01hcC5wdXNoKHVuaXF1ZVByb3ApO1xuICAgICAgICAgICAgaW5kZXhPZlNlcmllcyA9IGFyckxlbiAtIDE7XG4gICAgICAgICAgICBzZXJpZXNbaW5kZXhPZlNlcmllc10gPSB7XG4gICAgICAgICAgICAgICBuYW1lOiBgJHt1bmlxdWVQcm9wfWAsXG4gICAgICAgICAgICAgICBkYXRhOiBbXSxcbiAgICAgICAgICAgICAgIHR5cGU6ICdzcGxpbmUnXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdm90aW5nU2VyaWVzQ3VtdWxhdGl2ZVN1bVtpbmRleE9mU2VyaWVzXSA9IDA7XG4gICAgICAgICB9XG4gICAgICAgICAvLyBjdW11bGF0aXZlIHN1bVxuICAgICAgICAgdm90aW5nU2VyaWVzQ3VtdWxhdGl2ZVN1bVtpbmRleE9mU2VyaWVzXSA9IHZvdGluZ1Nlcmllc0N1bXVsYXRpdmVTdW1baW5kZXhPZlNlcmllc10gKyB2b3RpbmdEYXRhU2V0W2pdLnRvdGFsO1xuICAgICAgICAgc2VyaWVzW2luZGV4T2ZTZXJpZXNdLmRhdGEucHVzaChbXG4gICAgICAgICAgICB2b3RpbmdEYXRhU2V0W2pdLl9pZC50aW1lLFxuICAgICAgICAgICAgTWF0aC5yb3VuZCh2b3RpbmdTZXJpZXNDdW11bGF0aXZlU3VtW2luZGV4T2ZTZXJpZXNdICogMTApIC8gMTBcbiAgICAgICAgIF0pO1xuICAgICAgfVxuICAgICAgcmVzLmpzb24oc2VyaWVzKTtcbiAgIH1cbiAgIGNhdGNoIChlKSB7XG4gICAgICBuZXh0KGUpO1xuICAgfVxufTtcblxuLyoqXG4gKiBUaW1lIHNlcmllcyBvZiB2b3RpbmcgZG9uZSBwZXIgcm91bmQuXG4gKiBAcGFyYW0gcmVxXG4gKiBAcGFyYW0gcmVzXG4gKiBAcGFyYW0gbmV4dFxuICovXG5leHBvcnQgY29uc3Qgdm90ZVJvdW5kU2VyaWVzID0gYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFZvdGluZ0xvZ01vZGVsLmFnZ3JlZ2F0ZShbXG4gICAgICAgICB7XG4gICAgICAgICAgICAnJG1hdGNoJzoge1xuICAgICAgICAgICAgICAgJ0V2ZW50SWQnOiByZXEucGFyYW1zLmV2ZW50SWQsXG4gICAgICAgICAgICAgICAnU3RhdHVzJzogJ1ZPVEVfQUNDRVBURUQnXG4gICAgICAgICAgICB9XG4gICAgICAgICB9LFxuICAgICAgICAge1xuICAgICAgICAgICAgJyRncm91cCc6IHtcbiAgICAgICAgICAgICAgICdfaWQnOiB7XG4gICAgICAgICAgICAgICAgICAnUm91bmROdW1iZXInOiAnJFJvdW5kTnVtYmVyJyxcbiAgICAgICAgICAgICAgICAgICd0aW1lJzoge1xuICAgICAgICAgICAgICAgICAgICAgJyRzdWJ0cmFjdCc6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgJyRzdWJ0cmFjdCc6IFsnJGNyZWF0ZWRBdCcsIG5ldyBEYXRlKDApXSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgJyRtb2QnOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ICckc3VidHJhY3QnOiBbJyRjcmVhdGVkQXQnLCBuZXcgRGF0ZSgwKV0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDEwMDAgKiA2MFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICd0b3RhbCc6IHsgJyRzdW0nOiAxIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICB9LFxuICAgICAgICAge1xuICAgICAgICAgICAgJyRzb3J0JzogeyAnX2lkLnRpbWUnOiAxIH1cbiAgICAgICAgIH1cbiAgICAgIF0pLmFsbG93RGlza1VzZSh0cnVlKTtcblxuICAgICAgY29uc3Qgdm90aW5nU2VyaWVzTWFwOiBTdHJpbmdbXSA9IFtdO1xuICAgICAgY29uc3Qgc2VyaWVzID0gW107XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlc3VsdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgIGNvbnN0IHVuaXF1ZVByb3AgPSBgUm91bmQke3Jlc3VsdHNbaV0uX2lkLlJvdW5kTnVtYmVyfWA7XG4gICAgICAgICBsZXQgaW5kZXhPZlNlcmllcyA9IHZvdGluZ1Nlcmllc01hcC5pbmRleE9mKHVuaXF1ZVByb3ApO1xuICAgICAgICAgaWYgKGluZGV4T2ZTZXJpZXMgPT09IC0xKSB7XG4gICAgICAgICAgICBpbmRleE9mU2VyaWVzID0gKHZvdGluZ1Nlcmllc01hcC5wdXNoKHVuaXF1ZVByb3ApKSAtIDE7XG4gICAgICAgICAgICBzZXJpZXNbaW5kZXhPZlNlcmllc10gPSB7XG4gICAgICAgICAgICAgICBuYW1lOiBgJHt1bmlxdWVQcm9wfWAsXG4gICAgICAgICAgICAgICBkYXRhOiBbXSxcbiAgICAgICAgICAgICAgIHR5cGU6ICdzcGxpbmUnXG4gICAgICAgICAgICB9O1xuICAgICAgICAgfVxuICAgICAgICAgc2VyaWVzW2luZGV4T2ZTZXJpZXNdLmRhdGEucHVzaChbXG4gICAgICAgICAgICByZXN1bHRzW2ldLl9pZC50aW1lLFxuICAgICAgICAgICAgcmVzdWx0c1tpXS50b3RhbFxuICAgICAgICAgXSk7XG4gICAgICB9XG5cbiAgICAgIHJlcy5qc29uKHNlcmllcyk7XG4gICB9XG4gICBjYXRjaCAoZSkge1xuICAgICAgbmV4dChlKTtcbiAgIH1cbn07XG5cbmV4cG9ydCBjb25zdCB2b3RlTGluayA9IGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgdHJ5IHtcbiAgICAgIGNvbnN0IHZvdGVIYXNoID0gcmVxLnBhcmFtcy52b3RlSGFzaDtcbiAgICAgIGNvbnN0IGV2ZW50RG9jID0gYXdhaXQgRXZlbnRNb2RlbC5maW5kT25lKHtcbiAgICAgICAgICdSZWdpc3RyYXRpb25zVm90ZUZhY3Rvci5Wb3RlVXJsJzogYC92LyR7dm90ZUhhc2h9YCxcbiAgICAgIH0pXG4gICAgICAgICAgLnNlbGVjdChbJ05hbWUnLCAnRGVzY3JpcHRpb24nLCAnX2lkJywgJ1ZvdGVCeUxpbmsnLCAnUm91bmRzJywgJ0N1cnJlbnRSb3VuZCcsICdSZWdpc3RyYXRpb25zVm90ZUZhY3RvcicsICdDb250ZXN0YW50cycsICdJbWFnZXMnLCAnRW5hYmxlQXVjdGlvbicsICdFSUQnLCAnQWRtaW5Db250cm9sSW5BdWN0aW9uUGFnZSddKVxuICAgICAgICAgIC5wb3B1bGF0ZSgnUm91bmRzLkNvbnRlc3RhbnRzLkRldGFpbCcpXG4gICAgICAgICAgLnBvcHVsYXRlKCdDb3VudHJ5Jyk7XG4gICAgICBpZiAoIWV2ZW50RG9jKSB7XG4gICAgICAgICByZXR1cm4gbmV4dChuZXcgRXJyb3IoJ0ludmFsaWQgbGluaycpKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IG9wZW5BdWN0aW9uQ291bnQgPSBhd2FpdCBMb3RNb2RlbC5jb3VudERvY3VtZW50cyh7XG4gICAgICAgICAnRXZlbnQnOiBldmVudERvYy5faWQsXG4gICAgICAgICAnU3RhdHVzJzogMVxuICAgICAgfSk7XG4gICAgICBjb25zdCB1c2VyQWdlbnRIZWFkZXIgPSByZXEuaGVhZGVyKCd1c2VyLWFnZW50Jyk7XG4gICAgICBjb25zdCBpc0lvcyA9IHVzZXJBZ2VudEhlYWRlci5pbmRleE9mKCdCYXR0bGUnKSA+IC0xO1xuICAgICAgY29uc3QgaXNBbmRyb2lkID0gdXNlckFnZW50SGVhZGVyLmluZGV4T2YoJ29raHR0cCcpID4gLTE7XG4gICAgICBjb25zdCBpc1dlYiA9ICEoIGlzQW5kcm9pZCB8fCBpc0lvcyk7XG5cbiAgICAgIGNvbnN0IHRvdGFsUm91bmRzID0gZXZlbnREb2MuUm91bmRzLmxlbmd0aDtcbiAgICAgIGNvbnN0IGN1cnJlbnRSb3VuZCA9IGV2ZW50RG9jLkN1cnJlbnRSb3VuZDtcbiAgICAgIGxldCBjdXJyZW50Um91bmROdW1iZXIgPSBjdXJyZW50Um91bmQgJiYgY3VycmVudFJvdW5kLlJvdW5kTnVtYmVyO1xuICAgICAgbGV0IGN1cnJlbnRSb3VuZEluZGV4OiBudW1iZXI7XG4gICAgICBjb25zdCByb3VuZFdpc2VJbWFnZXMgPSBbXTtcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdG90YWxSb3VuZHM7IGorKykge1xuICAgICAgICAgY29uc3QgYXJ0aXN0c0luUm91bmQgPSBldmVudERvYy5Sb3VuZHNbal0uQ29udGVzdGFudHM7XG4gICAgICAgICBjb25zdCBhcnRpc3RzSW1hZ2VzID0gYXJ0aXN0V2lzZUltYWdlcyhhcnRpc3RzSW5Sb3VuZCk7XG4gICAgICAgICBjb25zdCByZXNwb25zZTogUm91bmRBcnRpc3RzSW50ZXJmYWNlID0ge1xuICAgICAgICAgICAgRXZlbnRJZDogZXZlbnREb2MuaWQsXG4gICAgICAgICAgICBFSUQ6IGV2ZW50RG9jLkVJRCxcbiAgICAgICAgICAgIFJvdW5kTnVtYmVyOiBldmVudERvYy5Sb3VuZHNbal0uUm91bmROdW1iZXIsXG4gICAgICAgICAgICBBcnRpc3RzOiBhcnRpc3RzSW1hZ2VzLmFydGlzdHMsXG4gICAgICAgICAgICBJc0N1cnJlbnRSb3VuZDogY3VycmVudFJvdW5kTnVtYmVyID09PSBldmVudERvYy5Sb3VuZHNbal0uUm91bmROdW1iZXIsXG4gICAgICAgICAgICBIYXNPcGVuUm91bmQ6ICFldmVudERvYy5Sb3VuZHNbal0uSXNGaW5pc2hlZCxcbiAgICAgICAgICAgIEhhc0ltYWdlczogYXJ0aXN0c0ltYWdlcy5oYXNJbWFnZXMsXG4gICAgICAgICAgICBFbmFibGVBdWN0aW9uOiBldmVudERvYy5FbmFibGVBdWN0aW9uXG4gICAgICAgICB9O1xuICAgICAgICAgcm91bmRXaXNlSW1hZ2VzLnB1c2gocmVzcG9uc2UpO1xuICAgICAgICAgaWYgKGV2ZW50RG9jLlJvdW5kc1tqXS5Sb3VuZE51bWJlciA9PT0gY3VycmVudFJvdW5kTnVtYmVyKSB7XG4gICAgICAgICAgICBjdXJyZW50Um91bmRJbmRleCA9IGo7XG4gICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCByZWdpc3RyYXRpb25PYmogPSBldmVudERvYy5SZWdpc3RyYXRpb25zVm90ZUZhY3Rvci5maW5kKChyZWc6IGFueSkgPT4ge1xuICAgICAgICAgcmV0dXJuIHJlZy5Wb3RlVXJsID09PSBgL3YvJHt2b3RlSGFzaH1gO1xuICAgICAgfSk7XG4gICAgICAvKmNvbnN0IHRva2VuID0gc2lnbih7XG4gICAgICAgICByZWdpc3RyYXRpb25JZDogcmVnaXN0cmF0aW9uT2JqLlJlZ2lzdHJhdGlvbklkXG4gICAgICB9LCBwcm9jZXNzLmVudi5KV1RfU0VDUkVULCAgeyBleHBpcmVzSW46IHByb2Nlc3MuZW52LkpXVF9FWFBfVElNRSB8fCAnMXknfSk7XG4gICAgICByZXMuY29va2llKCdqd3QnLCB0b2tlbiwge1xuICAgICAgICAgaHR0cE9ubHk6IHRydWUsXG4gICAgICAgICBzYW1lU2l0ZTogdHJ1ZSxcbiAgICAgICAgIHNpZ25lZDogdHJ1ZSxcbiAgICAgICAgIHNlY3VyZTogdHJ1ZVxuICAgICAgfSk7Ki9cbiAgICAgIGNvbnN0IHZvdGVzQ291bnQgPSBhd2FpdCBWb3RpbmdMb2dNb2RlbC5jb3VudERvY3VtZW50cyh7XG4gICAgICAgICAnUGhvbmVIYXNoJzogcmVnaXN0cmF0aW9uT2JqLkhhc2gsXG4gICAgICAgICAnU3RhdHVzJzogJ1ZPVEVfQUNDRVBURUQnXG4gICAgICB9KTtcbiAgICAgIGlmICghY3VycmVudFJvdW5kTnVtYmVyKSB7XG4gICAgICAgICBjdXJyZW50Um91bmROdW1iZXIgPSAwO1xuICAgICAgfVxuICAgICAgcmVzLnJlbmRlcigndm90ZV9saW5rJywge1xuICAgICAgICAgdGl0bGU6IGV2ZW50RG9jLk5hbWUsXG4gICAgICAgICBWb3Rlckhhc2g6IHJlZ2lzdHJhdGlvbk9iai5IYXNoLFxuICAgICAgICAgdm90ZUhhc2g6IHZvdGVIYXNoLFxuICAgICAgICAgRGVzY3JpcHRpb246IGV2ZW50RG9jLkRlc2NyaXB0aW9uLFxuICAgICAgICAgY291bnRyeUZsYWc6IGV2ZW50RG9jLkNvdW50cnkgJiYgZXZlbnREb2MuQ291bnRyeS5jb3VudHJ5X2ltYWdlLFxuICAgICAgICAgdm90ZXNDb3VudDogdm90ZXNDb3VudCxcbiAgICAgICAgIHZvdGVGYWN0b3I6IHJlZ2lzdHJhdGlvbk9iai5Wb3RlRmFjdG9yLFxuICAgICAgICAgcm91bmRXaXNlSW1hZ2VzOiByb3VuZFdpc2VJbWFnZXMsXG4gICAgICAgICBDdXJyZW50Um91bmROdW1iZXI6IGN1cnJlbnRSb3VuZE51bWJlcixcbiAgICAgICAgIHVzZXJTdGF0dXM6IHJlZ2lzdHJhdGlvbk9iai5TdGF0dXMsXG4gICAgICAgICBvcGVuQXVjdGlvbkNvdW50OiBvcGVuQXVjdGlvbkNvdW50LFxuICAgICAgICAgRUlEOiBldmVudERvYy5FSURcbiAgICAgIH0pO1xuICAgfVxuICAgY2F0Y2ggKGUpIHtcbiAgICAgIG5leHQoZSk7XG4gICB9XG59O1xuXG5leHBvcnQgY29uc3QgaGFuZGxlVm90ZUZvcm0gPSBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgIHRyeSB7XG4gICAgICBjb25zdCByb3VuZE51bWJlciA9IHJlcS5wYXJhbXMuUm91bmROdW1iZXI7XG4gICAgICBjb25zdCBsb2cgPSBuZXcgVm90aW5nTG9nTW9kZWwoKTtcbiAgICAgIGNvbnN0IHZvdGUgPSByZXEucGFyYW1zLnRleHQ7XG4gICAgICBjb25zdCBoYXNoID0gcmVxLnBhcmFtcy51cmxIYXNoO1xuICAgICAgY29uc3QgZXZlbnQgPSBhd2FpdCBnZXRFdmVudEZvckZvcm0ocmVzLCBoYXNoLCBuZXh0LCBsb2cpO1xuICAgICAgbGV0IGZyb20gPSAnJztcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXZlbnQuUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3IubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgIGlmIChldmVudC5SZWdpc3RyYXRpb25zVm90ZUZhY3RvcltpXS5Wb3RlVXJsID09PSBgL3YvJHtoYXNofWApIHtcbiAgICAgICAgICAgIGZyb20gPSBldmVudC5SZWdpc3RyYXRpb25zVm90ZUZhY3RvcltpXS5QaG9uZU51bWJlciB8fCBldmVudC5SZWdpc3RyYXRpb25zVm90ZUZhY3RvcltpXS5FbWFpbDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgfVxuICAgICAgfSAvLyBmcm9tIGNoZWNrIGlzIGluIHByb2Nlc3NWb3RlXG5cbiAgICAgIGlmIChldmVudCAmJiAhZXZlbnQuVm90ZUJ5TGluaykge1xuICAgICAgICAgLy8gdm90aW5nIGJ5IGxpbmsgZGlzYWJsZWRcbiAgICAgICAgIHNlbmRSZXNwb25zZSgnanNvbicsIHJlcywgJ1ZPVElOR19XRUJfRElTQUJMRUQnKTtcbiAgICAgIH1cbiAgICAgIGlmIChmcm9tKSB7XG4gICAgICAgICByZXR1cm4gYXdhaXQgcHJvY2Vzc1ZvdGUoJ2pzb24nLCB2b3RlLCBmcm9tLCBldmVudCwgcmVzLCBsb2csIHJvdW5kTnVtYmVyLCAwLCAnb25saW5lJyk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgIG5leHQoe1xuICAgICAgICAgICAgbWVzc2FnZTogJ1NvbWV0aGluZyB3ZW50IHdyb25nJyxcbiAgICAgICAgICAgIHN0YXR1czogNTAwXG4gICAgICAgICB9KTtcbiAgICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5leHQoZSk7XG4gICB9XG59O1xuXG4vKipcbiAqIEJhciBjaGFydCB0aGF0IHNob3dzIHZvdGUgc291cmNlICh3ZWItbmV3IGV4cC1zbXMgZXRjKSBwZXIgcm91bmQuXG4gKiBAcGFyYW0gcmVxXG4gKiBAcGFyYW0gcmVzXG4gKiBAcGFyYW0gbmV4dFxuICovXG5leHBvcnQgY29uc3Qgdm90ZUJhckdyYXBoID0gYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgIFZvdGluZ0xvZ01vZGVsLmFnZ3JlZ2F0ZShbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAnJG1hdGNoJzoge1xuICAgICAgICAgICAgICAgICAgJ0V2ZW50SWQnOiByZXEucGFyYW1zLmV2ZW50SWQsXG4gICAgICAgICAgICAgICAgICAnU3RhdHVzJzogJ1ZPVEVfQUNDRVBURUQnLFxuICAgICAgICAgICAgICAgICAgJ1ZvdGVGYWN0b3InOiB7XG4gICAgICAgICAgICAgICAgICAgICAnJGx0ZSc6IDFcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAnJGdyb3VwJzoge1xuICAgICAgICAgICAgICAgICAgJ19pZCc6IHtcbiAgICAgICAgICAgICAgICAgICAgICdSb3VuZE51bWJlcic6ICckUm91bmROdW1iZXInXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgJ3RvdGFsJzogeyAnJHN1bSc6IDEgfSxcbiAgICAgICAgICAgICAgICAgICd0b3RhbFZvdGVGYWN0b3InOiB7ICckc3VtJzogJyRWb3RlRmFjdG9yJyB9XG4gICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICckc29ydCc6IHtcbiAgICAgICAgICAgICAgICAgICdfaWQuUm91bmROdW1iZXInOiAxLFxuICAgICAgICAgICAgICAgICAgJ19pZC5Wb3RlQ2hhbm5lbC5DaGFubmVsJzogMVxuICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgIF0pLFxuICAgICAgICAgVm90aW5nTG9nTW9kZWwuYWdncmVnYXRlKFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICckbWF0Y2gnOiB7XG4gICAgICAgICAgICAgICAgICAnRXZlbnRJZCc6IHJlcS5wYXJhbXMuZXZlbnRJZCxcbiAgICAgICAgICAgICAgICAgICdTdGF0dXMnOiAnVk9URV9BQ0NFUFRFRCcsXG4gICAgICAgICAgICAgICAgICAnVm90ZUZhY3Rvcic6IHtcbiAgICAgICAgICAgICAgICAgICAgICckZ3QnOiAxXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgJyRncm91cCc6IHtcbiAgICAgICAgICAgICAgICAgICdfaWQnOiB7XG4gICAgICAgICAgICAgICAgICAgICAnUm91bmROdW1iZXInOiAnJFJvdW5kTnVtYmVyJ1xuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICd0b3RhbCc6IHsgJyRzdW0nOiAxIH0sXG4gICAgICAgICAgICAgICAgICAndG90YWxWb3RlRmFjdG9yJzogeyAnJHN1bSc6ICckVm90ZUZhY3RvcicgfVxuICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAnJHNvcnQnOiB7XG4gICAgICAgICAgICAgICAgICAnX2lkLlJvdW5kTnVtYmVyJzogMSxcbiAgICAgICAgICAgICAgICAgICdfaWQuVm90ZUNoYW5uZWwuQ2hhbm5lbCc6IDFcbiAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9XG4gICAgICAgICBdKS5leGVjKClcbiAgICAgIF0pO1xuXG4gICAgICBjb25zdCBzZXJpZXM6IHtcbiAgICAgICAgIG5hbWU6IHN0cmluZyxcbiAgICAgICAgIGRhdGE6IG51bWJlcltdLFxuICAgICAgICAgY29sb3I6IHN0cmluZ1xuICAgICAgfVtdID0gW107XG4gICAgICBjb25zdCBwcm9wTWFwID0gW1xuICAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ05ldycsXG4gICAgICAgICAgICBjb2xvcjogJyNERkYxRkYnXG4gICAgICAgICB9LFxuICAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ1JldHVybiBHdWVzdHMnLFxuICAgICAgICAgICAgY29sb3I6ICcjNDg2ODk1J1xuICAgICAgICAgfVxuICAgICAgXTtcblxuICAgICAgY29uc3Qgcm91bmRzOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgICBjb25zdCByb3VuZFdpc2VFeHAgPSBbXTtcbiAgICAgIGNvbnN0IHJvdW5kV2lzZUV4cERpZmYgPSBbXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVzdWx0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgc2VyaWVzW2ldID0ge1xuICAgICAgICAgICAgbmFtZTogYCR7cHJvcE1hcFtpXS50eXBlfWAsXG4gICAgICAgICAgICBkYXRhOiBbXSxcbiAgICAgICAgICAgIGNvbG9yOiBwcm9wTWFwW2ldLmNvbG9yXG4gICAgICAgICB9O1xuICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCByZXN1bHRzW2ldLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAvLyBleHBlcmllbmNlZCBhbmQgbmV3XG4gICAgICAgICAgICBsZXQgcm91bmRJbmRleCA9IHJvdW5kcy5pbmRleE9mKGBSb3VuZCAke3Jlc3VsdHNbaV1bal0uX2lkLlJvdW5kTnVtYmVyfWApO1xuICAgICAgICAgICAgaWYgKHJvdW5kSW5kZXggPT09IC0xKSB7XG4gICAgICAgICAgICAgICByb3VuZEluZGV4ID0gKHJvdW5kcy5wdXNoKGBSb3VuZCAke3Jlc3VsdHNbaV1bal0uX2lkLlJvdW5kTnVtYmVyfWApKSAtIDE7XG4gICAgICAgICAgICAgICByb3VuZFdpc2VFeHBbcm91bmRJbmRleF0gPSB7XG4gICAgICAgICAgICAgICAgICB0b3RhbFZvdGVzOiAwLFxuICAgICAgICAgICAgICAgICAgdG90YWxWb3RlRmFjdG9yOiAwLFxuICAgICAgICAgICAgICAgICAgZGlmZjogMFxuICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNlcmllc1tpXS5kYXRhW3JvdW5kSW5kZXhdID0gcmVzdWx0c1tpXVtqXS50b3RhbDtcblxuICAgICAgICAgICAgcm91bmRXaXNlRXhwW3JvdW5kSW5kZXhdLnRvdGFsVm90ZXMgPSByb3VuZFdpc2VFeHBbcm91bmRJbmRleF0udG90YWxWb3RlcyArIHJlc3VsdHNbaV1bal0udG90YWw7XG4gICAgICAgICAgICByb3VuZFdpc2VFeHBbcm91bmRJbmRleF0udG90YWxWb3RlRmFjdG9yID0gcm91bmRXaXNlRXhwW3JvdW5kSW5kZXhdLnRvdGFsVm90ZUZhY3RvciArIHJlc3VsdHNbaV1bal0udG90YWxWb3RlRmFjdG9yO1xuICAgICAgICAgICAgcm91bmRXaXNlRXhwRGlmZltyb3VuZEluZGV4XSA9IE1hdGgucm91bmQoKHJvdW5kV2lzZUV4cFtyb3VuZEluZGV4XS50b3RhbFZvdGVGYWN0b3IgLSByb3VuZFdpc2VFeHBbcm91bmRJbmRleF0udG90YWxWb3RlcykgKiAxMCkgLyAxMDtcbiAgICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHNlcmllcy5wdXNoKHtcbiAgICAgICAgIG5hbWU6ICdleHAgdmFsdWUnLFxuICAgICAgICAgZGF0YTogcm91bmRXaXNlRXhwRGlmZixcbiAgICAgICAgIGNvbG9yOiAnI0RCQTExQydcbiAgICAgIH0pO1xuXG5cbiAgICAgIHJlcy5qc29uKHtcbiAgICAgICAgIHNlcmllczogc2VyaWVzLnJldmVyc2UoKSxcbiAgICAgICAgIGNhdGVnb3JpZXM6IHJvdW5kc1xuICAgICAgfSk7XG4gICB9XG4gICBjYXRjaCAoZSkge1xuICAgICAgbmV4dChlKTtcbiAgIH1cbn07XG5cbmV4cG9ydCBjb25zdCBldmVudExpc3RIdG1sID0gYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICB0cnkge1xuICAgICAgY29uc3QgYXV0aEhlYWRlciA9IHJlcS5oZWFkZXIoJ0F1dGhvcml6YXRpb24nKTtcbiAgICAgIGxldCB0b2tlbiA9IGF1dGhIZWFkZXIgJiYgYXV0aEhlYWRlci5yZXBsYWNlKCdCZWFyZXIgJywgJycpO1xuICAgICAgbGV0IHNlbGVjdGVkRXZlbnQ6IEV2ZW50RFRPO1xuICAgICAgbGV0IHVzZXJTdGF0dXM6IHN0cmluZyA9ICcnO1xuICAgICAgbGV0IHBob25lSGFzaDogc3RyaW5nID0gJyc7XG4gICAgICBjb25zdCB2b3RlSGFzaCA9IHJlcS5wYXJhbXMudm90ZUhhc2g7XG4gICAgICBpZiAodm90ZUhhc2gpIHtcbiAgICAgICAgIHNlbGVjdGVkRXZlbnQgPSBhd2FpdCBFdmVudE1vZGVsLmZpbmRPbmUoe1xuICAgICAgICAgICAgJ1JlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yLlZvdGVVcmwnOiBgL3YvJHt2b3RlSGFzaH1gLFxuICAgICAgICAgfSkuc2VsZWN0KFsnX2lkJywgJ1JlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yJ10pO1xuICAgICAgICAgaWYgKCFzZWxlY3RlZEV2ZW50KSB7XG4gICAgICAgICAgICByZXR1cm4gbmV4dCgnSW52YWxpZCBsaW5rJyk7XG4gICAgICAgICB9XG4gICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNlbGVjdGVkRXZlbnQuUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3IubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHZvdGVGYWN0b3IgPSBzZWxlY3RlZEV2ZW50LlJlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yW2ldO1xuICAgICAgICAgICAgaWYgKHZvdGVGYWN0b3IuVm90ZVVybCA9PT0gYC92LyR7dm90ZUhhc2h9YCkge1xuICAgICAgICAgICAgICAgY29uc3QgcmVnSWQgPSB2b3RlRmFjdG9yLlJlZ2lzdHJhdGlvbklkO1xuICAgICAgICAgICAgICAgdXNlclN0YXR1cyA9IHZvdGVGYWN0b3IuU3RhdHVzO1xuICAgICAgICAgICAgICAgcmVxLnVzZXIgPSBhd2FpdCBSZWdpc3RyYXRpb25Nb2RlbC5maW5kQnlJZChyZWdJZCk7XG4gICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgIH1cbiAgICAgICAgIGlmIChyZXEudXNlcikge1xuICAgICAgICAgICAgdG9rZW4gPSBzaWduKHtcbiAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbklkOiByZXEudXNlci5faWRcbiAgICAgICAgICAgIH0sIHByb2Nlc3MuZW52LkpXVF9TRUNSRVQsIHsgZXhwaXJlc0luOiBwcm9jZXNzLmVudi5KV1RfRVhQX1RJTUUgfHwgJzF5JyB9KTtcbiAgICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChyZXEudXNlcikge1xuICAgICAgICAgLy8gc2V0IGNvb2tpZSBvbmx5IGZvciB0aG9zZSB3aG8gb3BlbmVkIGluIGJyb3dzZXIuXG4gICAgICAgICAvLyBkdXAgdG9rZW4gY2FsY3VsYXRpb24gYmVjYXVzZSB3ZSBhcmUgdGFyZ2V0aW5nIGNvb2tpZSBiYXNlZCByZXEudXNlciBoZXJlXG4gICAgICAgICB0b2tlbiA9IHNpZ24oe1xuICAgICAgICAgICAgcmVnaXN0cmF0aW9uSWQ6IHJlcS51c2VyLl9pZFxuICAgICAgICAgfSwgcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVCwgeyBleHBpcmVzSW46IHByb2Nlc3MuZW52LkpXVF9FWFBfVElNRSB8fCAnMXknIH0pO1xuICAgICAgICAgcmVzLmNvb2tpZSgnand0JywgdG9rZW4sIHtcbiAgICAgICAgICAgIGh0dHBPbmx5OiB0cnVlLFxuICAgICAgICAgICAgc2FtZVNpdGU6IHRydWUsXG4gICAgICAgICAgICBzaWduZWQ6IHRydWUsXG4gICAgICAgICAgICBzZWN1cmU6IHRydWUsXG4gICAgICAgICAgICBkb21haW46ICdhcnRiYXR0bGUuY29tJ1xuICAgICAgICAgfSk7XG4gICAgICAgICBwaG9uZUhhc2ggPSByZXEudXNlci5IYXNoO1xuICAgICAgfVxuICAgICAgcmVzLnJlbmRlcignZXZlbnRMaXN0Jywge1xuICAgICAgICAgdG9rZW46IHRva2VuLFxuICAgICAgICAgZXZlbnRJZDogcmVxLnBhcmFtcy5ldmVudElkIHx8IHNlbGVjdGVkRXZlbnQgJiYgc2VsZWN0ZWRFdmVudC5faWQsXG4gICAgICAgICB1c2VyU3RhdHVzOiB1c2VyU3RhdHVzLFxuICAgICAgICAgVm90ZXJIYXNoOiB2b3RlSGFzaCxcbiAgICAgICAgIE1lc3NhZ2U6IHJlcS51c2VyICYmIHJlcS51c2VyLklzQXJ0aXN0ID8ge1xuICAgICAgICAgICAgVGl0bGU6IGBCRVNUIEFSVCBXSU5TYCxcbiAgICAgICAgICAgIEJvZHk6IGBIaSAke3JlcS51c2VyLkZpcnN0TmFtZSB8fCByZXEudXNlci5OaWNrTmFtZSB8fCByZXEudXNlci5EaXNwbGF5UGhvbmV9ISwgdGhhbmsgeW91IGZvciByZWdpc3RlcmluZyB0byBwYWludCB3aXRoIEFydCBCYXR0bGUuIFdlIHZhbHVlIHlvdSBwYXJ0aWNpcGF0aW9uLFxuICAgICAgICAgYW5kIGVzcGVjaWFsbHkgaW4gdm90aW5nLiBBcyBhIHJlZ2lzdGVyZWQgYXJ0aXN0LCB5b3VyIHZvdGUgbWVhbnMgbW9yZSAtIGFuZCBpcyBsaXRlcmFsbHkgd29ydGggbW9yZSAtIHdoZW4geW91IHZvdGUgb25saW5lIG9yIGluIHBlcnNvbiBhdCBBcnQgQmF0dGxlXG4gICAgICAgICBldmVudHMuIFNvIHZvdGUgZm9yIHRoZSBiZXN0LCBoZWxwIHVzIG1ha2Ugc3VyZSB0aGF0IHRoZSBiZXN0IGFydCB3aW5zIWBcbiAgICAgICAgIH0gOiB7fSxcbiAgICAgICAgIHBob25lSGFzaDogcGhvbmVIYXNoLFxuICAgICAgICAgc2l0ZV91cmw6IHByb2Nlc3MuZW52LkFETUlOX1VSTCxcbiAgICAgICAgIHRpdGxlOiBgQkVTVCBBUlQgV0lOU2AsXG4gICAgICB9KTtcbiAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIG5leHQoZSk7XG4gICB9XG59O1xuXG5leHBvcnQgY29uc3QgZXZlbnRMaXN0ID0gYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICBjb25zdCBQaG9uZU51bWJlciA9IGZhbHNlO1xuICAgLy8gY29uc3QgSWFuYVRpbWV6b25lID0gcmVxLnBhcmFtcy5UaW1lem9uZTtcbiAgIC8qaWYgKHJlcS5oYXNPd25Qcm9wZXJ0eSgncmVnaXN0cmF0aW9uJykgJiYgcmVxLnJlZ2lzdHJhdGlvbi5QaG9uZU51bWJlcikge1xuICAgICAgIFBob25lTnVtYmVyID0gcmVxLnJlZ2lzdHJhdGlvbi5QaG9uZU51bWJlcjtcbiAgIH0qL1xuICAgY29uc3QgZXZlbnRJZCA9IHJlcS5xdWVyeS5ldmVudElkO1xuICAgY29uc3QgY2FjaGVHZXQgPSByZXEuYXBwLmdldCgnY2FjaGVHZXQnKTtcbiAgIGNvbnN0IGNhY2hlU2V0ID0gcmVxLmFwcC5nZXQoJ2NhY2hlU2V0Jyk7XG4gICBjb25zdCBjYWNoZUtleSA9IGBhcHAtZXZlbnQtbGlzdC0ke2V2ZW50SWQgfHwgJyd9YDtcbiAgIGxldCBhY3RpdmVFdmVudHM7XG4gICBjb25zdCBhY3RpdmVFdmVudHNKc29uID0gYXdhaXQgY2FjaGVHZXQoY2FjaGVLZXkpO1xuICAgaWYgKGFjdGl2ZUV2ZW50c0pzb24pIHtcbiAgICAgIGxvZ2dlci5pbmZvKGBzZXJ2aW5nIGV2ZW50IGxpc3QgZnJvbSBjYWNoZSAke2NhY2hlS2V5fWApO1xuICAgICAgcmVzLmpzb24oSlNPTi5wYXJzZShhY3RpdmVFdmVudHNKc29uKSk7XG4gICAgICByZXR1cm4gO1xuICAgfVxuICAgY29uc3QgcXVlcnk6IHtcbiAgICAgIFNob3dJbkFwcD86IGJvb2xlYW47XG4gICAgICBfaWQ/OiBhbnk7XG4gICB9ID0ge307XG4gICBpZiAoZXZlbnRJZCAmJiBldmVudElkLmxlbmd0aCA+IDApIHtcbiAgICAgIHF1ZXJ5Ll9pZCA9IGV2ZW50SWQ7XG4gICB9IGVsc2Uge1xuICAgICAgcXVlcnkuU2hvd0luQXBwID0gdHJ1ZTtcbiAgIH1cbiAgIGNvbnN0IHByb21pc2VzOiBhbnlbXSA9IFtdO1xuICAgY29uc3QgcHJvbWlzZTEgPSBFdmVudE1vZGVsLmZpbmQocXVlcnkpLnNlbGVjdChbXG4gICAgICAnX2lkJyxcbiAgICAgICdFSUQnLFxuICAgICAgJ05hbWUnLFxuICAgICAgJ0N1cnJlbnRSb3VuZCcsXG4gICAgICAnQ291bnRyeScsXG4gICAgICAnUm91bmRzJyxcbiAgICAgICdFdmVudFN0YXJ0RGF0ZVRpbWUnLFxuICAgICAgJ0V2ZW50RW5kRGF0ZVRpbWUnLFxuICAgICAgJ0xpdmVTdHJlYW0nLFxuICAgICAgJ1ZpZGVvU3RyZWFtJyxcbiAgICAgICdUaWNrZXRMaW5rJyxcbiAgICAgICdWZW51ZScsXG4gICAgICAnUHJpY2UnLFxuICAgICAgJ0Rlc2NyaXB0aW9uJyxcbiAgICAgICdFdmVudEVuZERhdGVUaW1lJyxcbiAgICAgICdUaW1lWm9uZUlDQU5OJyxcbiAgICAgICdTcG9uc29yTG9nbycsXG4gICAgICAnU3BvbnNvclRleHQnLFxuICAgICAgJ0VuYWJsZUF1Y3Rpb24nXG4gICBdKVxuICAgICAgIC5wb3B1bGF0ZSgnQ291bnRyeScpXG4gICAgICAgLy8gLnBvcHVsYXRlKCdSb3VuZHMuQ29udGVzdGFudHMuVm90ZXMnKVxuICAgICAgIC5wb3B1bGF0ZSgnUm91bmRzLkNvbnRlc3RhbnRzLkRldGFpbCcpXG4gICAgICAgLnBvcHVsYXRlKCdTcG9uc29yTG9nbycpXG4gICAgICAgLnNvcnQoe1xuICAgICAgICAgICdFdmVudFN0YXJ0RGF0ZVRpbWUnOiAtMVxuICAgICAgIH0pO1xuXG4gICBwcm9taXNlcy5wdXNoKHByb21pc2UxKTtcbiAgIC8vIHBhc3QgZXZlbnQgbGlzdFxuICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcblxuICAgYWN0aXZlRXZlbnRzID0gcmVzdWx0c1swXTtcblxuXG4gICBjb25zdCBhY3RpdmVFdmVudHNMaXN0OiBFdmVudHNJbnRlcmZhY2VbXSA9IFtdO1xuICAgY29uc3QgZXZlbnRJZHMgPSBbXTtcbiAgIGNvbnN0IGV2ZW50U3RySWRzID0gW107XG4gICBsZXQgdG9wUGxheWVyVXJsOiBzdHJpbmc7XG4gICBmb3IgKGxldCBpID0gMDsgaSA8IGFjdGl2ZUV2ZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgZXZlbnQgPSBhY3RpdmVFdmVudHNbaV07XG4gICAgICBjb25zdCBjdXJyZW50Um91bmQgPSBldmVudC5DdXJyZW50Um91bmQ7XG4gICAgICBjb25zdCBjdXJyZW50Um91bmROdW1iZXIgPSBjdXJyZW50Um91bmQgJiYgY3VycmVudFJvdW5kLlJvdW5kTnVtYmVyO1xuICAgICAgbGV0IHdpbm5lckltYWdlOiBBcnRpc3RJbWFnZUR0bztcbiAgICAgIGxldCB3aW5uZXJOYW1lOiBzdHJpbmc7XG4gICAgICBsZXQgd2lubmVySWQ6IHN0cmluZztcbiAgICAgIGxldCBudW1Wb3RlcyA9IDA7XG4gICAgICBsZXQgcm91bmRUZXh0ID0gJyc7XG4gICAgICBsZXQgcm91bmRDb2xvciA9ICcnO1xuICAgICAgbGV0IHN0YXR1c1RleHRDb2xvciA9ICcjRkZGJztcbiAgICAgIGNvbnN0IHRvdGFsUm91bmRzID0gZXZlbnQuUm91bmRzLmxlbmd0aDtcbiAgICAgIGxldCBoYXNPcGVuUm91bmQgPSBmYWxzZTtcbiAgICAgIGNvbnN0IGZpbmFsUm91bmRDb250ZXN0YW50TWFwID0gW107XG4gICAgICBjb25zdCBtYW51YWxXaW5uZXJzID0gW107XG4gICAgICBjb25zdCBjb250ZXN0YW50c1dpdGhWb3RlcyA9IFtdO1xuICAgICAgbGV0IHJvdW5kV2l0aFNpbmdsZVdpbm5lcjtcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgdG90YWxSb3VuZHM7IGorKykge1xuICAgICAgICAgY29uc3QgUm91bmQgPSBldmVudC5Sb3VuZHNbal07XG4gICAgICAgICBpZiAoIVJvdW5kLklzRmluaXNoZWQpIHtcbiAgICAgICAgICAgIGhhc09wZW5Sb3VuZCA9IHRydWU7XG4gICAgICAgICB9XG4gICAgICAgICBjb25zdCBjb250ZXN0YW50cyA9IFJvdW5kLkNvbnRlc3RhbnRzO1xuICAgICAgICAgbGV0IG51bVdpbm5lcnMgPSAwO1xuICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBjb250ZXN0YW50cy5sZW5ndGg7IGsrKykge1xuICAgICAgICAgICAgaWYgKGNvbnRlc3RhbnRzW2tdLklzV2lubmVyKSB7XG4gICAgICAgICAgICAgICBudW1XaW5uZXJzKys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBudW1Wb3RlcyArPSBjb250ZXN0YW50c1trXS5Wb3Rlcy5sZW5ndGg7XG4gICAgICAgICAgICAvKmNvbnRlc3RhbnRzV2l0aFZvdGVzLnB1c2goe1xuICAgICAgICAgICAgICAgVm90ZXM6IGNvbnRlc3RhbnRzW2tdLlZvdGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgIEltYWdlOiBjb250ZXN0YW50c1trXS5JbWFnZXMgJiYgY29udGVzdGFudHNba10uSW1hZ2VzW2NvbnRlc3RhbnRzW2tdLkltYWdlcy5sZW5ndGggLSAxXSxcbiAgICAgICAgICAgICAgIE5hbWU6IGNvbnRlc3RhbnRzW2tdLkRldGFpbC5OYW1lLFxuICAgICAgICAgICAgICAgSXNXaW5uZXI6IGNvbnRlc3RhbnRzW2tdLklzV2lubmVyLFxuICAgICAgICAgICAgICAgRmluYWxSb3VuZDogdG90YWxSb3VuZHMgPT09IFJvdW5kLlJvdW5kTnVtYmVyLFxuICAgICAgICAgICAgICAgUm91bmROdW1iZXI6IFJvdW5kLlJvdW5kTnVtYmVyXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmICh0b3RhbFJvdW5kcyA9PT0gUm91bmQuUm91bmROdW1iZXJcbiAgICAgICAgICAgICAgICYmIGNvbnRlc3RhbnRzW2tdLkVuYWJsZWQgJiYgY29udGVzdGFudHNba10uRWFzZWxOdW1iZXIgPiAwKSB7XG4gICAgICAgICAgICAgICAvLyBmaW5hbCByb3VuZFxuICAgICAgICAgICAgICAgZmluYWxSb3VuZENvbnRlc3RhbnRNYXBba10gPSB7XG4gICAgICAgICAgICAgICAgICBWb3RlczogY29udGVzdGFudHNba10uVm90ZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgLy8gSW1hZ2U6IGNvbnRlc3RhbnRzW2tdLkltYWdlc1tjb250ZXN0YW50c1trXS5JbWFnZXMubGVuZ3RoIC0gMV0sXG4gICAgICAgICAgICAgICAgICBJc1dpbm5lcjogY29udGVzdGFudHNba10uSXNXaW5uZXIsXG4gICAgICAgICAgICAgICAgICBOYW1lOiBjb250ZXN0YW50c1trXS5EZXRhaWwuTmFtZVxuICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgfSovXG4gICAgICAgICB9XG4gICAgICAgICBpZiAobnVtV2lubmVycyA9PT0gMSkge1xuICAgICAgICAgICAgcm91bmRXaXRoU2luZ2xlV2lubmVyID0gUm91bmQ7XG4gICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAocm91bmRXaXRoU2luZ2xlV2lubmVyKSB7XG4gICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IHJvdW5kV2l0aFNpbmdsZVdpbm5lci5Db250ZXN0YW50cy5sZW5ndGg7IGsrKykge1xuICAgICAgICAgICAgY29uc3QgY29udGVzdGFudCA9IHJvdW5kV2l0aFNpbmdsZVdpbm5lci5Db250ZXN0YW50c1trXTtcbiAgICAgICAgICAgIGlmIChjb250ZXN0YW50LklzV2lubmVyID09PSAxKSB7XG4gICAgICAgICAgICAgICB3aW5uZXJOYW1lID0gY29udGVzdGFudC5EZXRhaWwuTmFtZTtcbiAgICAgICAgICAgICAgIHdpbm5lckltYWdlID0gY29udGVzdGFudC5JbWFnZXMgJiYgY29udGVzdGFudC5JbWFnZXNbY29udGVzdGFudC5JbWFnZXMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgICB3aW5uZXJJZCA9IGNvbnRlc3RhbnQuRGV0YWlsLl9pZDtcbiAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgfVxuICAgICAgfVxuICAgICAgLypcbiAgICAgIGNvbnN0IHdpbm5lcnMgPSBtYW51YWxXaW5uZXJzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgIHJldHVybiBiLlJvdW5kTnVtYmVyIC0gYS5Sb3VuZE51bWJlcjtcbiAgICAgIH0pO1xuICAgICAgY29uc3QgZmlsdGVyZWRXaW5uZXJzID0gW107XG4gICAgICBsZXQgbGFzdFJvdW5kTnVtYmVyID0gMDtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgd2lubmVycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgbGFzdFJvdW5kTnVtYmVyID0gd2lubmVyc1tpXS5Sb3VuZE51bWJlcjtcbiAgICAgICAgIGlmICh3aW5uZXJzW2ldLlJvdW5kTnVtYmVyIDwgbGFzdFJvdW5kTnVtYmVyKSB7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgIH1cbiAgICAgICAgIGZpbHRlcmVkV2lubmVycy5wdXNoKG1hbnVhbFdpbm5lcnNbaV0pO1xuICAgICAgfVxuICAgICAgY29uc3Qgc29ydGVkV2lubmVycyA9IGZpbHRlcmVkV2lubmVycy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgICByZXR1cm4gYi5Wb3RlcyAtIGEuVm90ZXM7XG4gICAgICB9KTtcbiAgICAgIGlmIChzb3J0ZWRXaW5uZXJzWzBdKSB7XG4gICAgICAgICB3aW5uZXJOYW1lID0gc29ydGVkV2lubmVyc1swXS5OYW1lO1xuICAgICAgICAgY29uc3QgZmlsdGVyZWRDb250ZXN0YW50SW1hZ2VzID0gY29udGVzdGFudHNXaXRoVm90ZXMuZmlsdGVyKChjb250ZXN0YW50KSA9PiB7XG4gICAgICAgICAgICBpZiAoY29udGVzdGFudC5OYW1lID09PSB3aW5uZXJOYW1lKSB7XG4gICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgIH0pO1xuICAgICAgICAgY29uc3Qgc29ydGVkSW1hZ2VzID0gZmlsdGVyZWRDb250ZXN0YW50SW1hZ2VzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBiLlZvdGVzIC0gYS5Wb3RlcztcbiAgICAgICAgIH0pO1xuICAgICAgICAgd2lubmVySW1hZ2UgPSBzb3J0ZWRJbWFnZXNbMF0uSW1hZ2U7XG4gICAgICB9XG5cbiAgICAgIGNvbnNvbGUubG9nKCdzb3J0ZWRDb250ZXN0YW50cycsIHNvcnRlZENvbnRlc3RhbnRzKTtcbiAgICAgIGlmIChtYW51YWxXaW5uZXJzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjb25zdCBzb3J0ZWQgPSBtYW51YWxXaW5uZXJzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIGIuVm90ZXMgLSBhLlZvdGVzO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmIChzb3J0ZWRbMF0pIHtcbiAgICAgICAgICAgICAgd2lubmVyTmFtZSA9IHNvcnRlZFswXS5OYW1lO1xuICAgICAgICAgICAgICAvLyB3aW5uZXJJbWFnZSA9IHNvcnRlZFswXS5JbWFnZTtcbiAgICAgICAgICB9XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgICBjb25zdCBzb3J0ZWQgPSBmaW5hbFJvdW5kQ29udGVzdGFudE1hcC5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBiLlZvdGVzIC0gYS5Wb3RlcztcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAoc29ydGVkWzBdKSB7XG4gICAgICAgICAgICAgIHdpbm5lck5hbWUgPSBzb3J0ZWRbMF0uTmFtZTtcbiAgICAgICAgICAgICAvLyAgd2lubmVySW1hZ2UgPSBzb3J0ZWRbMF0uSW1hZ2U7XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgICAgY29uc3Qgc29ydGVkID0gY29udGVzdGFudHNXaXRoVm90ZXMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgIHJldHVybiBiLlZvdGVzIC0gYS5Wb3RlcztcbiAgICAgIH0pO1xuXG4gICAgICBmb3IgKGxldCBuID0gMDsgbiA8IHNvcnRlZC5sZW5ndGg7IG4rKykge1xuICAgICAgICAgIGlmIChzb3J0ZWRbbl0uTmFtZSA9PT0gd2lubmVyTmFtZSkge1xuICAgICAgICAgICAgICB3aW5uZXJJbWFnZSA9IHNvcnRlZFtuXS5JbWFnZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgfSovXG5cbiAgICAgIC8qaWYgKHNvcnRlZFswXSkge1xuICAgICAgICAgIHdpbm5lckltYWdlID0gc29ydGVkWzBdLkltYWdlO1xuICAgICAgfSovXG5cbiAgICAgIGlmIChjdXJyZW50Um91bmROdW1iZXIpIHtcbiAgICAgICAgIHJvdW5kVGV4dCA9IGBMSVZFYDtcbiAgICAgICAgIHJvdW5kQ29sb3IgPSAnI0QxNEIxOSc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAgaWYgKGhhc09wZW5Sb3VuZCkge1xuICAgICAgICAgICAgY29uc3QgZXZlbnREYXRlID0gbmV3IERhdGUoZXZlbnQuRXZlbnRTdGFydERhdGVUaW1lKTtcbiAgICAgICAgICAgIGNvbnN0IGRpZmZlcmVuY2VJbk1zID0gZGlmZmVyZW5jZUluTWlsbGlzZWNvbmRzKGV2ZW50RGF0ZSwgbmV3IERhdGUoKSk7XG4gICAgICAgICAgICBjb25zdCBkaXN0YW5jZUluV29yZCA9IGRpc3RhbmNlSW5Xb3Jkc1N0cmljdChldmVudERhdGUsIG5ldyBEYXRlKCkpO1xuICAgICAgICAgICAgaWYgKGRpZmZlcmVuY2VJbk1zID4gMCkge1xuICAgICAgICAgICAgICAgcm91bmRUZXh0ID0gYEluICR7ZGlzdGFuY2VJbldvcmR9YDtcbiAgICAgICAgICAgICAgIHJvdW5kQ29sb3IgPSAnIzE5NzVEMSc7XG4gICAgICAgICAgICAgICByb3VuZFRleHQgPSByb3VuZFRleHQucmVwbGFjZSgnZGF5cycsICdkJyk7XG4gICAgICAgICAgICAgICByb3VuZFRleHQgPSByb3VuZFRleHQucmVwbGFjZSgnc2Vjb25kcycsICdzJyk7XG4gICAgICAgICAgICAgICByb3VuZFRleHQgPSByb3VuZFRleHQucmVwbGFjZSgnaG91cnMnLCAnaCcpO1xuICAgICAgICAgICAgICAgcm91bmRUZXh0ID0gcm91bmRUZXh0LnJlcGxhY2UoJ21pbnV0ZXMnLCAnbScpO1xuICAgICAgICAgICAgICAgcm91bmRUZXh0ID0gcm91bmRUZXh0LnJlcGxhY2UoJ21vbnRocycsICdtbycpO1xuICAgICAgICAgICAgICAgcm91bmRUZXh0ID0gcm91bmRUZXh0LnJlcGxhY2UoJ3llYXJzJywgJ3knKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICByb3VuZFRleHQgPSBgU3RhcnRpbmcgc29vbmA7XG4gICAgICAgICAgICAgICByb3VuZENvbG9yID0gJyMxOTc1RDEnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJvdW5kVGV4dCA9ICdGSU5BTCc7XG4gICAgICAgICAgICByb3VuZENvbG9yID0gJyNGRkYnO1xuICAgICAgICAgICAgc3RhdHVzVGV4dENvbG9yID0gJyMwMDAnO1xuICAgICAgICAgfVxuICAgICAgfVxuICAgICAgZXZlbnRJZHMucHVzaChldmVudC5faWQpO1xuICAgICAgZXZlbnRTdHJJZHMucHVzaChldmVudC5faWQudG9TdHJpbmcoKSk7XG4gICAgICBsZXQgc3RyZWFtVXJsOiBzdHJpbmc7XG4gICAgICBjb25zdCBjdXJyZW50VGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgICAgY29uc3Qgc3RhcnRUaW1lID0gbmV3IERhdGUoZXZlbnQuRXZlbnRTdGFydERhdGVUaW1lKS5nZXRUaW1lKCk7XG4gICAgICBjb25zdCBlbmRUaW1lID0gbmV3IERhdGUoZXZlbnQuRXZlbnRFbmREYXRlVGltZSkuZ2V0VGltZSgpO1xuICAgICAgaWYgKChjdXJyZW50VGltZSA+IHN0YXJ0VGltZSAmJiBjdXJyZW50VGltZSA8IGVuZFRpbWUpICYmIGV2ZW50LkxpdmVTdHJlYW0pIHtcbiAgICAgICAgIHN0cmVhbVVybCA9IGV2ZW50LkxpdmVTdHJlYW07XG4gICAgICAgICBpZiAoIXRvcFBsYXllclVybCkge1xuICAgICAgICAgICAgdG9wUGxheWVyVXJsID0gc3RyZWFtVXJsO1xuICAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgIHN0cmVhbVVybCA9IGV2ZW50LlZpZGVvU3RyZWFtO1xuICAgICAgfVxuICAgICAgY29uc3QgZXZlbnRPYmo6IEV2ZW50c0ludGVyZmFjZSA9IHtcbiAgICAgICAgIEVJRDogZXZlbnQuRUlEIHx8ICcnLFxuICAgICAgICAgZXZlbnRJZDogZXZlbnQuX2lkLnRvU3RyaW5nKCksXG4gICAgICAgICB0aXRsZTogZXZlbnQuTmFtZSxcbiAgICAgICAgIGZsYWc6IGV2ZW50LkNvdW50cnkgPyBgJHtwcm9jZXNzLmVudi5TSVRFX1VSTH0vaW1hZ2VzL2NvdW50cmllcy80eDMvJHtldmVudC5Db3VudHJ5LmNvdW50cnlfaW1hZ2V9YCA6ICcnLFxuICAgICAgICAgZmxhZ1BuZzogZXZlbnQuQ291bnRyeSA/IGAke3Byb2Nlc3MuZW52LlNJVEVfVVJMfS9pbWFnZXMvY291bnRyaWVzLzR4M19wbmcvJHtldmVudC5Db3VudHJ5LmNvdW50cnlfaW1hZ2UucmVwbGFjZSgnc3ZnJywgJ3BuZycpfWAgOiAnJyxcbiAgICAgICAgIHN0YXR1c1RleHQ6IHJvdW5kVGV4dCxcbiAgICAgICAgIHN0YXR1c0NvbG9yOiByb3VuZENvbG9yLFxuICAgICAgICAgc3RhdHVzVGV4dENvbG9yOiBzdGF0dXNUZXh0Q29sb3IsXG4gICAgICAgICBvcGVuVm90aW5nOiBmYWxzZSxcbiAgICAgICAgIG9wZW5TdGF0dXM6IGZhbHNlLFxuICAgICAgICAgVGlja2V0TGluazogZXZlbnQuVGlja2V0TGluayB8fCAnJyxcbiAgICAgICAgIFZlbnVlOiBldmVudC5WZW51ZSB8fCAnJyxcbiAgICAgICAgIFByaWNlOiBldmVudC5QcmljZSB8fCAnJyxcbiAgICAgICAgIERlc2NyaXB0aW9uOiBldmVudC5EZXNjcmlwdGlvbixcbiAgICAgICAgIERhdGFUaW1lUmFuZ2U6IGZvcm1hdFRvVGltZVpvbmUobmV3IERhdGUoZXZlbnQuRXZlbnRTdGFydERhdGVUaW1lKSwgJ01NTU1Eby1obW1heicsIHsgdGltZVpvbmU6IGV2ZW50LlRpbWVab25lSUNBTk4gfHwgJ0FtZXJpY2EvVG9yb250bycgfSksXG4gICAgICAgICBWb3RlczogbnVtVm90ZXMsXG4gICAgICAgICBFdmVudE5vOiBpICsgMSxcbiAgICAgICAgIG9wZW5BdWN0aW9uQ291bnQ6IDAsXG4gICAgICAgICB3aW5uZXJJbWFnZTogd2lubmVySW1hZ2UsXG4gICAgICAgICB3aW5uZXJOYW1lOiB3aW5uZXJOYW1lLFxuICAgICAgICAgd2lubmVySWQ6IHdpbm5lcklkLFxuICAgICAgICAgc3BvbnNvckxvZ286IGV2ZW50LlNwb25zb3JMb2dvLFxuICAgICAgICAgc3BvbnNvclRleHQ6IGV2ZW50LlNwb25zb3JUZXh0LFxuICAgICAgICAgRW5hYmxlQXVjdGlvbjogZXZlbnQuRW5hYmxlQXVjdGlvbixcbiAgICAgICAgIFN0cmVhbVVybDogc3RyZWFtVXJsXG4gICAgICB9O1xuICAgICAgYWN0aXZlRXZlbnRzTGlzdC5wdXNoKGV2ZW50T2JqKTtcbiAgIH1cblxuICAgLypjb25zdCBvcGVuQXVjdGlvbkNvdW50UGVyRXZlbnRzID0gYXdhaXQgTG90TW9kZWwuYWdncmVnYXRlKFtcbiAgICAgIHtcbiAgICAgICAgICRtYXRjaDoge1xuICAgICAgICAgICAgJ0V2ZW50JzogeyAkaW46IGV2ZW50SWRzIH0sXG4gICAgICAgICAgICAnU3RhdHVzJzogMixcbiAgICAgICAgIH1cbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgICAkZ3JvdXA6IHtcbiAgICAgICAgICAgIF9pZDogeyBFdmVudDogJyRFdmVudCcgfSxcbiAgICAgICAgICAgIGNvdW50OiB7ICRzdW06IDEgfVxuICAgICAgICAgfVxuICAgICAgfVxuICAgXSk7XG5cbiAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3BlbkF1Y3Rpb25Db3VudFBlckV2ZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgaWQgPSBvcGVuQXVjdGlvbkNvdW50UGVyRXZlbnRzW2ldLl9pZC5FdmVudDtcbiAgICAgIGNvbnN0IGV2ZW50SWRJbmRleCA9IGV2ZW50U3RySWRzLmluZGV4T2YoaWQudG9TdHJpbmcoKSk7XG4gICAgICBhY3RpdmVFdmVudHNMaXN0W2V2ZW50SWRJbmRleF0ub3BlbkF1Y3Rpb25Db3VudCA9IG9wZW5BdWN0aW9uQ291bnRQZXJFdmVudHNbaV0uY291bnQ7XG4gICB9Ki9cblxuICAgY29uc3QgZXZlbnRMaXN0OiBFdmVudExpc3RbXSA9IFtcbiAgICAgIHtcbiAgICAgICAgIGxhYmVsOiAnQUNUSVZFIEVWRU5UUycsXG4gICAgICAgICBpdGVtczogYWN0aXZlRXZlbnRzTGlzdCxcbiAgICAgICAgIHRvcFBsYXllclVybDogdG9wUGxheWVyVXJsXG4gICAgICB9XG4gICBdO1xuXG5cbiAgIGNvbnN0IHJlc3VsdDogRGF0YU9wZXJhdGlvblJlc3VsdDxFdmVudExpc3RbXT4gPSB7XG4gICAgICAnU3VjY2Vzcyc6IHRydWUsXG4gICAgICBEYXRhOiBldmVudExpc3RcbiAgIH07XG4gICBsb2dnZXIuaW5mbyhgc2F2aW5nIGV2ZW50cyBsaXN0IGluIGNhY2hlICR7Y2FjaGVLZXl9YCk7XG4gICBhd2FpdCBjYWNoZVNldChjYWNoZUtleSwgSlNPTi5zdHJpbmdpZnkocmVzdWx0KSk7IC8vIGF1dG8gZXhwaXJlIGluIDEwIG1pbnV0ZXNcbiAgIGxvZ2dlci5pbmZvKGBzYXZlZCBldmVudHMgbGlzdCBpbiBjYWNoZSAke2NhY2hlS2V5fWApO1xuICAgcmVzLmpzb24ocmVzdWx0KTtcblxufTtcblxuZXhwb3J0IGNvbnN0IG1ha2VXaW5uZXIgPSBhc3luYyBmdW5jdGlvbiAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgIC8vIC86ZXZlbnRJZC86Y29udGVzdGFudElkLzpSb3VuZE51bWJlci86SXNXaW5uZXJcbiAgIHRyeSB7XG4gICAgICBjb25zdCBldmVudElkID0gcmVxLnBhcmFtcy5ldmVudElkO1xuICAgICAgY29uc3QgY29udGVzdGFudElkID0gcmVxLnBhcmFtcy5jb250ZXN0YW50SWQ7XG4gICAgICBjb25zdCByb3VuZE51bWJlciA9IHBhcnNlSW50KHJlcS5wYXJhbXMucm91bmROdW1iZXIpO1xuICAgICAgY29uc3QgaXNXaW5uZXIgPSBwYXJzZUludChyZXEucGFyYW1zLklzV2lubmVyKTtcbiAgICAgIGlmICghKGlzV2lubmVyID09PSAwIHx8IGlzV2lubmVyID09PSAxKSkge1xuICAgICAgICAgcmVzLnN0YXR1cyg0MDMpO1xuICAgICAgICAgbG9nZ2VyLmluZm8oYElzIFdpbm5lciBzaG91bGQgYmUgMCBvciAxYCwgcmVxLnBhcmFtcy5Jc1dpbm5lcik7XG4gICAgICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8c3RyaW5nPiA9IHtcbiAgICAgICAgICAgICdTdWNjZXNzJzogZmFsc2UsXG4gICAgICAgICAgICBEYXRhOiAnSW52YWxpZCdcbiAgICAgICAgIH07XG4gICAgICAgICByZXMuanNvbihyZXN1bHQpO1xuICAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29uc3QgZXZlbnQgPSBhd2FpdCBFdmVudE1vZGVsLmZpbmRPbmUoe1xuICAgICAgICAgX2lkOiBldmVudElkXG4gICAgICB9KTtcbiAgICAgIGxldCBpc01vZGlmaWVkID0gZmFsc2U7XG4gICAgICBpZiAoZXZlbnQpIHtcbiAgICAgICAgIGNvbnN0IHVwZGF0ZUNvbnRlc3RhbnQgPSBmdW5jdGlvbiAoY29udGVzdGFudHM6IFJvdW5kQ29udGVzdGFudERUT1tdLCBjb250ZXN0YW50SWQ6IHN0cmluZykge1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBjb250ZXN0YW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgY29uc3QgY29udGVzdGFudCA9IGNvbnRlc3RhbnRzW2pdO1xuICAgICAgICAgICAgICAgaWYgKGNvbnRlc3RhbnQuX2lkID09IGNvbnRlc3RhbnRJZCkge1xuICAgICAgICAgICAgICAgICAgY29udGVzdGFudC5Jc1dpbm5lciA9IGlzV2lubmVyO1xuICAgICAgICAgICAgICAgICAgaXNNb2RpZmllZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gY29udGVzdGFudHM7XG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICB9O1xuICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBldmVudC5Sb3VuZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHJvdW5kID0gZXZlbnQuUm91bmRzW2ldO1xuICAgICAgICAgICAgaWYgKHJvdW5kLlJvdW5kTnVtYmVyID09PSByb3VuZE51bWJlcikge1xuICAgICAgICAgICAgICAgcm91bmQuQ29udGVzdGFudHMgPSB1cGRhdGVDb250ZXN0YW50KHJvdW5kLkNvbnRlc3RhbnRzLCBjb250ZXN0YW50SWQpO1xuICAgICAgICAgICAgICAgaXNNb2RpZmllZCA9ICEhKHJvdW5kLkNvbnRlc3RhbnRzKTtcbiAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRSb3VuZE51bWJlciA9IGV2ZW50LkN1cnJlbnRSb3VuZCAmJiBldmVudC5DdXJyZW50Um91bmQuUm91bmROdW1iZXI7XG4gICAgICAgICAgICAgICBpZiAoaXNNb2RpZmllZCAmJiByb3VuZC5Sb3VuZE51bWJlciA9PT0gY3VycmVudFJvdW5kTnVtYmVyKSB7XG4gICAgICAgICAgICAgICAgICBldmVudC5DdXJyZW50Um91bmQuQ29udGVzdGFudHMgPSB1cGRhdGVDb250ZXN0YW50KGV2ZW50LkN1cnJlbnRSb3VuZC5Db250ZXN0YW50cywgY29udGVzdGFudElkKTtcbiAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgfVxuICAgICAgICAgaWYgKGlzTW9kaWZpZWQpIHtcbiAgICAgICAgICAgIGF3YWl0IGV2ZW50LnNhdmUoKTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogRGF0YU9wZXJhdGlvblJlc3VsdDxzdHJpbmc+ID0ge1xuICAgICAgICAgICAgICAgJ1N1Y2Nlc3MnOiB0cnVlLFxuICAgICAgICAgICAgICAgRGF0YTogaXNXaW5uZXIgPT09IDAgPyAnJyA6ICdXaW5uZXInXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgY29uc3QgY2FjaGVLZXkgPSBgYXBwLWV2ZW50LWxpc3QtYDtcbiAgICAgICAgICAgIGNvbnN0IGNhY2hlRGVsID0gcmVxLmFwcC5nZXQoJ2NhY2hlRGVsJyk7XG4gICAgICAgICAgICBjb25zdCBjYWNoZURlbFByb21pc2VzID0gW107XG4gICAgICAgICAgICBjYWNoZURlbFByb21pc2VzLnB1c2goY2FjaGVEZWwoYCR7Y2FjaGVLZXl9JHtldmVudElkfWApKTtcbiAgICAgICAgICAgIGNhY2hlRGVsUHJvbWlzZXMucHVzaChjYWNoZURlbChjYWNoZUtleSkpO1xuICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoY2FjaGVEZWxQcm9taXNlcyk7XG4gICAgICAgICAgICByZXMuanNvbihyZXN1bHQpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBub3RoaW5nIG1vZGlmaWVkICR7ZXZlbnRJZH1gKTtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNDAzKTtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdDogRGF0YU9wZXJhdGlvblJlc3VsdDxzdHJpbmc+ID0ge1xuICAgICAgICAgICAgICAgJ1N1Y2Nlc3MnOiBmYWxzZSxcbiAgICAgICAgICAgICAgIERhdGE6ICdJbnZhbGlkJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJlcy5qc29uKHJlc3VsdCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAgbG9nZ2VyLmluZm8oYG1hdGNoaW5nIGV2ZW50IG5vdCBmb3VuZCAke2V2ZW50SWR9YCk7XG4gICAgICAgICByZXMuc3RhdHVzKDQwMyk7XG4gICAgICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8c3RyaW5nPiA9IHtcbiAgICAgICAgICAgICdTdWNjZXNzJzogZmFsc2UsXG4gICAgICAgICAgICBEYXRhOiAnSW52YWxpZCdcbiAgICAgICAgIH07XG4gICAgICAgICByZXMuanNvbihyZXN1bHQpO1xuICAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICB9IGNhdGNoIChlKSB7XG4gICAgICBsb2dnZXIuaW5mbyhlKTtcbiAgICAgIGNvbnN0IHJlc3VsdDogRGF0YU9wZXJhdGlvblJlc3VsdDxzdHJpbmc+ID0ge1xuICAgICAgICAgJ1N1Y2Nlc3MnOiBmYWxzZSxcbiAgICAgICAgIERhdGE6ICdJbnRlcm5hbCBTZXJ2ZXIgRXJyb3InXG4gICAgICB9O1xuICAgICAgcmVzLnN0YXR1cyg1MDApO1xuICAgICAgcmVzLmpzb24ocmVzdWx0KTtcbiAgIH1cbn07XG5cbmV4cG9ydCBjb25zdCBldmVudFN0YXRzID0gYXN5bmMgZnVuY3Rpb24gKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSB7XG4gICB0cnkge1xuICAgICAgY29uc3QgZXZlbnRJZHMgPSByZXEudXNlci5ldmVudElkcztcbiAgICAgIGNvbnN0IGNvbmRpdGlvbiA9IHt9O1xuICAgICAgaWYgKGV2ZW50SWRzICYmIGV2ZW50SWRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgIGNvbmRpdGlvbi5faWQgPSB7ICRpbjogZXZlbnRJZHMgfTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGV2ZW50cyA9IGF3YWl0IEV2ZW50TW9kZWwuZmluZChjb25kaXRpb24pXG4gICAgICAgICAgLnNlbGVjdChbJ19pZCcsICdOYW1lJywgJ1JlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yJ10pXG4gICAgICAgICAgLnNvcnQoeyAnX2lkJzogLTEgfSk7XG5cbiAgICAgIGNvbnN0IGV2ZW50U3RhdGVzOiBFdmVudFN0YXREVE9bXSA9IFtdO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBldmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgIGNvbnN0IGV2ZW50ID0gZXZlbnRzW2ldO1xuICAgICAgICAgY29uc3QgZXZlbnRTdGF0ZSA9IHtcbiAgICAgICAgICAgIEV2ZW50SWQ6IGV2ZW50Ll9pZCxcbiAgICAgICAgICAgIE5hbWU6IGV2ZW50Lk5hbWUsXG4gICAgICAgICAgICBSZWdpc3RlcmVkOiAwLFxuICAgICAgICAgICAgRG9vcjogMCxcbiAgICAgICAgICAgIE9ubGluZTogMFxuICAgICAgICAgfTtcbiAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZXZlbnQuUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3IubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHZvdGVyID0gZXZlbnQuUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3Jbal07XG4gICAgICAgICAgICBldmVudFN0YXRlLlJlZ2lzdGVyZWQrKztcbiAgICAgICAgICAgIGlmICghdm90ZXIuRnJvbSB8fCB2b3Rlci5Gcm9tID09PSAnc21zJykge1xuICAgICAgICAgICAgICAgZXZlbnRTdGF0ZS5Eb29yKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgZXZlbnRTdGF0ZS5PbmxpbmUrKztcbiAgICAgICAgICAgIH1cbiAgICAgICAgIH1cbiAgICAgICAgIGV2ZW50U3RhdGVzLnB1c2goZXZlbnRTdGF0ZSk7XG4gICAgICB9XG4gICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8RXZlbnRTdGF0RFRPW10+ID0ge1xuICAgICAgICAgJ1N1Y2Nlc3MnOiB0cnVlLFxuICAgICAgICAgRGF0YTogZXZlbnRTdGF0ZXNcbiAgICAgIH07XG4gICAgICByZXMuanNvbihyZXN1bHQpO1xuICAgICAgcmV0dXJuO1xuICAgfSBjYXRjaCAoZSkge1xuICAgICAgbG9nZ2VyLmluZm8oZSk7XG4gICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8c3RyaW5nPiA9IHtcbiAgICAgICAgICdTdWNjZXNzJzogZmFsc2UsXG4gICAgICAgICBEYXRhOiAnSW50ZXJuYWwgU2VydmVyIEVycm9yJ1xuICAgICAgfTtcbiAgICAgIHJlcy5zdGF0dXMoNTAwKTtcbiAgICAgIHJlcy5qc29uKHJlc3VsdCk7XG4gICB9XG59O1xuXG5leHBvcnQgY29uc3Qgdmlld0V2ZW50ID0gYXN5bmMgZnVuY3Rpb24gKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSB7XG4gICB0cnkge1xuICAgICAgY29uc3QgZXZlbnREb2MgPSBhd2FpdCBFdmVudE1vZGVsLmZpbmRCeUlkKHJlcS5wYXJhbXMuZXZlbnRJZCkuc2VsZWN0KFsnX2lkJywgJ0VJRCcsICdWb3RlQnlMaW5rJywgJ1JvdW5kcycsICdDdXJyZW50Um91bmQnLCAnUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3InLCAnQ29udGVzdGFudHMnLCAnSW1hZ2VzJ10pXG4gICAgICAgICAgLnBvcHVsYXRlKCdSb3VuZHMuQ29udGVzdGFudHMuRGV0YWlsJylcbiAgICAgICAgICAucG9wdWxhdGUoJ1JvdW5kcy5Db250ZXN0YW50cy5Wb3RlcycpXG4gICAgICAgICAgLnBvcHVsYXRlKCdDdXJyZW50Um91bmQuQ29udGVzdGFudHMuVm90ZXMnKVxuICAgICAgICAgIC5wb3B1bGF0ZSgnQ291bnRyeScpO1xuICAgICAgaWYgKCFldmVudERvYykge1xuICAgICAgICAgcmV0dXJuIG5leHQoe1xuICAgICAgICAgICAgbWVzc2FnZTogJ0ludmFsaWQgbGluaycsXG4gICAgICAgICAgICBzdGF0dXM6IDQwNFxuICAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBjb25zdCB0b3RhbFJvdW5kcyA9IGV2ZW50RG9jLlJvdW5kcy5sZW5ndGg7XG4gICAgICBjb25zdCBjdXJyZW50Um91bmQgPSBldmVudERvYy5DdXJyZW50Um91bmQ7XG4gICAgICBsZXQgY3VycmVudFJvdW5kTnVtYmVyID0gY3VycmVudFJvdW5kICYmIGN1cnJlbnRSb3VuZC5Sb3VuZE51bWJlcjtcbiAgICAgIGxldCBjdXJyZW50Um91bmRJbmRleDogbnVtYmVyO1xuICAgICAgY29uc3Qgcm91bmRXaXNlSW1hZ2VzID0gW107XG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRvdGFsUm91bmRzOyBqKyspIHtcbiAgICAgICAgIGNvbnN0IGFydGlzdHNJblJvdW5kID0gZXZlbnREb2MuUm91bmRzW2pdLkNvbnRlc3RhbnRzO1xuICAgICAgICAgY29uc3QgYXJ0aXN0c0ltYWdlcyA9IGFydGlzdFdpc2VJbWFnZXMoYXJ0aXN0c0luUm91bmQsIHJlcS51c2VyKTtcbiAgICAgICAgIGNvbnN0IHJlc3BvbnNlOiBSb3VuZEFydGlzdHNJbnRlcmZhY2UgPSB7XG4gICAgICAgICAgICBFdmVudElkOiBldmVudERvYy5pZCxcbiAgICAgICAgICAgIEVJRDogZXZlbnREb2MuRUlEIHx8ICcnLFxuICAgICAgICAgICAgUm91bmROdW1iZXI6IGV2ZW50RG9jLlJvdW5kc1tqXS5Sb3VuZE51bWJlcixcbiAgICAgICAgICAgIEFydGlzdHM6IGFydGlzdHNJbWFnZXMuYXJ0aXN0cyxcbiAgICAgICAgICAgIElzQ3VycmVudFJvdW5kOiBjdXJyZW50Um91bmROdW1iZXIgPT09IGV2ZW50RG9jLlJvdW5kc1tqXS5Sb3VuZE51bWJlcixcbiAgICAgICAgICAgIEhhc09wZW5Sb3VuZDogIWV2ZW50RG9jLlJvdW5kc1tqXS5Jc0ZpbmlzaGVkLFxuICAgICAgICAgICAgSGFzSW1hZ2VzOiBhcnRpc3RzSW1hZ2VzLmhhc0ltYWdlcyxcbiAgICAgICAgICAgIEVuYWJsZUF1Y3Rpb246IGV2ZW50RG9jLkVuYWJsZUF1Y3Rpb24sXG4gICAgICAgICAgICBIYXNWb3RlZDogKCEhZXZlbnREb2MuaGFzVm90ZWQocmVxLnVzZXIuUGhvbmVOdW1iZXIgfHwgcmVxLnVzZXIuRW1haWwsIGV2ZW50RG9jLlJvdW5kc1tqXSkpXG4gICAgICAgICB9O1xuICAgICAgICAgcm91bmRXaXNlSW1hZ2VzLnB1c2gocmVzcG9uc2UpO1xuICAgICAgICAgbGV0IHJvdW5kID0gZXZlbnREb2MuUm91bmRzW2pdO1xuICAgICAgICAgaWYgKHJlc3BvbnNlLklzQ3VycmVudFJvdW5kKSB7XG4gICAgICAgICAgICBjdXJyZW50Um91bmRJbmRleCA9IGo7XG4gICAgICAgICAgICByb3VuZCA9IGV2ZW50RG9jLkN1cnJlbnRSb3VuZDtcbiAgICAgICAgIH1cbiAgICAgICAgIGNvbnN0IG51bWJlcnM6IHN0cmluZ1tdID0gW107XG5cbiAgICAgICAgIHJvdW5kLkNvbnRlc3RhbnRzLmZvckVhY2goKGN1cjogYW55KSA9PiB7XG4gICAgICAgICAgICBjdXIuVm90ZXMuZm9yRWFjaCgodjogUmVnaXN0cmF0aW9uRFRPKSA9PiB7XG4gICAgICAgICAgICAgICBudW1iZXJzLnB1c2godi5QaG9uZU51bWJlciB8fCB2LkVtYWlsKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBpZiAoIWN1cnJlbnRSb3VuZE51bWJlcikge1xuICAgICAgICAgY3VycmVudFJvdW5kTnVtYmVyID0gMDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzdWx0OiBEYXRhT3BlcmF0aW9uUmVzdWx0PHtcbiAgICAgICAgIHJvdW5kV2lzZUltYWdlczogUm91bmRBcnRpc3RzSW50ZXJmYWNlW10sXG4gICAgICAgICBDdXJyZW50Um91bmROdW1iZXI6IG51bWJlclxuICAgICAgfT4gPSB7XG4gICAgICAgICAnU3VjY2Vzcyc6IHRydWUsXG4gICAgICAgICBEYXRhOiB7XG4gICAgICAgICAgICByb3VuZFdpc2VJbWFnZXM6IHJvdW5kV2lzZUltYWdlcyxcbiAgICAgICAgICAgIEN1cnJlbnRSb3VuZE51bWJlcjogY3VycmVudFJvdW5kTnVtYmVyLFxuICAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIHJlcy5qc29uKHJlc3VsdCk7XG4gICB9XG4gICBjYXRjaCAoZSkge1xuICAgICAgbmV4dChlKTtcbiAgIH1cbn07XG5cbmV4cG9ydCBjb25zdCBhcHBWb3RlID0gYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICB0cnkge1xuICAgICAgY29uc3QgbG9nID0gbmV3IFZvdGluZ0xvZ01vZGVsKCk7XG4gICAgICBjb25zdCB2b3RlID0gcmVxLnBhcmFtcy5lYXNlbE51bWJlcjtcbiAgICAgIGNvbnN0IHJvdW5kTnVtYmVyID0gcmVxLnBhcmFtcy5Sb3VuZE51bWJlcjtcbiAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChbRXZlbnRNb2RlbC5maW5kT25lKHtcbiAgICAgICAgICdfaWQnOiByZXEucGFyYW1zLmV2ZW50SWQsXG4gICAgICB9KS5zZWxlY3QoWydOYW1lJywgJ19pZCcsICdWb3RlQnlMaW5rJywgJ1JvdW5kcycsICdSZWdpc3RyYXRpb25zVm90ZUZhY3RvcicsICdFbmFibGVkJywgJ1Bob25lTnVtYmVyJywgJ0N1cnJlbnRSb3VuZCcsICdSZWdpc3RyYXRpb25zJywgJ0VtYWlsJ10pXG4gICAgICAgICAgLnBvcHVsYXRlKCdSZWdpc3RyYXRpb25zJylcbiAgICAgICAgICAucG9wdWxhdGUoJ1JvdW5kcy5Db250ZXN0YW50cy5Wb3RlcycpXG4gICAgICAgICAgLnBvcHVsYXRlKCdDdXJyZW50Um91bmQuQ29udGVzdGFudHMuRGV0YWlsJylcbiAgICAgICAgICAucG9wdWxhdGUoJ0N1cnJlbnRSb3VuZC5Db250ZXN0YW50cy5Wb3RlcycpLFxuICAgICAgICAgTG90TW9kZWwuY291bnREb2N1bWVudHMoe1xuICAgICAgICAgICAgJ0V2ZW50JzogcmVxLnBhcmFtcy5ldmVudElkLFxuICAgICAgICAgICAgJ1N0YXR1cyc6IDFcbiAgICAgICAgIH0pXSk7XG4gICAgICBjb25zdCBldmVudCA9IHJlc3VsdHNbMF07XG4gICAgICBjb25zdCBvcGVuQXVjdGlvbkNvdW50ID0gcmVzdWx0c1sxXTtcbiAgICAgIGlmICghZXZlbnQpIHtcbiAgICAgICAgIG5leHQoe1xuICAgICAgICAgICAgbWVzc2FnZTogJ0V2ZW50IG5vdCBmb3VuZCcsXG4gICAgICAgICAgICBzdGF0dXM6IDQwNFxuICAgICAgICAgfSk7XG4gICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoZXZlbnQgJiYgIWV2ZW50LlZvdGVCeUxpbmspIHtcbiAgICAgICAgIC8vIHZvdGluZyBieSBsaW5rIGRpc2FibGVkXG4gICAgICAgICBzZW5kUmVzcG9uc2UoJ2pzb24nLCByZXMsICdWT1RJTkdfV0VCX0RJU0FCTEVEJyk7XG4gICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBsZXQgZnJvbSA9ICcnO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBldmVudC5SZWdpc3RyYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICBpZiAoZXZlbnQuUmVnaXN0cmF0aW9uc1tpXS5faWQudG9TdHJpbmcoKSA9PT0gcmVxLnVzZXIuX2lkLnRvU3RyaW5nKCkpIHtcbiAgICAgICAgICAgIGZyb20gPSBldmVudC5SZWdpc3RyYXRpb25zW2ldLlBob25lTnVtYmVyIHx8IGV2ZW50LlJlZ2lzdHJhdGlvbnNbaV0uRW1haWw7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgIH1cbiAgICAgIH0gLy8gZnJvbSBjaGVjayBpcyBpbiBwcm9jZXNzVm90ZVxuXG4gICAgICBpZiAoZnJvbSkge1xuICAgICAgICAgcmV0dXJuIGF3YWl0IHByb2Nlc3NWb3RlKCdqc29uJywgdm90ZSwgZnJvbSwgZXZlbnQsIHJlcywgbG9nLCByb3VuZE51bWJlciwgb3BlbkF1Y3Rpb25Db3VudCwgJ29ubGluZScpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgICBsb2dnZXIuaW5mbyhyZXEudXNlciwgJyBpcyBub3QgcmVnaXN0ZXJlZCBpbiBldmVudCwgcmVnaXN0ZXJpbmcnKTtcbiAgICAgICAgIGF3YWl0IFJlZ2lzdGVyVm90ZXIocmVxLnVzZXIsIHJlcS5wYXJhbXMuZXZlbnRJZCwgdHJ1ZSwgMC4xLCB0cnVlLCByZXEudXNlci5faWQpO1xuICAgICAgICAgLy8gdXBkYXRlZCBldmVudCBhZnRlciByZWdpc3RyYXRpb25cbiAgICAgICAgIGNvbnN0IHVwZGF0ZWRFdmVudCA9IGF3YWl0IEV2ZW50TW9kZWwuZmluZE9uZSh7XG4gICAgICAgICAgICAnX2lkJzogcmVxLnBhcmFtcy5ldmVudElkLFxuICAgICAgICAgfSkuc2VsZWN0KFsnTmFtZScsICdfaWQnLCAnVm90ZUJ5TGluaycsICdSb3VuZHMnLCAnUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3InLCAnRW5hYmxlZCcsICdQaG9uZU51bWJlcicsICdDdXJyZW50Um91bmQnLCAnUmVnaXN0cmF0aW9ucycsICdFbWFpbCddKVxuICAgICAgICAgICAgIC5wb3B1bGF0ZSgnUmVnaXN0cmF0aW9ucycpO1xuICAgICAgICAgcmV0dXJuIGF3YWl0IHByb2Nlc3NWb3RlKCdqc29uJywgdm90ZSwgcmVxLnVzZXIuUGhvbmVOdW1iZXIgfHwgcmVxLnVzZXIuRW1haWwsIHVwZGF0ZWRFdmVudCwgcmVzLCBsb2csIHJvdW5kTnVtYmVyLCBvcGVuQXVjdGlvbkNvdW50LCAnb25saW5lJyk7XG4gICAgICB9XG4gICB9IGNhdGNoIChlKSB7XG4gICAgICBuZXh0KGUpO1xuICAgfVxuXG5cbn07XG5cbmV4cG9ydCBjb25zdCBnZXRFdmVudEd1ZXN0Q291bnQgPSBhc3luYyBmdW5jdGlvbiAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgIHRyeSB7XG4gICAgICBjb25zdCBkYXRhID0gcmVxLmJvZHk7XG4gICAgICBjb25zdCBldmVudElkcyA9IFtdO1xuICAgICAgY29uc3QgZXZlbnROYW1lczoge1xuICAgICAgICAgaWQ6IHN0cmluZztcbiAgICAgICAgIEVJRDogc3RyaW5nO1xuICAgICAgICAgdGl0bGU6IHN0cmluZztcbiAgICAgICAgIGV2ZW50SWQ6IHN0cmluZztcbiAgICAgICAgIEV2ZW50Tm86IG51bWJlcjtcbiAgICAgIH1bXSA9IGRhdGE7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXZlbnROYW1lcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgZXZlbnRJZHMucHVzaChldmVudE5hbWVzW2ldLmV2ZW50SWQpO1xuICAgICAgfVxuXG4gICAgICAvLyBjb25zb2xlLmxvZygnRXZlbnRzIExpc3QgPT09Pj4+Pj4nLCBldmVudExpc3QpO1xuICAgICAgY29uc3QgcXVlcnk6IHtcbiAgICAgICAgIF9pZD86IHskaW46IHN0cmluZ1tdfTtcbiAgICAgIH0gPSB7fTtcbiAgICAgIHF1ZXJ5Ll9pZCA9IHsgJGluOiBldmVudElkcyB9O1xuXG4gICAgICBjb25zdCBwcm9taXNlcyA9IFtdO1xuICAgICAgY29uc3QgcHJvbWlzZTEgPSBFdmVudE1vZGVsLmZpbmQocXVlcnkpLnNlbGVjdChbXG4gICAgICAgICAnTmFtZScsXG4gICAgICAgICAnUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3InXG4gICAgICBdKS5zb3J0KHtcbiAgICAgICAgICdFdmVudFN0YXJ0RGF0ZVRpbWUnOiAtMVxuICAgICAgfSkuZXhlYygpO1xuXG4gICAgICBwcm9taXNlcy5wdXNoKHByb21pc2UxKTtcbiAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG5cbiAgICAgIGNvbnN0IGFjdGl2ZUV2ZW50cyA9IHJlc3VsdHNbMF07XG4gICAgICBsZXQgdG90YWxHdWVzdENvdW50ID0gMDtcbiAgICAgIGxldCByZWdpc3RyYXRpb25JZHM6IHN0cmluZ1tdID0gW107XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFjdGl2ZUV2ZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgdG90YWxHdWVzdENvdW50ICs9IGFjdGl2ZUV2ZW50c1tpXS5SZWdpc3RyYXRpb25zVm90ZUZhY3Rvci5sZW5ndGg7XG4gICAgICAgICBjb25zdCByZWdpc3RyYXRpb25zRGF0YUxpc3QgPSBhY3RpdmVFdmVudHNbaV0uUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3I7XG4gICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlZ2lzdHJhdGlvbnNEYXRhTGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coJ1JlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yID09PT4+PicsIHJlZ2lzdHJhdGlvbnNEYXRhTGlzdFswXS5faWQpO1xuICAgICAgICAgICAgcmVnaXN0cmF0aW9uSWRzLnB1c2gocmVnaXN0cmF0aW9uc0RhdGFMaXN0W2ldLlJlZ2lzdHJhdGlvbklkLnRvU3RyaW5nKCkpO1xuICAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZWdpc3RyYXRpb25JZHMgPSBbLi4ubmV3IFNldChyZWdpc3RyYXRpb25JZHMpXTtcbiAgICAgIGNvbnN0IHJlc3Q6IGFueSA9IHtcbiAgICAgICAgICdTdWNjZXNzJzogdHJ1ZSxcbiAgICAgICAgICdndWVzdCc6IHJlZ2lzdHJhdGlvbklkcy5sZW5ndGgsXG4gICAgICAgICAncmVnaXN0ZXJhdGlvbklEcyc6IHJlZ2lzdHJhdGlvbklkc1xuICAgICAgfTtcbiAgICAgIHJlcy5qc29uKHJlc3QpO1xuICAgICAgcmV0dXJuO1xuXG4gICB9XG4gICBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcihlKTtcbiAgICAgIC8vIGxvZ2dlci5lcnJvcihgJHtlLm1lc3NhZ2V9ICR7ZS5zdGFja31gKTtcbiAgICAgIGNvbnN0IHJlc3VsdDogRGF0YU9wZXJhdGlvblJlc3VsdDxzdHJpbmc+ID0ge1xuICAgICAgICAgJ1N1Y2Nlc3MnOiBmYWxzZSxcbiAgICAgICAgIERhdGE6ICdJbnRlcm5hbCBTZXJ2ZXIgRXJyb3InXG4gICAgICB9O1xuICAgICAgcmVzLnN0YXR1cyg1MDApO1xuICAgICAgbmV4dChyZXN1bHQpO1xuICAgfVxufTtcblxuXG5leHBvcnQgY29uc3QgZ2V0RXZlbnRGaWx0ZXJHdWVzdENvdW50ID0gYXN5bmMgZnVuY3Rpb24gKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSB7XG4gICB0cnkge1xuICAgICAgY29uc3QgZGF0YSA9IHJlcS5ib2R5O1xuICAgICAgbGV0IHNtc1JlZyA9IHJlcS5ib2R5WydzbXMtcmVnJ107XG4gICAgICBjb25zdCBhcHBSZWcgPSByZXEuYm9keVsnYXBwLXJlZyddO1xuICAgICAgbGV0IHZvdGVDb3VudCA9IHJlcS5ib2R5Wyd2b3RlQ291bnQnXSB8fCAnMCc7XG4gICAgICB2b3RlQ291bnQgPSBwYXJzZUludCh2b3RlQ291bnQpO1xuICAgICAgaWYgKGlzTmFOKHZvdGVDb3VudCkpIHtcbiAgICAgICAgIHZvdGVDb3VudCA9IDA7XG4gICAgICB9XG4gICAgICBpZiAoIXNtc1JlZyAmJiAhYXBwUmVnKSB7XG4gICAgICAgICBzbXNSZWcgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBldmVudExpc3RzID0gW107XG4gICAgICBjb25zdCB0aW1lbG9ncyA9IGRhdGEudGltZWxvZ3M7XG4gICAgICBjb25zdCBldmVudERhdGEgPSBkYXRhLmRhdGE7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV2ZW50RGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgZXZlbnRMaXN0cy5wdXNoKG5ldyBPYmplY3RJZChldmVudERhdGFbaV0uaWQpKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgYmlkID0gcGFyc2VJbnQoZGF0YS5iaWRzKTtcbiAgICAgIGxldCByZXN1bHRzOiBhbnlbXSB8IEV2ZW50RG9jdW1lbnRbXSB8IHsgUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3I6IGFueTsgfVtdID0gW107XG5cbiAgICAgIGNvbnN0IHJlZ2lzdHJhdGlvbklkcyA9IFtdO1xuICAgICAgY29uc3QgcmVnaXN0cmF0aW9uSGFzaCA9IFtdO1xuXG5cbiAgICAgIGlmIChiaWQgPT0gMCkge1xuICAgICAgICAgY29uc3QgY29uZGl0aW9uID0ge307XG5cbiAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgIGNvbmRpdGlvbi5faWQgPSB7ICRpbjogZXZlbnRMaXN0cyB9O1xuICAgICAgICAgcmVzdWx0cyA9IGF3YWl0IEV2ZW50TW9kZWwuZmluZChjb25kaXRpb24pLnNlbGVjdChbXG4gICAgICAgICAgICAnTmFtZScsXG4gICAgICAgICAgICAnUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3InXG4gICAgICAgICBdKS5zb3J0KHtcbiAgICAgICAgICAgICdFdmVudFN0YXJ0RGF0ZVRpbWUnOiAtMVxuICAgICAgICAgfSkuZXhlYygpO1xuXG5cbiAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVzdWx0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcmVzdCA9IHJlc3VsdHNbaV0uUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3I7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHJlc3QubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgIGxldCBhbGxvd1JlZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgaWYgKHNtc1JlZyAmJiAocmVzdFtqXS5Gcm9tID09PSAnc21zJyB8fCAhcmVzdFtqXS5Gcm9tKSkge1xuICAgICAgICAgICAgICAgICAgLy8gdG8gaGFuZGxlIG9sZCBudW1iZXIgb3Igc21zIG51bWJlclxuICAgICAgICAgICAgICAgICAgYWxsb3dSZWcgPSB0cnVlO1xuICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgaWYgKGFwcFJlZyAmJiAocmVzdFtqXS5Gcm9tID09PSAnYXBwJyB8fCByZXN0W2pdLkZyb20gPT09ICdhcHAtZ2xvYmFsJykpIHtcbiAgICAgICAgICAgICAgICAgIGFsbG93UmVnID0gdHJ1ZTtcbiAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgIGlmIChhbGxvd1JlZykge1xuICAgICAgICAgICAgICAgICAgcmVnaXN0cmF0aW9uSWRzLnB1c2gocmVzdFtqXS5SZWdpc3RyYXRpb25JZCk7XG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICB9XG4gICAgICAgICByZXN1bHRzID0gW107XG5cbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKGJpZCA+IDApIHtcbiAgICAgICAgIGNvbnN0IGV2dERhdGEgPSBhd2FpdCBMb3RNb2RlbC5hZ2dyZWdhdGUoW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgJG1hdGNoOiB7XG4gICAgICAgICAgICAgICAgICAnQmlkcy5BbW91bnQnOiB7XG4gICAgICAgICAgICAgICAgICAgICAnJGd0ZSc6IGJpZFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICdFdmVudCc6IHtcbiAgICAgICAgICAgICAgICAgICAgICRpbjogZXZlbnRMaXN0c1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICRwcm9qZWN0OiB7XG4gICAgICAgICAgICAgICAgICBFdmVudDogJyRFdmVudCcsXG4gICAgICAgICAgICAgICAgICBsb3RJZDogJyRfaWQnLFxuICAgICAgICAgICAgICAgICAgQmlkczoge1xuICAgICAgICAgICAgICAgICAgICAgJGZpbHRlcjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXQ6ICckQmlkcycsXG4gICAgICAgICAgICAgICAgICAgICAgICBhczogJ2l0ZW0nLFxuICAgICAgICAgICAgICAgICAgICAgICAgY29uZDogeyAkZ3RlOiBbJyQkaXRlbS5BbW91bnQnLCBiaWRdIH1cbiAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICAgXSkuZXhlYygpO1xuXG5cbiAgICAgICAgIGxldCBiaWRDb3VudCA9IDA7XG5cbiAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXZ0RGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coJ0V2ZW50ID09PT4+PicsIGV2dERhdGFbaV0uRXZlbnQpO1xuICAgICAgICAgICAgY29uc3QgYmlkcyA9IGV2dERhdGFbaV0uQmlkcztcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdCaWQgQ291bnQgPT09Pj4+JywgYmlkcy5sZW5ndGgpO1xuICAgICAgICAgICAgYmlkQ291bnQgKz0gYmlkcy5sZW5ndGg7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGJpZHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdSZWdpcyA9PT0+PicsIGJpZHNbal0uUmVnaXN0cmF0aW9uKTtcbiAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbklkcy5wdXNoKGJpZHNbal0uUmVnaXN0cmF0aW9uKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBsZXQgcmVnaXN0cmF0aW9uSWRzVW5pcXVlID0gWy4uLiBuZXcgU2V0KHJlZ2lzdHJhdGlvbklkcyldO1xuICAgICAgaWYgKHZvdGVDb3VudCA+IDApIHtcbiAgICAgICAgIGNvbnN0IHJlZ2lzdHJhdGlvbkhhc2hPYmpzID0gYXdhaXQgUmVnaXN0cmF0aW9uTW9kZWwuZmluZCh7X2lkOiB7JyRpbic6IHJlZ2lzdHJhdGlvbklkc1VuaXF1ZX19KS5zZWxlY3QoWydIYXNoJ10pO1xuICAgICAgICAgcmVnaXN0cmF0aW9uSWRzVW5pcXVlID0gW107XG4gICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlZ2lzdHJhdGlvbkhhc2hPYmpzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICByZWdpc3RyYXRpb25IYXNoLnB1c2gocmVnaXN0cmF0aW9uSGFzaE9ianNbaV0uSGFzaCk7XG4gICAgICAgICB9XG4gICAgICAgICBpZiAocmVnaXN0cmF0aW9uSGFzaC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBsb2dzID0gYXdhaXQgVm90aW5nTG9nTW9kZWwuYWdncmVnYXRlKFtcbiAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICRtYXRjaDoge1xuICAgICAgICAgICAgICAgICAgICAgJ1Bob25lSGFzaCc6IHsnJGluJzogcmVnaXN0cmF0aW9uSGFzaH0sXG4gICAgICAgICAgICAgICAgICAgICAnU3RhdHVzJzogJ1ZPVEVfQUNDRVBURUQnLFxuICAgICAgICAgICAgICAgICAgICAgLy8gJ0V2ZW50SWQnOiB7JyRpbic6IGRhdGEuZGF0YX1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAkZ3JvdXA6IHtcbiAgICAgICAgICAgICAgICAgICAgICdfaWQnOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAnUGhvbmVIYXNoJzogJyRQaG9uZUhhc2gnXG4gICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICAgJ3ZvdGVDb3VudCc6IHsgJHN1bTogMSB9XG4gICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAkbWF0Y2g6IHtcbiAgICAgICAgICAgICAgICAgICAgICd2b3RlQ291bnQnOiB7JyRndGUnOiB2b3RlQ291bnR9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgJGxvb2t1cDoge1xuICAgICAgICAgICAgICAgICAgICAgZnJvbTogJ3JlZ2lzdHJhdGlvbnMnLFxuICAgICAgICAgICAgICAgICAgICAgbG9jYWxGaWVsZDogJ19pZC5QaG9uZUhhc2gnLFxuICAgICAgICAgICAgICAgICAgICAgZm9yZWlnbkZpZWxkOiAnSGFzaCcsXG4gICAgICAgICAgICAgICAgICAgICBhczogJ3JlZ2lzdHJhdGlvbidcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF0pLmFsbG93RGlza1VzZSh0cnVlKS5leGVjKCk7XG4gICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IGxvZ3MubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgICAgIGNvbnN0IGxvZyA9IGxvZ3Nba107XG4gICAgICAgICAgICAgICBpZiAobG9nLnJlZ2lzdHJhdGlvbiAmJiBsb2cucmVnaXN0cmF0aW9uWzBdKSB7XG4gICAgICAgICAgICAgICAgICByZWdpc3RyYXRpb25JZHNVbmlxdWUucHVzaChsb2cucmVnaXN0cmF0aW9uWzBdLl9pZCk7XG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBjb25zb2xlLmxvZygncmVnaXN0cmF0aW9uSWRzVW5pcXVlID09PT4+Pj4nLCBKU09OLnN0cmluZ2lmeShyZWdpc3RyYXRpb25JZHNVbmlxdWUpKTtcbi8vIGNvbnNvbGUubG9nKCdDdXJlbnQgPT0+Pj4nLCAocGFyc2VJbnQodGltZWxvZ3MpICogNjAgKiA2MCAqIDEwMDApKTtcbiAgICAgIC8vIGNvbnNvbGUubG9nKCd0aW1lbG9ncyA9PT0+Pj4+PicsIG5ldyBEYXRlKERhdGUubm93KCkgLSAoKHBhcnNlSW50KHRpbWVsb2dzKSAqIDYwICogNjAgKiAxMDAwKSkpKTtcblxuXG4gICAgICAvLyBjb25kaXRpb24uY3JlYXRlZEF0ID0geyAkZ3Q6IG5ldyBEYXRlKERhdGUubm93KCkgLSAxICogNjAgKiA2MCAqIDEwMDApIH07XG4gICAgICBjb25zdCBxdWVyeToge1xuICAgICAgICAgX2lkOiB7XG4gICAgICAgICAgICAkaW46IHN0cmluZ1tdO1xuICAgICAgICAgfTtcbiAgICAgICAgIGxhc3RQcm9tb1NlbnRBdD86IHskbHQ6IERhdGV9O1xuICAgICAgfSA9IHtcbiAgICAgICAgIF9pZDoge1xuICAgICAgICAgICAgJGluOiByZWdpc3RyYXRpb25JZHNVbmlxdWVcbiAgICAgICAgIH0sXG4gICAgICB9O1xuICAgICAgaWYgKCFpc05hTihwYXJzZUludCh0aW1lbG9ncykpICYmIHBhcnNlSW50KHRpbWVsb2dzKSAhPT0gMCkge1xuICAgICAgICAgcXVlcnkubGFzdFByb21vU2VudEF0ICA9IHtcbiAgICAgICAgICAgICRsdDogbmV3IERhdGUoRGF0ZS5ub3coKSAtIChwYXJzZUludCh0aW1lbG9ncykgKiA2MCAqIDYwICogMTAwMCkpXG4gICAgICAgICB9O1xuICAgICAgfVxuICAgICAgY29uc3QgcmVnaXN0cmF0aW9ucyA9IGF3YWl0IFJlZ2lzdHJhdGlvbk1vZGVsLmZpbmQocXVlcnkpLnNlbGVjdChbXG4gICAgICAgICAnX2lkJ1xuICAgICAgXSk7XG4gICAgICBsb2dnZXIuaW5mbyhgcXVlcnkgJHtKU09OLnN0cmluZ2lmeShxdWVyeSl9YCk7XG4gICAgICBsb2dnZXIuaW5mbyhgZmlsdGVyZWQgcmVnaXN0cmF0aW9ucyAke0pTT04uc3RyaW5naWZ5KHJlZ2lzdHJhdGlvbnMpfWApO1xuXG4gICAgICBjb25zdCBwcm9tb3Rpb25Mb2dzUmVnSURzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZWdpc3RyYXRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICBwcm9tb3Rpb25Mb2dzUmVnSURzLnB1c2gocmVnaXN0cmF0aW9uc1tpXS5faWQpO1xuICAgICAgfVxuICAgICAgLy8gY29uc29sZS5sb2coJ3Byb21vdGlvbkxvZ3NEYXRhID09PT4+Pj4nLCBwcm9tb3Rpb25Mb2dzRGF0YSk7XG5cbiAgICAgIC8vIGNvbnNvbGUubG9nKHJlZ2lzdHJhdGlvbklkc1VuaXF1ZS5sZW5ndGggKyAnID09PT4+PicgKyBwcm9tb3Rpb25Mb2dzUmVnSURzLmxlbmd0aCk7XG5cblxuICAgICAgLy8gcmVnaXN0cmF0aW9uSWRzID0gcmVnaXN0cmF0aW9uSWRzLmNvbmNhdChwcm9tb3Rpb25Mb2dzUmVnSURzKTtcblxuICAgICAgLy8gY29uc29sZS5sb2coJ2ZpbmFsUmVnaXN0cmF0aW9uSWRzVW5pcXVlID09PT4+Pj4nLCBmaW5hbFJlZ2lzdHJhdGlvbklkc1VuaXF1ZSk7IClcblxuICAgICAgY29uc3QgcmVzdDogYW55ID0ge1xuICAgICAgICAgJ1N1Y2Nlc3MnOiB0cnVlLFxuICAgICAgICAgJ2d1ZXN0JzogcmVzdWx0cyxcbiAgICAgICAgICdndWVzdGNvdW50JzogcHJvbW90aW9uTG9nc1JlZ0lEcy5sZW5ndGgsXG4gICAgICAgICAncmVnaXN0cmF0aW9uaWRzJzogcHJvbW90aW9uTG9nc1JlZ0lEc1xuICAgICAgfTtcbiAgICAgIHJlcy5qc29uKHJlc3QpO1xuICAgICAgcmV0dXJuO1xuXG4gICB9XG4gICBjYXRjaCAoZSkge1xuICAgICAgbG9nZ2VyLmVycm9yKGUpO1xuICAgICAgcmVzLnN0YXR1cyg1MDApO1xuICAgICAgbmV4dChlKTtcbiAgIH1cblxufTtcblxuZXhwb3J0IGNvbnN0IHJhbmRvbVZvdGVVcmwgPSBhc3luYyBmdW5jdGlvbiAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgIGNvbnN0IG9mZnNldCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDUwMDApICsgMTsgLy8gYmV0d2VlbiAxIGFuZCA1MDAwXG4gICBjb25zdCByZWdMb2cgPSBhd2FpdCBSZWdpc3RyYXRpb25Mb2dNb2RlbC5maW5kT25lKCkuc29ydCh7XG4gICAgICBfaWQ6IC0xXG4gICB9KS5za2lwKG9mZnNldCk7XG4gICBpZiAocmVnTG9nICYmIHJlZ0xvZy5Wb3RlVXJsKSB7XG4gICAgICByZXMucmVkaXJlY3QoMzAyLCBgJHtwcm9jZXNzLmVudi5TSVRFX1VSTH0vJHtyZWdMb2cuVm90ZVVybC50b1N0cmluZygpfWApO1xuICAgfSBlbHNlIHtcbiAgICAgIG5leHQoe1xuICAgICAgICAgbWVzc2FnZTogJ3VuYWJsZSB0byBmaW5kIHRoZSB2b3RlIHVybCdcbiAgICAgIH0pO1xuICAgfVxufTsiXX0=
