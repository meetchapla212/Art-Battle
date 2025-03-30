"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeMessageStatus = exports.getDeviceCounts = exports.userProfileSendMessage = exports.userProfile = exports.promotionLogsTopVote = exports.promotionLogsMessage2 = exports.promotionLogsMessage = exports.logs = exports.sendPromotionNotifications = exports.savePromotion = exports.sendPromotion = exports.getEvents = void 0;
const Event_1 = require("../models/Event");
const PromotionLogs_1 = require("../models/PromotionLogs");
const Registration_1 = require("../models/Registration");
const Apns_1 = require("../common/Apns");
const FCM_1 = require("../common/FCM");
const Twilio = require("twilio");
const Lot_1 = require("../models/Lot");
const EventPhoneNumber_1 = require("../models/EventPhoneNumber");
const Message_1 = require("../models/Message");
const Contestant_1 = require("../models/Contestant");
const VotingLog_1 = require("../models/VotingLog");
const logger_1 = require("../config/logger");
exports.getEvents = async (req, res, next) => {
    const PhoneNumber = false;
    const eventId = req.query.eventName;
    const query = {};
    if (eventId && eventId.length > 0) {
        query.Name = new RegExp(eventId);
    }
    const promises = [];
    const promise1 = Event_1.default.find(query).select([
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
    const activeEventsList = [];
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
    const eventList = [
        {
            label: 'ALL EVENTS',
            items: activeEventsList,
            topPlayerUrl: ''
        }
    ];
    const result = {
        'Success': true,
        Data: eventList
    };
    res.json(activeEventsList);
};
exports.sendPromotion = async (req, res, next) => {
    // const authHeader = req.header('Authorization');
    // logger.info('req', req.user, 'authHeader', authHeader);
    res.render('home', {
        // token: authHeader && authHeader.replace('Bearer ', ''),
        // eventId: req.params.eventId
        message: 'Hi, this is Nitin kaushal'
    });
};
exports.savePromotion = async (req, res, next) => {
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
                    const promotionObj = new PromotionLogs_1.default();
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
        }
        else {
            // console.log('eventData HERE ==>>>', dt);
            const registrationIds = dt[0].registrationIds;
            if (registrationIds.length > 0) {
                await Registration_1.default.updateMany({ _id: { '$in': registrationIds } }, { $set: { 'lastPromoSentAt': new Date() } });
            }
            for (let j = 0; j < registrationIds.length; j++) {
                const promotionObj = new PromotionLogs_1.default();
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
        const result = {
            'Success': true,
            Data: 'Inserted Successfully'
        };
        res.json(result);
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
exports.sendPromotionNotifications = async (req, res, next) => {
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
            const promise1 = Registration_1.default.find(condition).select([
                '_id',
                'AndroidDeviceTokens',
                'DeviceTokens',
                'PhoneNumber',
                'FirstName',
                'LastName',
                'MessageBlocked'
            ]);
            promises.push(promise1);
            const promise2 = EventPhoneNumber_1.default.findOne({ phone: twillioPhoneNumber });
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
                            }
                            else {
                                logger_1.default.info(`Blocked Android message to ${registrations[j].PhoneNumber}`);
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
                                }
                                else if (registrations[j].MessageBlocked === 1) {
                                    logger_1.default.info(`Blocked iOS message to ${registrations[j].PhoneNumber}`);
                                }
                            }
                        }
                    }
                }
            }
            async function sendMessage(registration, channel) {
                try {
                    const MessageObj = new Message_1.default();
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
                }
                catch (e) {
                    logger_1.default.error(`unable to save message in log ${e}`);
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
                        }
                        else {
                            logger_1.default.info(`Blocked message to ${registrations[i].PhoneNumber}`);
                        }
                    }
                    catch (e) {
                        //  logger.error(`failed sms ${smsMessage}`);
                        //  logger.error(`${e.message} ${e.stack}`);
                        sendMessagePromises.push(sendMessage(registrations[i], 'SMS'));
                    }
                }
            }
            if (isiOS) {
                const badDeviceTokens = await Apns_1.default(finaliOS, message, 'Artbattle');
                for (let j = 0; j < registrations.length; j++) {
                    if (registrations[j].DeviceTokens && registrations[j].DeviceTokens.length > 0 && registrations[j].MessageBlocked !== 1) {
                        sendMessagePromises.push(sendMessage(registrations[j], 'iOS'));
                    }
                    else if (registrations[j].MessageBlocked === 1) {
                        // logger.info(`Blocked iOS message to ${registrations[j].PhoneNumber}`);
                    }
                }
            }
            let androidRes;
            if (isAndroid && finalAndroid.length > 0) {
                // ANDROID NOTIFICATION
                androidRes = await FCM_1.MultiCast({
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
                    }
                    else if (registrations[j].MessageBlocked === 1) {
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
        }
        else {
            const result = {
                'Success': false,
                Data: 'Please provide registration Ids'
            };
            res.json(result);
            return;
        }
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
exports.logs = async (req, res, next) => {
    try {
        const data = await PromotionLogs_1.default.aggregate([
            {
                '$group': {
                    _id: '$registration',
                    count: {
                        $sum: 1
                    }
                }
            },
            { '$addFields': {
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
            });
        }
        res.json(finalData);
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
exports.promotionLogsMessage = async (req, res, next) => {
    try {
        const promotionMessageLogs = await Message_1.default.find({ 'Status': 0 })
            .select([
            'ClientRegistration',
            'Status',
            'createdAt'
        ])
            .sort({
            'createdAt': -1
        });
        let uniqueIDs = [];
        for (let i = 0; i < promotionMessageLogs.length; i++) {
            if (uniqueIDs.indexOf(promotionMessageLogs[i].ClientRegistration.toString()) !== -1) {
                // console.log('Available');
            }
            else {
                uniqueIDs.push(promotionMessageLogs[i].ClientRegistration.toString());
            }
        }
        uniqueIDs = uniqueIDs.slice(0, 100);
        const condition = {};
        // @ts-ignore
        condition._id = { $in: uniqueIDs };
        const userInfo = await Registration_1.default.find(condition)
            .select([
            '_id',
            'NickName',
            'Email',
            'PhoneNumber'
        ])
            .sort({
            'createdAt': -1
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
            });
        }
        res.json(finalData);
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
exports.promotionLogsMessage2 = async (req, res, next) => {
    try {
        const results = await Message_1.default.aggregate([
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
        const finalData = [];
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
                        'lastMessage': lastMessage
                    });
                }
            }
        }
        const sortedActivities = finalData.sort((a, b) => b.lastMessage - a.lastMessage);
        res.json(sortedActivities);
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
exports.promotionLogsTopVote = async (req, res, next) => {
    try {
        const results = await VotingLog_1.default.aggregate([
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
        const finalData = [];
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
exports.userProfile = async (req, res, next) => {
    try {
        // console.log('req.params ', req.params);
        const userData = await Registration_1.default.findOne({ 'PhoneNumber': req.params.p })
            .populate('Artist');
        if (!userData) {
            next('This user is not registered');
            return;
        }
        const Arts = [];
        if (userData.Artist) {
            const Lots = await Lot_1.default.find({ Contestant: userData.Artist._id }).select(['ArtId']);
            for (let i = 0; i < Lots.length; i++) {
                Arts.push(Lots[i].ArtId);
            }
        }
        const userId = userData._id;
        const condition = {};
        // @ts-ignore
        condition.Registrations = { $in: req.params.p };
        const eventData = await Event_1.default.find({ 'RegistrationsVoteFactor.RegistrationId': userId })
            .select([
            '_id',
            'EID',
            'Name',
            'Price',
            'Country',
            'RegistrationsVoteFactor'
        ]);
        const eventFinalData = [];
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
        const promotionLogs = await PromotionLogs_1.default.find({ 'registration': userId })
            .select([
            '_id',
            'phone',
            'notifySMS',
            'notifyiOS',
            'notifyAndroid',
            'message',
            'createdAt'
        ]).sort({
            'createdAt': -1
        });
        // console.log('promotionLogs ==>>', promotionLogs);
        const auctionData = await Lot_1.default.find({ 'Bids.Registration': userId })
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
            'createdAt': -1
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
                    createdAt = new Date(createdAt.getTime() - (createdAt.getTimezoneOffset() * 60000)).toISOString().slice(0, -5).replace('T', ' ');
                }
            }
            bid.sort((a, b) => b.Amount - a.Amount);
            if (bid && bid[0]) {
                isHigherBid = bid[0].Registration.toString() === userId.toString();
            }
            const artistData = await _findArtistImageInEvent(auctionData[i].Event, auctionData[i].Round, auctionData[i].EaselNumber, false);
            if (artistData) {
                // console.log('ArtistData ==>>>', artistData.Detail);
                const artistNameData = await Contestant_1.default.findOne({ '_id': artistData.Detail }).select(['Name']).exec();
                // console.log('artistNameData ==>>>', artistNameData);
                auctionLogs.push({
                    'ArtId': eventName,
                    'amount': amount,
                    'createdAt': createdAt,
                    'artist_name': artistNameData && artistNameData.Name,
                    'isHigherBid': isHigherBid === true
                });
            }
            else {
                logger_1.default.info(`No artist in this round? ${auctionData[i].Event && auctionData[i].Event._id} ${auctionData[i].Round} ${auctionData[i].EaselNumber}
            bid amount ${amount} art id ${auctionData[i].ArtId}
            `);
            }
        }
        const query = {
            status: 1,
        };
        const phoneNumbersList = await EventPhoneNumber_1.default.find(query).select([
            '_id',
            'phone',
            'label',
            'type',
            'location',
            'status'
        ]).sort({
            'EventStartDateTime': -1
        }).exec();
        const messageData = await Message_1.default.find({ 'ClientRegistration': userId })
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
            auctionData: auctionLogs,
            phoneNumberList: phoneNumbersList,
            registrationId: userId,
            phoneNumber: userData.PhoneNumber,
            messageData: messageData,
            lastServerPhoneNumber: lastServerPhoneNumber,
            token: '',
            videoList: [],
            Arts: Arts
        });
    }
    catch (err) {
        return next(err);
    }
};
exports.userProfileSendMessage = async (req, res, next) => {
    try {
        const dt = req.body;
        const MessageObj = new Message_1.default();
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
    }
    catch (err) {
        return next(err);
    }
};
function _findArtistImageInEvent(event, roundNumber, EaselNumber, checkEnabled = true) {
    for (let i = 0; i < event.Rounds.length; i++) {
        const Round = event.Rounds[i];
        if (roundNumber === Round.RoundNumber) {
            for (let j = 0; j < Round.Contestants.length; j++) {
                if (Round.Contestants[j].EaselNumber === EaselNumber) {
                    if (checkEnabled && Round.Contestants[j].Enabled) {
                        return Round.Contestants[j];
                    }
                    else {
                        return Round.Contestants[j];
                    }
                }
            }
        }
    }
}
exports.getDeviceCounts = async (req, res, next) => {
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
exports.changeMessageStatus = async (req, res, next) => {
    try {
        const registrationId = req.params.registrationId;
        const isBlocked = parseInt(req.params.isBlocked);
        if (!(isBlocked === 0 || isBlocked === 1)) {
            res.status(403);
            logger_1.default.info(`Is Winner should be 0 or 1`, req.params.IsWinner);
            const result = {
                'Success': false,
                Data: 'Invalid'
            };
            res.json(result);
            return;
        }
        const registration = await Registration_1.default.findOne({
            _id: registrationId
        });
        if (registration) {
            registration.MessageBlocked = isBlocked;
            await registration.save();
            const result = {
                'Success': true,
                Data: isBlocked === 0 ? '' : 'Blocked'
            };
            res.json(result);
            return;
        }
        else {
            logger_1.default.info(`matching user not found ${registrationId}`);
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbnRyb2xsZXJzL3Byb21vdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFFQSwyQ0FBd0Q7QUFJeEQsMkRBQXVFO0FBQ3ZFLHlEQUF1RDtBQUN2RCx5Q0FBOEM7QUFDOUMsdUNBQTBDO0FBQzFDLGlDQUFpQztBQUNqQyx1Q0FBcUM7QUFDckMsaUVBQThFO0FBQzlFLCtDQUE2RDtBQUk3RCxxREFBa0U7QUFDbEUsbURBQWlEO0FBR2pELDZDQUFzQztBQUd6QixRQUFBLFNBQVMsR0FBRyxLQUFLLEVBQUUsR0FBWSxFQUFFLEdBQWEsRUFBRSxJQUFrQixFQUFFLEVBQUU7SUFFaEYsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDO0lBRTFCLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDO0lBQ3BDLE1BQU0sS0FBSyxHQUdQLEVBQUUsQ0FBQztJQUdQLElBQUksT0FBTyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ2hDLEtBQUssQ0FBQyxJQUFJLEdBQUcsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7S0FDbkM7SUFDRCxNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUM7SUFDcEIsTUFBTSxRQUFRLEdBQUcsZUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFDNUMsS0FBSztRQUNMLEtBQUs7UUFDTCxNQUFNO1FBQ04sYUFBYTtLQUNmLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDTCxvQkFBb0IsRUFBRSxDQUFDLENBQUM7S0FDMUIsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0lBRVYsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUV4QixrQkFBa0I7SUFDbEIsTUFBTSxPQUFPLEdBQUcsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzVDLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUVoQyxNQUFNLGdCQUFnQixHQUFRLEVBQUUsQ0FBQztJQUVqQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUMzQyxNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFOUIsTUFBTSxRQUFRLEdBQUc7WUFDZCxFQUFFLEVBQUUsS0FBSyxDQUFDLEdBQUc7WUFDYixHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUcsSUFBSSxFQUFFO1lBQ3BCLEtBQUssRUFBRSxLQUFLLENBQUMsSUFBSTtZQUNqQixPQUFPLEVBQUUsS0FBSyxDQUFDLEVBQUU7WUFDakIsT0FBTyxFQUFFLENBQUMsR0FBRyxDQUFDO1NBQ2hCLENBQUM7UUFDRixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7S0FDbEM7SUFFRCxNQUFNLFNBQVMsR0FBZ0I7UUFDNUI7WUFDRyxLQUFLLEVBQUUsWUFBWTtZQUNuQixLQUFLLEVBQUUsZ0JBQWdCO1lBQ3ZCLFlBQVksRUFBRSxFQUFFO1NBQ2xCO0tBQ0gsQ0FBQztJQUVGLE1BQU0sTUFBTSxHQUFxQztRQUM5QyxTQUFTLEVBQUUsSUFBSTtRQUNmLElBQUksRUFBRSxTQUFTO0tBQ2pCLENBQUM7SUFFRixHQUFHLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7QUFDOUIsQ0FBQyxDQUFDO0FBR1csUUFBQSxhQUFhLEdBQUcsS0FBSyxFQUFFLEdBQVksRUFBRSxHQUFhLEVBQUUsSUFBa0IsRUFBRSxFQUFFO0lBRXBGLGtEQUFrRDtJQUNsRCwwREFBMEQ7SUFDMUQsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUU7UUFDaEIsMERBQTBEO1FBQzFELDhCQUE4QjtRQUM5QixPQUFPLEVBQUUsMkJBQTJCO0tBQ3RDLENBQUMsQ0FBQztBQUNOLENBQUMsQ0FBQztBQUdXLFFBQUEsYUFBYSxHQUFHLEtBQUssRUFBRSxHQUFZLEVBQUUsR0FBYSxFQUFFLElBQWtCLEVBQUUsRUFBRTtJQUVwRixJQUFJO1FBQ0QsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQztRQUNwQixzQ0FBc0M7UUFDdEMsMENBQTBDO1FBRTFDLE1BQU0sSUFBSSxHQUFHO1lBQ1YsYUFBYSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXO1lBQ2hDLFdBQVcsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRztZQUN0QixXQUFXLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUc7WUFDdEIsZUFBZSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPO1lBQzlCLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTztTQUMxQixDQUFDO1FBR0YsTUFBTSxTQUFTLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUNqQyw2REFBNkQ7UUFDdkQsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUN2QixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFFeEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUMzRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtvQkFDbkMsaUJBQWlCO29CQUNqQixNQUFNLFlBQVksR0FBRyxJQUFJLHVCQUFpQixFQUFFLENBQUM7b0JBQzdDLFlBQVksQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztvQkFDeEMsWUFBWSxDQUFDLElBQUksR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO29CQUN2QyxZQUFZLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUM7b0JBQ2pELFlBQVksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztvQkFDdEMsWUFBWSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO29CQUN4QyxZQUFZLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7b0JBQ3hDLFlBQVksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztvQkFDaEQsWUFBWSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO29CQUdwQyxNQUFNLFVBQVUsR0FBRyxNQUFNLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQztpQkFDL0M7YUFFSDtTQUVIO2FBQU07WUFDSiwyQ0FBMkM7WUFDM0MsTUFBTSxlQUFlLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQztZQUM5QyxJQUFJLGVBQWUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUM3QixNQUFNLHNCQUFpQixDQUFDLFVBQVUsQ0FBQyxFQUFDLEdBQUcsRUFBRSxFQUFDLEtBQUssRUFBRSxlQUFlLEVBQUMsRUFBQyxFQUFFLEVBQUMsSUFBSSxFQUFFLEVBQUMsaUJBQWlCLEVBQUUsSUFBSSxJQUFJLEVBQUUsRUFBQyxFQUFDLENBQUMsQ0FBQzthQUMvRztZQUNELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxlQUFlLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO2dCQUM5QyxNQUFNLFlBQVksR0FBRyxJQUFJLHVCQUFpQixFQUFFLENBQUM7Z0JBQzdDLFlBQVksQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDO2dCQUN4QixZQUFZLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztnQkFDdkIsWUFBWSxDQUFDLFlBQVksR0FBRyxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQy9DLFlBQVksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztnQkFDdEMsWUFBWSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUN4QyxZQUFZLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ3hDLFlBQVksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztnQkFDaEQsWUFBWSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO2dCQUNwQyxNQUFNLFVBQVUsR0FBRyxNQUFNLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQzthQUMvQztTQUNIO1FBR0QsTUFBTSxNQUFNLEdBQWdDO1lBQ3pDLFNBQVMsRUFBRSxJQUFJO1lBQ2YsSUFBSSxFQUFFLHVCQUF1QjtTQUMvQixDQUFDO1FBQ0YsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNqQixPQUFPO0tBRVQ7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNULE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakIsMkNBQTJDO1FBQzNDLE1BQU0sTUFBTSxHQUFnQztZQUN6QyxTQUFTLEVBQUUsS0FBSztZQUNoQixJQUFJLEVBQUUsdUJBQXVCO1NBQy9CLENBQUM7UUFDRixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2hCLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNmO0FBSUosQ0FBQyxDQUFDO0FBR0YscURBQXFEO0FBQ3JELFdBQVc7QUFDWCw2QkFBNkI7QUFDN0IsdURBQXVEO0FBQ3ZELDhCQUE4QjtBQUM5Qiw4QkFBOEI7QUFDOUIsc0NBQXNDO0FBQ3RDLG1EQUFtRDtBQUNuRCxvQ0FBb0M7QUFJcEMsMENBQTBDO0FBQzFDLGtDQUFrQztBQUVsQyxnQ0FBZ0M7QUFDaEMsaUNBQWlDO0FBQ2pDLHlCQUF5QjtBQUN6QixxREFBcUQ7QUFDckQsdUVBQXVFO0FBQ3ZFLHFCQUFxQjtBQUNyQixxQ0FBcUM7QUFDckMsMkJBQTJCO0FBQzNCLHlCQUF5QjtBQUN6QixlQUFlO0FBQ2Ysb0NBQW9DO0FBQ3BDLHVFQUF1RTtBQUN2RSxxQkFBcUI7QUFDckIsOEJBQThCO0FBQzlCLDJCQUEyQjtBQUMzQix5QkFBeUI7QUFDekIsZUFBZTtBQUNmLG9DQUFvQztBQUNwQyx1RUFBdUU7QUFDdkUscUJBQXFCO0FBQ3JCLDZCQUE2QjtBQUM3QiwyQkFBMkI7QUFDM0IseUJBQXlCO0FBQ3pCLGVBQWU7QUFDZixvQ0FBb0M7QUFHcEMsd0RBQXdEO0FBQ3hELDZDQUE2QztBQUM3Qyx5Q0FBeUM7QUFDekMsMkNBQTJDO0FBRTNDLG9DQUFvQztBQUNwQyxnQ0FBZ0M7QUFDaEMseUNBQXlDO0FBRXpDLDZCQUE2QjtBQUM3Qiw0REFBNEQ7QUFFNUQsbUVBQW1FO0FBQ25FLHdFQUF3RTtBQUN4RSw0RkFBNEY7QUFDNUYsK0ZBQStGO0FBQy9GLG1GQUFtRjtBQUNuRixzQkFBc0I7QUFDdEIsbUJBQW1CO0FBQ25CLGdCQUFnQjtBQUNoQixhQUFhO0FBRWIseUJBQXlCO0FBQ3pCLHdEQUF3RDtBQUV4RCx3REFBd0Q7QUFDeEQsNkRBQTZEO0FBQzdELGlGQUFpRjtBQUNqRiwrRkFBK0Y7QUFDL0Ysb0VBQW9FO0FBQ3BFLHNCQUFzQjtBQUN0QixtQkFBbUI7QUFDbkIsZ0JBQWdCO0FBQ2hCLGFBQWE7QUFFYiwrQkFBK0I7QUFDL0IsMERBQTBEO0FBRTFELHlEQUF5RDtBQUN6RCw4REFBOEQ7QUFDOUQsb0ZBQW9GO0FBQ3BGLDRGQUE0RjtBQUM1Rix3RUFBd0U7QUFDeEUseUJBQXlCO0FBQ3pCLG1CQUFtQjtBQUNuQixnQkFBZ0I7QUFDaEIsYUFBYTtBQUViLHdCQUF3QjtBQUV4QixtRUFBbUU7QUFDbkUsdUJBQXVCO0FBQ3ZCLHFEQUFxRDtBQUNyRCxtREFBbUQ7QUFDbkQsbUZBQW1GO0FBQ25GLG9EQUFvRDtBQUNwRCxxREFBcUQ7QUFDckQsaURBQWlEO0FBQ2pELHdDQUF3QztBQUN4QywyQkFBMkI7QUFDM0IsMEVBQTBFO0FBRTFFLCtCQUErQjtBQUMvQiwrREFBK0Q7QUFDL0QsOERBQThEO0FBQzlELCtEQUErRDtBQUMvRCxnQkFBZ0I7QUFFaEIsZ0JBQWdCO0FBQ2hCLGFBQWE7QUFJYix3QkFBd0I7QUFDeEIsK0ZBQStGO0FBQy9GLDZFQUE2RTtBQUM3RSxhQUFhO0FBQ2IsaUNBQWlDO0FBQ2pDLDRCQUE0QjtBQUM1QixzQ0FBc0M7QUFDdEMsNkNBQTZDO0FBQzdDLDBDQUEwQztBQUMxQyx3QkFBd0I7QUFDeEIsa0NBQWtDO0FBQ2xDLGdDQUFnQztBQUNoQyxrQ0FBa0M7QUFDbEMsNkNBQTZDO0FBQzdDLGtCQUFrQjtBQUNsQixzREFBc0Q7QUFDdEQsMkVBQTJFO0FBQzNFLGFBQWE7QUFHYiw0QkFBNEI7QUFDNUIsK0JBQStCO0FBQy9CLHNEQUFzRDtBQUN0RCxvQ0FBb0M7QUFDcEMsY0FBYztBQUNkLDZCQUE2QjtBQUM3QixtQkFBbUI7QUFDbkIsaUJBQWlCO0FBQ2pCLHlEQUF5RDtBQUN6RCxnQ0FBZ0M7QUFDaEMsc0RBQXNEO0FBQ3RELGNBQWM7QUFDZCw2QkFBNkI7QUFDN0IsbUJBQW1CO0FBQ25CLFVBQVU7QUFFVixtQkFBbUI7QUFDbkIsMEJBQTBCO0FBQzFCLG9EQUFvRDtBQUNwRCxzREFBc0Q7QUFDdEQsNkJBQTZCO0FBQzdCLHlDQUF5QztBQUN6QyxXQUFXO0FBQ1gseUJBQXlCO0FBQ3pCLHNCQUFzQjtBQUN0QixPQUFPO0FBQ1AsSUFBSTtBQUtTLFFBQUEsMEJBQTBCLEdBQUcsS0FBSyxFQUFFLEdBQVksRUFBRSxHQUFhLEVBQUUsSUFBa0IsRUFBRSxFQUFFO0lBRWpHLElBQUk7UUFDRCxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDO1FBQ3BCLE1BQU0sZUFBZSxHQUFHLEVBQUUsQ0FBQyxlQUFlLENBQUM7UUFDM0MsTUFBTSxLQUFLLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQztRQUNyQixNQUFNLEtBQUssR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDO1FBQ3JCLE1BQU0sU0FBUyxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUM7UUFDN0IsTUFBTSxrQkFBa0IsR0FBRyxFQUFFLENBQUMsV0FBVyxDQUFDO1FBQzFDLE1BQU0sT0FBTyxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUM7UUFJM0IsSUFBSSxlQUFlLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUM3QixzQkFBc0I7WUFFdEIsTUFBTSxRQUFRLEdBQUcsRUFBRSxDQUFDO1lBQ3BCLE1BQU0sU0FBUyxHQUFHLEVBQUUsQ0FBQztZQUNyQixhQUFhO1lBQ2IsU0FBUyxDQUFDLEdBQUcsR0FBRyxFQUFFLEdBQUcsRUFBRSxlQUFlLEVBQUUsQ0FBQztZQUN6QyxNQUFNLFFBQVEsR0FBRyxzQkFBaUIsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsTUFBTSxDQUFDO2dCQUN2RCxLQUFLO2dCQUNMLHFCQUFxQjtnQkFDckIsY0FBYztnQkFDZCxhQUFhO2dCQUNiLFdBQVc7Z0JBQ1gsVUFBVTtnQkFDVixnQkFBZ0I7YUFDbEIsQ0FBQyxDQUFDO1lBQ0gsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN4QixNQUFNLFFBQVEsR0FBRywwQkFBcUIsQ0FBQyxPQUFPLENBQUMsRUFBQyxLQUFLLEVBQUUsa0JBQWtCLEVBQUMsQ0FBQyxDQUFDO1lBQzVFLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7WUFFeEIsYUFBYTtZQUNiLE1BQU0sT0FBTyxHQUFHLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM1QyxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFakMsTUFBTSxZQUFZLEdBQUcsRUFBRSxDQUFDO1lBQ3hCLE1BQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQztZQUNwQixNQUFNLGlCQUFpQixHQUFHLEVBQUUsQ0FBQztZQUU3QixpQkFBaUI7WUFDakIsSUFBSSxTQUFTLEVBQUU7Z0JBQ1osS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7b0JBQzVDLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsbUJBQW1CLENBQUMsRUFBRTt3QkFDdEQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7NEJBQ25FLHVFQUF1RTs0QkFDdkUsSUFBSSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxLQUFLLENBQUMsRUFBRTtnQ0FDeEMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUM7Z0NBQ2hFLFlBQVksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7NkJBQzdEO2lDQUFNO2dDQUNKLGdCQUFNLENBQUMsSUFBSSxDQUFDLDhCQUE4QixhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQzs2QkFDNUU7eUJBQ0g7cUJBQ0g7aUJBQ0g7YUFDSDtZQUVELGFBQWE7WUFDYixJQUFJLEtBQUssRUFBRTtnQkFDUixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtvQkFFNUMsSUFBSSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxLQUFLLElBQUksRUFBRTt3QkFDekMsSUFBSSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7NEJBQzNDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtnQ0FDNUQsdUVBQXVFO2dDQUN2RSxJQUFJLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLElBQUksYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLEtBQUssQ0FBQyxFQUFFO29DQUNySCxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQztvQ0FDNUQsUUFBUSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7aUNBQ2xEO3FDQUFNLElBQUksYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsS0FBSyxDQUFDLEVBQUU7b0NBQy9DLGdCQUFNLENBQUMsSUFBSSxDQUFDLDBCQUEwQixhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztpQ0FDeEU7NkJBQ0g7eUJBQ0g7cUJBQ0g7aUJBQ0g7YUFDSDtZQUVELEtBQUssVUFBVSxXQUFXLENBQUMsWUFBNkIsRUFBRSxPQUFlO2dCQUN0RSxJQUFJO29CQUNELE1BQU0sVUFBVSxHQUFHLElBQUksaUJBQWEsRUFBRSxDQUFDO29CQUN2QyxVQUFVLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztvQkFDN0IsVUFBVSxDQUFDLFVBQVUsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztvQkFDMUQsVUFBVSxDQUFDLGtCQUFrQixHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO29CQUM5RCxVQUFVLENBQUMsWUFBWSxHQUFHLGtCQUFrQixDQUFDO29CQUM3QyxVQUFVLENBQUMsZUFBZSxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7b0JBQzVDLFVBQVUsQ0FBQyxpQkFBaUIsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDO29CQUN4RCxVQUFVLENBQUMsa0JBQWtCLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQztvQkFDakQsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxlQUFlO29CQUN0QyxVQUFVLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztvQkFDN0IsT0FBTyxNQUFNLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztpQkFDakM7Z0JBQUMsT0FBTyxDQUFDLEVBQUU7b0JBQ1QsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsaUNBQWlDLENBQUMsRUFBRSxDQUFDLENBQUM7aUJBQ3JEO1lBQ0osQ0FBQztZQUVELE1BQU0sbUJBQW1CLEdBQUcsRUFBRSxDQUFDO1lBQy9CLElBQUksS0FBSyxFQUFFO2dCQUNSLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxhQUFhLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO29CQUM1QyxJQUFJO3dCQUNELElBQUksYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsSUFBSSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsS0FBSyxDQUFDLEVBQUU7NEJBQ25ILE1BQU0sWUFBWSxHQUFHLE1BQU0sRUFBRSxDQUFDOzRCQUM5QixNQUFNLGNBQWMsR0FBRyxNQUFNLFlBQVksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDO2dDQUN2RCxJQUFJLEVBQUUsa0JBQWtCO2dDQUN4QixFQUFFLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVc7Z0NBQ2hDLHNCQUFzQjtnQ0FDdEIsSUFBSSxFQUFFLE9BQU87NkJBQ2YsQ0FBQyxDQUFDOzRCQUNILG1CQUFtQixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7eUJBQ2pFOzZCQUFNOzRCQUNKLGdCQUFNLENBQUMsSUFBSSxDQUFDLHNCQUFzQixhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQzt5QkFDcEU7cUJBQ0g7b0JBQUMsT0FBTyxDQUFDLEVBQUU7d0JBQ1QsNkNBQTZDO3dCQUM3Qyw0Q0FBNEM7d0JBQzVDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7cUJBQ2pFO2lCQUVIO2FBQ0g7WUFJRCxJQUFJLEtBQUssRUFBRTtnQkFDUixNQUFNLGVBQWUsR0FBRyxNQUFNLGNBQWdCLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxXQUFXLENBQUMsQ0FBQztnQkFDL0UsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7b0JBQzVDLElBQUksYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksSUFBSSxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsS0FBSyxDQUFDLEVBQUU7d0JBQ3JILG1CQUFtQixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7cUJBQ2pFO3lCQUFNLElBQUksYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsS0FBSyxDQUFDLEVBQUU7d0JBQy9DLHlFQUF5RTtxQkFDM0U7aUJBQ0g7YUFDSDtZQUVELElBQUksVUFBZSxDQUFFO1lBQ3JCLElBQUksU0FBUyxJQUFJLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUN2Qyx1QkFBdUI7Z0JBQ3ZCLFVBQVUsR0FBRyxNQUFNLGVBQVMsQ0FBQztvQkFDMUIsWUFBWSxFQUFFLFlBQVk7b0JBQzFCLElBQUksRUFBRSxFQUFFO29CQUNSLEtBQUssRUFBRSxXQUFXO29CQUNsQixPQUFPLEVBQUUsT0FBTztvQkFDaEIsUUFBUSxFQUFFLFFBQVE7b0JBQ2xCLGNBQWMsRUFBRSxjQUFjO2lCQUNoQyxDQUFDLENBQUM7Z0JBQ0gsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7b0JBQzVDLElBQUksYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixJQUFJLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLEtBQUssQ0FBQyxFQUFFO3dCQUNuSSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO3FCQUNyRTt5QkFBTSxJQUFJLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLEtBQUssQ0FBQyxFQUFFO3dCQUMvQyw2RUFBNkU7cUJBQy9FO2lCQUNIO2FBQ0g7WUFHRCxNQUFNLE1BQU0sR0FBRztnQkFDWixTQUFTLEVBQUUsSUFBSTtnQkFDZixJQUFJLEVBQUUsZ0NBQWdDO2dCQUN0QyxTQUFTLEVBQUUsVUFBVTthQUN2QixDQUFDO1lBQ0YsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNqQixNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUN2QyxPQUFPO1NBQ1Q7YUFBTTtZQUNKLE1BQU0sTUFBTSxHQUFnQztnQkFDekMsU0FBUyxFQUFFLEtBQUs7Z0JBQ2hCLElBQUksRUFBRSxpQ0FBaUM7YUFDekMsQ0FBQztZQUNGLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDakIsT0FBTztTQUNUO0tBRUg7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNULE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakIsMkNBQTJDO1FBQzNDLE1BQU0sTUFBTSxHQUFnQztZQUN6QyxTQUFTLEVBQUUsS0FBSztZQUNoQixJQUFJLEVBQUUsdUJBQXVCO1NBQy9CLENBQUM7UUFDRixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2hCLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNmO0FBQ0osQ0FBQyxDQUFDO0FBR1csUUFBQSxJQUFJLEdBQUcsS0FBSyxFQUFFLEdBQVksRUFBRSxHQUFhLEVBQUUsSUFBa0IsRUFBRSxFQUFFO0lBQzNFLElBQUk7UUFFRCxNQUFNLElBQUksR0FBSSxNQUFNLHVCQUFpQixDQUFDLFNBQVMsQ0FBQztZQUM3QztnQkFDRyxRQUFRLEVBQUU7b0JBQ1AsR0FBRyxFQUFFLGVBQWU7b0JBQ3BCLEtBQUssRUFBRTt3QkFDSixJQUFJLEVBQUUsQ0FBQztxQkFDVDtpQkFDSDthQUNIO1lBQ0QsRUFBSSxZQUFZLEVBQUU7b0JBQ1osS0FBSyxFQUFFLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRTtpQkFDbEM7YUFDSDtZQUNEO2dCQUNHLFNBQVMsRUFBRTtvQkFDUixJQUFJLEVBQUUsZUFBZTtvQkFDckIsVUFBVSxFQUFFLEtBQUs7b0JBQ2pCLFlBQVksRUFBRSxLQUFLO29CQUNuQixFQUFFLEVBQUUsWUFBWTtpQkFDbEI7YUFDSDtTQUNILENBQUMsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdEIsTUFBTSxTQUFTLEdBQUcsRUFBRSxDQUFDO1FBQ3JCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ25DLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7WUFDdkIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUM1QixJQUFJLEtBQUssR0FBRyxFQUFFLENBQUM7WUFDZixJQUFJLFFBQVEsR0FBRyxFQUFFLENBQUM7WUFDbEIsSUFBSSxXQUFXLEdBQUcsRUFBRSxDQUFDO1lBQ3JCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDakQsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDO2dCQUNwQyxRQUFRLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7Z0JBQzFDLFdBQVcsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQzthQUNsRDtZQUNELFNBQVMsQ0FBQyxJQUFJLENBQUM7Z0JBQ1osS0FBSyxFQUFFLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUMxQixPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUc7Z0JBQzVCLFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRztnQkFDckMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxHQUFHO2FBRWhELENBQUUsQ0FBQztTQUVOO1FBRUQsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNwQixPQUFPO0tBRVQ7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNULE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakIsMkNBQTJDO1FBQzNDLE1BQU0sTUFBTSxHQUFnQztZQUN6QyxTQUFTLEVBQUUsS0FBSztZQUNoQixJQUFJLEVBQUUsdUJBQXVCO1NBQy9CLENBQUM7UUFDRixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2hCLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNmO0FBQ0osQ0FBQyxDQUFDO0FBR1MsUUFBQSxvQkFBb0IsR0FBRyxLQUFLLEVBQUMsR0FBWSxFQUFFLEdBQWEsRUFBRSxJQUFrQixFQUFFLEVBQUU7SUFDeEYsSUFBSTtRQUNELE1BQU0sb0JBQW9CLEdBQUcsTUFBTSxpQkFBYSxDQUFDLElBQUksQ0FBQyxFQUFDLFFBQVEsRUFBRSxDQUFDLEVBQUMsQ0FBQzthQUMvRCxNQUFNLENBQUM7WUFDTCxvQkFBb0I7WUFDcEIsUUFBUTtZQUNSLFdBQVc7U0FDYixDQUFDO2FBQ0QsSUFBSSxDQUFDO1lBQ0gsV0FBVyxFQUFHLENBQUMsQ0FBQztTQUNsQixDQUFDLENBQUM7UUFDUCxJQUFJLFNBQVMsR0FBUSxFQUFFLENBQUM7UUFDeEIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLG9CQUFvQixDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUVuRCxJQUFJLFNBQVMsQ0FBQyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsUUFBUSxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtnQkFDbEYsNEJBQTRCO2FBQzlCO2lCQUFNO2dCQUNKLFNBQVMsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQzthQUN4RTtTQUNIO1FBQ0QsU0FBUyxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3BDLE1BQU0sU0FBUyxHQUFHLEVBQUUsQ0FBQztRQUVyQixhQUFhO1FBQ2IsU0FBUyxDQUFDLEdBQUcsR0FBRyxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsQ0FBQztRQUNuQyxNQUFNLFFBQVEsR0FBRyxNQUFNLHNCQUFpQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbkQsTUFBTSxDQUFDO1lBQ0wsS0FBSztZQUNMLFVBQVU7WUFDVixPQUFPO1lBQ1AsYUFBYTtTQUNmLENBQUM7YUFDRCxJQUFJLENBQUM7WUFDSCxXQUFXLEVBQUcsQ0FBQyxDQUFDO1NBQ2xCLENBQUMsQ0FBQztRQUVQLE1BQU0sU0FBUyxHQUFHLEVBQUUsQ0FBQztRQUNyQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUN2QyxNQUFNLEVBQUUsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO1lBRTNCLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFDaEMsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztZQUN0QyxNQUFNLFdBQVcsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDO1lBRzVDLFNBQVMsQ0FBQyxJQUFJLENBQUM7Z0JBQ1osS0FBSyxFQUFFLEVBQUU7Z0JBQ1QsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHO2dCQUM1QixVQUFVLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUc7Z0JBQ3JDLGFBQWEsRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsR0FBRzthQUVoRCxDQUFFLENBQUM7U0FFTjtRQUVELEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDcEIsT0FBTztLQUVUO0lBQUMsT0FBTyxDQUFDLEVBQUU7UUFDVCxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pCLDJDQUEyQztRQUMzQyxNQUFNLE1BQU0sR0FBZ0M7WUFDekMsU0FBUyxFQUFFLEtBQUs7WUFDaEIsSUFBSSxFQUFFLHVCQUF1QjtTQUMvQixDQUFDO1FBQ0YsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNoQixJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDZjtBQUNKLENBQUMsQ0FBQztBQUVTLFFBQUEscUJBQXFCLEdBQUcsS0FBSyxFQUFDLEdBQVksRUFBRSxHQUFhLEVBQUUsSUFBa0IsRUFBRSxFQUFFO0lBQ3pGLElBQUk7UUFDRCxNQUFNLE9BQU8sR0FBRyxNQUFNLGlCQUFhLENBQUMsU0FBUyxDQUFDO1lBQzNDO2dCQUNHLFFBQVEsRUFBRTtvQkFDUCxRQUFRLEVBQUUsQ0FBQztpQkFDYjthQUNILEVBQUU7Z0JBQ0EsUUFBUSxFQUFFO29CQUNQLEtBQUssRUFBRSxxQkFBcUI7b0JBQzVCLFVBQVUsRUFBRTt3QkFDVCxPQUFPLEVBQUUsWUFBWTtxQkFDdkI7aUJBQ0g7YUFDSCxFQUFFO2dCQUNBLE9BQU8sRUFBRTtvQkFDTixXQUFXLEVBQUUsQ0FBQyxDQUFDO2lCQUNqQjthQUNILEVBQUU7Z0JBQ0EsUUFBUSxFQUFFLEdBQUc7YUFDZixFQUFFO2dCQUNBLFNBQVMsRUFBRTtvQkFDUixNQUFNLEVBQUUsZUFBZTtvQkFDdkIsWUFBWSxFQUFFLEtBQUs7b0JBQ25CLGNBQWMsRUFBRSxLQUFLO29CQUNyQixJQUFJLEVBQUUsVUFBVTtpQkFDbEI7YUFFSDtTQUNILENBQUMsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdEIsTUFBTSxTQUFTLEdBQVEsRUFBRSxDQUFDO1FBQzFCLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3RDLE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7WUFDckMsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNyRCxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDWixJQUFJLFFBQVEsRUFBRTtnQkFDWCxJQUFJLFFBQVEsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO29CQUN0QixTQUFTLENBQUMsSUFBSSxDQUFDO3dCQUNaLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRzt3QkFDdEIsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUc7d0JBQ3BELFVBQVUsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHO3dCQUM3RCxhQUFhLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsR0FBRzt3QkFDdEUsYUFBYSxFQUFHLFdBQVc7cUJBQzdCLENBQUMsQ0FBQztpQkFDTDthQUVIO1NBR0g7UUFDRCxNQUFNLGdCQUFnQixHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFNLEVBQUUsQ0FBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUMzRixHQUFHLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDM0IsT0FBTztLQUVUO0lBQUMsT0FBTyxDQUFDLEVBQUU7UUFDVCxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pCLDJDQUEyQztRQUMzQyxNQUFNLE1BQU0sR0FBZ0M7WUFDekMsU0FBUyxFQUFFLEtBQUs7WUFDaEIsSUFBSSxFQUFFLHVCQUF1QjtTQUMvQixDQUFDO1FBQ0YsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNoQixJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDZjtBQUNKLENBQUMsQ0FBQztBQUdTLFFBQUEsb0JBQW9CLEdBQUcsS0FBSyxFQUFDLEdBQVksRUFBRSxHQUFhLEVBQUUsSUFBa0IsRUFBRSxFQUFFO0lBQ3hGLElBQUk7UUFDRCxNQUFNLE9BQU8sR0FBRyxNQUFNLG1CQUFjLENBQUMsU0FBUyxDQUFDO1lBQzVDO2dCQUNHLFFBQVEsRUFBRTtvQkFDUCxRQUFRLEVBQUUsZUFBZTtpQkFDM0I7YUFDSCxFQUFFO2dCQUNBLFFBQVEsRUFBRTtvQkFDUCxLQUFLLEVBQUU7d0JBQ0osV0FBVyxFQUFFLFlBQVk7cUJBQzNCO29CQUNELE9BQU8sRUFBRTt3QkFDTixNQUFNLEVBQUUsQ0FBQztxQkFDWDtpQkFDSDthQUNILEVBQUU7Z0JBQ0EsT0FBTyxFQUFFO29CQUNOLE9BQU8sRUFBRSxDQUFDLENBQUM7aUJBQ2I7YUFDSDtZQUNEO2dCQUNHLFFBQVEsRUFBRSxHQUFHO2FBQ2Y7WUFDRDtnQkFDRyxTQUFTLEVBQUU7b0JBQ1IsTUFBTSxFQUFFLGVBQWU7b0JBQ3ZCLFlBQVksRUFBRSxlQUFlO29CQUM3QixjQUFjLEVBQUUsTUFBTTtvQkFDdEIsSUFBSSxFQUFFLFVBQVU7aUJBQ2xCO2FBQ0g7U0FDSCxDQUFDLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RCLE1BQU0sU0FBUyxHQUFRLEVBQUUsQ0FBQztRQUMxQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUN0QyxvRkFBb0Y7WUFDcEYsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztZQUNyQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDWix5RUFBeUU7WUFDekUsSUFBSSxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtnQkFDdEIsU0FBUyxDQUFDLElBQUksQ0FBQztvQkFDWixPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUs7b0JBQ3pCLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHO29CQUM5QyxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRztvQkFDcEQsVUFBVSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUc7b0JBQzdELGFBQWEsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxHQUFHO2lCQUN4RSxDQUFDLENBQUM7YUFDTDtTQUVIO1FBQ0QsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNwQixPQUFPO0tBRVQ7SUFBQyxPQUFPLENBQUMsRUFBRTtRQUNULE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakIsMkNBQTJDO1FBQzNDLE1BQU0sTUFBTSxHQUFnQztZQUN6QyxTQUFTLEVBQUUsS0FBSztZQUNoQixJQUFJLEVBQUUsdUJBQXVCO1NBQy9CLENBQUM7UUFDRixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2hCLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNmO0FBQ0osQ0FBQyxDQUFDO0FBQ1MsUUFBQSxXQUFXLEdBQUcsS0FBSyxFQUFDLEdBQVksRUFBRSxHQUFhLEVBQUUsSUFBa0IsRUFBRSxFQUFFO0lBQy9FLElBQUk7UUFDRCwwQ0FBMEM7UUFDMUMsTUFBTSxRQUFRLEdBQUcsTUFBTSxzQkFBaUIsQ0FBQyxPQUFPLENBQUMsRUFBQyxhQUFhLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUMsQ0FBQzthQUMxRSxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDeEIsSUFBSSxDQUFDLFFBQVEsRUFBRTtZQUNaLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO1lBQ3BDLE9BQVE7U0FDVjtRQUNELE1BQU0sSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUNoQixJQUFLLFFBQVEsQ0FBQyxNQUFNLEVBQUU7WUFDbkIsTUFBTSxJQUFJLEdBQUcsTUFBTSxhQUFRLENBQUMsSUFBSSxDQUFDLEVBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ3RGLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO2dCQUNuQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQzthQUMzQjtTQUNIO1FBQ0QsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDLEdBQUcsQ0FBQztRQUM1QixNQUFNLFNBQVMsR0FBRyxFQUFFLENBQUM7UUFDckIsYUFBYTtRQUNiLFNBQVMsQ0FBQyxhQUFhLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUVoRCxNQUFNLFNBQVMsR0FBRyxNQUFNLGVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBQyx3Q0FBd0MsRUFBRSxNQUFNLEVBQUMsQ0FBQzthQUN0RixNQUFNLENBQUM7WUFDTCxLQUFLO1lBQ0wsS0FBSztZQUNMLE1BQU07WUFDTixPQUFPO1lBQ1AsU0FBUztZQUNULHlCQUF5QjtTQUMzQixDQUFDLENBQUM7UUFDUCxNQUFNLGNBQWMsR0FBUSxFQUFFLENBQUM7UUFDL0IsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDeEMscURBQXFEO1lBQ3JELE1BQU0sRUFBRSxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyx1QkFBdUIsQ0FBQztZQUNoRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFFakMsSUFBSSxNQUFNLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxRQUFRLEVBQUUsRUFBRTtvQkFDdkQseUNBQXlDO29CQUN6QyxjQUFjLENBQUMsSUFBSSxDQUFDO3dCQUNqQixLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUc7d0JBQ3ZCLE1BQU0sRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSTt3QkFDekIsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJO3FCQUNwQixDQUFDLENBQUM7aUJBQ0w7YUFDSDtTQUNIO1FBRUQsTUFBTSxhQUFhLEdBQUcsTUFBTSx1QkFBaUIsQ0FBQyxJQUFJLENBQUMsRUFBQyxjQUFjLEVBQUUsTUFBTSxFQUFDLENBQUM7YUFDdkUsTUFBTSxDQUFDO1lBQ0wsS0FBSztZQUNMLE9BQU87WUFDUCxXQUFXO1lBQ1gsV0FBVztZQUNYLGVBQWU7WUFDZixTQUFTO1lBQ1QsV0FBVztTQUNiLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDTCxXQUFXLEVBQUcsQ0FBQyxDQUFDO1NBQ2xCLENBQUMsQ0FBQztRQUNQLG9EQUFvRDtRQUdwRCxNQUFNLFdBQVcsR0FBRyxNQUFNLGFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBQyxtQkFBbUIsRUFBRSxNQUFNLEVBQUMsQ0FBQzthQUNqRSxNQUFNLENBQUM7WUFDTCxLQUFLO1lBQ0wsTUFBTTtZQUNOLE9BQU87WUFDUCxPQUFPO1lBQ1AsT0FBTztZQUNQLGFBQWE7U0FDZixDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQztZQUNwQiwrQ0FBK0M7YUFDOUMsSUFBSSxDQUFDO1lBQ0gsV0FBVyxFQUFHLENBQUMsQ0FBQztTQUNsQixDQUFDLENBQUM7UUFFUCxNQUFNLFdBQVcsR0FBRyxFQUFFLENBQUM7UUFDdkIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7WUFDMUMsTUFBTSxTQUFTLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUN2QyxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUM7WUFDZixJQUFJLFNBQVMsQ0FBQztZQUNkLElBQUksV0FBVyxHQUFHLEtBQUssQ0FBQztZQUV4QixNQUFNLEdBQUcsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ2hDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO2dCQUNsQyxJQUFJLE1BQU0sQ0FBQyxRQUFRLEVBQUUsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRSxFQUFFO29CQUN2RCxNQUFNLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztvQkFDdkIsU0FBUyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7b0JBQzdCLFNBQVMsR0FBRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsaUJBQWlCLEVBQUUsR0FBRyxLQUFLLENBQUUsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2lCQUNwSTthQUNIO1lBQ0QsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3hDLElBQUksR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRTtnQkFDaEIsV0FBVyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLEtBQUssTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO2FBQ3JFO1lBQ0QsTUFBTSxVQUFVLEdBQUcsTUFBTSx1QkFBdUIsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNoSSxJQUFJLFVBQVUsRUFBRTtnQkFDYixzREFBc0Q7Z0JBQ3RELE1BQU0sY0FBYyxHQUFHLE1BQU0sb0JBQWUsQ0FBQyxPQUFPLENBQUMsRUFBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLE1BQU0sRUFBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFFekcsdURBQXVEO2dCQUN2RCxXQUFXLENBQUMsSUFBSSxDQUFDO29CQUNkLE9BQU8sRUFBRSxTQUFTO29CQUNsQixRQUFRLEVBQUUsTUFBTTtvQkFDaEIsV0FBVyxFQUFFLFNBQVM7b0JBQ3RCLGFBQWEsRUFBRSxjQUFjLElBQUksY0FBYyxDQUFDLElBQUk7b0JBQ3BELGFBQWEsRUFBRSxXQUFXLEtBQUssSUFBSTtpQkFDckMsQ0FBQyxDQUFDO2FBQ0w7aUJBQU07Z0JBQ0osZ0JBQU0sQ0FBQyxJQUFJLENBQUMsNEJBQTRCLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVzt5QkFDakksTUFBTSxXQUFXLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLO2FBQ2pELENBQUMsQ0FBQzthQUNMO1NBQ0g7UUFFRCxNQUFNLEtBQUssR0FFUDtZQUNELE1BQU0sRUFBRSxDQUFDO1NBQ1gsQ0FBQztRQUNGLE1BQU0sZ0JBQWdCLEdBQUcsTUFBTSwwQkFBcUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxDQUFDO1lBQ3JFLEtBQUs7WUFDTCxPQUFPO1lBQ1AsT0FBTztZQUNQLE1BQU07WUFDTixVQUFVO1lBQ1YsUUFBUTtTQUNWLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDRCxvQkFBb0IsRUFBRSxDQUFDLENBQUM7U0FDMUIsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO1FBTWQsTUFBTSxXQUFXLEdBQUcsTUFBTSxpQkFBYSxDQUFDLElBQUksQ0FBQyxFQUFDLG9CQUFvQixFQUFFLE1BQU0sRUFBQyxDQUFDO2FBQ3ZFLElBQUksQ0FBQztZQUNILEtBQUssRUFBRSxDQUFDLENBQUM7U0FDWCxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0scUJBQXFCLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUM7UUFFNUUsa0RBQWtEO1FBQ2xELGlGQUFpRjtRQUVqRixHQUFHLENBQUMsTUFBTSxDQUFDLFdBQVcsRUFBRTtZQUNyQixRQUFRLEVBQUUsUUFBUTtZQUNsQixXQUFXLEVBQUUsY0FBYztZQUMzQixhQUFhLEVBQUUsYUFBYTtZQUM1QixXQUFXLEVBQUcsV0FBVztZQUN6QixlQUFlLEVBQUUsZ0JBQWdCO1lBQ2pDLGNBQWMsRUFBRSxNQUFNO1lBQ3RCLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVztZQUNqQyxXQUFXLEVBQUUsV0FBVztZQUN4QixxQkFBcUIsRUFBRSxxQkFBcUI7WUFDNUMsS0FBSyxFQUFFLEVBQUU7WUFDVCxTQUFTLEVBQUUsRUFBRTtZQUNiLElBQUksRUFBRSxJQUFJO1NBQ1osQ0FBQyxDQUFDO0tBQ0w7SUFBQyxPQUFPLEdBQUcsRUFBRTtRQUNYLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0tBQ25CO0FBQ0osQ0FBQyxDQUFDO0FBR1MsUUFBQSxzQkFBc0IsR0FBRyxLQUFLLEVBQUMsR0FBWSxFQUFFLEdBQWEsRUFBRSxJQUFrQixFQUFFLEVBQUU7SUFDMUYsSUFBSTtRQUNELE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUM7UUFDcEIsTUFBTSxVQUFVLEdBQUcsSUFBSSxpQkFBYSxFQUFFLENBQUM7UUFDdkMsVUFBVSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDO1FBQ2hDLFVBQVUsQ0FBQyxVQUFVLEdBQUcsRUFBRSxDQUFDLGNBQWMsQ0FBQztRQUMxQyxVQUFVLENBQUMsa0JBQWtCLEdBQUcsRUFBRSxDQUFDLGNBQWMsQ0FBQztRQUNsRCxVQUFVLENBQUMsWUFBWSxHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQztRQUMvQyxVQUFVLENBQUMsZUFBZSxHQUFHLEVBQUUsQ0FBQyxjQUFjLENBQUM7UUFDL0MsVUFBVSxDQUFDLGlCQUFpQixHQUFHLEVBQUUsQ0FBQyxlQUFlLENBQUM7UUFDbEQsVUFBVSxDQUFDLGtCQUFrQixHQUFHLEVBQUUsQ0FBQyxjQUFjLENBQUM7UUFDbEQsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxlQUFlO1FBRXRDLE1BQU0sWUFBWSxHQUFHLE1BQU0sVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDO1FBRzdDLE1BQU0sWUFBWSxHQUFHLE1BQU0sRUFBRSxDQUFDO1FBQzlCLE1BQU0sY0FBYyxHQUFHLE1BQU0sWUFBWSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUM7WUFDdkQsSUFBSSxFQUFFLEVBQUUsQ0FBQyxpQkFBaUI7WUFDMUIsRUFBRSxFQUFFLEVBQUUsQ0FBQyxlQUFlO1lBQ3RCLHNCQUFzQjtZQUN0QixJQUFJLEVBQUUsRUFBRSxDQUFDLE9BQU87U0FDbEIsQ0FBQyxDQUFDO1FBQ0gsd0RBQXdEO1FBSXhELE9BQU8sR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsR0FBRyxLQUFLLEdBQUcsRUFBRSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0tBQ3pFO0lBQUMsT0FBTyxHQUFHLEVBQUU7UUFDWCxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUNuQjtBQUNKLENBQUMsQ0FBQztBQUdGLFNBQVMsdUJBQXVCLENBQUMsS0FBZSxFQUFFLFdBQW1CLEVBQUUsV0FBbUIsRUFBRSxZQUFZLEdBQUcsSUFBSTtJQUM1RyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDM0MsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5QixJQUFJLFdBQVcsS0FBSyxLQUFLLENBQUMsV0FBVyxFQUFFO1lBQ3BDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDaEQsSUFBSSxLQUFLLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsS0FBSyxXQUFXLEVBQUU7b0JBQ25ELElBQUksWUFBWSxJQUFJLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFO3dCQUMvQyxPQUFPLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7cUJBQzlCO3lCQUFNO3dCQUNKLE9BQU8sS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztxQkFDOUI7aUJBQ0g7YUFDSDtTQUNIO0tBQ0g7QUFDSixDQUFDO0FBQ1ksUUFBQSxlQUFlLEdBQUcsS0FBSyxFQUFFLEdBQVksRUFBRSxHQUFhLEVBQUUsSUFBa0IsRUFBRSxFQUFFO0lBRXRGLFFBQVE7SUFDUiwwQkFBMEI7SUFDMUIsK0NBQStDO0lBRS9DLHVEQUF1RDtJQUV2RCwyQkFBMkI7SUFDM0Isc0JBQXNCO0lBQ3RCLGtEQUFrRDtJQUNsRCwwRUFBMEU7SUFDMUUsa0JBQWtCO0lBQ2xCLGtDQUFrQztJQUNsQywyQkFBMkI7SUFDM0IsMEJBQTBCO0lBQzFCLHdCQUF3QjtJQUN4QixzQkFBc0I7SUFDdEIsWUFBWTtJQUVaLHNFQUFzRTtJQU10RSwyQkFBMkI7SUFDM0IsMkJBQTJCO0lBQzNCLG1DQUFtQztJQUNuQyxnREFBZ0Q7SUFDaEQsaUNBQWlDO0lBSWpDLHVDQUF1QztJQUN2QywrQkFBK0I7SUFFL0IsNkJBQTZCO0lBQzdCLDhCQUE4QjtJQUM5QixzQkFBc0I7SUFDdEIsa0RBQWtEO0lBQ2xELG9FQUFvRTtJQUNwRSxrQkFBa0I7SUFDbEIsa0NBQWtDO0lBQ2xDLHdCQUF3QjtJQUN4QixzQkFBc0I7SUFDdEIsWUFBWTtJQUNaLGlDQUFpQztJQUNqQyxvRUFBb0U7SUFDcEUsa0JBQWtCO0lBQ2xCLDJCQUEyQjtJQUMzQix3QkFBd0I7SUFDeEIsc0JBQXNCO0lBQ3RCLFlBQVk7SUFDWixpQ0FBaUM7SUFDakMsb0VBQW9FO0lBQ3BFLGtCQUFrQjtJQUNsQiwwQkFBMEI7SUFDMUIsd0JBQXdCO0lBQ3hCLHNCQUFzQjtJQUN0QixZQUFZO0lBQ1osaUNBQWlDO0lBR2pDLHFEQUFxRDtJQUNyRCwwQ0FBMEM7SUFDMUMsc0NBQXNDO0lBQ3RDLHdDQUF3QztJQUV4QyxpQ0FBaUM7SUFDakMsNkJBQTZCO0lBQzdCLHNDQUFzQztJQUV0QywwQkFBMEI7SUFDMUIseURBQXlEO0lBRXpELGdFQUFnRTtJQUNoRSxxRUFBcUU7SUFDckUseUZBQXlGO0lBQ3pGLDRGQUE0RjtJQUM1RixnRkFBZ0Y7SUFDaEYsbUJBQW1CO0lBQ25CLGdCQUFnQjtJQUNoQixhQUFhO0lBQ2IsVUFBVTtJQUVWLHNCQUFzQjtJQUN0QixxREFBcUQ7SUFFckQscURBQXFEO0lBQ3JELDBEQUEwRDtJQUMxRCw4RUFBOEU7SUFDOUUsNEZBQTRGO0lBQzVGLGlFQUFpRTtJQUNqRSxtQkFBbUI7SUFDbkIsZ0JBQWdCO0lBQ2hCLGFBQWE7SUFDYixVQUFVO0lBRVYsNEJBQTRCO0lBQzVCLHVEQUF1RDtJQUV2RCxzREFBc0Q7SUFDdEQsMkRBQTJEO0lBQzNELGlGQUFpRjtJQUNqRix5RkFBeUY7SUFDekYscUVBQXFFO0lBQ3JFLHNCQUFzQjtJQUN0QixnQkFBZ0I7SUFDaEIsYUFBYTtJQUNiLFVBQVU7SUFFVixxQkFBcUI7SUFFckIseUNBQXlDO0lBQ3pDLCtDQUErQztJQUMvQyw2Q0FBNkM7SUFDN0MsZ0RBQWdEO0lBQ2hELDhDQUE4QztJQUM5QywrQ0FBK0M7SUFDL0MsMkNBQTJDO0lBQzNDLGtDQUFrQztJQUNsQyxvQkFBb0I7SUFDcEIsaUZBQWlGO0lBQ2pGLGFBQWE7SUFDYixVQUFVO0lBSVYscUJBQXFCO0lBQ3JCLDRGQUE0RjtJQUM1RiwwRUFBMEU7SUFDMUUsVUFBVTtJQUVWLHlCQUF5QjtJQUN6QixtQ0FBbUM7SUFDbkMsZ0RBQWdEO0lBQ2hELHVDQUF1QztJQUN2QyxxQkFBcUI7SUFDckIsK0JBQStCO0lBQy9CLDZCQUE2QjtJQUM3QiwrQkFBK0I7SUFDL0IsMENBQTBDO0lBQzFDLGVBQWU7SUFDZix3RUFBd0U7SUFDeEUsVUFBVTtJQUdWLHNEQUFzRDtJQUN0RCw0QkFBNEI7SUFDNUIsa0RBQWtEO0lBQ2xELFdBQVc7SUFDWCwwQkFBMEI7SUFDMUIsZ0JBQWdCO0lBQ2hCLGlCQUFpQjtJQUNqQix5REFBeUQ7SUFDekQsZ0NBQWdDO0lBQ2hDLHNEQUFzRDtJQUN0RCxjQUFjO0lBQ2QsNkJBQTZCO0lBQzdCLG1CQUFtQjtJQUNuQixRQUFRO0lBRVIsZ0JBQWdCO0lBQ2hCLHVCQUF1QjtJQUN2QixpREFBaUQ7SUFDakQsbURBQW1EO0lBQ25ELDBCQUEwQjtJQUMxQixzQ0FBc0M7SUFDdEMsUUFBUTtJQUNSLHNCQUFzQjtJQUN0QixtQkFBbUI7SUFDbkIsSUFBSTtBQUNQLENBQUMsQ0FBQztBQUVTLFFBQUEsbUJBQW1CLEdBQUcsS0FBSyxFQUFDLEdBQVksRUFBRSxHQUFhLEVBQUUsSUFBa0IsRUFBRSxFQUFFO0lBQ3ZGLElBQUk7UUFDRCxNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQztRQUNqRCxNQUFNLFNBQVMsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNqRCxJQUFJLENBQUMsQ0FBQyxTQUFTLEtBQUssQ0FBQyxJQUFJLFNBQVMsS0FBSyxDQUFDLENBQUMsRUFBRTtZQUN4QyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2hCLGdCQUFNLENBQUMsSUFBSSxDQUFDLDRCQUE0QixFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDL0QsTUFBTSxNQUFNLEdBQWdDO2dCQUN6QyxTQUFTLEVBQUUsS0FBSztnQkFDaEIsSUFBSSxFQUFFLFNBQVM7YUFDakIsQ0FBQztZQUNGLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDakIsT0FBTztTQUNUO1FBQ0QsTUFBTSxZQUFZLEdBQUcsTUFBTSxzQkFBaUIsQ0FBQyxPQUFPLENBQUM7WUFDbEQsR0FBRyxFQUFFLGNBQWM7U0FDckIsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxZQUFZLEVBQUU7WUFDZixZQUFZLENBQUMsY0FBYyxHQUFHLFNBQVMsQ0FBQztZQUN4QyxNQUFNLFlBQVksQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUUxQixNQUFNLE1BQU0sR0FBZ0M7Z0JBQ3pDLFNBQVMsRUFBRSxJQUFJO2dCQUNmLElBQUksRUFBRSxTQUFTLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVM7YUFDeEMsQ0FBQztZQUNGLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDakIsT0FBTztTQUNUO2FBQU07WUFDSixnQkFBTSxDQUFDLElBQUksQ0FBQywyQkFBMkIsY0FBYyxFQUFFLENBQUMsQ0FBQztZQUN6RCxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2hCLE1BQU0sTUFBTSxHQUFnQztnQkFDekMsU0FBUyxFQUFFLEtBQUs7Z0JBQ2hCLElBQUksRUFBRSxTQUFTO2FBQ2pCLENBQUM7WUFDRixHQUFHLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ2pCLE9BQU87U0FDVDtLQUVIO0lBQUMsT0FBTyxDQUFDLEVBQUU7UUFDVCxnQkFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNmLE1BQU0sTUFBTSxHQUFnQztZQUN6QyxTQUFTLEVBQUUsS0FBSztZQUNoQixJQUFJLEVBQUUsdUJBQXVCO1NBQy9CLENBQUM7UUFDRixHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2hCLEdBQUcsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDbkI7QUFDSixDQUFDLENBQUMiLCJmaWxlIjoiY29udHJvbGxlcnMvcHJvbW90aW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUmVxdWVzdCwgUmVzcG9uc2UsIE5leHRGdW5jdGlvbiB9IGZyb20gJ2V4cHJlc3MnO1xuXG5pbXBvcnQgeyBkZWZhdWx0IGFzIEV2ZW50TW9kZWwgfSBmcm9tICcuLi9tb2RlbHMvRXZlbnQnO1xuaW1wb3J0IHsgRGF0YU9wZXJhdGlvblJlc3VsdCB9IGZyb20gJy4uLy4uLy4uL3NoYXJlZC9PcGVyYXRpb25SZXN1bHQnO1xuaW1wb3J0IHsgRXZlbnRMaXN0IH0gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL0V2ZW50TGlzdFJlc3BvbnNlRFRPJztcblxuaW1wb3J0IHsgZGVmYXVsdCBhcyBQcm9tb3Rpb25Mb2dNb2RlbCB9IGZyb20gJy4uL21vZGVscy9Qcm9tb3Rpb25Mb2dzJztcbmltcG9ydCBSZWdpc3RyYXRpb25Nb2RlbCBmcm9tICcuLi9tb2RlbHMvUmVnaXN0cmF0aW9uJztcbmltcG9ydCBzZW5kTm90aWZpY2F0aW9uIGZyb20gJy4uL2NvbW1vbi9BcG5zJztcbmltcG9ydCB7IE11bHRpQ2FzdCB9IGZyb20gJy4uL2NvbW1vbi9GQ00nO1xuaW1wb3J0ICogYXMgVHdpbGlvIGZyb20gJ3R3aWxpbyc7XG5pbXBvcnQgTG90TW9kZWwgZnJvbSAnLi4vbW9kZWxzL0xvdCc7XG5pbXBvcnQgeyBkZWZhdWx0IGFzIEV2ZW50UGhvbmVOdW1iZXJNb2RlbCB9IGZyb20gJy4uL21vZGVscy9FdmVudFBob25lTnVtYmVyJztcbmltcG9ydCB7IGRlZmF1bHQgYXMgTWVzc2FnZVNjaGVtYSB9IGZyb20gJy4uL21vZGVscy9NZXNzYWdlJztcblxuaW1wb3J0IEV2ZW50RFRPIGZyb20gJy4uLy4uLy4uL3NoYXJlZC9FdmVudERUTyc7XG5pbXBvcnQgUm91bmRDb250ZXN0YW50RFRPIGZyb20gJy4uLy4uLy4uL3NoYXJlZC9Sb3VuZENvbnRlc3RhbnREVE8nO1xuaW1wb3J0IHsgZGVmYXVsdCBhcyBDb250ZXN0YW50TW9kZWwgfSBmcm9tICcuLi9tb2RlbHMvQ29udGVzdGFudCc7XG5pbXBvcnQgVm90aW5nTG9nTW9kZWwgZnJvbSAnLi4vbW9kZWxzL1ZvdGluZ0xvZyc7XG5cbmltcG9ydCBSZWdpc3RyYXRpb25EVE8gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL1JlZ2lzdHJhdGlvbkRUTyc7XG5pbXBvcnQgbG9nZ2VyIGZyb20gJy4uL2NvbmZpZy9sb2dnZXInO1xuXG5cbmV4cG9ydCBjb25zdCBnZXRFdmVudHMgPSBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcblxuICAgY29uc3QgUGhvbmVOdW1iZXIgPSBmYWxzZTtcblxuICAgY29uc3QgZXZlbnRJZCA9IHJlcS5xdWVyeS5ldmVudE5hbWU7XG4gICBjb25zdCBxdWVyeToge1xuICAgICAgTmFtZT86IGFueTtcblxuICAgfSA9IHt9O1xuXG5cbiAgIGlmIChldmVudElkICYmIGV2ZW50SWQubGVuZ3RoID4gMCkge1xuICAgICAgcXVlcnkuTmFtZSA9IG5ldyBSZWdFeHAoZXZlbnRJZCk7XG4gICB9XG4gICBjb25zdCBwcm9taXNlcyA9IFtdO1xuICAgY29uc3QgcHJvbWlzZTEgPSBFdmVudE1vZGVsLmZpbmQocXVlcnkpLnNlbGVjdChbXG4gICAgICAnX2lkJyxcbiAgICAgICdFSUQnLFxuICAgICAgJ05hbWUnLFxuICAgICAgJ0Rlc2NyaXB0aW9uJyxcbiAgIF0pLnNvcnQoe1xuICAgICAgJ0V2ZW50U3RhcnREYXRlVGltZSc6IC0xXG4gICB9KS5leGVjKCk7XG5cbiAgIHByb21pc2VzLnB1c2gocHJvbWlzZTEpO1xuXG4gICAvLyBwYXN0IGV2ZW50IGxpc3RcbiAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG4gICBjb25zdCBhY3RpdmVFdmVudHMgPSByZXN1bHRzWzBdO1xuXG4gICBjb25zdCBhY3RpdmVFdmVudHNMaXN0OiBhbnkgPSBbXTtcblxuICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhY3RpdmVFdmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IGV2ZW50ID0gYWN0aXZlRXZlbnRzW2ldO1xuXG4gICAgICBjb25zdCBldmVudE9iaiA9IHtcbiAgICAgICAgIGlkOiBldmVudC5faWQsXG4gICAgICAgICBFSUQ6IGV2ZW50LkVJRCB8fCAnJyxcbiAgICAgICAgIHRpdGxlOiBldmVudC5OYW1lLFxuICAgICAgICAgZXZlbnRJZDogZXZlbnQuaWQsXG4gICAgICAgICBFdmVudE5vOiBpICsgMVxuICAgICAgfTtcbiAgICAgIGFjdGl2ZUV2ZW50c0xpc3QucHVzaChldmVudE9iaik7XG4gICB9XG5cbiAgIGNvbnN0IGV2ZW50TGlzdDogRXZlbnRMaXN0W10gPSBbXG4gICAgICB7XG4gICAgICAgICBsYWJlbDogJ0FMTCBFVkVOVFMnLFxuICAgICAgICAgaXRlbXM6IGFjdGl2ZUV2ZW50c0xpc3QsXG4gICAgICAgICB0b3BQbGF5ZXJVcmw6ICcnXG4gICAgICB9XG4gICBdO1xuXG4gICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8RXZlbnRMaXN0W10+ID0ge1xuICAgICAgJ1N1Y2Nlc3MnOiB0cnVlLFxuICAgICAgRGF0YTogZXZlbnRMaXN0XG4gICB9O1xuXG4gICByZXMuanNvbihhY3RpdmVFdmVudHNMaXN0KTtcbn07XG5cblxuZXhwb3J0IGNvbnN0IHNlbmRQcm9tb3Rpb24gPSBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcblxuICAgLy8gY29uc3QgYXV0aEhlYWRlciA9IHJlcS5oZWFkZXIoJ0F1dGhvcml6YXRpb24nKTtcbiAgIC8vIGxvZ2dlci5pbmZvKCdyZXEnLCByZXEudXNlciwgJ2F1dGhIZWFkZXInLCBhdXRoSGVhZGVyKTtcbiAgIHJlcy5yZW5kZXIoJ2hvbWUnLCB7XG4gICAgICAvLyB0b2tlbjogYXV0aEhlYWRlciAmJiBhdXRoSGVhZGVyLnJlcGxhY2UoJ0JlYXJlciAnLCAnJyksXG4gICAgICAvLyBldmVudElkOiByZXEucGFyYW1zLmV2ZW50SWRcbiAgICAgIG1lc3NhZ2U6ICdIaSwgdGhpcyBpcyBOaXRpbiBrYXVzaGFsJ1xuICAgfSk7XG59O1xuXG5cbmV4cG9ydCBjb25zdCBzYXZlUHJvbW90aW9uID0gYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG5cbiAgIHRyeSB7XG4gICAgICBjb25zdCBkdCA9IHJlcS5ib2R5O1xuICAgICAgLy8gcHJvbW90aW9uT2JqLm5vdGlmeUFuZHJvaWQgPSBcImlvc1wiO1xuICAgICAgLy8gY29uc3QgZXZlbnREYXRhID0gSlNPTi5wYXJzZShkdFswXS5kdCk7XG5cbiAgICAgIGNvbnN0IGxvZ3MgPSB7XG4gICAgICAgICAncGhvbmVudW1iZXInOiBkdFswXS5QaG9uZW51bWJlcixcbiAgICAgICAgICdub3RpZnlTTVMnOiBkdFswXS5zbXMsXG4gICAgICAgICAnbm90aWZ5aU9TJzogZHRbMF0uaW9zLFxuICAgICAgICAgJ25vdGlmeUFuZHJvaWQnOiBkdFswXS5hbmRyb2lkLFxuICAgICAgICAgJ21lc3NhZ2UnOiBkdFswXS5tZXNzYWdlLFxuICAgICAgfTtcblxuXG4gICAgICBjb25zdCBldmVudERhdGEgPSBkdFswXS5kdDtcbi8vIGNvbnNvbGUubG9nKCdldmVudERhdGEgPT09Pj4nLCBKU09OLnN0cmluZ2lmeShldmVudERhdGEpKTtcbiAgICAgIGlmIChldmVudERhdGEubGVuZ3RoID4gMCkge1xuICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBldmVudERhdGEubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgICAgY29uc3QgYmlkcyA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoZXZlbnREYXRhW2ldLkJpZHMpKTtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgYmlkcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgLy8gSU5TRVJUSU9OIEhFUkVcbiAgICAgICAgICAgICAgIGNvbnN0IHByb21vdGlvbk9iaiA9IG5ldyBQcm9tb3Rpb25Mb2dNb2RlbCgpO1xuICAgICAgICAgICAgICAgcHJvbW90aW9uT2JqLmV2ZW50ID0gZXZlbnREYXRhW2ldLkV2ZW50O1xuICAgICAgICAgICAgICAgcHJvbW90aW9uT2JqLmxvdHMgPSBldmVudERhdGFbaV0ubG90SWQ7XG4gICAgICAgICAgICAgICBwcm9tb3Rpb25PYmoucmVnaXN0cmF0aW9uID0gYmlkc1tqXS5SZWdpc3RyYXRpb247XG4gICAgICAgICAgICAgICBwcm9tb3Rpb25PYmoucGhvbmUgPSBsb2dzLnBob25lbnVtYmVyO1xuICAgICAgICAgICAgICAgcHJvbW90aW9uT2JqLm5vdGlmeVNNUyA9IGxvZ3Mubm90aWZ5U01TO1xuICAgICAgICAgICAgICAgcHJvbW90aW9uT2JqLm5vdGlmeWlPUyA9IGxvZ3Mubm90aWZ5aU9TO1xuICAgICAgICAgICAgICAgcHJvbW90aW9uT2JqLm5vdGlmeUFuZHJvaWQgPSBsb2dzLm5vdGlmeUFuZHJvaWQ7XG4gICAgICAgICAgICAgICBwcm9tb3Rpb25PYmoubWVzc2FnZSA9IGxvZ3MubWVzc2FnZTtcblxuXG4gICAgICAgICAgICAgICBjb25zdCBzYXZlZEV2ZW50ID0gYXdhaXQgcHJvbW90aW9uT2JqLnNhdmUoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgfVxuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAgLy8gY29uc29sZS5sb2coJ2V2ZW50RGF0YSBIRVJFID09Pj4+JywgZHQpO1xuICAgICAgICAgY29uc3QgcmVnaXN0cmF0aW9uSWRzID0gZHRbMF0ucmVnaXN0cmF0aW9uSWRzO1xuICAgICAgICAgaWYgKHJlZ2lzdHJhdGlvbklkcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBhd2FpdCBSZWdpc3RyYXRpb25Nb2RlbC51cGRhdGVNYW55KHtfaWQ6IHsnJGluJzogcmVnaXN0cmF0aW9uSWRzfX0sIHskc2V0OiB7J2xhc3RQcm9tb1NlbnRBdCc6IG5ldyBEYXRlKCl9fSk7XG4gICAgICAgICB9XG4gICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHJlZ2lzdHJhdGlvbklkcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgY29uc3QgcHJvbW90aW9uT2JqID0gbmV3IFByb21vdGlvbkxvZ01vZGVsKCk7XG4gICAgICAgICAgICBwcm9tb3Rpb25PYmouZXZlbnQgPSAnJztcbiAgICAgICAgICAgIHByb21vdGlvbk9iai5sb3RzID0gJyc7XG4gICAgICAgICAgICBwcm9tb3Rpb25PYmoucmVnaXN0cmF0aW9uID0gcmVnaXN0cmF0aW9uSWRzW2pdO1xuICAgICAgICAgICAgcHJvbW90aW9uT2JqLnBob25lID0gbG9ncy5waG9uZW51bWJlcjtcbiAgICAgICAgICAgIHByb21vdGlvbk9iai5ub3RpZnlTTVMgPSBsb2dzLm5vdGlmeVNNUztcbiAgICAgICAgICAgIHByb21vdGlvbk9iai5ub3RpZnlpT1MgPSBsb2dzLm5vdGlmeWlPUztcbiAgICAgICAgICAgIHByb21vdGlvbk9iai5ub3RpZnlBbmRyb2lkID0gbG9ncy5ub3RpZnlBbmRyb2lkO1xuICAgICAgICAgICAgcHJvbW90aW9uT2JqLm1lc3NhZ2UgPSBsb2dzLm1lc3NhZ2U7XG4gICAgICAgICAgICBjb25zdCBzYXZlZEV2ZW50ID0gYXdhaXQgcHJvbW90aW9uT2JqLnNhdmUoKTtcbiAgICAgICAgIH1cbiAgICAgIH1cblxuXG4gICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8c3RyaW5nPiA9IHtcbiAgICAgICAgICdTdWNjZXNzJzogdHJ1ZSxcbiAgICAgICAgIERhdGE6ICdJbnNlcnRlZCBTdWNjZXNzZnVsbHknXG4gICAgICB9O1xuICAgICAgcmVzLmpzb24ocmVzdWx0KTtcbiAgICAgIHJldHVybjtcblxuICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcihlKTtcbiAgICAgIC8vIGxvZ2dlci5lcnJvcihgJHtlLm1lc3NhZ2V9ICR7ZS5zdGFja31gKTtcbiAgICAgIGNvbnN0IHJlc3VsdDogRGF0YU9wZXJhdGlvblJlc3VsdDxzdHJpbmc+ID0ge1xuICAgICAgICAgJ1N1Y2Nlc3MnOiBmYWxzZSxcbiAgICAgICAgIERhdGE6ICdJbnRlcm5hbCBTZXJ2ZXIgRXJyb3InXG4gICAgICB9O1xuICAgICAgcmVzLnN0YXR1cyg1MDApO1xuICAgICAgbmV4dChyZXN1bHQpO1xuICAgfVxuXG5cblxufTtcblxuXG4vLyBmdW5jdGlvbiBfc2VuZFNNUyhyZWdpc3RyYXRpb25JRHM6IHN0cmluZywpOiBhbnkge1xuLy8gICAgdHJ5IHtcbi8vICAgICAgIGNvbnN0IGR0ID0gcmVxLmJvZHk7XG4vLyAgICAgICAvLyBjb25zdCByZWdpc3RyYXRpb25JRHMgPSBkdC5yZWdpc3RyYXRpb25JRHM7XG4vLyAgICAgICBjb25zdCBpc1NNUyA9IGR0LnNtcztcbi8vICAgICAgIGNvbnN0IGlzaU9TID0gZHQuaW9zO1xuLy8gICAgICAgY29uc3QgaXNBbmRyb2lkID0gZHQuYW5kcm9pZDtcbi8vICAgICAgIGNvbnN0IHR3aWxsaW9QaG9uZU51bWJlciA9IGR0LlBob25lbnVtYmVyO1xuLy8gICAgICAgY29uc3QgbWVzc2FnZSA9IGR0Lm1lc3NhZ2U7XG5cblxuXG4vLyAgICAgICBpZiAocmVnaXN0cmF0aW9uSURzLmxlbmd0aCA+IDApIHtcbi8vICAgICAgICAgIC8vIEZFVENIIFRPS0VOIERldGFpbHNcblxuLy8gICAgICAgICAgY29uc3QgcHJvbWlzZXMgPSBbXTtcbi8vICAgICAgICAgIGNvbnN0IGNvbmRpdGlvbiA9IHt9O1xuLy8gICAgICAgICAgLy8gQHRzLWlnbm9yZVxuLy8gICAgICAgICAgY29uZGl0aW9uLl9pZCA9IHsgJGluOiByZWdpc3RyYXRpb25JRHMgfTtcbi8vICAgICAgICAgIGNvbnN0IHByb21pc2UxID0gUmVnaXN0cmF0aW9uTW9kZWwuZmluZChjb25kaXRpb24pLnNlbGVjdChbXG4vLyAgICAgICAgICAgICAnX2lkJyxcbi8vICAgICAgICAgICAgICdBbmRyb2lkRGV2aWNlVG9rZW5zJyxcbi8vICAgICAgICAgICAgICdGaXJzdE5hbWUnLFxuLy8gICAgICAgICAgICAgJ0xhc3ROYW1lJ1xuLy8gICAgICAgICAgXSk7XG4vLyAgICAgICAgICBwcm9taXNlcy5wdXNoKHByb21pc2UxKTtcbi8vICAgICAgICAgIGNvbnN0IHByb21pc2UyID0gUmVnaXN0cmF0aW9uTW9kZWwuZmluZChjb25kaXRpb24pLnNlbGVjdChbXG4vLyAgICAgICAgICAgICAnX2lkJyxcbi8vICAgICAgICAgICAgICdEZXZpY2VUb2tlbnMnLFxuLy8gICAgICAgICAgICAgJ0ZpcnN0TmFtZScsXG4vLyAgICAgICAgICAgICAnTGFzdE5hbWUnXG4vLyAgICAgICAgICBdKTtcbi8vICAgICAgICAgIHByb21pc2VzLnB1c2gocHJvbWlzZTIpO1xuLy8gICAgICAgICAgY29uc3QgcHJvbWlzZTMgPSBSZWdpc3RyYXRpb25Nb2RlbC5maW5kKGNvbmRpdGlvbikuc2VsZWN0KFtcbi8vICAgICAgICAgICAgICdfaWQnLFxuLy8gICAgICAgICAgICAgJ1Bob25lTnVtYmVyJyxcbi8vICAgICAgICAgICAgICdGaXJzdE5hbWUnLFxuLy8gICAgICAgICAgICAgJ0xhc3ROYW1lJ1xuLy8gICAgICAgICAgXSk7XG4vLyAgICAgICAgICBwcm9taXNlcy5wdXNoKHByb21pc2UzKTtcblxuXG4vLyAgICAgICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuLy8gICAgICAgICAgY29uc3QgYW5kcm9pZFRva2VucyA9IHJlc3VsdHNbMF07XG4vLyAgICAgICAgICBjb25zdCBpT1NUb2tlbnMgPSByZXN1bHRzWzFdO1xuLy8gICAgICAgICAgY29uc3QgcGhvbmVudW1iZXIgPSByZXN1bHRzWzJdO1xuXG4vLyAgICAgICAgICBjb25zdCBmaW5hbEFuZHJvaWQgPSBbXTtcbi8vICAgICAgICAgIGNvbnN0IGZpbmFsaU9TID0gW107XG4vLyAgICAgICAgICBjb25zdCBmaW5hbFBob25lTnVtYmVycyA9IFtdO1xuXG4vLyAgICAgICAgICAvLyBBbmRyb2lkIFRva2Vuc1xuLy8gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhbmRyb2lkVG9rZW5zLmxlbmd0aDsgaSsrKSB7XG5cbi8vICAgICAgICAgICAgIGlmIChhbmRyb2lkVG9rZW5zW2ldLkFuZHJvaWREZXZpY2VUb2tlbnMgIT09IG51bGwpIHtcbi8vICAgICAgICAgICAgICAgIGlmIChhbmRyb2lkVG9rZW5zW2ldLkFuZHJvaWREZXZpY2VUb2tlbnMubGVuZ3RoID4gMCkge1xuLy8gICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBhbmRyb2lkVG9rZW5zW2ldLkFuZHJvaWREZXZpY2VUb2tlbnMubGVuZ3RoOyBqKyspIHtcbi8vICAgICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdUb2tlbiA9PT0+PicsIGFuZHJvaWRUb2tlbnNbaV0uQW5kcm9pZERldmljZVRva2Vuc1tqXSk7XG4vLyAgICAgICAgICAgICAgICAgICAgICBmaW5hbEFuZHJvaWQucHVzaChhbmRyb2lkVG9rZW5zW2ldLkFuZHJvaWREZXZpY2VUb2tlbnNbal0pO1xuLy8gICAgICAgICAgICAgICAgICAgfVxuLy8gICAgICAgICAgICAgICAgfVxuLy8gICAgICAgICAgICAgfVxuLy8gICAgICAgICAgfVxuXG4vLyAgICAgICAgICAvLyBpT1MgVG9rZW5zXG4vLyAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGlPU1Rva2Vucy5sZW5ndGg7IGkrKykge1xuXG4vLyAgICAgICAgICAgICBpZiAoaU9TVG9rZW5zW2ldLkRldmljZVRva2VucyAhPT0gbnVsbCkge1xuLy8gICAgICAgICAgICAgICAgaWYgKGlPU1Rva2Vuc1tpXS5EZXZpY2VUb2tlbnMubGVuZ3RoID4gMCkge1xuLy8gICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBpT1NUb2tlbnNbaV0uRGV2aWNlVG9rZW5zLmxlbmd0aDsgaisrKSB7XG4vLyAgICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnVG9rZW4gPT09Pj4nLCBhbmRyb2lkVG9rZW5zW2ldLkFuZHJvaWREZXZpY2VUb2tlbnNbal0pO1xuLy8gICAgICAgICAgICAgICAgICAgICAgZmluYWxpT1MucHVzaChpT1NUb2tlbnNbaV0uRGV2aWNlVG9rZW5zW2pdKTtcbi8vICAgICAgICAgICAgICAgICAgIH1cbi8vICAgICAgICAgICAgICAgIH1cbi8vICAgICAgICAgICAgIH1cbi8vICAgICAgICAgIH1cblxuLy8gICAgICAgICAgLy8gUGhvbmVOdW1iZXIgTGlzdFxuLy8gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwaG9uZW51bWJlci5sZW5ndGg7IGkrKykge1xuXG4vLyAgICAgICAgICAgICBpZiAocGhvbmVudW1iZXJbaV0uUGhvbmVOdW1iZXIgIT09IG51bGwpIHtcbi8vICAgICAgICAgICAgICAgIGlmIChwaG9uZW51bWJlcltpXS5QaG9uZU51bWJlci5sZW5ndGggPiAwKSB7XG4vLyAgICAgICAgICAgICAgICAgICAvLyBmb3IgKGxldCBqID0gMDsgaiA8IGlPU1Rva2Vuc1tpXS5EZXZpY2VUb2tlbnMubGVuZ3RoOyBqKyspIHtcbi8vICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdUb2tlbiA9PT0+PicsIGFuZHJvaWRUb2tlbnNbaV0uQW5kcm9pZERldmljZVRva2Vuc1tqXSk7XG4vLyAgICAgICAgICAgICAgICAgICBmaW5hbFBob25lTnVtYmVycy5wdXNoKHBob25lbnVtYmVyW2ldLlBob25lTnVtYmVyKTtcbi8vICAgICAgICAgICAgICAgICAgIC8vIH1cbi8vICAgICAgICAgICAgICAgIH1cbi8vICAgICAgICAgICAgIH1cbi8vICAgICAgICAgIH1cblxuLy8gICAgICAgICAgaWYgKGlzU01TKSB7XG5cbi8vICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZmluYWxQaG9uZU51bWJlcnMubGVuZ3RoOyBpKyspIHtcbi8vICAgICAgICAgICAgICAgIHRyeSB7XG4vLyAgICAgICAgICAgICAgICAgICBjb25zdCBwaCA9IGZpbmFsUGhvbmVOdW1iZXJzW2ldO1xuLy8gICAgICAgICAgICAgICAgICAgY29uc3QgdHdpbGlvQ2xpZW50ID0gVHdpbGlvKCk7XG4vLyAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0d2lsaW9SZXNwb25zZSA9IGF3YWl0IHR3aWxpb0NsaWVudC5tZXNzYWdlcy5jcmVhdGUoe1xuLy8gICAgICAgICAgICAgICAgICAgICAgICAgZnJvbTogdHdpbGxpb1Bob25lTnVtYmVyLFxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgIHRvOiBmaW5hbFBob25lTnVtYmVyc1tpXSxcbi8vICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRvOiAnKzE0MDU5OTY4NzQ0Jyxcbi8vICAgICAgICAgICAgICAgICAgICAgICAgIGJvZHk6IG1lc3NhZ2Vcbi8vICAgICAgICAgICAgICAgICAgICAgIH0pO1xuLy8gICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1NNUyBSZXNwb3NuZSA9PT4+JywgdHdpbGlvUmVzcG9uc2Uuc2lkKTtcblxuLy8gICAgICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuLy8gICAgICAgICAgICAgICAgLy8gIGxvZ2dlci5lcnJvcihgZmFpbGVkIHNtcyAke3Ntc01lc3NhZ2V9YCk7XG4vLyAgICAgICAgICAgICAgICAvLyAgbG9nZ2VyLmVycm9yKGAke2UubWVzc2FnZX0gJHtlLnN0YWNrfWApO1xuLy8gICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdUd2lsaW8gRXJyb3IgPT0+PicsIGUubWVzc2FnZSk7XG4vLyAgICAgICAgICAgICB9XG5cbi8vICAgICAgICAgICAgIH1cbi8vICAgICAgICAgIH1cblxuXG5cbi8vICAgICAgICAgIGlmIChpc2lPUykge1xuLy8gICAgICAgICAgICAgIGNvbnN0IGJhZERldmljZVRva2VucyA9IGF3YWl0IHNlbmROb3RpZmljYXRpb24oZmluYWxpT1MsIG1lc3NhZ2UsICdBcnRiYXR0bGUnKTtcbi8vICAgICAgICAgICAgICBjb25zb2xlLmxvZygnaU9TIExvZ3MgPT4gJywgSlNPTi5zdHJpbmdpZnkoYmFkRGV2aWNlVG9rZW5zKSk7XG4vLyAgICAgICAgICB9XG4vLyAgICAgICAgICBsZXQgYW5kcm9pZFJlczogYW55IDtcbi8vICAgICAgICAgIGlmIChpc0FuZHJvaWQpIHtcbi8vICAgICAgICAgICAgIC8vIEFORFJPSUQgTk9USUZJQ0FUSU9OXG4vLyAgICAgICAgICAgICBhbmRyb2lkUmVzID0gYXdhaXQgTXVsdGlDYXN0KHtcbi8vICAgICAgICAgICAgIERldmljZVRva2VuczogZmluYWxBbmRyb2lkLFxuLy8gICAgICAgICAgICAgbGluazogJycsXG4vLyAgICAgICAgICAgICB0aXRsZTogJ0FydGJhdHRsZScsXG4vLyAgICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuLy8gICAgICAgICAgICAgcHJpb3JpdHk6ICdub3JtYWwnLFxuLy8gICAgICAgICAgICAgYW5hbHl0aWNzTGFiZWw6ICdXZWJWaWV3IFRlc3QnXG4vLyAgICAgICAgICAgICB9KTtcbi8vICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdJRFMgPT0+Pj4nLCBmaW5hbEFuZHJvaWQpO1xuLy8gICAgICAgICAgICAgY29uc29sZS5sb2coJ0FuZHJvaWQgTG9ncyA9PiAnLCBKU09OLnN0cmluZ2lmeShhbmRyb2lkUmVzKSk7XG4vLyAgICAgICAgICB9XG5cblxuLy8gICAgICAgICAgY29uc3QgcmVzdWx0ID0ge1xuLy8gICAgICAgICAgICAgJ1N1Y2Nlc3MnOiB0cnVlLFxuLy8gICAgICAgICAgICAgRGF0YTogJ05vdGlmaWNhdGlvbiBzZW50IFN1Y2Nlc3NmdWxseScsXG4vLyAgICAgICAgICAgICAnYW5kcm9pZCc6IGFuZHJvaWRSZXNcbi8vICAgICAgICAgIH07XG4vLyAgICAgICAgICByZXMuanNvbihyZXN1bHQpO1xuLy8gICAgICAgICAgcmV0dXJuO1xuLy8gICAgICAgfSBlbHNlIHtcbi8vICAgICAgICAgIGNvbnN0IHJlc3VsdDogRGF0YU9wZXJhdGlvblJlc3VsdDxzdHJpbmc+ID0ge1xuLy8gICAgICAgICAgICAgJ1N1Y2Nlc3MnOiBmYWxzZSxcbi8vICAgICAgICAgICAgIERhdGE6ICdQbGVhc2UgcHJvdmlkZSByZWdpc3RyYXRpb24gSWRzJ1xuLy8gICAgICAgICAgfTtcbi8vICAgICAgICAgIHJlcy5qc29uKHJlc3VsdCk7XG4vLyAgICAgICAgICByZXR1cm47XG4vLyAgICAgICB9XG5cbi8vICAgIH0gY2F0Y2ggKGUpIHtcbi8vICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4vLyAgICAgICAvLyBsb2dnZXIuZXJyb3IoYCR7ZS5tZXNzYWdlfSAke2Uuc3RhY2t9YCk7XG4vLyAgICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8c3RyaW5nPiA9IHtcbi8vICAgICAgICAgICdTdWNjZXNzJzogZmFsc2UsXG4vLyAgICAgICAgICBEYXRhOiAnSW50ZXJuYWwgU2VydmVyIEVycm9yJ1xuLy8gICAgICAgfTtcbi8vICAgICAgIHJlcy5zdGF0dXMoNTAwKTtcbi8vICAgICAgIG5leHQocmVzdWx0KTtcbi8vICAgIH1cbi8vIH1cblxuXG5cblxuZXhwb3J0IGNvbnN0IHNlbmRQcm9tb3Rpb25Ob3RpZmljYXRpb25zID0gYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG5cbiAgIHRyeSB7XG4gICAgICBjb25zdCBkdCA9IHJlcS5ib2R5O1xuICAgICAgY29uc3QgcmVnaXN0cmF0aW9uSURzID0gZHQucmVnaXN0cmF0aW9uSURzO1xuICAgICAgY29uc3QgaXNTTVMgPSBkdC5zbXM7XG4gICAgICBjb25zdCBpc2lPUyA9IGR0LmlvcztcbiAgICAgIGNvbnN0IGlzQW5kcm9pZCA9IGR0LmFuZHJvaWQ7XG4gICAgICBjb25zdCB0d2lsbGlvUGhvbmVOdW1iZXIgPSBkdC5QaG9uZW51bWJlcjtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBkdC5tZXNzYWdlO1xuXG5cblxuICAgICAgaWYgKHJlZ2lzdHJhdGlvbklEcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAvLyBGRVRDSCBUT0tFTiBEZXRhaWxzXG5cbiAgICAgICAgIGNvbnN0IHByb21pc2VzID0gW107XG4gICAgICAgICBjb25zdCBjb25kaXRpb24gPSB7fTtcbiAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgIGNvbmRpdGlvbi5faWQgPSB7ICRpbjogcmVnaXN0cmF0aW9uSURzIH07XG4gICAgICAgICBjb25zdCBwcm9taXNlMSA9IFJlZ2lzdHJhdGlvbk1vZGVsLmZpbmQoY29uZGl0aW9uKS5zZWxlY3QoW1xuICAgICAgICAgICAgJ19pZCcsXG4gICAgICAgICAgICAnQW5kcm9pZERldmljZVRva2VucycsXG4gICAgICAgICAgICAnRGV2aWNlVG9rZW5zJyxcbiAgICAgICAgICAgICdQaG9uZU51bWJlcicsXG4gICAgICAgICAgICAnRmlyc3ROYW1lJyxcbiAgICAgICAgICAgICdMYXN0TmFtZScsXG4gICAgICAgICAgICAnTWVzc2FnZUJsb2NrZWQnXG4gICAgICAgICBdKTtcbiAgICAgICAgIHByb21pc2VzLnB1c2gocHJvbWlzZTEpO1xuICAgICAgICAgY29uc3QgcHJvbWlzZTIgPSBFdmVudFBob25lTnVtYmVyTW9kZWwuZmluZE9uZSh7cGhvbmU6IHR3aWxsaW9QaG9uZU51bWJlcn0pO1xuICAgICAgICAgcHJvbWlzZXMucHVzaChwcm9taXNlMik7XG5cbiAgICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG4gICAgICAgICBjb25zdCByZWdpc3RyYXRpb25zID0gcmVzdWx0c1swXTtcblxuICAgICAgICAgY29uc3QgZmluYWxBbmRyb2lkID0gW107XG4gICAgICAgICBjb25zdCBmaW5hbGlPUyA9IFtdO1xuICAgICAgICAgY29uc3QgZmluYWxQaG9uZU51bWJlcnMgPSBbXTtcblxuICAgICAgICAgLy8gQW5kcm9pZCBUb2tlbnNcbiAgICAgICAgIGlmIChpc0FuZHJvaWQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVnaXN0cmF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocmVnaXN0cmF0aW9uc1tpXS5BbmRyb2lkRGV2aWNlVG9rZW5zKSkge1xuICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCByZWdpc3RyYXRpb25zW2ldLkFuZHJvaWREZXZpY2VUb2tlbnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdUb2tlbiA9PT0+PicsIGFuZHJvaWRUb2tlbnNbaV0uQW5kcm9pZERldmljZVRva2Vuc1tqXSk7XG4gICAgICAgICAgICAgICAgICAgICBpZiAocmVnaXN0cmF0aW9uc1tqXS5NZXNzYWdlQmxvY2tlZCAhPT0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3NlbmRpbmcgdG8gYW5kcm9pZCcsIHJlZ2lzdHJhdGlvbnNbal0uUGhvbmVOdW1iZXIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZmluYWxBbmRyb2lkLnB1c2gocmVnaXN0cmF0aW9uc1tpXS5BbmRyb2lkRGV2aWNlVG9rZW5zW2pdKTtcbiAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsb2dnZXIuaW5mbyhgQmxvY2tlZCBBbmRyb2lkIG1lc3NhZ2UgdG8gJHtyZWdpc3RyYXRpb25zW2pdLlBob25lTnVtYmVyfWApO1xuICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgfVxuXG4gICAgICAgICAvLyBpT1MgVG9rZW5zXG4gICAgICAgICBpZiAoaXNpT1MpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVnaXN0cmF0aW9ucy5sZW5ndGg7IGkrKykge1xuXG4gICAgICAgICAgICAgICBpZiAocmVnaXN0cmF0aW9uc1tpXS5EZXZpY2VUb2tlbnMgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgIGlmIChyZWdpc3RyYXRpb25zW2ldLkRldmljZVRva2Vucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHJlZ2lzdHJhdGlvbnNbaV0uRGV2aWNlVG9rZW5zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnVG9rZW4gPT09Pj4nLCBhbmRyb2lkVG9rZW5zW2ldLkFuZHJvaWREZXZpY2VUb2tlbnNbal0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJlZ2lzdHJhdGlvbnNbal0uRGV2aWNlVG9rZW5zICYmIHJlZ2lzdHJhdGlvbnNbal0uRGV2aWNlVG9rZW5zLmxlbmd0aCA+IDAgJiYgcmVnaXN0cmF0aW9uc1tqXS5NZXNzYWdlQmxvY2tlZCAhPT0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3NlbmRpbmcgdG8gaU9TJywgcmVnaXN0cmF0aW9uc1tqXS5QaG9uZU51bWJlcik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICBmaW5hbGlPUy5wdXNoKHJlZ2lzdHJhdGlvbnNbaV0uRGV2aWNlVG9rZW5zW2pdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocmVnaXN0cmF0aW9uc1tqXS5NZXNzYWdlQmxvY2tlZCA9PT0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oYEJsb2NrZWQgaU9TIG1lc3NhZ2UgdG8gJHtyZWdpc3RyYXRpb25zW2pdLlBob25lTnVtYmVyfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgfVxuXG4gICAgICAgICBhc3luYyBmdW5jdGlvbiBzZW5kTWVzc2FnZShyZWdpc3RyYXRpb246IFJlZ2lzdHJhdGlvbkRUTywgY2hhbm5lbDogc3RyaW5nKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgY29uc3QgTWVzc2FnZU9iaiA9IG5ldyBNZXNzYWdlU2NoZW1hKCk7XG4gICAgICAgICAgICAgICBNZXNzYWdlT2JqLk1lc3NhZ2UgPSBtZXNzYWdlO1xuICAgICAgICAgICAgICAgTWVzc2FnZU9iai5TZXJ2ZXJVc2VyID0gcmVxLnVzZXIucGFzc3dvcmQgJiYgcmVxLnVzZXIuX2lkO1xuICAgICAgICAgICAgICAgTWVzc2FnZU9iai5TZXJ2ZXJSZWdpc3RyYXRpb24gPSByZXEudXNlci5IYXNoICYmIHJlcS51c2VyLl9pZDtcbiAgICAgICAgICAgICAgIE1lc3NhZ2VPYmouU2VydmVyTnVtYmVyID0gdHdpbGxpb1Bob25lTnVtYmVyO1xuICAgICAgICAgICAgICAgTWVzc2FnZU9iai5TZXJ2ZXJOdW1iZXJEb2MgPSByZXN1bHRzWzFdLl9pZDtcbiAgICAgICAgICAgICAgIE1lc3NhZ2VPYmouQ2xpZW50UGhvbmVOdW1iZXIgPSByZWdpc3RyYXRpb24uUGhvbmVOdW1iZXI7XG4gICAgICAgICAgICAgICBNZXNzYWdlT2JqLkNsaWVudFJlZ2lzdHJhdGlvbiA9IHJlZ2lzdHJhdGlvbi5faWQ7XG4gICAgICAgICAgICAgICBNZXNzYWdlT2JqLlN0YXR1cyA9IDE7IC8vIFNFTkQgVE8gVVNFUlxuICAgICAgICAgICAgICAgTWVzc2FnZU9iai5DaGFubmVsID0gY2hhbm5lbDtcbiAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCBNZXNzYWdlT2JqLnNhdmUoKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihgdW5hYmxlIHRvIHNhdmUgbWVzc2FnZSBpbiBsb2cgJHtlfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgfVxuXG4gICAgICAgICBjb25zdCBzZW5kTWVzc2FnZVByb21pc2VzID0gW107XG4gICAgICAgICBpZiAoaXNTTVMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVnaXN0cmF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgIGlmIChyZWdpc3RyYXRpb25zW2ldLlBob25lTnVtYmVyICYmIHJlZ2lzdHJhdGlvbnNbaV0uUGhvbmVOdW1iZXIubGVuZ3RoID4gMCAmJiByZWdpc3RyYXRpb25zW2ldLk1lc3NhZ2VCbG9ja2VkICE9PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICBjb25zdCB0d2lsaW9DbGllbnQgPSBUd2lsaW8oKTtcbiAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHR3aWxpb1Jlc3BvbnNlID0gYXdhaXQgdHdpbGlvQ2xpZW50Lm1lc3NhZ2VzLmNyZWF0ZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcm9tOiB0d2lsbGlvUGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICB0bzogcmVnaXN0cmF0aW9uc1tpXS5QaG9uZU51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRvOiAnKzE0MDU5OTY4NzQ0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJvZHk6IG1lc3NhZ2VcbiAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgc2VuZE1lc3NhZ2VQcm9taXNlcy5wdXNoKHNlbmRNZXNzYWdlKHJlZ2lzdHJhdGlvbnNbaV0sICdTTVMnKSk7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oYEJsb2NrZWQgbWVzc2FnZSB0byAke3JlZ2lzdHJhdGlvbnNbaV0uUGhvbmVOdW1iZXJ9YCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAvLyAgbG9nZ2VyLmVycm9yKGBmYWlsZWQgc21zICR7c21zTWVzc2FnZX1gKTtcbiAgICAgICAgICAgICAgICAgIC8vICBsb2dnZXIuZXJyb3IoYCR7ZS5tZXNzYWdlfSAke2Uuc3RhY2t9YCk7XG4gICAgICAgICAgICAgICAgICBzZW5kTWVzc2FnZVByb21pc2VzLnB1c2goc2VuZE1lc3NhZ2UocmVnaXN0cmF0aW9uc1tpXSwgJ1NNUycpKTtcbiAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuICAgICAgICAgfVxuXG5cblxuICAgICAgICAgaWYgKGlzaU9TKSB7XG4gICAgICAgICAgICBjb25zdCBiYWREZXZpY2VUb2tlbnMgPSBhd2FpdCBzZW5kTm90aWZpY2F0aW9uKGZpbmFsaU9TLCBtZXNzYWdlLCAnQXJ0YmF0dGxlJyk7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHJlZ2lzdHJhdGlvbnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgIGlmIChyZWdpc3RyYXRpb25zW2pdLkRldmljZVRva2VucyAmJiByZWdpc3RyYXRpb25zW2pdLkRldmljZVRva2Vucy5sZW5ndGggPiAwICYmIHJlZ2lzdHJhdGlvbnNbal0uTWVzc2FnZUJsb2NrZWQgIT09IDEpIHtcbiAgICAgICAgICAgICAgICAgIHNlbmRNZXNzYWdlUHJvbWlzZXMucHVzaChzZW5kTWVzc2FnZShyZWdpc3RyYXRpb25zW2pdLCAnaU9TJykpO1xuICAgICAgICAgICAgICAgfSBlbHNlIGlmIChyZWdpc3RyYXRpb25zW2pdLk1lc3NhZ2VCbG9ja2VkID09PSAxKSB7XG4gICAgICAgICAgICAgICAgICAvLyBsb2dnZXIuaW5mbyhgQmxvY2tlZCBpT1MgbWVzc2FnZSB0byAke3JlZ2lzdHJhdGlvbnNbal0uUGhvbmVOdW1iZXJ9YCk7XG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICB9XG5cbiAgICAgICAgIGxldCBhbmRyb2lkUmVzOiBhbnkgO1xuICAgICAgICAgaWYgKGlzQW5kcm9pZCAmJiBmaW5hbEFuZHJvaWQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgLy8gQU5EUk9JRCBOT1RJRklDQVRJT05cbiAgICAgICAgICAgIGFuZHJvaWRSZXMgPSBhd2FpdCBNdWx0aUNhc3Qoe1xuICAgICAgICAgICAgICAgRGV2aWNlVG9rZW5zOiBmaW5hbEFuZHJvaWQsXG4gICAgICAgICAgICAgICBsaW5rOiAnJyxcbiAgICAgICAgICAgICAgIHRpdGxlOiAnQXJ0YmF0dGxlJyxcbiAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICBwcmlvcml0eTogJ25vcm1hbCcsXG4gICAgICAgICAgICAgICBhbmFseXRpY3NMYWJlbDogJ1dlYlZpZXcgVGVzdCdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCByZWdpc3RyYXRpb25zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICBpZiAocmVnaXN0cmF0aW9uc1tqXS5BbmRyb2lkRGV2aWNlVG9rZW5zICYmIHJlZ2lzdHJhdGlvbnNbal0uQW5kcm9pZERldmljZVRva2Vucy5sZW5ndGggPiAwICYmIHJlZ2lzdHJhdGlvbnNbal0uTWVzc2FnZUJsb2NrZWQgIT09IDEpIHtcbiAgICAgICAgICAgICAgICAgIHNlbmRNZXNzYWdlUHJvbWlzZXMucHVzaChzZW5kTWVzc2FnZShyZWdpc3RyYXRpb25zW2pdLCAnQW5kcm9pZCcpKTtcbiAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocmVnaXN0cmF0aW9uc1tqXS5NZXNzYWdlQmxvY2tlZCA9PT0gMSkge1xuICAgICAgICAgICAgICAgICAgLy8gbG9nZ2VyLmluZm8oYEJsb2NrZWQgYW5kcm9pZCBtZXNzYWdlIHRvICR7cmVnaXN0cmF0aW9uc1tqXS5QaG9uZU51bWJlcn1gKTtcbiAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgIH1cblxuXG4gICAgICAgICBjb25zdCByZXN1bHQgPSB7XG4gICAgICAgICAgICAnU3VjY2Vzcyc6IHRydWUsXG4gICAgICAgICAgICBEYXRhOiAnTm90aWZpY2F0aW9uIHNlbnQgU3VjY2Vzc2Z1bGx5JyxcbiAgICAgICAgICAgICdhbmRyb2lkJzogYW5kcm9pZFJlc1xuICAgICAgICAgfTtcbiAgICAgICAgIHJlcy5qc29uKHJlc3VsdCk7XG4gICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChzZW5kTWVzc2FnZVByb21pc2VzKTtcbiAgICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8c3RyaW5nPiA9IHtcbiAgICAgICAgICAgICdTdWNjZXNzJzogZmFsc2UsXG4gICAgICAgICAgICBEYXRhOiAnUGxlYXNlIHByb3ZpZGUgcmVnaXN0cmF0aW9uIElkcydcbiAgICAgICAgIH07XG4gICAgICAgICByZXMuanNvbihyZXN1bHQpO1xuICAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgLy8gbG9nZ2VyLmVycm9yKGAke2UubWVzc2FnZX0gJHtlLnN0YWNrfWApO1xuICAgICAgY29uc3QgcmVzdWx0OiBEYXRhT3BlcmF0aW9uUmVzdWx0PHN0cmluZz4gPSB7XG4gICAgICAgICAnU3VjY2Vzcyc6IGZhbHNlLFxuICAgICAgICAgRGF0YTogJ0ludGVybmFsIFNlcnZlciBFcnJvcidcbiAgICAgIH07XG4gICAgICByZXMuc3RhdHVzKDUwMCk7XG4gICAgICBuZXh0KHJlc3VsdCk7XG4gICB9XG59O1xuXG5cbmV4cG9ydCBjb25zdCBsb2dzID0gYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICB0cnkge1xuXG4gICAgICBjb25zdCBkYXRhID0gIGF3YWl0IFByb21vdGlvbkxvZ01vZGVsLmFnZ3JlZ2F0ZShbXG4gICAgICAgICB7XG4gICAgICAgICAgICAnJGdyb3VwJzoge1xuICAgICAgICAgICAgICAgX2lkOiAnJHJlZ2lzdHJhdGlvbicsXG4gICAgICAgICAgICAgICBjb3VudDoge1xuICAgICAgICAgICAgICAgICAgJHN1bTogMVxuICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgfSxcbiAgICAgICAgIHsgICAnJGFkZEZpZWxkcyc6IHtcbiAgICAgICAgICAgICAgICdfaWQnOiB7ICckdG9PYmplY3RJZCc6ICckX2lkJyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICB9LFxuICAgICAgICAge1xuICAgICAgICAgICAgJyRsb29rdXAnOiB7XG4gICAgICAgICAgICAgICBmcm9tOiAncmVnaXN0cmF0aW9ucycsXG4gICAgICAgICAgICAgICBsb2NhbEZpZWxkOiAnX2lkJyxcbiAgICAgICAgICAgICAgIGZvcmVpZ25GaWVsZDogJ19pZCcsXG4gICAgICAgICAgICAgICBhczogJ2luZm9PYmplY3QnXG4gICAgICAgICAgICB9XG4gICAgICAgICB9XG4gICAgICBdKS5hbGxvd0Rpc2tVc2UodHJ1ZSk7XG5cbiAgICAgIGNvbnN0IGZpbmFsRGF0YSA9IFtdO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICBjb25zdCBpZCA9IGRhdGFbaV0uX2lkO1xuICAgICAgICAgY29uc3QgY291bnQgPSBkYXRhW2ldLmNvdW50O1xuICAgICAgICAgbGV0IGVtYWlsID0gJyc7XG4gICAgICAgICBsZXQgbmlja25hbWUgPSAnJztcbiAgICAgICAgIGxldCBwaG9uZW51bWJlciA9ICcnO1xuICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBkYXRhW2ldLmluZm9PYmplY3QubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIGVtYWlsID0gZGF0YVtpXS5pbmZvT2JqZWN0W2pdLkVtYWlsO1xuICAgICAgICAgICAgbmlja25hbWUgPSBkYXRhW2ldLmluZm9PYmplY3Rbal0uTmlja05hbWU7XG4gICAgICAgICAgICBwaG9uZW51bWJlciA9IGRhdGFbaV0uaW5mb09iamVjdFtqXS5QaG9uZU51bWJlcjtcbiAgICAgICAgIH1cbiAgICAgICAgIGZpbmFsRGF0YS5wdXNoKHtcbiAgICAgICAgICAgICdfaWQnOiBpZCxcbiAgICAgICAgICAgICdjb3VudCc6IGNvdW50ID8gY291bnQgOiAwLFxuICAgICAgICAgICAgJ2VtYWlsJzogZW1haWwgPyBlbWFpbCA6ICctJyxcbiAgICAgICAgICAgICduaWNrbmFtZSc6IG5pY2tuYW1lID8gbmlja25hbWUgOiAnLScsXG4gICAgICAgICAgICAncGhvbmVudW1iZXInOiBwaG9uZW51bWJlciA/IHBob25lbnVtYmVyIDogJy0nXG5cbiAgICAgICAgIH0gKTtcblxuICAgICAgfVxuXG4gICAgICByZXMuanNvbihmaW5hbERhdGEpO1xuICAgICAgcmV0dXJuO1xuXG4gICB9IGNhdGNoIChlKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgLy8gbG9nZ2VyLmVycm9yKGAke2UubWVzc2FnZX0gJHtlLnN0YWNrfWApO1xuICAgICAgY29uc3QgcmVzdWx0OiBEYXRhT3BlcmF0aW9uUmVzdWx0PHN0cmluZz4gPSB7XG4gICAgICAgICAnU3VjY2Vzcyc6IGZhbHNlLFxuICAgICAgICAgRGF0YTogJ0ludGVybmFsIFNlcnZlciBFcnJvcidcbiAgICAgIH07XG4gICAgICByZXMuc3RhdHVzKDUwMCk7XG4gICAgICBuZXh0KHJlc3VsdCk7XG4gICB9XG59O1xuXG5cbmV4cG9ydCBsZXQgcHJvbW90aW9uTG9nc01lc3NhZ2UgPSBhc3luYyhyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgdHJ5IHtcbiAgICAgIGNvbnN0IHByb21vdGlvbk1lc3NhZ2VMb2dzID0gYXdhaXQgTWVzc2FnZVNjaGVtYS5maW5kKHsnU3RhdHVzJzogMH0pXG4gICAgICAgICAgLnNlbGVjdChbXG4gICAgICAgICAgICAgJ0NsaWVudFJlZ2lzdHJhdGlvbicsXG4gICAgICAgICAgICAgJ1N0YXR1cycsXG4gICAgICAgICAgICAgJ2NyZWF0ZWRBdCdcbiAgICAgICAgICBdKVxuICAgICAgICAgIC5zb3J0KHtcbiAgICAgICAgICAgICAnY3JlYXRlZEF0JyA6IC0xXG4gICAgICAgICAgfSk7XG4gICAgICBsZXQgdW5pcXVlSURzOiBhbnkgPSBbXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcHJvbW90aW9uTWVzc2FnZUxvZ3MubGVuZ3RoOyBpKyspIHtcblxuICAgICAgICAgaWYgKHVuaXF1ZUlEcy5pbmRleE9mKHByb21vdGlvbk1lc3NhZ2VMb2dzW2ldLkNsaWVudFJlZ2lzdHJhdGlvbi50b1N0cmluZygpKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdBdmFpbGFibGUnKTtcbiAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1bmlxdWVJRHMucHVzaChwcm9tb3Rpb25NZXNzYWdlTG9nc1tpXS5DbGllbnRSZWdpc3RyYXRpb24udG9TdHJpbmcoKSk7XG4gICAgICAgICB9XG4gICAgICB9XG4gICAgICB1bmlxdWVJRHMgPSB1bmlxdWVJRHMuc2xpY2UoMCwgMTAwKTtcbiAgICAgIGNvbnN0IGNvbmRpdGlvbiA9IHt9O1xuXG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBjb25kaXRpb24uX2lkID0geyAkaW46IHVuaXF1ZUlEcyB9O1xuICAgICAgY29uc3QgdXNlckluZm8gPSBhd2FpdCBSZWdpc3RyYXRpb25Nb2RlbC5maW5kKGNvbmRpdGlvbilcbiAgICAgICAgICAuc2VsZWN0KFtcbiAgICAgICAgICAgICAnX2lkJyxcbiAgICAgICAgICAgICAnTmlja05hbWUnLFxuICAgICAgICAgICAgICdFbWFpbCcsXG4gICAgICAgICAgICAgJ1Bob25lTnVtYmVyJ1xuICAgICAgICAgIF0pXG4gICAgICAgICAgLnNvcnQoe1xuICAgICAgICAgICAgICdjcmVhdGVkQXQnIDogLTFcbiAgICAgICAgICB9KTtcblxuICAgICAgY29uc3QgZmluYWxEYXRhID0gW107XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHVzZXJJbmZvLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICBjb25zdCBpZCA9IHVzZXJJbmZvW2ldLl9pZDtcblxuICAgICAgICAgY29uc3QgZW1haWwgPSB1c2VySW5mb1tpXS5FbWFpbDtcbiAgICAgICAgIGNvbnN0IG5pY2tuYW1lID0gdXNlckluZm9baV0uTmlja05hbWU7XG4gICAgICAgICBjb25zdCBwaG9uZW51bWJlciA9IHVzZXJJbmZvW2ldLlBob25lTnVtYmVyO1xuXG5cbiAgICAgICAgIGZpbmFsRGF0YS5wdXNoKHtcbiAgICAgICAgICAgICdfaWQnOiBpZCxcbiAgICAgICAgICAgICdlbWFpbCc6IGVtYWlsID8gZW1haWwgOiAnLScsXG4gICAgICAgICAgICAnbmlja25hbWUnOiBuaWNrbmFtZSA/IG5pY2tuYW1lIDogJy0nLFxuICAgICAgICAgICAgJ3Bob25lbnVtYmVyJzogcGhvbmVudW1iZXIgPyBwaG9uZW51bWJlciA6ICctJ1xuXG4gICAgICAgICB9ICk7XG5cbiAgICAgIH1cblxuICAgICAgcmVzLmpzb24oZmluYWxEYXRhKTtcbiAgICAgIHJldHVybjtcblxuICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcihlKTtcbiAgICAgIC8vIGxvZ2dlci5lcnJvcihgJHtlLm1lc3NhZ2V9ICR7ZS5zdGFja31gKTtcbiAgICAgIGNvbnN0IHJlc3VsdDogRGF0YU9wZXJhdGlvblJlc3VsdDxzdHJpbmc+ID0ge1xuICAgICAgICAgJ1N1Y2Nlc3MnOiBmYWxzZSxcbiAgICAgICAgIERhdGE6ICdJbnRlcm5hbCBTZXJ2ZXIgRXJyb3InXG4gICAgICB9O1xuICAgICAgcmVzLnN0YXR1cyg1MDApO1xuICAgICAgbmV4dChyZXN1bHQpO1xuICAgfVxufTtcblxuZXhwb3J0IGxldCBwcm9tb3Rpb25Mb2dzTWVzc2FnZTIgPSBhc3luYyhyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBNZXNzYWdlU2NoZW1hLmFnZ3JlZ2F0ZShbXG4gICAgICAgICB7XG4gICAgICAgICAgICAnJG1hdGNoJzoge1xuICAgICAgICAgICAgICAgJ1N0YXR1cyc6IDBcbiAgICAgICAgICAgIH1cbiAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICckZ3JvdXAnOiB7XG4gICAgICAgICAgICAgICAnX2lkJzogJyRDbGllbnRSZWdpc3RyYXRpb24nLFxuICAgICAgICAgICAgICAgJ2NyZWF0ZUF0Jzoge1xuICAgICAgICAgICAgICAgICAgJyRwdXNoJzogJyRjcmVhdGVkQXQnXG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICB9LCB7XG4gICAgICAgICAgICAnJHNvcnQnOiB7XG4gICAgICAgICAgICAgICAnY3JlYXRlZEF0JzogLTFcbiAgICAgICAgICAgIH1cbiAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICckbGltaXQnOiAxMDBcbiAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICckbG9va3VwJzoge1xuICAgICAgICAgICAgICAgJ2Zyb20nOiAncmVnaXN0cmF0aW9ucycsXG4gICAgICAgICAgICAgICAnbG9jYWxGaWVsZCc6ICdfaWQnLFxuICAgICAgICAgICAgICAgJ2ZvcmVpZ25GaWVsZCc6ICdfaWQnLFxuICAgICAgICAgICAgICAgJ2FzJzogJ3VzZXJpbmZvJ1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICB9XG4gICAgICBdKS5hbGxvd0Rpc2tVc2UodHJ1ZSk7XG5cbiAgICAgIGNvbnN0IGZpbmFsRGF0YTogYW55ID0gW107XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlc3VsdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgIGNvbnN0IHVzZXJJbmZvID0gcmVzdWx0c1tpXS51c2VyaW5mbztcbiAgICAgICAgIGNvbnN0IGxhc3RNZXNzYWdlID0gcmVzdWx0c1tpXS5jcmVhdGVBdC5zbGljZSgtMSlbMF07XG4gICAgICAgICBjb25zdCBqID0gMDtcbiAgICAgICAgIGlmICh1c2VySW5mbykge1xuICAgICAgICAgICAgaWYgKHVzZXJJbmZvLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgIGZpbmFsRGF0YS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICdfaWQnOiB1c2VySW5mb1tqXS5faWQsXG4gICAgICAgICAgICAgICAgICAnZW1haWwnOiB1c2VySW5mb1tqXS5FbWFpbCA/IHVzZXJJbmZvW2pdLkVtYWlsIDogJy0nLFxuICAgICAgICAgICAgICAgICAgJ25pY2tuYW1lJzogdXNlckluZm9bal0uTmlja05hbWUgPyB1c2VySW5mb1tqXS5OaWNrTmFtZSA6ICctJyxcbiAgICAgICAgICAgICAgICAgICdwaG9uZW51bWJlcic6IHVzZXJJbmZvW2pdLlBob25lTnVtYmVyID8gdXNlckluZm9bal0uUGhvbmVOdW1iZXIgOiAnLScsXG4gICAgICAgICAgICAgICAgICAnbGFzdE1lc3NhZ2UnIDogbGFzdE1lc3NhZ2VcbiAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICB9XG5cblxuICAgICAgfVxuICAgICAgY29uc3Qgc29ydGVkQWN0aXZpdGllcyA9IGZpbmFsRGF0YS5zb3J0KChhOiBhbnksIGI6IGFueSkgPT4gYi5sYXN0TWVzc2FnZSAtIGEubGFzdE1lc3NhZ2UpO1xuICAgICAgcmVzLmpzb24oc29ydGVkQWN0aXZpdGllcyk7XG4gICAgICByZXR1cm47XG5cbiAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAvLyBsb2dnZXIuZXJyb3IoYCR7ZS5tZXNzYWdlfSAke2Uuc3RhY2t9YCk7XG4gICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8c3RyaW5nPiA9IHtcbiAgICAgICAgICdTdWNjZXNzJzogZmFsc2UsXG4gICAgICAgICBEYXRhOiAnSW50ZXJuYWwgU2VydmVyIEVycm9yJ1xuICAgICAgfTtcbiAgICAgIHJlcy5zdGF0dXMoNTAwKTtcbiAgICAgIG5leHQocmVzdWx0KTtcbiAgIH1cbn07XG5cblxuZXhwb3J0IGxldCBwcm9tb3Rpb25Mb2dzVG9wVm90ZSA9IGFzeW5jKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFZvdGluZ0xvZ01vZGVsLmFnZ3JlZ2F0ZShbXG4gICAgICAgICB7XG4gICAgICAgICAgICAnJG1hdGNoJzoge1xuICAgICAgICAgICAgICAgJ1N0YXR1cyc6ICdWT1RFX0FDQ0VQVEVEJ1xuICAgICAgICAgICAgfVxuICAgICAgICAgfSwge1xuICAgICAgICAgICAgJyRncm91cCc6IHtcbiAgICAgICAgICAgICAgICdfaWQnOiB7XG4gICAgICAgICAgICAgICAgICAnUGhvbmVIYXNoJzogJyRQaG9uZUhhc2gnXG4gICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgJ2NvdW50Jzoge1xuICAgICAgICAgICAgICAgICAgJyRzdW0nOiAxXG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICB9LCB7XG4gICAgICAgICAgICAnJHNvcnQnOiB7XG4gICAgICAgICAgICAgICAnY291bnQnOiAtMVxuICAgICAgICAgICAgfVxuICAgICAgICAgfSxcbiAgICAgICAgIHtcbiAgICAgICAgICAgICckbGltaXQnOiAyMDBcbiAgICAgICAgIH0sXG4gICAgICAgICB7XG4gICAgICAgICAgICAnJGxvb2t1cCc6IHtcbiAgICAgICAgICAgICAgICdmcm9tJzogJ3JlZ2lzdHJhdGlvbnMnLFxuICAgICAgICAgICAgICAgJ2xvY2FsRmllbGQnOiAnX2lkLlBob25lSGFzaCcsXG4gICAgICAgICAgICAgICAnZm9yZWlnbkZpZWxkJzogJ0hhc2gnLFxuICAgICAgICAgICAgICAgJ2FzJzogJ1VzZXJJbmZvJ1xuICAgICAgICAgICAgfVxuICAgICAgICAgfVxuICAgICAgXSkuYWxsb3dEaXNrVXNlKHRydWUpO1xuICAgICAgY29uc3QgZmluYWxEYXRhOiBhbnkgPSBbXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVzdWx0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgLy8gY29uc29sZS5sb2cocmVzdWx0cy5sZW5ndGggKyAnID0+ICcgKyBpICsgJyBMZW5ndGggPT09Pj4+JywgcmVzdWx0c1tpXS5Vc2VySW5mbyk7XG4gICAgICAgICBjb25zdCB1c2VySW5mbyA9IHJlc3VsdHNbaV0uVXNlckluZm87XG4gICAgICAgICBjb25zdCBqID0gMDtcbiAgICAgICAgIC8vIGNvbnNvbGUubG9nKHJlc3VsdHMubGVuZ3RoICsgJyA9PiAnICsgaSArICcgTGVuZ3RoID09PT4+PicsIHVzZXJJbmZvKTtcbiAgICAgICAgIGlmICh1c2VySW5mby5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBmaW5hbERhdGEucHVzaCh7XG4gICAgICAgICAgICAgICAnY291bnQnOiByZXN1bHRzW2ldLmNvdW50LFxuICAgICAgICAgICAgICAgJ19pZCc6IHVzZXJJbmZvW2pdLl9pZCA/IHVzZXJJbmZvW2pdLl9pZCA6ICctJyxcbiAgICAgICAgICAgICAgICdlbWFpbCc6IHVzZXJJbmZvW2pdLkVtYWlsID8gdXNlckluZm9bal0uRW1haWwgOiAnLScsXG4gICAgICAgICAgICAgICAnbmlja25hbWUnOiB1c2VySW5mb1tqXS5OaWNrTmFtZSA/IHVzZXJJbmZvW2pdLk5pY2tOYW1lIDogJy0nLFxuICAgICAgICAgICAgICAgJ3Bob25lbnVtYmVyJzogdXNlckluZm9bal0uUGhvbmVOdW1iZXIgPyB1c2VySW5mb1tqXS5QaG9uZU51bWJlciA6ICctJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICB9XG5cbiAgICAgIH1cbiAgICAgIHJlcy5qc29uKGZpbmFsRGF0YSk7XG4gICAgICByZXR1cm47XG5cbiAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAvLyBsb2dnZXIuZXJyb3IoYCR7ZS5tZXNzYWdlfSAke2Uuc3RhY2t9YCk7XG4gICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8c3RyaW5nPiA9IHtcbiAgICAgICAgICdTdWNjZXNzJzogZmFsc2UsXG4gICAgICAgICBEYXRhOiAnSW50ZXJuYWwgU2VydmVyIEVycm9yJ1xuICAgICAgfTtcbiAgICAgIHJlcy5zdGF0dXMoNTAwKTtcbiAgICAgIG5leHQocmVzdWx0KTtcbiAgIH1cbn07XG5leHBvcnQgbGV0IHVzZXJQcm9maWxlID0gYXN5bmMocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgIHRyeSB7XG4gICAgICAvLyBjb25zb2xlLmxvZygncmVxLnBhcmFtcyAnLCByZXEucGFyYW1zKTtcbiAgICAgIGNvbnN0IHVzZXJEYXRhID0gYXdhaXQgUmVnaXN0cmF0aW9uTW9kZWwuZmluZE9uZSh7J1Bob25lTnVtYmVyJzogcmVxLnBhcmFtcy5wfSlcbiAgICAgICAgICAucG9wdWxhdGUoJ0FydGlzdCcpO1xuICAgICAgaWYgKCF1c2VyRGF0YSkge1xuICAgICAgICAgbmV4dCgnVGhpcyB1c2VyIGlzIG5vdCByZWdpc3RlcmVkJyk7XG4gICAgICAgICByZXR1cm4gO1xuICAgICAgfVxuICAgICAgY29uc3QgQXJ0cyA9IFtdO1xuICAgICAgaWYgICh1c2VyRGF0YS5BcnRpc3QpIHtcbiAgICAgICAgIGNvbnN0IExvdHMgPSBhd2FpdCBMb3RNb2RlbC5maW5kKHtDb250ZXN0YW50OiB1c2VyRGF0YS5BcnRpc3QuX2lkfSkuc2VsZWN0KFsnQXJ0SWQnXSk7XG4gICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IExvdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIEFydHMucHVzaChMb3RzW2ldLkFydElkKTtcbiAgICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNvbnN0IHVzZXJJZCA9IHVzZXJEYXRhLl9pZDtcbiAgICAgIGNvbnN0IGNvbmRpdGlvbiA9IHt9O1xuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgY29uZGl0aW9uLlJlZ2lzdHJhdGlvbnMgPSB7ICRpbjogcmVxLnBhcmFtcy5wIH07XG5cbiAgICAgIGNvbnN0IGV2ZW50RGF0YSA9IGF3YWl0IEV2ZW50TW9kZWwuZmluZCh7J1JlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yLlJlZ2lzdHJhdGlvbklkJzogdXNlcklkfSlcbiAgICAgICAgICAuc2VsZWN0KFtcbiAgICAgICAgICAgICAnX2lkJyxcbiAgICAgICAgICAgICAnRUlEJyxcbiAgICAgICAgICAgICAnTmFtZScsXG4gICAgICAgICAgICAgJ1ByaWNlJyxcbiAgICAgICAgICAgICAnQ291bnRyeScsXG4gICAgICAgICAgICAgJ1JlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yJ1xuICAgICAgICAgIF0pO1xuICAgICAgY29uc3QgZXZlbnRGaW5hbERhdGE6IGFueSA9IFtdO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBldmVudERhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgIC8vIGNvbnNvbGUubG9nKGV2ZW50RGF0YVtpXS5SZWdpc3RyYXRpb25zVm90ZUZhY3Rvcik7XG4gICAgICAgICBjb25zdCBkdCA9IGV2ZW50RGF0YVtpXS5SZWdpc3RyYXRpb25zVm90ZUZhY3RvcjtcbiAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgZHQubGVuZ3RoOyBqKyspIHtcblxuICAgICAgICAgICAgaWYgKHVzZXJJZC50b1N0cmluZygpID09IGR0W2pdLlJlZ2lzdHJhdGlvbklkLnRvU3RyaW5nKCkpIHtcbiAgICAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdJRCA9PT0+Pj4gJywgZHRbal0uRnJvbSk7XG4gICAgICAgICAgICAgICBldmVudEZpbmFsRGF0YS5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICdfaWQnOiBldmVudERhdGFbaV0uX2lkLFxuICAgICAgICAgICAgICAgICAgJ05hbWUnOiBldmVudERhdGFbaV0uTmFtZSxcbiAgICAgICAgICAgICAgICAgICdGcm9tJzogZHRbal0uRnJvbSxcbiAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBwcm9tb3Rpb25Mb2dzID0gYXdhaXQgUHJvbW90aW9uTG9nTW9kZWwuZmluZCh7J3JlZ2lzdHJhdGlvbic6IHVzZXJJZH0pXG4gICAgICAgICAgLnNlbGVjdChbXG4gICAgICAgICAgICAgJ19pZCcsXG4gICAgICAgICAgICAgJ3Bob25lJyxcbiAgICAgICAgICAgICAnbm90aWZ5U01TJyxcbiAgICAgICAgICAgICAnbm90aWZ5aU9TJyxcbiAgICAgICAgICAgICAnbm90aWZ5QW5kcm9pZCcsXG4gICAgICAgICAgICAgJ21lc3NhZ2UnLFxuICAgICAgICAgICAgICdjcmVhdGVkQXQnXG4gICAgICAgICAgXSkuc29ydCh7XG4gICAgICAgICAgICAgJ2NyZWF0ZWRBdCcgOiAtMVxuICAgICAgICAgIH0pO1xuICAgICAgLy8gY29uc29sZS5sb2coJ3Byb21vdGlvbkxvZ3MgPT0+PicsIHByb21vdGlvbkxvZ3MpO1xuXG5cbiAgICAgIGNvbnN0IGF1Y3Rpb25EYXRhID0gYXdhaXQgTG90TW9kZWwuZmluZCh7J0JpZHMuUmVnaXN0cmF0aW9uJzogdXNlcklkfSlcbiAgICAgICAgICAuc2VsZWN0KFtcbiAgICAgICAgICAgICAnX2lkJyxcbiAgICAgICAgICAgICAnQmlkcycsXG4gICAgICAgICAgICAgJ0V2ZW50JyxcbiAgICAgICAgICAgICAnQXJ0SWQnLFxuICAgICAgICAgICAgICdSb3VuZCcsXG4gICAgICAgICAgICAgJ0Vhc2VsTnVtYmVyJ1xuICAgICAgICAgIF0pLnBvcHVsYXRlKCdFdmVudCcpXG4gICAgICAgICAgLy8gLnBvcHVsYXRlKCdFdmVudC5Sb3VuZHMuQ29udGVzdGFudHMuRGV0YWlsJylcbiAgICAgICAgICAuc29ydCh7XG4gICAgICAgICAgICAgJ2NyZWF0ZWRBdCcgOiAtMVxuICAgICAgICAgIH0pO1xuXG4gICAgICBjb25zdCBhdWN0aW9uTG9ncyA9IFtdO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhdWN0aW9uRGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgY29uc3QgZXZlbnROYW1lID0gYXVjdGlvbkRhdGFbaV0uQXJ0SWQ7XG4gICAgICAgICBsZXQgYW1vdW50ID0gMDtcbiAgICAgICAgIGxldCBjcmVhdGVkQXQ7XG4gICAgICAgICBsZXQgaXNIaWdoZXJCaWQgPSBmYWxzZTtcblxuICAgICAgICAgY29uc3QgYmlkID0gYXVjdGlvbkRhdGFbaV0uQmlkcztcbiAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgYmlkLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBpZiAodXNlcklkLnRvU3RyaW5nKCkgPT09IGJpZFtqXS5SZWdpc3RyYXRpb24udG9TdHJpbmcoKSkge1xuICAgICAgICAgICAgICAgYW1vdW50ID0gYmlkW2pdLkFtb3VudDtcbiAgICAgICAgICAgICAgIGNyZWF0ZWRBdCA9IGJpZFtqXS5jcmVhdGVkQXQ7XG4gICAgICAgICAgICAgICBjcmVhdGVkQXQgPSBuZXcgRGF0ZShjcmVhdGVkQXQuZ2V0VGltZSgpIC0gKGNyZWF0ZWRBdC5nZXRUaW1lem9uZU9mZnNldCgpICogNjAwMDAgKSkudG9JU09TdHJpbmcoKS5zbGljZSgwLCAtNSkucmVwbGFjZSgnVCcsICcgJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICB9XG4gICAgICAgICBiaWQuc29ydCgoYSwgYikgPT4gYi5BbW91bnQgLSBhLkFtb3VudCk7XG4gICAgICAgICBpZiAoYmlkICYmIGJpZFswXSkge1xuICAgICAgICAgICAgaXNIaWdoZXJCaWQgPSBiaWRbMF0uUmVnaXN0cmF0aW9uLnRvU3RyaW5nKCkgPT09IHVzZXJJZC50b1N0cmluZygpO1xuICAgICAgICAgfVxuICAgICAgICAgY29uc3QgYXJ0aXN0RGF0YSA9IGF3YWl0IF9maW5kQXJ0aXN0SW1hZ2VJbkV2ZW50KGF1Y3Rpb25EYXRhW2ldLkV2ZW50LCBhdWN0aW9uRGF0YVtpXS5Sb3VuZCwgYXVjdGlvbkRhdGFbaV0uRWFzZWxOdW1iZXIsIGZhbHNlKTtcbiAgICAgICAgIGlmIChhcnRpc3REYXRhKSB7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnQXJ0aXN0RGF0YSA9PT4+PicsIGFydGlzdERhdGEuRGV0YWlsKTtcbiAgICAgICAgICAgIGNvbnN0IGFydGlzdE5hbWVEYXRhID0gYXdhaXQgQ29udGVzdGFudE1vZGVsLmZpbmRPbmUoeydfaWQnOiBhcnRpc3REYXRhLkRldGFpbH0pLnNlbGVjdChbJ05hbWUnXSkuZXhlYygpO1xuXG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnYXJ0aXN0TmFtZURhdGEgPT0+Pj4nLCBhcnRpc3ROYW1lRGF0YSk7XG4gICAgICAgICAgICBhdWN0aW9uTG9ncy5wdXNoKHtcbiAgICAgICAgICAgICAgICdBcnRJZCc6IGV2ZW50TmFtZSxcbiAgICAgICAgICAgICAgICdhbW91bnQnOiBhbW91bnQsXG4gICAgICAgICAgICAgICAnY3JlYXRlZEF0JzogY3JlYXRlZEF0LFxuICAgICAgICAgICAgICAgJ2FydGlzdF9uYW1lJzogYXJ0aXN0TmFtZURhdGEgJiYgYXJ0aXN0TmFtZURhdGEuTmFtZSxcbiAgICAgICAgICAgICAgICdpc0hpZ2hlckJpZCc6IGlzSGlnaGVyQmlkID09PSB0cnVlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyhgTm8gYXJ0aXN0IGluIHRoaXMgcm91bmQ/ICR7YXVjdGlvbkRhdGFbaV0uRXZlbnQgJiYgYXVjdGlvbkRhdGFbaV0uRXZlbnQuX2lkfSAke2F1Y3Rpb25EYXRhW2ldLlJvdW5kfSAke2F1Y3Rpb25EYXRhW2ldLkVhc2VsTnVtYmVyfVxuICAgICAgICAgICAgYmlkIGFtb3VudCAke2Ftb3VudH0gYXJ0IGlkICR7YXVjdGlvbkRhdGFbaV0uQXJ0SWR9XG4gICAgICAgICAgICBgKTtcbiAgICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgY29uc3QgcXVlcnk6IHtcbiAgICAgICAgIHN0YXR1czogYW55O1xuICAgICAgfSA9IHtcbiAgICAgICAgIHN0YXR1czogMSxcbiAgICAgIH07XG4gICAgICBjb25zdCBwaG9uZU51bWJlcnNMaXN0ID0gYXdhaXQgRXZlbnRQaG9uZU51bWJlck1vZGVsLmZpbmQocXVlcnkpLnNlbGVjdChbXG4gICAgICAgICAnX2lkJyxcbiAgICAgICAgICdwaG9uZScsXG4gICAgICAgICAnbGFiZWwnLFxuICAgICAgICAgJ3R5cGUnLFxuICAgICAgICAgJ2xvY2F0aW9uJyxcbiAgICAgICAgICdzdGF0dXMnXG4gICAgICBdKS5zb3J0KHtcbiAgICAgICAgICAgICAnRXZlbnRTdGFydERhdGVUaW1lJzogLTFcbiAgICAgICAgICB9KS5leGVjKCk7XG5cblxuXG5cblxuICAgICAgY29uc3QgbWVzc2FnZURhdGEgPSBhd2FpdCBNZXNzYWdlU2NoZW1hLmZpbmQoeydDbGllbnRSZWdpc3RyYXRpb24nOiB1c2VySWR9KVxuICAgICAgICAgIC5zb3J0KHtcbiAgICAgICAgICAgICAnX2lkJzogLTFcbiAgICAgICAgICB9KS5saW1pdCgyMCk7XG5cbiAgICAgIGNvbnN0IGxhc3RTZXJ2ZXJQaG9uZU51bWJlciA9IG1lc3NhZ2VEYXRhWzBdICYmIG1lc3NhZ2VEYXRhWzBdLlNlcnZlck51bWJlcjtcblxuICAgICAgLy8gY29uc29sZS5sb2coJ2F1Y3Rpb25Mb2dzID09Pj4+PicsIGF1Y3Rpb25Mb2dzKTtcbiAgICAgIC8vIGNvbnN0IGNvbnRlc3RhbnQgPSBfZmluZEFydGlzdEltYWdlSW5FdmVudChFdmVudCwgTG90LlJvdW5kLCBMb3QuRWFzZWxOdW1iZXIpO1xuXG4gICAgICByZXMucmVuZGVyKCdwX3Byb2ZpbGUnLCB7XG4gICAgICAgICB1c2VySW5mbzogdXNlckRhdGEsXG4gICAgICAgICBldmVudEpvaW5lZDogZXZlbnRGaW5hbERhdGEsXG4gICAgICAgICBwcm9tb3Rpb25Mb2dzOiBwcm9tb3Rpb25Mb2dzLFxuICAgICAgICAgYXVjdGlvbkRhdGEgOiBhdWN0aW9uTG9ncyxcbiAgICAgICAgIHBob25lTnVtYmVyTGlzdDogcGhvbmVOdW1iZXJzTGlzdCxcbiAgICAgICAgIHJlZ2lzdHJhdGlvbklkOiB1c2VySWQsXG4gICAgICAgICBwaG9uZU51bWJlcjogdXNlckRhdGEuUGhvbmVOdW1iZXIsXG4gICAgICAgICBtZXNzYWdlRGF0YTogbWVzc2FnZURhdGEsXG4gICAgICAgICBsYXN0U2VydmVyUGhvbmVOdW1iZXI6IGxhc3RTZXJ2ZXJQaG9uZU51bWJlcixcbiAgICAgICAgIHRva2VuOiAnJyxcbiAgICAgICAgIHZpZGVvTGlzdDogW10sXG4gICAgICAgICBBcnRzOiBBcnRzXG4gICAgICB9KTtcbiAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgcmV0dXJuIG5leHQoZXJyKTtcbiAgIH1cbn07XG5cblxuZXhwb3J0IGxldCB1c2VyUHJvZmlsZVNlbmRNZXNzYWdlID0gYXN5bmMocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pID0+IHtcbiAgIHRyeSB7XG4gICAgICBjb25zdCBkdCA9IHJlcS5ib2R5O1xuICAgICAgY29uc3QgTWVzc2FnZU9iaiA9IG5ldyBNZXNzYWdlU2NoZW1hKCk7XG4gICAgICBNZXNzYWdlT2JqLk1lc3NhZ2UgPSBkdC5tZXNzYWdlO1xuICAgICAgTWVzc2FnZU9iai5TZXJ2ZXJVc2VyID0gZHQucmVnaXN0cmF0aW9uSWQ7XG4gICAgICBNZXNzYWdlT2JqLlNlcnZlclJlZ2lzdHJhdGlvbiA9IGR0LnJlZ2lzdHJhdGlvbklkO1xuICAgICAgTWVzc2FnZU9iai5TZXJ2ZXJOdW1iZXIgPSBkdC5Ud2lsaW9waG9uZW51bWJlcjtcbiAgICAgIE1lc3NhZ2VPYmouU2VydmVyTnVtYmVyRG9jID0gZHQucmVnaXN0cmF0aW9uSWQ7XG4gICAgICBNZXNzYWdlT2JqLkNsaWVudFBob25lTnVtYmVyID0gZHQudXNlclBob25lTnVtYmVyO1xuICAgICAgTWVzc2FnZU9iai5DbGllbnRSZWdpc3RyYXRpb24gPSBkdC5yZWdpc3RyYXRpb25JZDtcbiAgICAgIE1lc3NhZ2VPYmouU3RhdHVzID0gMTsgLy8gU0VORCBUTyBVU0VSXG5cbiAgICAgIGNvbnN0IHNhdmVkTWVzc2FnZSA9IGF3YWl0IE1lc3NhZ2VPYmouc2F2ZSgpO1xuXG5cbiAgICAgIGNvbnN0IHR3aWxpb0NsaWVudCA9IFR3aWxpbygpO1xuICAgICAgY29uc3QgdHdpbGlvUmVzcG9uc2UgPSBhd2FpdCB0d2lsaW9DbGllbnQubWVzc2FnZXMuY3JlYXRlKHtcbiAgICAgICAgIGZyb206IGR0LlR3aWxpb3Bob25lbnVtYmVyLFxuICAgICAgICAgdG86IGR0LnVzZXJQaG9uZU51bWJlcixcbiAgICAgICAgIC8vIHRvOiAnKzE0MTYzMDI1OTU5JyxcbiAgICAgICAgIGJvZHk6IGR0Lm1lc3NhZ2VcbiAgICAgIH0pO1xuICAgICAgLy8gY29uc29sZS5sb2coJ1NNUyBSZXNwb3NuZSA9PT4+JywgdHdpbGlvUmVzcG9uc2Uuc2lkKTtcblxuXG5cbiAgICAgIHJldHVybiByZXMucmVkaXJlY3QocHJvY2Vzcy5lbnYuU0lURV9VUkwgKyAnL3AvJyArIGR0LnVzZXJQaG9uZU51bWJlcik7XG4gICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHJldHVybiBuZXh0KGVycik7XG4gICB9XG59O1xuXG5cbmZ1bmN0aW9uIF9maW5kQXJ0aXN0SW1hZ2VJbkV2ZW50KGV2ZW50OiBFdmVudERUTywgcm91bmROdW1iZXI6IE51bWJlciwgRWFzZWxOdW1iZXI6IG51bWJlciwgY2hlY2tFbmFibGVkID0gdHJ1ZSk6IFJvdW5kQ29udGVzdGFudERUTyB7XG4gICBmb3IgKGxldCBpID0gMDsgaSA8IGV2ZW50LlJvdW5kcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgUm91bmQgPSBldmVudC5Sb3VuZHNbaV07XG4gICAgICBpZiAocm91bmROdW1iZXIgPT09IFJvdW5kLlJvdW5kTnVtYmVyKSB7XG4gICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IFJvdW5kLkNvbnRlc3RhbnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBpZiAoUm91bmQuQ29udGVzdGFudHNbal0uRWFzZWxOdW1iZXIgPT09IEVhc2VsTnVtYmVyKSB7XG4gICAgICAgICAgICAgICBpZiAoY2hlY2tFbmFibGVkICYmIFJvdW5kLkNvbnRlc3RhbnRzW2pdLkVuYWJsZWQpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBSb3VuZC5Db250ZXN0YW50c1tqXTtcbiAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gUm91bmQuQ29udGVzdGFudHNbal07XG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICB9XG4gICAgICB9XG4gICB9XG59XG5leHBvcnQgY29uc3QgZ2V0RGV2aWNlQ291bnRzID0gYXN5bmMgKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG5cbiAgIC8vIHRyeSB7XG4gICAvLyAgICBjb25zdCBkdCA9IHJlcS5ib2R5O1xuICAgLy8gICAgbGV0IHJlZ2lzdHJhdGlvbklEcyA9IGR0LnJlZ2lzdHJhdGlvbklEcztcblxuICAgLy8gICAgcmVnaXN0cmF0aW9uSURzID0gWy4uLiBuZXcgU2V0KHJlZ2lzdHJhdGlvbklEcyldO1xuXG4gICAvLyAgICBjb25zdCBjb25kaXRpb24gPSB7fTtcbiAgIC8vICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgIC8vICAgICAgIGNvbmRpdGlvbi5faWQgPSB7ICRpbjogcmVnaXN0cmF0aW9uSURzIH07XG4gICAvLyAgICAgICBjb25zdCB1c2VyRGV2aWNlRGF0YSA9IFJlZ2lzdHJhdGlvbk1vZGVsLmZpbmQoY29uZGl0aW9uKS5zZWxlY3QoW1xuICAgLy8gICAgICAgICAgJ19pZCcsXG4gICAvLyAgICAgICAgICAnQW5kcm9pZERldmljZVRva2VucycsXG4gICAvLyAgICAgICAgICAnRGV2aWNlVG9rZW5zJyxcbiAgIC8vICAgICAgICAgICdQaG9uZU51bWJlcicsXG4gICAvLyAgICAgICAgICAnRmlyc3ROYW1lJyxcbiAgIC8vICAgICAgICAgICdMYXN0TmFtZSdcbiAgIC8vICAgICAgIF0pO1xuXG4gICAvLyAgICAgICBjb25zb2xlLmxvZygnUmVzdWx0ID09PT4+PicsIEpTT04uc3RyaW5naWZ5KHVzZXJEZXZpY2VEYXRhKSk7XG5cblxuXG5cblxuICAgLy8gICAgY29uc3QgaXNTTVMgPSBkdC5zbXM7XG4gICAvLyAgICBjb25zdCBpc2lPUyA9IGR0LmlvcztcbiAgIC8vICAgIGNvbnN0IGlzQW5kcm9pZCA9IGR0LmFuZHJvaWQ7XG4gICAvLyAgICBjb25zdCB0d2lsbGlvUGhvbmVOdW1iZXIgPSBkdC5QaG9uZW51bWJlcjtcbiAgIC8vICAgIGNvbnN0IG1lc3NhZ2UgPSBkdC5tZXNzYWdlO1xuXG5cblxuICAgLy8gICAgaWYgKHJlZ2lzdHJhdGlvbklEcy5sZW5ndGggPiAwKSB7XG4gICAvLyAgICAgICAvLyBGRVRDSCBUT0tFTiBEZXRhaWxzXG5cbiAgIC8vICAgICAgIGNvbnN0IHByb21pc2VzID0gW107XG4gICAvLyAgICAgICBjb25zdCBjb25kaXRpb24gPSB7fTtcbiAgIC8vICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgIC8vICAgICAgIGNvbmRpdGlvbi5faWQgPSB7ICRpbjogcmVnaXN0cmF0aW9uSURzIH07XG4gICAvLyAgICAgICBjb25zdCBwcm9taXNlMSA9IFJlZ2lzdHJhdGlvbk1vZGVsLmZpbmQoY29uZGl0aW9uKS5zZWxlY3QoW1xuICAgLy8gICAgICAgICAgJ19pZCcsXG4gICAvLyAgICAgICAgICAnQW5kcm9pZERldmljZVRva2VucycsXG4gICAvLyAgICAgICAgICAnRmlyc3ROYW1lJyxcbiAgIC8vICAgICAgICAgICdMYXN0TmFtZSdcbiAgIC8vICAgICAgIF0pO1xuICAgLy8gICAgICAgcHJvbWlzZXMucHVzaChwcm9taXNlMSk7XG4gICAvLyAgICAgICBjb25zdCBwcm9taXNlMiA9IFJlZ2lzdHJhdGlvbk1vZGVsLmZpbmQoY29uZGl0aW9uKS5zZWxlY3QoW1xuICAgLy8gICAgICAgICAgJ19pZCcsXG4gICAvLyAgICAgICAgICAnRGV2aWNlVG9rZW5zJyxcbiAgIC8vICAgICAgICAgICdGaXJzdE5hbWUnLFxuICAgLy8gICAgICAgICAgJ0xhc3ROYW1lJ1xuICAgLy8gICAgICAgXSk7XG4gICAvLyAgICAgICBwcm9taXNlcy5wdXNoKHByb21pc2UyKTtcbiAgIC8vICAgICAgIGNvbnN0IHByb21pc2UzID0gUmVnaXN0cmF0aW9uTW9kZWwuZmluZChjb25kaXRpb24pLnNlbGVjdChbXG4gICAvLyAgICAgICAgICAnX2lkJyxcbiAgIC8vICAgICAgICAgICdQaG9uZU51bWJlcicsXG4gICAvLyAgICAgICAgICAnRmlyc3ROYW1lJyxcbiAgIC8vICAgICAgICAgICdMYXN0TmFtZSdcbiAgIC8vICAgICAgIF0pO1xuICAgLy8gICAgICAgcHJvbWlzZXMucHVzaChwcm9taXNlMyk7XG5cblxuICAgLy8gICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcbiAgIC8vICAgICAgIGNvbnN0IGFuZHJvaWRUb2tlbnMgPSByZXN1bHRzWzBdO1xuICAgLy8gICAgICAgY29uc3QgaU9TVG9rZW5zID0gcmVzdWx0c1sxXTtcbiAgIC8vICAgICAgIGNvbnN0IHBob25lbnVtYmVyID0gcmVzdWx0c1syXTtcblxuICAgLy8gICAgICAgY29uc3QgZmluYWxBbmRyb2lkID0gW107XG4gICAvLyAgICAgICBjb25zdCBmaW5hbGlPUyA9IFtdO1xuICAgLy8gICAgICAgY29uc3QgZmluYWxQaG9uZU51bWJlcnMgPSBbXTtcblxuICAgLy8gICAgICAgLy8gQW5kcm9pZCBUb2tlbnNcbiAgIC8vICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYW5kcm9pZFRva2Vucy5sZW5ndGg7IGkrKykge1xuXG4gICAvLyAgICAgICAgICBpZiAoYW5kcm9pZFRva2Vuc1tpXS5BbmRyb2lkRGV2aWNlVG9rZW5zICE9PSBudWxsKSB7XG4gICAvLyAgICAgICAgICAgICBpZiAoYW5kcm9pZFRva2Vuc1tpXS5BbmRyb2lkRGV2aWNlVG9rZW5zLmxlbmd0aCA+IDApIHtcbiAgIC8vICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgYW5kcm9pZFRva2Vuc1tpXS5BbmRyb2lkRGV2aWNlVG9rZW5zLmxlbmd0aDsgaisrKSB7XG4gICAvLyAgICAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnVG9rZW4gPT09Pj4nLCBhbmRyb2lkVG9rZW5zW2ldLkFuZHJvaWREZXZpY2VUb2tlbnNbal0pO1xuICAgLy8gICAgICAgICAgICAgICAgICAgZmluYWxBbmRyb2lkLnB1c2goYW5kcm9pZFRva2Vuc1tpXS5BbmRyb2lkRGV2aWNlVG9rZW5zW2pdKTtcbiAgIC8vICAgICAgICAgICAgICAgIH1cbiAgIC8vICAgICAgICAgICAgIH1cbiAgIC8vICAgICAgICAgIH1cbiAgIC8vICAgICAgIH1cblxuICAgLy8gICAgICAgLy8gaU9TIFRva2Vuc1xuICAgLy8gICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpT1NUb2tlbnMubGVuZ3RoOyBpKyspIHtcblxuICAgLy8gICAgICAgICAgaWYgKGlPU1Rva2Vuc1tpXS5EZXZpY2VUb2tlbnMgIT09IG51bGwpIHtcbiAgIC8vICAgICAgICAgICAgIGlmIChpT1NUb2tlbnNbaV0uRGV2aWNlVG9rZW5zLmxlbmd0aCA+IDApIHtcbiAgIC8vICAgICAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgaU9TVG9rZW5zW2ldLkRldmljZVRva2Vucy5sZW5ndGg7IGorKykge1xuICAgLy8gICAgICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coJ1Rva2VuID09PT4+JywgYW5kcm9pZFRva2Vuc1tpXS5BbmRyb2lkRGV2aWNlVG9rZW5zW2pdKTtcbiAgIC8vICAgICAgICAgICAgICAgICAgIGZpbmFsaU9TLnB1c2goaU9TVG9rZW5zW2ldLkRldmljZVRva2Vuc1tqXSk7XG4gICAvLyAgICAgICAgICAgICAgICB9XG4gICAvLyAgICAgICAgICAgICB9XG4gICAvLyAgICAgICAgICB9XG4gICAvLyAgICAgICB9XG5cbiAgIC8vICAgICAgIC8vIFBob25lTnVtYmVyIExpc3RcbiAgIC8vICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGhvbmVudW1iZXIubGVuZ3RoOyBpKyspIHtcblxuICAgLy8gICAgICAgICAgaWYgKHBob25lbnVtYmVyW2ldLlBob25lTnVtYmVyICE9PSBudWxsKSB7XG4gICAvLyAgICAgICAgICAgICBpZiAocGhvbmVudW1iZXJbaV0uUGhvbmVOdW1iZXIubGVuZ3RoID4gMCkge1xuICAgLy8gICAgICAgICAgICAgICAgLy8gZm9yIChsZXQgaiA9IDA7IGogPCBpT1NUb2tlbnNbaV0uRGV2aWNlVG9rZW5zLmxlbmd0aDsgaisrKSB7XG4gICAvLyAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnVG9rZW4gPT09Pj4nLCBhbmRyb2lkVG9rZW5zW2ldLkFuZHJvaWREZXZpY2VUb2tlbnNbal0pO1xuICAgLy8gICAgICAgICAgICAgICAgZmluYWxQaG9uZU51bWJlcnMucHVzaChwaG9uZW51bWJlcltpXS5QaG9uZU51bWJlcik7XG4gICAvLyAgICAgICAgICAgICAgICAvLyB9XG4gICAvLyAgICAgICAgICAgICB9XG4gICAvLyAgICAgICAgICB9XG4gICAvLyAgICAgICB9XG5cbiAgIC8vICAgICAgIGlmIChpc1NNUykge1xuXG4gICAvLyAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDE7IGkrKykge1xuICAgLy8gICAgICAgICAgICAgY29uc3QgcGggPSBmaW5hbFBob25lTnVtYmVyc1tpXTtcbiAgIC8vICAgICAgICAgICAgIGNvbnN0IHR3aWxpb0NsaWVudCA9IFR3aWxpbygpO1xuICAgLy8gICAgICAgICAgICAgICAgdHdpbGlvQ2xpZW50Lm1lc3NhZ2VzLmNyZWF0ZSh7XG4gICAvLyAgICAgICAgICAgICAgICAgICBmcm9tOiB0d2lsbGlvUGhvbmVOdW1iZXIsXG4gICAvLyAgICAgICAgICAgICAgICAgICAgdG86IGZpbmFsUGhvbmVOdW1iZXJzW2ldLFxuICAgLy8gICAgICAgICAgICAgICAgICAgLy8gdG86ICcrMTQxNjMwMjU5NTknLFxuICAgLy8gICAgICAgICAgICAgICAgICAgYm9keTogbWVzc2FnZVxuICAgLy8gICAgICAgICAgICAgICAgfSlcbiAgIC8vICAgICAgICAgICAgICAgIC50aGVuKG1lc3NhZ2UgPT4gY29uc29sZS5sb2cocGggKyAnIFNNUyA9PT0+Pj4nLCBtZXNzYWdlLnNpZCkpO1xuICAgLy8gICAgICAgICAgfVxuICAgLy8gICAgICAgfVxuXG5cblxuICAgLy8gICAgICAgaWYgKGlzaU9TKSB7XG4gICAvLyAgICAgICAgICAgY29uc3QgYmFkRGV2aWNlVG9rZW5zID0gYXdhaXQgc2VuZE5vdGlmaWNhdGlvbihmaW5hbGlPUywgbWVzc2FnZSwgJ0FydGJhdHRsZScpO1xuICAgLy8gICAgICAgICAgIGNvbnNvbGUubG9nKCdpT1MgTG9ncyA9PiAnLCBKU09OLnN0cmluZ2lmeShiYWREZXZpY2VUb2tlbnMpKTtcbiAgIC8vICAgICAgIH1cblxuICAgLy8gICAgICAgaWYgKGlzQW5kcm9pZCkge1xuICAgLy8gICAgICAgICAgLy8gQU5EUk9JRCBOT1RJRklDQVRJT05cbiAgIC8vICAgICAgICAgIGNvbnN0IGFuZHJvaWRSZXMgPSBhd2FpdCBNdWx0aUNhc3Qoe1xuICAgLy8gICAgICAgICAgRGV2aWNlVG9rZW5zOiBmaW5hbEFuZHJvaWQsXG4gICAvLyAgICAgICAgICBsaW5rOiAnJyxcbiAgIC8vICAgICAgICAgIHRpdGxlOiAnQXJ0YmF0dGxlJyxcbiAgIC8vICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAvLyAgICAgICAgICBwcmlvcml0eTogJ25vcm1hbCcsXG4gICAvLyAgICAgICAgICBhbmFseXRpY3NMYWJlbDogJ1dlYlZpZXcgVGVzdCdcbiAgIC8vICAgICAgICAgIH0pO1xuICAgLy8gICAgICAgICAgY29uc29sZS5sb2coJ0FuZHJvaWQgTG9ncyA9PiAnLCBKU09OLnN0cmluZ2lmeShhbmRyb2lkUmVzKSk7XG4gICAvLyAgICAgICB9XG5cblxuICAgLy8gICAgICAgY29uc3QgcmVzdWx0OiBEYXRhT3BlcmF0aW9uUmVzdWx0PHN0cmluZz4gPSB7XG4gICAvLyAgICAgICAgICAnU3VjY2Vzcyc6IHRydWUsXG4gICAvLyAgICAgICAgICBEYXRhOiAnTm90aWZpY2F0aW9uIHNlbnQgU3VjY2Vzc2Z1bGx5J1xuICAgLy8gICAgICAgfTtcbiAgIC8vICAgICAgIHJlcy5qc29uKHJlc3VsdCk7XG4gICAvLyAgICAgICByZXR1cm47XG4gICAvLyAgICAvLyB9IGVsc2Uge1xuICAgLy8gICAgLy8gICAgY29uc3QgcmVzdWx0OiBEYXRhT3BlcmF0aW9uUmVzdWx0PHN0cmluZz4gPSB7XG4gICAvLyAgICAvLyAgICAgICAnU3VjY2Vzcyc6IGZhbHNlLFxuICAgLy8gICAgLy8gICAgICAgRGF0YTogJ1BsZWFzZSBwcm92aWRlIHJlZ2lzdHJhdGlvbiBJZHMnXG4gICAvLyAgICAvLyAgICB9O1xuICAgLy8gICAgLy8gICAgcmVzLmpzb24ocmVzdWx0KTtcbiAgIC8vICAgIC8vICAgIHJldHVybjtcbiAgIC8vICAgICB9XG5cbiAgIC8vIH0gY2F0Y2ggKGUpIHtcbiAgIC8vICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAvLyAgICAvLyBsb2dnZXIuZXJyb3IoYCR7ZS5tZXNzYWdlfSAke2Uuc3RhY2t9YCk7XG4gICAvLyAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8c3RyaW5nPiA9IHtcbiAgIC8vICAgICAgICdTdWNjZXNzJzogZmFsc2UsXG4gICAvLyAgICAgICBEYXRhOiAnSW50ZXJuYWwgU2VydmVyIEVycm9yJ1xuICAgLy8gICAgfTtcbiAgIC8vICAgIHJlcy5zdGF0dXMoNTAwKTtcbiAgIC8vICAgIG5leHQocmVzdWx0KTtcbiAgIC8vIH1cbn07XG5cbmV4cG9ydCBsZXQgY2hhbmdlTWVzc2FnZVN0YXR1cyA9IGFzeW5jKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSA9PiB7XG4gICB0cnkge1xuICAgICAgY29uc3QgcmVnaXN0cmF0aW9uSWQgPSByZXEucGFyYW1zLnJlZ2lzdHJhdGlvbklkO1xuICAgICAgY29uc3QgaXNCbG9ja2VkID0gcGFyc2VJbnQocmVxLnBhcmFtcy5pc0Jsb2NrZWQpO1xuICAgICAgaWYgKCEoaXNCbG9ja2VkID09PSAwIHx8IGlzQmxvY2tlZCA9PT0gMSkpIHtcbiAgICAgICAgIHJlcy5zdGF0dXMoNDAzKTtcbiAgICAgICAgIGxvZ2dlci5pbmZvKGBJcyBXaW5uZXIgc2hvdWxkIGJlIDAgb3IgMWAsIHJlcS5wYXJhbXMuSXNXaW5uZXIpO1xuICAgICAgICAgY29uc3QgcmVzdWx0OiBEYXRhT3BlcmF0aW9uUmVzdWx0PHN0cmluZz4gPSB7XG4gICAgICAgICAgICAnU3VjY2Vzcyc6IGZhbHNlLFxuICAgICAgICAgICAgRGF0YTogJ0ludmFsaWQnXG4gICAgICAgICB9O1xuICAgICAgICAgcmVzLmpzb24ocmVzdWx0KTtcbiAgICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHJlZ2lzdHJhdGlvbiA9IGF3YWl0IFJlZ2lzdHJhdGlvbk1vZGVsLmZpbmRPbmUoe1xuICAgICAgICAgX2lkOiByZWdpc3RyYXRpb25JZFxuICAgICAgfSk7XG4gICAgICBpZiAocmVnaXN0cmF0aW9uKSB7XG4gICAgICAgICByZWdpc3RyYXRpb24uTWVzc2FnZUJsb2NrZWQgPSBpc0Jsb2NrZWQ7XG4gICAgICAgICBhd2FpdCByZWdpc3RyYXRpb24uc2F2ZSgpO1xuXG4gICAgICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8c3RyaW5nPiA9IHtcbiAgICAgICAgICAgICdTdWNjZXNzJzogdHJ1ZSxcbiAgICAgICAgICAgIERhdGE6IGlzQmxvY2tlZCA9PT0gMCA/ICcnIDogJ0Jsb2NrZWQnXG4gICAgICAgICB9O1xuICAgICAgICAgcmVzLmpzb24ocmVzdWx0KTtcbiAgICAgICAgIHJldHVybjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICBsb2dnZXIuaW5mbyhgbWF0Y2hpbmcgdXNlciBub3QgZm91bmQgJHtyZWdpc3RyYXRpb25JZH1gKTtcbiAgICAgICAgIHJlcy5zdGF0dXMoNDAzKTtcbiAgICAgICAgIGNvbnN0IHJlc3VsdDogRGF0YU9wZXJhdGlvblJlc3VsdDxzdHJpbmc+ID0ge1xuICAgICAgICAgICAgJ1N1Y2Nlc3MnOiBmYWxzZSxcbiAgICAgICAgICAgIERhdGE6ICdJbnZhbGlkJ1xuICAgICAgICAgfTtcbiAgICAgICAgIHJlcy5qc29uKHJlc3VsdCk7XG4gICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGxvZ2dlci5pbmZvKGUpO1xuICAgICAgY29uc3QgcmVzdWx0OiBEYXRhT3BlcmF0aW9uUmVzdWx0PHN0cmluZz4gPSB7XG4gICAgICAgICAnU3VjY2Vzcyc6IGZhbHNlLFxuICAgICAgICAgRGF0YTogJ0ludGVybmFsIFNlcnZlciBFcnJvcidcbiAgICAgIH07XG4gICAgICByZXMuc3RhdHVzKDUwMCk7XG4gICAgICByZXMuanNvbihyZXN1bHQpO1xuICAgfVxufTtcbiJdfQ==
