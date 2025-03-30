import { Request, Response, NextFunction } from 'express';

import { default as EventModel } from '../models/Event';
import { DataOperationResult } from '../../../shared/OperationResult';
import { EventList } from '../../../shared/EventListResponseDTO';

import { default as PromotionLogModel } from '../models/PromotionLogs';
import RegistrationModel from '../models/Registration';
import sendNotification from '../common/Apns';
import { MultiCast } from '../common/FCM';
import * as Twilio from 'twilio';
import LotModel from '../models/Lot';
import { default as EventPhoneNumberModel } from '../models/EventPhoneNumber';
import { default as MessageSchema } from '../models/Message';

import EventDTO from '../../../shared/EventDTO';
import RoundContestantDTO from '../../../shared/RoundContestantDTO';
import { default as ContestantModel } from '../models/Contestant';
import VotingLogModel from '../models/VotingLog';

import RegistrationDTO from '../../../shared/RegistrationDTO';
import logger from '../config/logger';


export const getEvents = async (req: Request, res: Response, next: NextFunction) => {

   const PhoneNumber = false;

   const eventId = req.query.eventName;
   const query: {
      Name?: any;

   } = {};


   if (eventId && eventId.length > 0) {
      query.Name = new RegExp(eventId);
   }
   const promises = [];
   const promise1 = EventModel.find(query).select([
      '_id',
      'EID',
      'Name',
      'Description',
   ]).sort({
      'EventStartDateTime': -1
   }).exec();

   promises.push(promise1);

   // past event list
   const results = await Promise.all(promises);
   const activeEvents = results[0];

   const activeEventsList: any = [];

   for (let i = 0; i < activeEvents.length; i++) {
      const event = activeEvents[i];

      const eventObj = {
         id: event._id,
         EID: event.EID || '',
         title: event.Name,
         eventId: event.id,
         EventNo: i + 1
      };
      activeEventsList.push(eventObj);
   }

   const eventList: EventList[] = [
      {
         label: 'ALL EVENTS',
         items: activeEventsList,
         topPlayerUrl: ''
      }
   ];

   const result: DataOperationResult<EventList[]> = {
      'Success': true,
      Data: eventList
   };

   res.json(activeEventsList);
};


export const sendPromotion = async (req: Request, res: Response, next: NextFunction) => {

   // const authHeader = req.header('Authorization');
   // logger.info('req', req.user, 'authHeader', authHeader);
   res.render('home', {
      // token: authHeader && authHeader.replace('Bearer ', ''),
      // eventId: req.params.eventId
      message: 'Hi, this is Nitin kaushal'
   });
};


