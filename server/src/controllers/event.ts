import { NextFunction, Request, Response } from 'express';
// @ts-ignore
import { formatToTimeZone, parseFromTimeZone } from 'date-fns-timezone';
// @ts-ignore
import { differenceInMilliseconds, distanceInWordsStrict } from 'date-fns';

import { default as EventModel, EventDocument } from '../models/Event';
import { EventDTO, EventHomeDto, RoundHomeDto, Series } from '../../../shared/EventDTO';
import { DataOperationResult, OperationResult } from '../../../shared/OperationResult';
import * as Twilio from 'twilio';
import { default as User, UserDocument } from '../models/User';
import { default as VotingLogModel, VotingLogDocument } from '../models/VotingLog';
import RegistrationLogModel, { RegistrationLogDocument } from '../models/RegistrationLog';
// Slack HTTPS call
import postToSlack, { postToSlackSMSFlood } from '../common/Slack';
import RoundDTO from '../../../shared/RoundDTO';
import { getEventForForm, getEventForSMS, processVote, sendResponse } from '../common/voteProcessor';
import AnnouncementModel from '../models/Announcement';
import EventPhoneNumberModel, { EventPhoneNumberDocument } from '../models/EventPhoneNumber';
import TimezoneModel from '../models/Timezone';
import { EventList, EventsInterface } from '../../../shared/EventListResponseDTO';
import sendNotification from '../common/Apns';
import artistWiseImages from '../common/ArtistWiseImages';
import ArtistImageDto, { RoundArtistsInterface } from '../../../shared/ArtistImageDTO';
import RegistrationDTO from '../../../shared/RegistrationDTO';
import RegistrationModel from '../models/Registration';
import RoundContestantDTO from '../../../shared/RoundContestantDTO';
import PreferenceModel, { PreferenceDocument } from '../models/Preference';
import { EventStatDTO } from '../../../shared/EventStatDTO';
import logger from '../config/logger';
import { RegisterVoter } from '../common/RegistrationProcessor';
import LotModel from '../models/Lot';
import { MultiCastIgnoreErr } from '../common/FCM';
import { EventIncrementRound } from '../common/eventRoundIncrement';
import { ObjectId } from 'bson';

import { sign } from 'jsonwebtoken';
import MediaModel from '../models/Media';
import * as sharp from 'sharp';
import * as fs from 'fs-extra';
import { processMessage } from '../common/messageProcessor';
import { StateVoteFactorMap } from '../common/States';


export async function getAnnounce(req: Request, res: Response) {
   const event = await EventModel.findById(req.params.eventId).populate('Registrations');
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
      } else if (voteFactors[i].From === 'app' || voteFactors[i].From === 'app-global') {
         appVotersCount++;
      }
   }
   const globalAppVotersCount = await RegistrationModel.countDocuments({ 'DeviceTokens': { $exists: true, $ne: [] } });
   announcementOptions[0].label += ` (${smsVotersCount})`;
   announcementOptions[1].label += ` (${appVotersCount})`;
   announcementOptions[2].label += ` (${globalAppVotersCount})`;
   const topAnnouncements = await AnnouncementModel.find({ firedTimes: { '$gt': 1 } }).sort({ firedTimes: -1 }).limit(10);
   res.render('announce', {
      title: 'Announcement',
      EventName: event.Name,
      EventId: event._id,
      topAnnouncements: topAnnouncements,
      options: announcementOptions
   });
}