export const savePromotion = async (req: Request, res: Response, next: NextFunction) => {

   try {
      const dt = req.body;
      // promotionObj.notifyAndroid = "ios";
      // const eventData = JSON.parse(dt[0].dt);

      const logs = {
         'phonenumber': dt[0].Phonenumber,
         'notifySMS': dt[0].sms,
         'notifyiOS': dt[0].ios,
         'notifyAndroid': dt[0].android,
         'message': dt[0].message,
      };


      const eventData = dt[0].dt;
// console.log('eventData ===>>', JSON.stringify(eventData));
      if (eventData.length > 0) {
         for (let i = 0; i < eventData.length; i++) {

            const bids = JSON.parse(JSON.stringify(eventData[i].Bids));
            for (let j = 0; j < bids.length; j++) {
               // INSERTION HERE
               const promotionObj = new PromotionLogModel();
               promotionObj.event = eventData[i].Event;
               promotionObj.lots = eventData[i].lotId;
               promotionObj.registration = bids[j].Registration;
               promotionObj.phone = logs.phonenumber;
               promotionObj.notifySMS = logs.notifySMS;
               promotionObj.notifyiOS = logs.notifyiOS;
               promotionObj.notifyAndroid = logs.notifyAndroid;
               promotionObj.message = logs.message;


               const savedEvent = await promotionObj.save();
            }

         }

      } else {
         // console.log('eventData HERE ==>>>', dt);
         const registrationIds = dt[0].registrationIds;
         if (registrationIds.length > 0) {
            await RegistrationModel.updateMany({_id: {'$in': registrationIds}}, {$set: {'lastPromoSentAt': new Date()}});
         }
         for (let j = 0; j < registrationIds.length; j++) {
            const promotionObj = new PromotionLogModel();
            promotionObj.event = '';
            promotionObj.lots = '';
            promotionObj.registration = registrationIds[j];
            promotionObj.phone = logs.phonenumber;
            promotionObj.notifySMS = logs.notifySMS;
            promotionObj.notifyiOS = logs.notifyiOS;
            promotionObj.notifyAndroid = logs.notifyAndroid;
            promotionObj.message = logs.message;
            const savedEvent = await promotionObj.save();
         }
      }


      const result: DataOperationResult<string> = {
         'Success': true,
         Data: 'Inserted Successfully'
      };
      res.json(result);
      return;

   } catch (e) {
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


// function _sendSMS(registrationIDs: string,): any {
//    try {
//       const dt = req.body;
//       // const registrationIDs = dt.registrationIDs;
//       const isSMS = dt.sms;
//       const isiOS = dt.ios;
//       const isAndroid = dt.android;
//       const twillioPhoneNumber = dt.Phonenumber;
//       const message = dt.message;



//       if (registrationIDs.length > 0) {
//          // FETCH TOKEN Details

//          const promises = [];
//          const condition = {};
//          // @ts-ignore
//          condition._id = { $in: registrationIDs };
//          const promise1 = RegistrationModel.find(condition).select([
//             '_id',
//             'AndroidDeviceTokens',
//             'FirstName',
//             'LastName'
//          ]);
//          promises.push(promise1);
//          const promise2 = RegistrationModel.find(condition).select([
//             '_id',
//             'DeviceTokens',
//             'FirstName',
//             'LastName'
//          ]);
//          promises.push(promise2);
//          const promise3 = RegistrationModel.find(condition).select([
//             '_id',
//             'PhoneNumber',
//             'FirstName',
//             'LastName'
//          ]);
//          promises.push(promise3);


//          const results = await Promise.all(promises);
//          const androidTokens = results[0];
//          const iOSTokens = results[1];
//          const phonenumber = results[2];

//          const finalAndroid = [];
//          const finaliOS = [];
//          const finalPhoneNumbers = [];

//          // Android Tokens
//          for (let i = 0; i < androidTokens.length; i++) {

//             if (androidTokens[i].AndroidDeviceTokens !== null) {
//                if (androidTokens[i].AndroidDeviceTokens.length > 0) {
//                   for (let j = 0; j < androidTokens[i].AndroidDeviceTokens.length; j++) {
//                      // console.log('Token ===>>', androidTokens[i].AndroidDeviceTokens[j]);
//                      finalAndroid.push(androidTokens[i].AndroidDeviceTokens[j]);
//                   }
//                }
//             }
//          }

//          // iOS Tokens
//          for (let i = 0; i < iOSTokens.length; i++) {

//             if (iOSTokens[i].DeviceTokens !== null) {
//                if (iOSTokens[i].DeviceTokens.length > 0) {
//                   for (let j = 0; j < iOSTokens[i].DeviceTokens.length; j++) {
//                      // console.log('Token ===>>', androidTokens[i].AndroidDeviceTokens[j]);
//                      finaliOS.push(iOSTokens[i].DeviceTokens[j]);
//                   }
//                }
//             }
//          }

//          // PhoneNumber List
//          for (let i = 0; i < phonenumber.length; i++) {

//             if (phonenumber[i].PhoneNumber !== null) {
//                if (phonenumber[i].PhoneNumber.length > 0) {
//                   // for (let j = 0; j < iOSTokens[i].DeviceTokens.length; j++) {
//                   // console.log('Token ===>>', androidTokens[i].AndroidDeviceTokens[j]);
//                   finalPhoneNumbers.push(phonenumber[i].PhoneNumber);
//                   // }
//                }
//             }
//          }

//          if (isSMS) {

//             for (let i = 0; i < finalPhoneNumbers.length; i++) {
//                try {
//                   const ph = finalPhoneNumbers[i];
//                   const twilioClient = Twilio();
//                      const twilioResponse = await twilioClient.messages.create({
//                         from: twillioPhoneNumber,
//                          to: finalPhoneNumbers[i],
//                         // to: '+14059968744',
//                         body: message
//                      });
//                   console.log('SMS Resposne ==>>', twilioResponse.sid);

//                } catch (e) {
//                //  logger.error(`failed sms ${smsMessage}`);
//                //  logger.error(`${e.message} ${e.stack}`);
//                 console.log('Twilio Error ==>>', e.message);
//             }

//             }
//          }



//          if (isiOS) {
//              const badDeviceTokens = await sendNotification(finaliOS, message, 'Artbattle');
//              console.log('iOS Logs => ', JSON.stringify(badDeviceTokens));
//          }
//          let androidRes: any ;
//          if (isAndroid) {
//             // ANDROID NOTIFICATION
//             androidRes = await MultiCast({
//             DeviceTokens: finalAndroid,
//             link: '',
//             title: 'Artbattle',
//             message: message,
//             priority: 'normal',
//             analyticsLabel: 'WebView Test'
//             });
//             console.log('IDS ==>>>', finalAndroid);
//             console.log('Android Logs => ', JSON.stringify(androidRes));
//          }


//          const result = {
//             'Success': true,
//             Data: 'Notification sent Successfully',
//             'android': androidRes
//          };
//          res.json(result);
//          return;
//       } else {
//          const result: DataOperationResult<string> = {
//             'Success': false,
//             Data: 'Please provide registration Ids'
//          };
//          res.json(result);
//          return;
//       }

//    } catch (e) {
//       console.error(e);
//       // logger.error(`${e.message} ${e.stack}`);
//       const result: DataOperationResult<string> = {
//          'Success': false,
//          Data: 'Internal Server Error'
//       };
//       res.status(500);
//       next(result);
//    }
// }




export const sendPromotionNotifications = async (req: Request, res: Response, next: NextFunction) => {

   try {
      const dt = req.body;
      const registrationIDs = dt.registrationIDs;
      const isSMS = dt.sms;
      const isiOS = dt.ios;
      const isAndroid = dt.android;
      const twillioPhoneNumber = dt.Phonenumber;
      const message = dt.message;



      if (registrationIDs.length > 0) {
         // FETCH TOKEN Details

         const promises = [];
         const condition = {};
         // @ts-ignore
         condition._id = { $in: registrationIDs };
         const promise1 = RegistrationModel.find(condition).select([
            '_id',
            'AndroidDeviceTokens',
            'DeviceTokens',
            'PhoneNumber',
            'FirstName',
            'LastName',
            'MessageBlocked'
         ]);
         promises.push(promise1);
         const promise2 = EventPhoneNumberModel.findOne({phone: twillioPhoneNumber});
         promises.push(promise2);

         // @ts-ignore
         const results = await Promise.all(promises);
         const registrations = results[0];

         const finalAndroid = [];
         const finaliOS = [];
         const finalPhoneNumbers = [];

         // Android Tokens
         if (isAndroid) {
            for (let i = 0; i < registrations.length; i++) {
               if (Array.isArray(registrations[i].AndroidDeviceTokens)) {
                  for (let j = 0; j < registrations[i].AndroidDeviceTokens.length; j++) {
                     // console.log('Token ===>>', androidTokens[i].AndroidDeviceTokens[j]);
                     if (registrations[j].MessageBlocked !== 1) {
                        console.log('sending to android', registrations[j].PhoneNumber);
                        finalAndroid.push(registrations[i].AndroidDeviceTokens[j]);
                     } else {
                        logger.info(`Blocked Android message to ${registrations[j].PhoneNumber}`);
                     }
                  }
               }
            }
         }

         // iOS Tokens
         if (isiOS) {
            for (let i = 0; i < registrations.length; i++) {

               if (registrations[i].DeviceTokens !== null) {
                  if (registrations[i].DeviceTokens.length > 0) {
                     for (let j = 0; j < registrations[i].DeviceTokens.length; j++) {
                        // console.log('Token ===>>', androidTokens[i].AndroidDeviceTokens[j]);
                        if (registrations[j].DeviceTokens && registrations[j].DeviceTokens.length > 0 && registrations[j].MessageBlocked !== 1) {
                           console.log('sending to iOS', registrations[j].PhoneNumber);
                           finaliOS.push(registrations[i].DeviceTokens[j]);
                        } else if (registrations[j].MessageBlocked === 1) {
                           logger.info(`Blocked iOS message to ${registrations[j].PhoneNumber}`);
                        }
                     }
                  }
               }
            }
         }

         async function sendMessage(registration: RegistrationDTO, channel: string) {
            try {
               const MessageObj = new MessageSchema();
               MessageObj.Message = message;
               MessageObj.ServerUser = req.user.password && req.user._id;
               MessageObj.ServerRegistration = req.user.Hash && req.user._id;
               MessageObj.ServerNumber = twillioPhoneNumber;
               MessageObj.ServerNumberDoc = results[1]._id;
               MessageObj.ClientPhoneNumber = registration.PhoneNumber;
               MessageObj.ClientRegistration = registration._id;
               MessageObj.Status = 1; // SEND TO USER
               MessageObj.Channel = channel;
               return await MessageObj.save();
            } catch (e) {
               logger.error(`unable to save message in log ${e}`);
            }
         }

         const sendMessagePromises = [];
         if (isSMS) {
            for (let i = 0; i < registrations.length; i++) {
               try {
                  if (registrations[i].PhoneNumber && registrations[i].PhoneNumber.length > 0 && registrations[i].MessageBlocked !== 1) {
                     const twilioClient = Twilio();
                     const twilioResponse = await twilioClient.messages.create({
                        from: twillioPhoneNumber,
                        to: registrations[i].PhoneNumber,
                        // to: '+14059968744',
                        body: message
                     });
                     sendMessagePromises.push(sendMessage(registrations[i], 'SMS'));
                  } else {
                     logger.info(`Blocked message to ${registrations[i].PhoneNumber}`);
                  }
               } catch (e) {
                  //  logger.error(`failed sms ${smsMessage}`);
                  //  logger.error(`${e.message} ${e.stack}`);
                  sendMessagePromises.push(sendMessage(registrations[i], 'SMS'));
               }

            }
         }



         if (isiOS) {
            const badDeviceTokens = await sendNotification(finaliOS, message, 'Artbattle');
            for (let j = 0; j < registrations.length; j++) {
               if (registrations[j].DeviceTokens && registrations[j].DeviceTokens.length > 0 && registrations[j].MessageBlocked !== 1) {
                  sendMessagePromises.push(sendMessage(registrations[j], 'iOS'));
               } else if (registrations[j].MessageBlocked === 1) {
                  // logger.info(`Blocked iOS message to ${registrations[j].PhoneNumber}`);
               }
            }
         }

         let androidRes: any ;
         if (isAndroid && finalAndroid.length > 0) {
            // ANDROID NOTIFICATION
            androidRes = await MultiCast({
               DeviceTokens: finalAndroid,
               link: '',
               title: 'Artbattle',
               message: message,
               priority: 'normal',
               analyticsLabel: 'WebView Test'
            });
            for (let j = 0; j < registrations.length; j++) {
               if (registrations[j].AndroidDeviceTokens && registrations[j].AndroidDeviceTokens.length > 0 && registrations[j].MessageBlocked !== 1) {
                  sendMessagePromises.push(sendMessage(registrations[j], 'Android'));
               } else if (registrations[j].MessageBlocked === 1) {
                  // logger.info(`Blocked android message to ${registrations[j].PhoneNumber}`);
               }
            }
         }


         const result = {
            'Success': true,
            Data: 'Notification sent Successfully',
            'android': androidRes
         };
         res.json(result);
         await Promise.all(sendMessagePromises);
         return;
      } else {
         const result: DataOperationResult<string> = {
            'Success': false,
            Data: 'Please provide registration Ids'
         };
         res.json(result);
         return;
      }

   } catch (e) {
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


export const logs = async (req: Request, res: Response, next: NextFunction) => {
   try {

      const data =  await PromotionLogModel.aggregate([
         {
            '$group': {
               _id: '$registration',
               count: {
                  $sum: 1
               }
            }
         },
         {   '$addFields': {
               '_id': { '$toObjectId': '$_id' }
            }
         },
         {
            '$lookup': {
               from: 'registrations',
               localField: '_id',
               foreignField: '_id',
               as: 'infoObject'
            }
         }
      ]).allowDiskUse(true);

      const finalData = [];
      for (let i = 0; i < data.length; i++) {
         const id = data[i]._id;
         const count = data[i].count;
         let email = '';
         let nickname = '';
         let phonenumber = '';
         for (let j = 0; j < data[i].infoObject.length; j++) {
            email = data[i].infoObject[j].Email;
            nickname = data[i].infoObject[j].NickName;
            phonenumber = data[i].infoObject[j].PhoneNumber;
         }
         finalData.push({
            '_id': id,
            'count': count ? count : 0,
            'email': email ? email : '-',
            'nickname': nickname ? nickname : '-',
            'phonenumber': phonenumber ? phonenumber : '-'

         } );

      }

      res.json(finalData);
      return;

   } catch (e) {
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


export let promotionLogsMessage = async(req: Request, res: Response, next: NextFunction) => {
   try {
      const promotionMessageLogs = await MessageSchema.find({'Status': 0})
          .select([
             'ClientRegistration',
             'Status',
             'createdAt'
          ])
          .sort({
             'createdAt' : -1
          });
      let uniqueIDs: any = [];
      for (let i = 0; i < promotionMessageLogs.length; i++) {

         if (uniqueIDs.indexOf(promotionMessageLogs[i].ClientRegistration.toString()) !== -1) {
            // console.log('Available');
         } else {
            uniqueIDs.push(promotionMessageLogs[i].ClientRegistration.toString());
         }
      }
      uniqueIDs = uniqueIDs.slice(0, 100);
      const condition = {};

      // @ts-ignore
      condition._id = { $in: uniqueIDs };
      const userInfo = await RegistrationModel.find(condition)
          .select([
             '_id',
             'NickName',
             'Email',
             'PhoneNumber'
          ])
          .sort({
             'createdAt' : -1
          });

      const finalData = [];
      for (let i = 0; i < userInfo.length; i++) {
         const id = userInfo[i]._id;

         const email = userInfo[i].Email;
         const nickname = userInfo[i].NickName;
         const phonenumber = userInfo[i].PhoneNumber;


         finalData.push({
            '_id': id,
            'email': email ? email : '-',
            'nickname': nickname ? nickname : '-',
            'phonenumber': phonenumber ? phonenumber : '-'

         } );

      }

      res.json(finalData);
      return;

   } catch (e) {
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

export let promotionLogsMessage2 = async(req: Request, res: Response, next: NextFunction) => {
   try {
      const results = await MessageSchema.aggregate([
         {
            '$match': {
               'Status': 0
            }
         }, {
            '$group': {
               '_id': '$ClientRegistration',
               'createAt': {
                  '$push': '$createdAt'
               }
            }
         }, {
            '$sort': {
               'createdAt': -1
            }
         }, {
            '$limit': 100
         }, {
            '$lookup': {
               'from': 'registrations',
               'localField': '_id',
               'foreignField': '_id',
               'as': 'userinfo'
            }

         }
      ]).allowDiskUse(true);

      const finalData: any = [];
      for (let i = 0; i < results.length; i++) {
         const userInfo = results[i].userinfo;
         const lastMessage = results[i].createAt.slice(-1)[0];
         const j = 0;
         if (userInfo) {
            if (userInfo.length > 0) {
               finalData.push({
                  '_id': userInfo[j]._id,
                  'email': userInfo[j].Email ? userInfo[j].Email : '-',
                  'nickname': userInfo[j].NickName ? userInfo[j].NickName : '-',
                  'phonenumber': userInfo[j].PhoneNumber ? userInfo[j].PhoneNumber : '-',
                  'lastMessage' : lastMessage
               });
            }

         }


      }
      const sortedActivities = finalData.sort((a: any, b: any) => b.lastMessage - a.lastMessage);
      res.json(sortedActivities);
      return;

   } catch (e) {
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


export let promotionLogsTopVote = async(req: Request, res: Response, next: NextFunction) => {
   try {
      const results = await VotingLogModel.aggregate([
         {
            '$match': {
               'Status': 'VOTE_ACCEPTED'
            }
         }, {
            '$group': {
               '_id': {
                  'PhoneHash': '$PhoneHash'
               },
               'count': {
                  '$sum': 1
               }
            }
         }, {
            '$sort': {
               'count': -1
            }
         },
         {
            '$limit': 200
         },
         {
            '$lookup': {
               'from': 'registrations',
               'localField': '_id.PhoneHash',
               'foreignField': 'Hash',
               'as': 'UserInfo'
            }
         }
      ]).allowDiskUse(true);
      const finalData: any = [];
      for (let i = 0; i < results.length; i++) {
         // console.log(results.length + ' => ' + i + ' Length ===>>>', results[i].UserInfo);
         const userInfo = results[i].UserInfo;
         const j = 0;
         // console.log(results.length + ' => ' + i + ' Length ===>>>', userInfo);
         if (userInfo.length > 0) {
            finalData.push({
               'count': results[i].count,
               '_id': userInfo[j]._id ? userInfo[j]._id : '-',
               'email': userInfo[j].Email ? userInfo[j].Email : '-',
               'nickname': userInfo[j].NickName ? userInfo[j].NickName : '-',
               'phonenumber': userInfo[j].PhoneNumber ? userInfo[j].PhoneNumber : '-'
            });
         }

      }
      res.json(finalData);
      return;

   } catch (e) {
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
export let userProfile = async(req: Request, res: Response, next: NextFunction) => {
   try {
      // console.log('req.params ', req.params);
      const userData = await RegistrationModel.findOne({'PhoneNumber': req.params.p})
          .populate('Artist');
      if (!userData) {
         next('This user is not registered');
         return ;
      }
      const Arts = [];
      if  (userData.Artist) {
         const Lots = await LotModel.find({Contestant: userData.Artist._id}).select(['ArtId']);
         for (let i = 0; i < Lots.length; i++) {
            Arts.push(Lots[i].ArtId);
         }
      }
      const userId = userData._id;
      const condition = {};
      // @ts-ignore
      condition.Registrations = { $in: req.params.p };

      const eventData = await EventModel.find({'RegistrationsVoteFactor.RegistrationId': userId})
          .select([
             '_id',
             'EID',
             'Name',
             'Price',
             'Country',
             'RegistrationsVoteFactor'
          ]);
      const eventFinalData: any = [];
      for (let i = 0; i < eventData.length; i++) {
         // console.log(eventData[i].RegistrationsVoteFactor);
         const dt = eventData[i].RegistrationsVoteFactor;
         for (let j = 0; j < dt.length; j++) {

            if (userId.toString() == dt[j].RegistrationId.toString()) {
               // console.log('ID ===>>> ', dt[j].From);
               eventFinalData.push({
                  '_id': eventData[i]._id,
                  'Name': eventData[i].Name,
                  'From': dt[j].From,
               });
            }
         }
      }

      const promotionLogs = await PromotionLogModel.find({'registration': userId})
          .select([
             '_id',
             'phone',
             'notifySMS',
             'notifyiOS',
             'notifyAndroid',
             'message',
             'createdAt'
          ]).sort({
             'createdAt' : -1
          });
      // console.log('promotionLogs ==>>', promotionLogs);


      const auctionData = await LotModel.find({'Bids.Registration': userId})
          .select([
             '_id',
             'Bids',
             'Event',
             'ArtId',
             'Round',
             'EaselNumber'
          ]).populate('Event')
          // .populate('Event.Rounds.Contestants.Detail')
          .sort({
             'createdAt' : -1
          });

      const auctionLogs = [];
      for (let i = 0; i < auctionData.length; i++) {
         const eventName = auctionData[i].ArtId;
         let amount = 0;
         let createdAt;
         let isHigherBid = false;

         const bid = auctionData[i].Bids;
         for (let j = 0; j < bid.length; j++) {
            if (userId.toString() === bid[j].Registration.toString()) {
               amount = bid[j].Amount;
               createdAt = bid[j].createdAt;
               createdAt = new Date(createdAt.getTime() - (createdAt.getTimezoneOffset() * 60000 )).toISOString().slice(0, -5).replace('T', ' ');
            }
         }
         bid.sort((a, b) => b.Amount - a.Amount);
         if (bid && bid[0]) {
            isHigherBid = bid[0].Registration.toString() === userId.toString();
         }
         const artistData = await _findArtistImageInEvent(auctionData[i].Event, auctionData[i].Round, auctionData[i].EaselNumber, false);
         if (artistData) {
            // console.log('ArtistData ==>>>', artistData.Detail);
            const artistNameData = await ContestantModel.findOne({'_id': artistData.Detail}).select(['Name']).exec();

            // console.log('artistNameData ==>>>', artistNameData);
            auctionLogs.push({
               'ArtId': eventName,
               'amount': amount,
               'createdAt': createdAt,
               'artist_name': artistNameData && artistNameData.Name,
               'isHigherBid': isHigherBid === true
            });
         } else {
            logger.info(`No artist in this round? ${auctionData[i].Event && auctionData[i].Event._id} ${auctionData[i].Round} ${auctionData[i].EaselNumber}
            bid amount ${amount} art id ${auctionData[i].ArtId}
            `);
         }
      }

      const query: {
         status: any;
      } = {
         status: 1,
      };
      const phoneNumbersList = await EventPhoneNumberModel.find(query).select([
         '_id',
         'phone',
         'label',
         'type',
         'location',
         'status'
      ]).sort({
             'EventStartDateTime': -1
          }).exec();





      const messageData = await MessageSchema.find({'ClientRegistration': userId})
          .sort({
             '_id': -1
          }).limit(20);

      const lastServerPhoneNumber = messageData[0] && messageData[0].ServerNumber;

      // console.log('auctionLogs ==>>>>', auctionLogs);
      // const contestant = _findArtistImageInEvent(Event, Lot.Round, Lot.EaselNumber);

      res.render('p_profile', {
         userInfo: userData,
         eventJoined: eventFinalData,
         promotionLogs: promotionLogs,
         auctionData : auctionLogs,
         phoneNumberList: phoneNumbersList,
         registrationId: userId,
         phoneNumber: userData.PhoneNumber,
         messageData: messageData,
         lastServerPhoneNumber: lastServerPhoneNumber,
         token: '',
         videoList: [],
         Arts: Arts
      });
   } catch (err) {
      return next(err);
   }
};


export let userProfileSendMessage = async(req: Request, res: Response, next: NextFunction) => {
   try {
      const dt = req.body;
      const MessageObj = new MessageSchema();
      MessageObj.Message = dt.message;
      MessageObj.ServerUser = dt.registrationId;
      MessageObj.ServerRegistration = dt.registrationId;
      MessageObj.ServerNumber = dt.Twiliophonenumber;
      MessageObj.ServerNumberDoc = dt.registrationId;
      MessageObj.ClientPhoneNumber = dt.userPhoneNumber;
      MessageObj.ClientRegistration = dt.registrationId;
      MessageObj.Status = 1; // SEND TO USER

      const savedMessage = await MessageObj.save();


      const twilioClient = Twilio();
      const twilioResponse = await twilioClient.messages.create({
         from: dt.Twiliophonenumber,
         to: dt.userPhoneNumber,
         // to: '+14163025959',
         body: dt.message
      });
      // console.log('SMS Resposne ==>>', twilioResponse.sid);



      return res.redirect(process.env.SITE_URL + '/p/' + dt.userPhoneNumber);
   } catch (err) {
      return next(err);
   }
};


function _findArtistImageInEvent(event: EventDTO, roundNumber: Number, EaselNumber: number, checkEnabled = true): RoundContestantDTO {
   for (let i = 0; i < event.Rounds.length; i++) {
      const Round = event.Rounds[i];
      if (roundNumber === Round.RoundNumber) {
         for (let j = 0; j < Round.Contestants.length; j++) {
            if (Round.Contestants[j].EaselNumber === EaselNumber) {
               if (checkEnabled && Round.Contestants[j].Enabled) {
                  return Round.Contestants[j];
               } else {
                  return Round.Contestants[j];
               }
            }
         }
      }
   }
}
export const getDeviceCounts = async (req: Request, res: Response, next: NextFunction) => {

   // try {
   //    const dt = req.body;
   //    let registrationIDs = dt.registrationIDs;

   //    registrationIDs = [... new Set(registrationIDs)];

   //    const condition = {};
   //       // @ts-ignore
   //       condition._id = { $in: registrationIDs };
   //       const userDeviceData = RegistrationModel.find(condition).select([
   //          '_id',
   //          'AndroidDeviceTokens',
   //          'DeviceTokens',
   //          'PhoneNumber',
   //          'FirstName',
   //          'LastName'
   //       ]);

   //       console.log('Result ===>>>', JSON.stringify(userDeviceData));





   //    const isSMS = dt.sms;
   //    const isiOS = dt.ios;
   //    const isAndroid = dt.android;
   //    const twillioPhoneNumber = dt.Phonenumber;
   //    const message = dt.message;



   //    if (registrationIDs.length > 0) {
   //       // FETCH TOKEN Details

   //       const promises = [];
   //       const condition = {};
   //       // @ts-ignore
   //       condition._id = { $in: registrationIDs };
   //       const promise1 = RegistrationModel.find(condition).select([
   //          '_id',
   //          'AndroidDeviceTokens',
   //          'FirstName',
   //          'LastName'
   //       ]);
   //       promises.push(promise1);
   //       const promise2 = RegistrationModel.find(condition).select([
   //          '_id',
   //          'DeviceTokens',
   //          'FirstName',
   //          'LastName'
   //       ]);
   //       promises.push(promise2);
   //       const promise3 = RegistrationModel.find(condition).select([
   //          '_id',
   //          'PhoneNumber',
   //          'FirstName',
   //          'LastName'
   //       ]);
   //       promises.push(promise3);


   //       const results = await Promise.all(promises);
   //       const androidTokens = results[0];
   //       const iOSTokens = results[1];
   //       const phonenumber = results[2];

   //       const finalAndroid = [];
   //       const finaliOS = [];
   //       const finalPhoneNumbers = [];

   //       // Android Tokens
   //       for (let i = 0; i < androidTokens.length; i++) {

   //          if (androidTokens[i].AndroidDeviceTokens !== null) {
   //             if (androidTokens[i].AndroidDeviceTokens.length > 0) {
   //                for (let j = 0; j < androidTokens[i].AndroidDeviceTokens.length; j++) {
   //                   // console.log('Token ===>>', androidTokens[i].AndroidDeviceTokens[j]);
   //                   finalAndroid.push(androidTokens[i].AndroidDeviceTokens[j]);
   //                }
   //             }
   //          }
   //       }

   //       // iOS Tokens
   //       for (let i = 0; i < iOSTokens.length; i++) {

   //          if (iOSTokens[i].DeviceTokens !== null) {
   //             if (iOSTokens[i].DeviceTokens.length > 0) {
   //                for (let j = 0; j < iOSTokens[i].DeviceTokens.length; j++) {
   //                   // console.log('Token ===>>', androidTokens[i].AndroidDeviceTokens[j]);
   //                   finaliOS.push(iOSTokens[i].DeviceTokens[j]);
   //                }
   //             }
   //          }
   //       }

   //       // PhoneNumber List
   //       for (let i = 0; i < phonenumber.length; i++) {

   //          if (phonenumber[i].PhoneNumber !== null) {
   //             if (phonenumber[i].PhoneNumber.length > 0) {
   //                // for (let j = 0; j < iOSTokens[i].DeviceTokens.length; j++) {
   //                // console.log('Token ===>>', androidTokens[i].AndroidDeviceTokens[j]);
   //                finalPhoneNumbers.push(phonenumber[i].PhoneNumber);
   //                // }
   //             }
   //          }
   //       }

   //       if (isSMS) {

   //          for (let i = 0; i < 1; i++) {
   //             const ph = finalPhoneNumbers[i];
   //             const twilioClient = Twilio();
   //                twilioClient.messages.create({
   //                   from: twillioPhoneNumber,
   //                    to: finalPhoneNumbers[i],
   //                   // to: '+14163025959',
   //                   body: message
   //                })
   //                .then(message => console.log(ph + ' SMS ===>>>', message.sid));
   //          }
   //       }



   //       if (isiOS) {
   //           const badDeviceTokens = await sendNotification(finaliOS, message, 'Artbattle');
   //           console.log('iOS Logs => ', JSON.stringify(badDeviceTokens));
   //       }

   //       if (isAndroid) {
   //          // ANDROID NOTIFICATION
   //          const androidRes = await MultiCast({
   //          DeviceTokens: finalAndroid,
   //          link: '',
   //          title: 'Artbattle',
   //          message: message,
   //          priority: 'normal',
   //          analyticsLabel: 'WebView Test'
   //          });
   //          console.log('Android Logs => ', JSON.stringify(androidRes));
   //       }


   //       const result: DataOperationResult<string> = {
   //          'Success': true,
   //          Data: 'Notification sent Successfully'
   //       };
   //       res.json(result);
   //       return;
   //    // } else {
   //    //    const result: DataOperationResult<string> = {
   //    //       'Success': false,
   //    //       Data: 'Please provide registration Ids'
   //    //    };
   //    //    res.json(result);
   //    //    return;
   //     }

   // } catch (e) {
   //    console.error(e);
   //    // logger.error(`${e.message} ${e.stack}`);
   //    const result: DataOperationResult<string> = {
   //       'Success': false,
   //       Data: 'Internal Server Error'
   //    };
   //    res.status(500);
   //    next(result);
   // }
};

export let changeMessageStatus = async(req: Request, res: Response, next: NextFunction) => {
   try {
      const registrationId = req.params.registrationId;
      const isBlocked = parseInt(req.params.isBlocked);
      if (!(isBlocked === 0 || isBlocked === 1)) {
         res.status(403);
         logger.info(`Is Winner should be 0 or 1`, req.params.IsWinner);
         const result: DataOperationResult<string> = {
            'Success': false,
            Data: 'Invalid'
         };
         res.json(result);
         return;
      }
      const registration = await RegistrationModel.findOne({
         _id: registrationId
      });
      if (registration) {
         registration.MessageBlocked = isBlocked;
         await registration.save();

         const result: DataOperationResult<string> = {
            'Success': true,
            Data: isBlocked === 0 ? '' : 'Blocked'
         };
         res.json(result);
         return;
      } else {
         logger.info(`matching user not found ${registrationId}`);
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