export const announce = async (req: Request, res: Response, next: NextFunction) => {
   logger.info(`announce() called at ${new Date().toISOString()}`, req.body);
   const message = req.body['Message'] && req.body['Message'].trim();
   const smsVote = req.body['sms-voters'] && req.body['sms-voters'].trim() === 'on';
   const appVote = req.body['app-voters'] && req.body['app-voters'].trim() === 'on';
   const appGlobalVote = req.body['global-app-voters'] && req.body['global-app-voters'].trim() === 'on';
   let globalRegistrations: RegistrationDTO[] = [];
   if (appGlobalVote) {
      // Fetch all registrant with device token
      globalRegistrations = await RegistrationModel.find({ 'DeviceTokens': { $exists: true, $ne: [] } });
   }
   // logger.debug(`appVote ${appVote}, smsVote ${smsVote}, appGlobalVote ${appGlobalVote}`);
   try {
      const event = await EventModel
          .findById(req.params.eventId)
          .populate('Registrations');
      if (!event.PhoneNumber) {
         req.flash('failure', { msg: 'Failed! Server Phonenumber is missing in event Setting, please define it.' });
         res.redirect(`${process.env.ADMIN_URL}/event/${req.params.eventId}/results`);
         return;
      }
      const preferences = await PreferenceModel.find();
      const preferenceMap: {
         [key: string]: PreferenceDocument
      } = {};
      for (let i = 0; i < preferences.length; i++) {
         preferenceMap[preferences[i]._id] = preferences[i];
      }

      const twilioClient = Twilio();
      const RegistrantTokens: {
         [key: string]: String[]
      } = {};
      const RegistrantAndroidTokens: {
         [key: string]: string[]
      } = {};
      const RegistrationsById: {
         [key: string]: RegistrationDTO
      } = {};
      const RegistrationChannels: {
         [key: string]: string
      } = {};
      event.RegistrationsVoteFactor.forEach(registrant => {
         // old event don't have From in registrants
         RegistrationChannels[registrant.RegistrationId.toString()] = (registrant.From || 'sms');
      });
      const isSmsAndAppBothChecked = (smsVote && (appVote || appGlobalVote));
      event.Registrations.forEach(registrant => {
         if ((smsVote && (RegistrationChannels[registrant._id] === 'sms')) || (smsVote && RegistrationChannels[registrant._id] !== 'sms' && !isSmsAndAppBothChecked)) {
            // if sms and app both are checked then sms should not be sent to a app number
            logger.info(`Sending message: ${message} From: ${event.PhoneNumber} To: ${registrant.PhoneNumber}`);
            twilioClient.messages.create({
               from: event.PhoneNumber,
               to: registrant.PhoneNumber,
               body: message
            }).then((res) => {
               logger.info(`sent message: ${message} From: ${event.PhoneNumber} To: ${registrant.PhoneNumber}, SID: ${res.sid}`);
               postToSlackSMSFlood({
                  'text': `${registrant.NickName}(${registrant.PhoneNumber}) (sms) \n${message} source: event.ts.announce`
               }).catch(() => logger.error(`auction slack flood call failed ${ message } source: event.ts.announce`));
            }).catch(e => {
               logger.error(`Failed Message: ${message} From: ${event.PhoneNumber} To: ${registrant.PhoneNumber}, ${e}`);
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
      const user: UserDocument = await User.findById(req.user.id);
      const slackMessage = `${event.Name} announcement made by ${user && user.email}.\nMessage: ${message}`;
      postToSlack({
         'text': slackMessage
      }).catch(() => logger.info('event announcement slack call failed ', message));

      // send push notifications
      const deviceTokens: String[] = [];
      const androidTokens: string[] = [];
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
         const badDeviceTokens = await sendNotification(deviceTokens, message, event.Name).catch(e => logger.info(`push notification failed`, e));
         try {
            // handle bad device tokens
            const toBeCorrectedRegs: {
               [key: string]: RegistrationDTO
            } = {};
            if (Array.isArray(badDeviceTokens)) {
               const registrationIds = Object.keys(RegistrantTokens);
               for (let i = 0; i < badDeviceTokens.length; i++) {
                  const badToken = badDeviceTokens[i].device;
                  for (let j = 0; j < registrationIds.length; j++) {
                     const indexOfBadToken = RegistrantTokens[registrationIds[j]].indexOf(badToken);
                     if (indexOfBadToken > - 1) {
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
               promises.push(RegistrationModel.findByIdAndUpdate(toBeCorrectedRegIds[i], {
                  '$set': {
                     'DeviceTokens': toBeCorrectedRegs[toBeCorrectedRegIds[i]].DeviceTokens
                  }
               }).exec);
            }
            await Promise.all(promises);
         } catch (e) {
            logger.info(e);
         }
      }
      if (androidTokens.length > 0) {
         const androidPushRes = await MultiCastIgnoreErr({
            DeviceTokens: androidTokens,
            link: undefined,
            title: event.Name,
            message: message,
            priority: 'normal',
            analyticsLabel: `announce-push ${event.EID}`
         });
         logger.info(`androidPushRes ${JSON.stringify(androidPushRes)}`);
      }
      event.Logs.push({
         Message: slackMessage,
         CreatedDate: new Date()
      });
      event.save().catch(e => logger.info('Unable to store log message of slack related to announcement', e));

      let announcement = await AnnouncementModel.findOne({ message: message });
      if (!announcement) {
         announcement = new AnnouncementModel();
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

   } catch (err) {
      logger.info(err);
      return next(err);
   }

};


export const voteSMS = async (req: Request, res: Response, next: NextFunction) => {
   try {
      res.header('Content-Type', 'text/xml');
      logger.info('original from', req.params.From, 'Original to', req.params.To);
      const log = new VotingLogModel();
      let body = req.param('Body').trim();
      // the number the vote it being sent to (this should match an Event)
      const to = '+' + req.param('To').slice(1);
      // log.EaselNumber = body;
      // the voter, use this to keep people from voting more than once
      const from = '+' + req.param('From').replace(/\D/g, '');
      const event = await getEventForSMS(to, res, next, log);
      logger.info('debug: body', body, to, from);
      const lowerCasedBody = body.toLowerCase().trim();
      if (lowerCasedBody.startsWith('easel')) {
         // handle wrong spelling
         body = `${parseInt(lowerCasedBody.replace('easel', ''))}`;
      } else if (lowerCasedBody === 'vote' && (event && event.RegisterAtSMSVote)) {
         return await RegisterVoter({
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
         }, event._id, false, StateVoteFactorMap[8], true);
      }
      if (!isNaN(parseInt(body))) {
         return await processVote('xml', body, from, event, res, log, 0, 0, 'phone');
      } else {
         return await processMessage(req.param('Body'), from, to, res);
      }
   }
   catch (e) {
      logger.info(`Error in voteSMS ${e.stack} Body: ${req.param('Body')}, From: ${req.param('From')}, To: ${req.param('To')}`);
      res.send('<Response><Sms>Sorry! Our system encountered an error. Please try again.</Sms></Response>');
   }
};

export const saveEvent = async (req: Request, res: Response, next: NextFunction) => {
   const dto: EventDTO = req.body;
   logger.info(`Saving event: ${dto.Name}`);
   const cacheKey = `app-event-list-`;
   const cacheDel = req.app.get('cacheDel');
   const cacheDelPromises: any[] = [];
   cacheDelPromises.push(cacheDel(cacheKey));
   const preDeterminedId = new ObjectId().toHexString();
   let savedEvent: EventDocument;
   try {
      if (!dto.EID) {
         throw 'EID is required';
      }
      if (dto.SponsorLogo && dto.SponsorLogo.Url.length > 0) {
         const media = new MediaModel();
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
      } else {
         dto.SponsorLogo = undefined;
      }
      const user: UserDocument = await User.findById(req.user.id);
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
      const queryObj: {
         PhoneNumber: String,
         Enabled: Boolean,
         _id: any
      } = {
         PhoneNumber: dto.PhoneNumber,
         Enabled: true,
         _id: undefined
      };
      const eidQueryObj: {
         EID: string;
         _id?: any;
      } = {
         EID: dto.EID,
      };
      if (dto._id) {
         queryObj._id = {
            '$ne': dto._id
         };
         eidQueryObj._id = {
            '$ne': dto._id
         };
      } else {
         dto._id = preDeterminedId;
      }
      const tasks: any[] = [
         EventModel.find(queryObj).countDocuments(),
         EventModel
             .findById(dto._id)
             .exec(),
          EventModel.countDocuments(eidQueryObj)
      ];
      if (dto.TimeZone) {
         tasks.push(TimezoneModel.findById(dto.TimeZone));
      }

      const combinedData = await Promise.all(tasks);
      let event: EventDocument = combinedData[1];
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
                  const lot =  await LotModel.findOne({ArtId: artId});
                  if (!lot) {
                     // link lot on rounds.contestants
                     const lotModel = new LotModel();
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
                  } else {
                     r.Contestants[i].Lot = lot;
                     // if the contestant is changed then reflect it.
                     lot.Contestant = r.Contestants[i].Detail._id;
                     lot.ArtistId = r.Contestants[i].Detail.EntryId;
                     await lot.save();
                  }
               } else {
                  logger.info(`lot exists ${r.Contestants[i].Lot}`);
               }
            }
         }
      }

      /* In db GMT date */
      dto.TimeZoneICANN = combinedData[3] && combinedData[3].icann_name;
      const startDate = parseFromTimeZone(dto.EventStartDateTime, 'M/D/Y HH:mm A', { timeZone: dto.TimeZoneICANN });
      const endDate = parseFromTimeZone(dto.EventEndDateTime, 'M/D/Y HH:mm A', { timeZone: dto.TimeZoneICANN });
      dto.EventStartDateTime = startDate.toISOString();
      dto.EventEndDateTime = endDate.toISOString();
      /* In db GMT date end */
      if (!event) {
         const eventDTO: EventDTO = dto as EventDTO;
         eventDTO.Rounds = eventDTO.Rounds.map(r => {
                r.IsFinished = false;
                return r;
             }
         );
         event = new EventModel(eventDTO);
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
         const result: DataOperationResult<EventDTO> = {
            Success: true,
            Data: savedEvent
         };
         res.json(result);

         // After sending response send message to slack channel
         postToSlack({
            'text': message
         }).catch(() => logger.info('event create slack call failed ', message));

      } else {
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
         const result: DataOperationResult<EventDTO> = {
            Success: true,
            Data: savedEvent
         };
         res.json(result);
         // Delete cache
         cacheDelPromises.push(cacheDel(`${cacheKey}${savedEvent._id}`));

         postToSlack({
            'text': message
         }).catch(() => logger.info('event edit slack call failed ', message));
      }
      logger.info(`removing auction details/event-list cache`);
      await Promise.all(cacheDelPromises);
      logger.info(`removed auction details/event-list cache`);
   }
   catch (e) {
      if (typeof e === 'string') {
         logger.error(e);
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
         logger.error(e);
         e = {
            status: 403,
         };
         e.message = 'Server error occurred!';
      }
      e.Message = e.message;
      return next(e);
   }
};

async function _upload(rawImage: string, originalPath: string): Promise<{
   main: string,
   mainStart: Date,
   mainEnd: Date,
   mainHeight: number,
   mainWidth: number,
   mainSize: number,
   mainFile: string,
}> {
   const base64Data = rawImage.replace(/^data:image\/([\w+]+);base64/, '');
   const filePath: string = `${__dirname}/../public/uploads/images/sponsors/${originalPath}`;
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

async function _writeFile(filePath: string, binary: Buffer) {
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
export const archiveEvent = async (req: Request, res: Response, next: NextFunction) => {
   const event = await EventModel.findById(req.params.eventId);

   event.Enabled = false;

   await event.save();

   const result: OperationResult = {
      Success: true
   };

   res.json(result);
};

export const getEvents = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const user: UserDocument = await User.findById(req.user.id);
      const eventIds = req.user.eventIds;
      logger.info(`eventList is event admin ${req.user.IsEventAdmin}, allowed event ids ${JSON.stringify(req.user.eventIds || [])}, is guest ${req.user.IsGuestUser} dont have password ${!req.user.password}`);
      if (
          (!req.user.password && !req.user.IsGuestUser) ||
          (req.user.IsGuestUser && !req.user.IsEventAdmin) ||
          (req.user.IsGuestUser && req.user.IsEventAdmin && req.user.eventIds && req.user.eventIds.length === 0)
      ) {
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
      let query = EventModel.find(condition)
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
      const events: EventDocument[] = await query.exec();

      const filterRoundFn = (roundObj: RoundDTO) => {
         return {
            IsFinished: roundObj.IsFinished,
            RoundNumber: roundObj.RoundNumber
         };
      };

      const filteredEvents = []; // Reduce Payload size
      for (let i = 0; i < events.length; i++) {
         const filteredEventObj: EventHomeDto = {
            _id: events[i]._id,
            Name: events[i].Name,
            PhoneNumber: events[i].PhoneNumber,
            Enabled: events[i].Enabled,
            Rounds: [],
            CurrentRound: events[i].CurrentRound ? filterRoundFn(events[i].CurrentRound) : null,
            countryFlag: events[i].Country && events[i].Country.country_image
         };
         const filteredRounds: RoundHomeDto[] = [];

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

export const getEvent = async (req: Request, res: Response, next: NextFunction) => {
   let event: EventDocument;
   interface Body {
      ReportLinks: (
          {
             link: string;
             label: string
          })[];
      PhoneNumbers: EventPhoneNumberDocument[];
   }
   const body: Body = {
      ReportLinks: [],
      PhoneNumbers: await EventPhoneNumberModel.find({
         type: 'vote',
         status: 1
      })
   };
   try {
      const user: UserDocument = await User.findById(req.user.id);
      event = await EventModel
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
         eventObj.EventStartDateTime = formatToTimeZone(new Date(event.EventStartDateTime), 'MM/DD/YYYY hh:mm A', { timeZone: event.TimeZoneICANN }).toString();
         eventObj.EventEndDateTime = formatToTimeZone(new Date(event.EventEndDateTime), 'MM/DD/YYYY hh:mm A', { timeZone: event.TimeZoneICANN });
         eventObj.AuctionCloseStartsAt = formatToTimeZone(new Date(event.AuctionCloseStartsAt), 'MM/DD/YYYY hh:mm A', { timeZone: event.TimeZoneICANN }).toString();
         logger.info(eventObj.EventStartDateTime, eventObj.TimeZoneICANN);

         res.json({ ...body, ...eventObj });
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
export const incrementRound = async (req: Request, res: Response, next: NextFunction) => {
   try {
      res.json(await EventIncrementRound(req, req.params.eventId, req.user.id));
   } catch (e) {
      return next(e);
   }
};

/**
 * Download Voter logs
 * @param req
 * @param res
 * @param next
 */
export const voterLogs = async (req: Request, res: Response, next: NextFunction) => {
   const eventId = req.params.eventId;
   res.setHeader('Content-disposition', `attachment; filename=voterLogs_${eventId}.csv`);
   res.writeHead(200, {
      'Content-Type': 'text/csv'
   });
   res.write(`"EventId","EventName","EaselNumber","RoundNumber","Status","ArtistName","PhoneNumber","createdAtUnix","createdAt"\n`);
   VotingLogModel.find({
      EventId: req.params.eventId
   }).cursor({
      transform: (doc: VotingLogDocument) => {
         return `"${doc.EventId}","${doc.EventName}","${doc.EaselNumber}","${doc.RoundNumber}","${doc.Status}","${doc.ArtistName}","${doc.PhoneNumber}","${new Date(doc.createdAt).getTime()}","${formatToTimeZone(
             new Date(doc.createdAt),
             'MM/DD/YYYY hh:mm:ss',
             {
                timeZone: 'America/Los_Angeles'
             }
         )}"\n`;
      }
   }).pipe(res);
};

/**
 * Download Registration Logs
 * @param req
 * @param res
 * @param next
 */
export const registrationLogs = async (req: Request, res: Response, next: NextFunction) => {
   const eventId = req.params.eventId;
   res.setHeader('Content-disposition', `attachment; filename=registrationLogs_${eventId}.csv`);
   res.writeHead(200, {
      'Content-Type': 'text/csv'
   });
   res.write(`"PhoneNumber","NumberExists","EventId","EventName","AlreadyRegisteredForEvent","Email","FirstName","LastName","createdAtUnix","createdAt"\n`);
   RegistrationLogModel.find({
      EventId: req.params.eventId
   }).cursor({
      transform: (doc: RegistrationLogDocument) => {
         return `"${doc.PhoneNumber}","${doc.NumberExists}","${doc.EventId}","${doc.EventName}","${doc.AlreadyRegisteredForEvent}","${doc.Email}","${doc.FirstName}","${doc.LastName}","${new Date(doc.createdAt).getTime()}","${formatToTimeZone(
             new Date(doc.createdAt),
             'MM/DD/YYYY hh:mm:ss',
             {
                timeZone: 'America/Los_Angeles'
             }
         )}"\n`;
      }
   }).pipe(res);
};

/**
 * Time series of registration done for a event and Voting for contestants per round
 * @param req
 * @param res
 * @param next
 */
export const voteRegistrationsSeries = async (req: Request, res: Response, next: NextFunction) => {
   const event = await EventModel.findById(req.params.eventId).select('Contestants').populate('Contestants');
   const contestantsCount = event && event.Contestants.length;

   try {
      const results = await Promise.all([
         RegistrationLogModel.aggregate([
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
         VotingLogModel.aggregate([
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
      const series: Series[] = [];
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
export const voteRoundSeries = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const results = await VotingLogModel.aggregate([
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

      const votingSeriesMap: String[] = [];
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

export const voteLink = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const voteHash = req.params.voteHash;
      const eventDoc = await EventModel.findOne({
         'RegistrationsVoteFactor.VoteUrl': `/v/${voteHash}`,
      })
          .select(['Name', 'Description', '_id', 'VoteByLink', 'Rounds', 'CurrentRound', 'RegistrationsVoteFactor', 'Contestants', 'Images', 'EnableAuction', 'EID', 'AdminControlInAuctionPage'])
          .populate('Rounds.Contestants.Detail')
          .populate('Country');
      if (!eventDoc) {
         return next(new Error('Invalid link'));
      }
      const openAuctionCount = await LotModel.countDocuments({
         'Event': eventDoc._id,
         'Status': 1
      });
      const userAgentHeader = req.header('user-agent');
      const isIos = userAgentHeader.indexOf('Battle') > -1;
      const isAndroid = userAgentHeader.indexOf('okhttp') > -1;
      const isWeb = !( isAndroid || isIos);

      const totalRounds = eventDoc.Rounds.length;
      const currentRound = eventDoc.CurrentRound;
      let currentRoundNumber = currentRound && currentRound.RoundNumber;
      let currentRoundIndex: number;
      const roundWiseImages = [];
      for (let j = 0; j < totalRounds; j++) {
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
      const registrationObj = eventDoc.RegistrationsVoteFactor.find((reg: any) => {
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
      const votesCount = await VotingLogModel.countDocuments({
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

export const handleVoteForm = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const roundNumber = req.params.RoundNumber;
      const log = new VotingLogModel();
      const vote = req.params.text;
      const hash = req.params.urlHash;
      const event = await getEventForForm(res, hash, next, log);
      let from = '';
      for (let i = 0; i < event.RegistrationsVoteFactor.length; i++) {
         if (event.RegistrationsVoteFactor[i].VoteUrl === `/v/${hash}`) {
            from = event.RegistrationsVoteFactor[i].PhoneNumber || event.RegistrationsVoteFactor[i].Email;
            break;
         }
      } // from check is in processVote

      if (event && !event.VoteByLink) {
         // voting by link disabled
         sendResponse('json', res, 'VOTING_WEB_DISABLED');
      }
      if (from) {
         return await processVote('json', vote, from, event, res, log, roundNumber, 0, 'online');
      }
      else {
         next({
            message: 'Something went wrong',
            status: 500
         });
         return;
      }
   } catch (e) {
      next(e);
   }
};

/**
 * Bar chart that shows vote source (web-new exp-sms etc) per round.
 * @param req
 * @param res
 * @param next
 */
export const voteBarGraph = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const results = await Promise.all([
         VotingLogModel.aggregate([
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
         VotingLogModel.aggregate([
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

      const series: {
         name: string,
         data: number[],
         color: string
      }[] = [];
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

      const rounds: string[] = [];

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

export const eventListHtml = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const authHeader = req.header('Authorization');
      let token = authHeader && authHeader.replace('Bearer ', '');
      let selectedEvent: EventDTO;
      let userStatus: string = '';
      let phoneHash: string = '';
      const voteHash = req.params.voteHash;
      if (voteHash) {
         selectedEvent = await EventModel.findOne({
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
               req.user = await RegistrationModel.findById(regId);
               break;
            }
         }
         if (req.user) {
            token = sign({
               registrationId: req.user._id
            }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXP_TIME || '1y' });
         }
      }
      if (req.user) {
         // set cookie only for those who opened in browser.
         // dup token calculation because we are targeting cookie based req.user here
         token = sign({
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
   } catch (e) {
      next(e);
   }
};

export const eventList = async (req: Request, res: Response, next: NextFunction) => {
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
      logger.info(`serving event list from cache ${cacheKey}`);
      res.json(JSON.parse(activeEventsJson));
      return ;
   }
   const query: {
      ShowInApp?: boolean;
      _id?: any;
   } = {};
   if (eventId && eventId.length > 0) {
      query._id = eventId;
   } else {
      query.ShowInApp = true;
   }
   const promises: any[] = [];
   const promise1 = EventModel.find(query).select([
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


   const activeEventsList: EventsInterface[] = [];
   const eventIds = [];
   const eventStrIds = [];
   let topPlayerUrl: string;
   for (let i = 0; i < activeEvents.length; i++) {
      const event = activeEvents[i];
      const currentRound = event.CurrentRound;
      const currentRoundNumber = currentRound && currentRound.RoundNumber;
      let winnerImage: ArtistImageDto;
      let winnerName: string;
      let winnerId: string;
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
      } else {
         if (hasOpenRound) {
            const eventDate = new Date(event.EventStartDateTime);
            const differenceInMs = differenceInMilliseconds(eventDate, new Date());
            const distanceInWord = distanceInWordsStrict(eventDate, new Date());
            if (differenceInMs > 0) {
               roundText = `In ${distanceInWord}`;
               roundColor = '#1975D1';
               roundText = roundText.replace('days', 'd');
               roundText = roundText.replace('seconds', 's');
               roundText = roundText.replace('hours', 'h');
               roundText = roundText.replace('minutes', 'm');
               roundText = roundText.replace('months', 'mo');
               roundText = roundText.replace('years', 'y');
            } else {
               roundText = `Starting soon`;
               roundColor = '#1975D1';
            }
         } else {
            roundText = 'FINAL';
            roundColor = '#FFF';
            statusTextColor = '#000';
         }
      }
      eventIds.push(event._id);
      eventStrIds.push(event._id.toString());
      let streamUrl: string;
      const currentTime = new Date().getTime();
      const startTime = new Date(event.EventStartDateTime).getTime();
      const endTime = new Date(event.EventEndDateTime).getTime();
      if ((currentTime > startTime && currentTime < endTime) && event.LiveStream) {
         streamUrl = event.LiveStream;
         if (!topPlayerUrl) {
            topPlayerUrl = streamUrl;
         }
      } else {
         streamUrl = event.VideoStream;
      }
      const eventObj: EventsInterface = {
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
         DataTimeRange: formatToTimeZone(new Date(event.EventStartDateTime), 'MMMMDo-hmmaz', { timeZone: event.TimeZoneICANN || 'America/Toronto' }),
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

   const eventList: EventList[] = [
      {
         label: 'ACTIVE EVENTS',
         items: activeEventsList,
         topPlayerUrl: topPlayerUrl
      }
   ];


   const result: DataOperationResult<EventList[]> = {
      'Success': true,
      Data: eventList
   };
   logger.info(`saving events list in cache ${cacheKey}`);
   await cacheSet(cacheKey, JSON.stringify(result)); // auto expire in 10 minutes
   logger.info(`saved events list in cache ${cacheKey}`);
   res.json(result);

};

export const makeWinner = async function (req: Request, res: Response, next: NextFunction) {
   // /:eventId/:contestantId/:RoundNumber/:IsWinner
   try {
      const eventId = req.params.eventId;
      const contestantId = req.params.contestantId;
      const roundNumber = parseInt(req.params.roundNumber);
      const isWinner = parseInt(req.params.IsWinner);
      if (!(isWinner === 0 || isWinner === 1)) {
         res.status(403);
         logger.info(`Is Winner should be 0 or 1`, req.params.IsWinner);
         const result: DataOperationResult<string> = {
            'Success': false,
            Data: 'Invalid'
         };
         res.json(result);
         return;
      }
      const event = await EventModel.findOne({
         _id: eventId
      });
      let isModified = false;
      if (event) {
         const updateContestant = function (contestants: RoundContestantDTO[], contestantId: string) {
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
            const result: DataOperationResult<string> = {
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
         } else {
            logger.info(`nothing modified ${eventId}`);
            res.status(403);
            const result: DataOperationResult<string> = {
               'Success': false,
               Data: 'Invalid'
            };
            res.json(result);
            return;
         }
      } else {
         logger.info(`matching event not found ${eventId}`);
         res.status(403);
         const result: DataOperationResult<string> = {
            'Success': false,
            Data: 'Invalid'
         };
         res.json(result);
         return;
      }

   } catch (e) {
      logger.info(e);
      const result: DataOperationResult<string> = {
         'Success': false,
         Data: 'Internal Server Error'
      };
      res.status(500);
      res.json(result);
   }
};

export const eventStats = async function (req: Request, res: Response, next: NextFunction) {
   try {
      const eventIds = req.user.eventIds;
      const condition = {};
      if (eventIds && eventIds.length > 0) {
         // @ts-ignore
         condition._id = { $in: eventIds };
      }
      const events = await EventModel.find(condition)
          .select(['_id', 'Name', 'RegistrationsVoteFactor'])
          .sort({ '_id': -1 });

      const eventStates: EventStatDTO[] = [];
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
            } else {
               eventState.Online++;
            }
         }
         eventStates.push(eventState);
      }
      const result: DataOperationResult<EventStatDTO[]> = {
         'Success': true,
         Data: eventStates
      };
      res.json(result);
      return;
   } catch (e) {
      logger.info(e);
      const result: DataOperationResult<string> = {
         'Success': false,
         Data: 'Internal Server Error'
      };
      res.status(500);
      res.json(result);
   }
};

export const viewEvent = async function (req: Request, res: Response, next: NextFunction) {
   try {
      const eventDoc = await EventModel.findById(req.params.eventId).select(['_id', 'EID', 'VoteByLink', 'Rounds', 'CurrentRound', 'RegistrationsVoteFactor', 'Contestants', 'Images'])
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
      let currentRoundIndex: number;
      const roundWiseImages = [];
      for (let j = 0; j < totalRounds; j++) {
         const artistsInRound = eventDoc.Rounds[j].Contestants;
         const artistsImages = artistWiseImages(artistsInRound, req.user);
         const response: RoundArtistsInterface = {
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
         const numbers: string[] = [];

         round.Contestants.forEach((cur: any) => {
            cur.Votes.forEach((v: RegistrationDTO) => {
               numbers.push(v.PhoneNumber || v.Email);
            });
         });
      }
      if (!currentRoundNumber) {
         currentRoundNumber = 0;
      }

      const result: DataOperationResult<{
         roundWiseImages: RoundArtistsInterface[],
         CurrentRoundNumber: number
      }> = {
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

export const appVote = async (req: Request, res: Response, next: NextFunction) => {
   try {
      const log = new VotingLogModel();
      const vote = req.params.easelNumber;
      const roundNumber = req.params.RoundNumber;
      const results = await Promise.all([EventModel.findOne({
         '_id': req.params.eventId,
      }).select(['Name', '_id', 'VoteByLink', 'Rounds', 'RegistrationsVoteFactor', 'Enabled', 'PhoneNumber', 'CurrentRound', 'Registrations', 'Email'])
          .populate('Registrations')
          .populate('Rounds.Contestants.Votes')
          .populate('CurrentRound.Contestants.Detail')
          .populate('CurrentRound.Contestants.Votes'),
         LotModel.countDocuments({
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
         sendResponse('json', res, 'VOTING_WEB_DISABLED');
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
         return await processVote('json', vote, from, event, res, log, roundNumber, openAuctionCount, 'online');
      }
      else {
         logger.info(req.user, ' is not registered in event, registering');
         await RegisterVoter(req.user, req.params.eventId, true, 0.1, true, req.user._id);
         // updated event after registration
         const updatedEvent = await EventModel.findOne({
            '_id': req.params.eventId,
         }).select(['Name', '_id', 'VoteByLink', 'Rounds', 'RegistrationsVoteFactor', 'Enabled', 'PhoneNumber', 'CurrentRound', 'Registrations', 'Email'])
             .populate('Registrations');
         return await processVote('json', vote, req.user.PhoneNumber || req.user.Email, updatedEvent, res, log, roundNumber, openAuctionCount, 'online');
      }
   } catch (e) {
      next(e);
   }


};

export const getEventGuestCount = async function (req: Request, res: Response, next: NextFunction) {
   try {
      const data = req.body;
      const eventIds = [];
      const eventNames: {
         id: string;
         EID: string;
         title: string;
         eventId: string;
         EventNo: number;
      }[] = data;

      for (let i = 0; i < eventNames.length; i++) {
         eventIds.push(eventNames[i].eventId);
      }

      // console.log('Events List ===>>>>>', eventList);
      const query: {
         _id?: {$in: string[]};
      } = {};
      query._id = { $in: eventIds };

      const promises = [];
      const promise1 = EventModel.find(query).select([
         'Name',
         'RegistrationsVoteFactor'
      ]).sort({
         'EventStartDateTime': -1
      }).exec();

      promises.push(promise1);
      const results = await Promise.all(promises);

      const activeEvents = results[0];
      let totalGuestCount = 0;
      let registrationIds: string[] = [];
      for (let i = 0; i < activeEvents.length; i++) {
         totalGuestCount += activeEvents[i].RegistrationsVoteFactor.length;
         const registrationsDataList = activeEvents[i].RegistrationsVoteFactor;
         for (let i = 0; i < registrationsDataList.length; i++) {
            // console.log('RegistrationsVoteFactor ===>>>', registrationsDataList[0]._id);
            registrationIds.push(registrationsDataList[i].RegistrationId.toString());
         }
      }

      registrationIds = [...new Set(registrationIds)];
      const rest: any = {
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
      const result: DataOperationResult<string> = {
         'Success': false,
         Data: 'Internal Server Error'
      };
      res.status(500);
      next(result);
   }
};


export const getEventFilterGuestCount = async function (req: Request, res: Response, next: NextFunction) {
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
         eventLists.push(new ObjectId(eventData[i].id));
      }

      const bid = parseInt(data.bids);
      let results: any[] | EventDocument[] | { RegistrationsVoteFactor: any; }[] = [];

      const registrationIds = [];
      const registrationHash = [];


      if (bid == 0) {
         const condition = {};

         // @ts-ignore
         condition._id = { $in: eventLists };
         results = await EventModel.find(condition).select([
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
         const evtData = await LotModel.aggregate([
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

      let registrationIdsUnique = [... new Set(registrationIds)];
      if (voteCount > 0) {
         const registrationHashObjs = await RegistrationModel.find({_id: {'$in': registrationIdsUnique}}).select(['Hash']);
         registrationIdsUnique = [];
         for (let i = 0; i < registrationHashObjs.length; i++) {
            registrationHash.push(registrationHashObjs[i].Hash);
         }
         if (registrationHash.length > 0) {
            const logs = await VotingLogModel.aggregate([
               {
                  $match: {
                     'PhoneHash': {'$in': registrationHash},
                     'Status': 'VOTE_ACCEPTED',
                     // 'EventId': {'$in': data.data}
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
                     'voteCount': {'$gte': voteCount}
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
      const query: {
         _id: {
            $in: string[];
         };
         lastPromoSentAt?: {$lt: Date};
      } = {
         _id: {
            $in: registrationIdsUnique
         },
      };
      if (!isNaN(parseInt(timelogs)) && parseInt(timelogs) !== 0) {
         query.lastPromoSentAt  = {
            $lt: new Date(Date.now() - (parseInt(timelogs) * 60 * 60 * 1000))
         };
      }
      const registrations = await RegistrationModel.find(query).select([
         '_id'
      ]);
      logger.info(`query ${JSON.stringify(query)}`);
      logger.info(`filtered registrations ${JSON.stringify(registrations)}`);

      const promotionLogsRegIDs: string[] = [];
      for (let i = 0; i < registrations.length; i++) {
         promotionLogsRegIDs.push(registrations[i]._id);
      }
      // console.log('promotionLogsData ===>>>>', promotionLogsData);

      // console.log(registrationIdsUnique.length + ' ===>>>' + promotionLogsRegIDs.length);


      // registrationIds = registrationIds.concat(promotionLogsRegIDs);

      // console.log('finalRegistrationIdsUnique ===>>>>', finalRegistrationIdsUnique); )

      const rest: any = {
         'Success': true,
         'guest': results,
         'guestcount': promotionLogsRegIDs.length,
         'registrationids': promotionLogsRegIDs
      };
      res.json(rest);
      return;

   }
   catch (e) {
      logger.error(e);
      res.status(500);
      next(e);
   }

};

export const randomVoteUrl = async function (req: Request, res: Response, next: NextFunction) {
   const offset = Math.floor(Math.random() * 5000) + 1; // between 1 and 5000
   const regLog = await RegistrationLogModel.findOne().sort({
      _id: -1
   }).skip(offset);
   if (regLog && regLog.VoteUrl) {
      res.redirect(302, `${process.env.SITE_URL}/${regLog.VoteUrl.toString()}`);
   } else {
      next({
         message: 'unable to find the vote url'
      });
   }
};