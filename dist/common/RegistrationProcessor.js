"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterByVoteFactor = exports.RegisterVoter = void 0;
const RegistrationLog_1 = require("../models/RegistrationLog");
const utils_1 = require("../utils");
const Event_1 = require("../models/Event");
const Registration_1 = require("../models/Registration");
const Twilio = require("twilio");
const nodemailer = require("nodemailer");
const register_1 = require("../controllers/register");
const google_libphonenumber_1 = require("google-libphonenumber");
const uniqueId = require('uniqid');
const phoneUtil = google_libphonenumber_1.PhoneNumberUtil.getInstance();
const logger_1 = require("../config/logger");
const States_1 = require("./States");
const Slack_1 = require("./Slack");
exports.RegisterVoter = async (dto, eventId, self = true, voteFactorNumber = 0.1, verified = false, userId = false) => {
    const logObj = new RegistrationLog_1.default();
    let channel = 'sms';
    if (self && voteFactorNumber === 0.1) {
        channel = 'app-global';
    }
    else if (self) {
        channel = 'app';
    }
    if (eventId === 'dummy') {
        eventId = '5e3c5f6624ca9a7ed1e9f517'; // assume static
    }
    logger_1.default.info(`Registering ${dto.PhoneNumber}, self ${self}, verified ${verified} userId ${userId}`);
    if (!dto.PhoneNumber) {
        const error = 'Invalid registration record. No PhoneNumber provided.';
        logger_1.default.info(error);
        throw error;
    }
    const isEmail = utils_1.IsEmail(dto.PhoneNumber);
    const event = await Event_1.default.findById(eventId).populate('Country');
    const countryPhoneCode = event.Country && event.Country.phone_code;
    let condition = {};
    if (!isEmail) {
        if (!dto.PhoneNumber.startsWith('+')) {
            // If phone number is without plus add it
            dto.PhoneNumber = `${countryPhoneCode}${dto.PhoneNumber}`;
        }
        try {
            const parsedNumber = _parseNumber(dto.PhoneNumber);
            dto.PhoneNumber = `+${parsedNumber.getCountryCode()}${parsedNumber.getNationalNumber()}`;
            dto.RegionCode = phoneUtil.getRegionCodeForNumber(parsedNumber);
            condition = {
                PhoneNumber: dto.PhoneNumber
            };
        }
        catch (e) {
            logger_1.default.info(`phone parse error ${e.message} `);
            e.status = 403;
            throw {
                status: e.status,
                message: e.message
            };
        }
    }
    else {
        dto.Email = '' + dto.PhoneNumber;
        condition = {
            Email: dto.Email
        };
        dto.PhoneNumber = null;
    }
    let userHistory = 'new';
    let registration = await Registration_1.default.findOne(condition);
    if (registration) {
        registration.FirstName = dto.FirstName || registration.FirstName;
        registration.LastName = dto.LastName || registration.LastName;
        registration.Email = dto.Email || registration.Email;
        registration.PhoneNumber = dto.PhoneNumber;
        registration.NickName = dto.NickName || registration.NickName;
        logObj.NumberExists = true;
        if (!registration.Hash) {
            // handle Old number
            logger_1.default.info('migrating old number');
            registration.Hash = uniqueId.time();
            registration.DisplayPhone = registration.PhoneNumber ? `*******${registration.PhoneNumber.slice(-4)}` : '';
        }
        userHistory = 'past';
    }
    else {
        logger_1.default.info('registering new user');
        logObj.AlreadyRegisteredForEvent = false;
        // For new user
        registration = new Registration_1.default(dto);
        registration.Hash = uniqueId.time();
        registration.DisplayPhone = registration.PhoneNumber ? `*******${registration.PhoneNumber.slice(-4)}` : '';
        registration.lastPromoSentAt = new Date(2014);
    }
    if (!verified && self) {
        // verification required
        registration.VerificationCode = Math.floor(1000 + Math.random() * 9000);
        registration.VerificationCodeExp = new Date(new Date().getTime() + 15 * 60 * 1000);
        registration.SelfRegistered = true;
        logger_1.default.info(`user is not verified, code: ${registration.VerificationCode} exp: ${registration.VerificationCodeExp}`);
    }
    const savedRegistration = await registration.save();
    const eventRegistration = event.Registrations.find(rid => {
        return savedRegistration._id.equals(rid);
    });
    let relatedReg;
    if (eventRegistration) {
        relatedReg = event.RegistrationsVoteFactor.find(reg => {
            return eventRegistration._id.equals(reg.RegistrationId);
        });
    }
    const existingVoteUrl = relatedReg && relatedReg.VoteUrl;
    // Generate and store vote link event if voting if link is enabled, so that event edit don't impact this.
    logObj.FirstName = registration.FirstName;
    logObj.LastName = registration.LastName;
    logObj.Email = registration.Email;
    logObj.PhoneNumber = registration.PhoneNumber;
    logObj.PhoneNumberHash = registration.Hash;
    logObj.DisplayPhone = registration.DisplayPhone;
    logObj.VoteUrl = existingVoteUrl || `/v/${uniqueId.time()}`;
    logObj.AuctionUrl = `${process.env.SHORT_SITE_URL}/a/r/${registration.Hash}`;
    logObj.RegisteredAt = channel;
    const voteFactor = await register_1.calculateUserVoteFactor(registration.PhoneNumber);
    if (registration.IsArtist) {
        voteFactor.result = States_1.StateVoteFactorMap[3];
    }
    if (!eventRegistration) {
        // if it is registration by admin or user is verified then do this
        logger_1.default.info('user verified', verified);
        const userVoteFactor = {
            RegistrationId: savedRegistration._id,
            VoteFactor: voteFactor.result,
            VoteFactorInfo: {
                Type: userHistory,
                Value: '' + voteFactor.voteCount
            },
            PhoneNumber: savedRegistration.PhoneNumber,
            Hash: savedRegistration.Hash,
            VoteUrl: logObj.VoteUrl,
            Email: savedRegistration.Email,
            RegionCode: savedRegistration.RegionCode,
            From: channel,
            NickName: savedRegistration.NickName,
            Preferences: savedRegistration.Preferences,
            Status: savedRegistration.IsArtist ? States_1.States[3] : '',
            AuctionUrl: logObj.AuctionUrl
        };
        if (!event.RegistrationsVoteFactor) {
            event.RegistrationsVoteFactor = [];
        }
        event.RegistrationsVoteFactor.push(userVoteFactor);
        event.Registrations.push(savedRegistration);
        logObj.AlreadyRegisteredForEvent = false;
    }
    else if (event.RegisterAtSMSVote) {
        logObj.AlreadyRegisteredForEvent = true;
        // userId check will force not logged in user to login using otp
        if (verified /*|| self*/) {
            // no verification required for self because user is registered by admin in the event
            logger_1.default.info('no verification required, already registered');
            registration.VerificationCode = null;
            registration.VerificationCodeExp = null;
            verified = true; // mark user as verified
            await registration.save();
        }
    }
    if (event) {
        logObj.EventId = event.id;
        logObj.EventName = event.Name;
    }
    logObj.VoteFactor = voteFactor.result;
    logObj.VoteFactorInfo = {
        Type: userHistory,
        Value: '' + voteFactor.voteCount
    };
    await event.save();
    // check existing active event registration where server phone number is same for logging
    const registeredInMultiple = await Event_1.default.find({
        'Registrations': registration,
        'Enabled': true,
        '_id': {
            '$ne': eventId
        },
        'PhoneNumber': event.PhoneNumber
    }).countDocuments();
    if (!(registeredInMultiple === 0)) {
        const errObj = {
            status: 403,
            code: 'mul_act_event',
            message: `${registration.PhoneNumber || registration.Email} is active in the ${registeredInMultiple} events.`
        };
        // throw errObj;
        logger_1.default.info(errObj);
    } // check existing active event registration where server phone number is same for logging
    const result = {
        Success: true,
        Data: {
            VoteFactor: logObj.VoteFactor,
            VoteFactorInfo: logObj.VoteFactorInfo,
            RegistrationId: registration._id,
            PhoneNumber: registration.PhoneNumber,
            Hash: registration.Hash,
            VoteUrl: logObj.VoteUrl,
            AuctionUrl: logObj.AuctionUrl,
            AlreadyRegistered: logObj.AlreadyRegisteredForEvent,
            RegisteredInMultipleActiveEvent: registeredInMultiple,
            Email: registration.Email,
            RegionCode: registration.RegionCode,
            RegionImage: registration.RegionCode && (event.Country && event.Country.country_code.toLowerCase() != registration.RegionCode.toLowerCase()) ? `/images/countries/4x3/${registration.RegionCode.toLowerCase()}.svg` : null,
            RegionImagePng: registration.RegionCode && (event.Country && event.Country.country_code.toLowerCase() != registration.RegionCode.toLowerCase()) ? `/images/countries/4x3_png/${registration.RegionCode.toLowerCase()}.png` : null,
            VerificationCode: registration.VerificationCode,
            VerificationCodeExp: registration.VerificationCodeExp,
            ServerPhoneNumber: event.PhoneNumber,
            NickName: registration.NickName,
            Verified: verified,
            Status: logObj.Status,
            userVoteFactor: event.RegistrationsVoteFactor[event.RegistrationsVoteFactor.length - 1]
        }
    };
    // Intentionally not waiting for the log entry to complete
    logObj.save().catch(e => {
        logger_1.default.info(`${e.message} ${e.stack}`);
    });
    if (event.VoteByLink && event.SendLinkToGuests && !event.SendAuctionLinkToGuests) {
        event.RegistrationConfirmationMessage += ` > ${process.env.SITE_URL}${logObj.VoteUrl}`;
    }
    else if (event.SendAuctionLinkToGuests) {
        event.RegistrationConfirmationMessage += ` > ${logObj.AuctionUrl}`;
    }
    if (!isEmail && !self) {
        // only if user is registered by admin
        const twilioClient = Twilio();
        twilioClient.messages.create({
            from: event.PhoneNumber,
            to: dto.PhoneNumber,
            body: event.RegistrationConfirmationMessage
        });
        Slack_1.postToSlackSMSFlood({
            'text': `${registration.NickName}(${dto.PhoneNumber}) (sms) \n${event.RegistrationConfirmationMessage} source: RegistrationProcessor.RegisterVoter`
        }).catch(() => logger_1.default.error(`otp slack flood call failed ${event.RegistrationConfirmationMessage} source: RegistrationProcessor.RegisterVoter`));
    }
    else if (isEmail) {
        const transportOptions = {
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT),
            secure: false,
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            },
            pool: {
                pool: true,
            }
        };
        const transporter = nodemailer.createTransport(transportOptions);
        const mailOptions = {
            to: dto.Email,
            from: 'hello@artbattle.com',
            subject: `Vote link for ${event.Name}`,
            text: `Your personal Art Battle voting URL ${process.env.SITE_URL}${logObj.VoteUrl}\n`
        };
        transporter.sendMail(mailOptions, (err) => {
            if (err) {
                logger_1.default.info('Error in sending the registration email', err);
            }
        });
    }
    logger_1.default.info(`Successfully registered ${dto.FirstName} ${dto.LastName} - ${dto.PhoneNumber}, sms body ${event.RegistrationConfirmationMessage}`);
    /*res.json(result);*/
    return result;
};
const _parseNumber = function (phoneNumber) {
    const parsedNumber = phoneUtil.parse(phoneNumber);
    if (!phoneUtil.isValidNumber(parsedNumber)) {
        throw {
            status: 403,
            message: 'Phone number is in invalid format.'
        };
    }
    return parsedNumber;
};
exports.RegisterByVoteFactor = async function (matchingVoteFactor) {
    const regModel = new Registration_1.default({
        PhoneNumber: matchingVoteFactor.PhoneNumber,
        _id: matchingVoteFactor.RegistrationId,
        NickName: matchingVoteFactor.NickName,
        Email: matchingVoteFactor.Email,
        Hash: matchingVoteFactor.Hash,
        DisplayPhone: `*******${matchingVoteFactor.PhoneNumber.slice(-4)}`,
        RegionCode: matchingVoteFactor.RegionCode,
        Preferences: matchingVoteFactor.Preferences,
        lastPromoSentAt: new Date(2014)
    });
    return await regModel.save();
};

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbW1vbi9SZWdpc3RyYXRpb25Qcm9jZXNzb3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsK0RBQTRFO0FBQzVFLG9DQUFtQztBQUNuQywyQ0FBeUM7QUFDekMseURBQXVEO0FBSXZELGlDQUFpQztBQUVqQyx5Q0FBeUM7QUFDekMsc0RBQWtFO0FBQ2xFLGlFQUF3RDtBQUN4RCxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDbkMsTUFBTSxTQUFTLEdBQUcsdUNBQWUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztBQUNoRCw2Q0FBc0M7QUFFdEMscUNBQXNEO0FBQ3RELG1DQUE4QztBQUc5QyxxQkFBYSxHQUFHLEtBQUssRUFBRSxHQUFvQixFQUFFLE9BQVksRUFBRSxJQUFJLEdBQUcsSUFBSSxFQUFFLGdCQUFnQixHQUFHLEdBQUcsRUFBRSxRQUFRLEdBQUcsS0FBSyxFQUFFLE1BQU0sR0FBRyxLQUFLLEVBQUUsRUFBRTtJQUNoSSxNQUFNLE1BQU0sR0FBRyxJQUFJLHlCQUFvQixFQUFFLENBQUM7SUFDMUMsSUFBSSxPQUFPLEdBQUcsS0FBSyxDQUFDO0lBQ3BCLElBQUksSUFBSSxJQUFJLGdCQUFnQixLQUFLLEdBQUcsRUFBRTtRQUNsQyxPQUFPLEdBQUcsWUFBWSxDQUFDO0tBQzFCO1NBQU0sSUFBSSxJQUFJLEVBQUU7UUFDYixPQUFPLEdBQUcsS0FBSyxDQUFDO0tBQ25CO0lBQ0QsSUFBSSxPQUFPLEtBQUssT0FBTyxFQUFFO1FBQ3JCLE9BQU8sR0FBRywwQkFBMEIsQ0FBQyxDQUFDLGdCQUFnQjtLQUN6RDtJQUNELGdCQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRyxDQUFDLFdBQVcsVUFBVSxJQUFJLGNBQWMsUUFBUSxXQUFXLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFFbkcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUU7UUFDbEIsTUFBTSxLQUFLLEdBQUcsdURBQXVELENBQUM7UUFDdEUsZ0JB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QUFDLFdBQVc7UUFDM0MsR0FBRyxFQUFFLGtCQUFrQixDQUFDLGNBQWM7UUFDdEMsUUFBUSxFQUFFLGtCQUFrQixDQUFDLFFBQVE7UUFDckMsS0FBSyxFQUFFLGtCQUFrQixDQUFDLEtBQUs7UUFDL0IsSUFBSSxFQUFFLGtCQUFrQixDQUFDLElBQUk7UUFDN0IsWUFBWSxFQUFFLFVBQVUsa0JBQWtCLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ2xFLFVBQVUsRUFBRSxrQkFBa0IsQ0FBQyxVQUFVO1FBQ3pDLFdBQVcsRUFBRSxrQkFBa0IsQ0FBQyxXQUFXO1FBQzNDLGVBQWUsRUFBRSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUM7S0FDbEMsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUNqQyxDQUFDLENBQUMiLCJmaWxlIjoiY29tbW9uL1JlZ2lzdHJhdGlvblByb2Nlc3Nvci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBSZWdpc3RyYXRpb25EVE8gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL1JlZ2lzdHJhdGlvbkRUTyc7XG5pbXBvcnQgeyBkZWZhdWx0IGFzIFJlZ2lzdHJhdGlvbkxvZ01vZGVsIH0gZnJvbSAnLi4vbW9kZWxzL1JlZ2lzdHJhdGlvbkxvZyc7XG5pbXBvcnQgeyBJc0VtYWlsIH0gZnJvbSAnLi4vdXRpbHMnO1xuaW1wb3J0IEV2ZW50TW9kZWwgZnJvbSAnLi4vbW9kZWxzL0V2ZW50JztcbmltcG9ydCBSZWdpc3RyYXRpb25Nb2RlbCBmcm9tICcuLi9tb2RlbHMvUmVnaXN0cmF0aW9uJztcbmltcG9ydCB7IEVycm9yRFRPIH0gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL0Vycm9yRFRPJztcbmltcG9ydCB7IFJlZ2lzdHJhdGlvblZvdGVGYWN0b3JEVE8gfSBmcm9tICcuLi8uLi8uLi9zaGFyZWQvUm91bmRDb250ZXN0YW50RFRPJztcbmltcG9ydCB7IERhdGFPcGVyYXRpb25SZXN1bHQgfSBmcm9tICcuLi8uLi8uLi9zaGFyZWQvT3BlcmF0aW9uUmVzdWx0JztcbmltcG9ydCAqIGFzIFR3aWxpbyBmcm9tICd0d2lsaW8nO1xuaW1wb3J0IHsgU210cE9wdGlvbnMgfSBmcm9tICdub2RlbWFpbGVyLXNtdHAtdHJhbnNwb3J0JztcbmltcG9ydCAqIGFzIG5vZGVtYWlsZXIgZnJvbSAnbm9kZW1haWxlcic7XG5pbXBvcnQgeyBjYWxjdWxhdGVVc2VyVm90ZUZhY3RvciB9IGZyb20gJy4uL2NvbnRyb2xsZXJzL3JlZ2lzdGVyJztcbmltcG9ydCB7IFBob25lTnVtYmVyVXRpbCB9IGZyb20gJ2dvb2dsZS1saWJwaG9uZW51bWJlcic7XG5jb25zdCB1bmlxdWVJZCA9IHJlcXVpcmUoJ3VuaXFpZCcpO1xuY29uc3QgcGhvbmVVdGlsID0gUGhvbmVOdW1iZXJVdGlsLmdldEluc3RhbmNlKCk7XG5pbXBvcnQgbG9nZ2VyIGZyb20gJy4uL2NvbmZpZy9sb2dnZXInO1xuaW1wb3J0IHsgUmVnaXN0cmF0aW9uUmVzcG9uc2VEVE8gfSBmcm9tICcuLi8uLi8uLi9zaGFyZWQvUmVnaXN0cmF0aW9uUmVzcG9uc2UnO1xuaW1wb3J0IHsgU3RhdGVzLCBTdGF0ZVZvdGVGYWN0b3JNYXAgfSBmcm9tICcuL1N0YXRlcyc7XG5pbXBvcnQgeyBwb3N0VG9TbGFja1NNU0Zsb29kIH0gZnJvbSAnLi9TbGFjayc7XG5cbmV4cG9ydCBsZXQgUmVnaXN0ZXJWb3RlcjogKGR0bzogUmVnaXN0cmF0aW9uRFRPLCBldmVudElkOiBhbnksIHNlbGY/OiBib29sZWFuLCB2b3RlRmFjdG9yTnVtYmVyPzogbnVtYmVyLCB2ZXJpZmllZD86IGJvb2xlYW4sIHVzZXJJZD86IGJvb2xlYW4pID0+IFByb21pc2U8RGF0YU9wZXJhdGlvblJlc3VsdDxSZWdpc3RyYXRpb25SZXNwb25zZURUTz4+O1xuUmVnaXN0ZXJWb3RlciA9IGFzeW5jIChkdG86IFJlZ2lzdHJhdGlvbkRUTywgZXZlbnRJZDogYW55LCBzZWxmID0gdHJ1ZSwgdm90ZUZhY3Rvck51bWJlciA9IDAuMSwgdmVyaWZpZWQgPSBmYWxzZSwgdXNlcklkID0gZmFsc2UpID0+IHtcbiAgICBjb25zdCBsb2dPYmogPSBuZXcgUmVnaXN0cmF0aW9uTG9nTW9kZWwoKTtcbiAgICBsZXQgY2hhbm5lbCA9ICdzbXMnO1xuICAgIGlmIChzZWxmICYmIHZvdGVGYWN0b3JOdW1iZXIgPT09IDAuMSkge1xuICAgICAgICBjaGFubmVsID0gJ2FwcC1nbG9iYWwnO1xuICAgIH0gZWxzZSBpZiAoc2VsZikge1xuICAgICAgICBjaGFubmVsID0gJ2FwcCc7XG4gICAgfVxuICAgIGlmIChldmVudElkID09PSAnZHVtbXknKSB7XG4gICAgICAgIGV2ZW50SWQgPSAnNWUzYzVmNjYyNGNhOWE3ZWQxZTlmNTE3JzsgLy8gYXNzdW1lIHN0YXRpY1xuICAgIH1cbiAgICBsb2dnZXIuaW5mbyhgUmVnaXN0ZXJpbmcgJHtkdG8uUGhvbmVOdW1iZXJ9LCBzZWxmICR7c2VsZn0sIHZlcmlmaWVkICR7dmVyaWZpZWR9IHVzZXJJZCAke3VzZXJJZH1gKTtcblxuICAgIGlmICghZHRvLlBob25lTnVtYmVyKSB7XG4gICAgICAgIGNvbnN0IGVycm9yID0gJ0ludmFsaWQgcmVnaXN0cmF0aW9uIHJlY29yZC4gTm8gUGhvbmVOdW1iZXIgcHJvdmlkZWQuJztcbiAgICAgICAgbG9nZ2VyLmluZm8oZXJyb3IpO1xuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gICAgY29uc3QgaXNFbWFpbCA9IElzRW1haWwoZHRvLlBob25lTnVtYmVyKTtcbiAgICBjb25zdCBldmVudCA9IGF3YWl0IEV2ZW50TW9kZWwuZmluZEJ5SWQoZXZlbnRJZCkucG9wdWxhdGUoJ0NvdW50cnknKTtcbiAgICBjb25zdCBjb3VudHJ5UGhvbmVDb2RlID0gZXZlbnQuQ291bnRyeSAmJiBldmVudC5Db3VudHJ5LnBob25lX2NvZGU7XG5cbiAgICBsZXQgY29uZGl0aW9uID0ge307XG4gICAgaWYgKCFpc0VtYWlsKSB7XG4gICAgICAgIGlmICghZHRvLlBob25lTnVtYmVyLnN0YXJ0c1dpdGgoJysnKSkge1xuICAgICAgICAgICAgLy8gSWYgcGhvbmUgbnVtYmVyIGlzIHdpdGhvdXQgcGx1cyBhZGQgaXRcbiAgICAgICAgICAgIGR0by5QaG9uZU51bWJlciA9IGAke2NvdW50cnlQaG9uZUNvZGV9JHtkdG8uUGhvbmVOdW1iZXJ9YDtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcGFyc2VkTnVtYmVyID0gX3BhcnNlTnVtYmVyKGR0by5QaG9uZU51bWJlcik7XG4gICAgICAgICAgICBkdG8uUGhvbmVOdW1iZXIgPSBgKyR7cGFyc2VkTnVtYmVyLmdldENvdW50cnlDb2RlKCl9JHtwYXJzZWROdW1iZXIuZ2V0TmF0aW9uYWxOdW1iZXIoKX1gO1xuICAgICAgICAgICAgZHRvLlJlZ2lvbkNvZGUgPSBwaG9uZVV0aWwuZ2V0UmVnaW9uQ29kZUZvck51bWJlcihwYXJzZWROdW1iZXIpO1xuICAgICAgICAgICAgY29uZGl0aW9uID0ge1xuICAgICAgICAgICAgICAgIFBob25lTnVtYmVyOiBkdG8uUGhvbmVOdW1iZXJcbiAgICAgICAgICAgIH07XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBwaG9uZSBwYXJzZSBlcnJvciAke2UubWVzc2FnZX0gYCk7XG4gICAgICAgICAgICBlLnN0YXR1cyA9IDQwMztcblxuICAgICAgICAgICAgdGhyb3cge1xuICAgICAgICAgICAgICAgIHN0YXR1czogZS5zdGF0dXMsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogZS5tZXNzYWdlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZHRvLkVtYWlsID0gJycgKyBkdG8uUGhvbmVOdW1iZXI7XG4gICAgICAgIGNvbmRpdGlvbiA9IHtcbiAgICAgICAgICAgIEVtYWlsOiBkdG8uRW1haWxcbiAgICAgICAgfTtcbiAgICAgICAgZHRvLlBob25lTnVtYmVyID0gbnVsbDtcbiAgICB9XG4gICAgbGV0IHVzZXJIaXN0b3J5ID0gJ25ldyc7XG4gICAgbGV0IHJlZ2lzdHJhdGlvbiA9IGF3YWl0IFJlZ2lzdHJhdGlvbk1vZGVsLmZpbmRPbmUoY29uZGl0aW9uKTtcbiAgICBpZiAocmVnaXN0cmF0aW9uKSB7XG4gICAgICAgIHJlZ2lzdHJhdGlvbi5GaXJzdE5hbWUgPSBkdG8uRmlyc3ROYW1lIHx8IHJlZ2lzdHJhdGlvbi5GaXJzdE5hbWU7XG4gICAgICAgIHJlZ2lzdHJhdGlvbi5MYXN0TmFtZSA9IGR0by5MYXN0TmFtZSB8fCByZWdpc3RyYXRpb24uTGFzdE5hbWU7XG4gICAgICAgIHJlZ2lzdHJhdGlvbi5FbWFpbCA9IGR0by5FbWFpbCB8fCByZWdpc3RyYXRpb24uRW1haWw7XG4gICAgICAgIHJlZ2lzdHJhdGlvbi5QaG9uZU51bWJlciA9IGR0by5QaG9uZU51bWJlcjtcbiAgICAgICAgcmVnaXN0cmF0aW9uLk5pY2tOYW1lID0gZHRvLk5pY2tOYW1lIHx8IHJlZ2lzdHJhdGlvbi5OaWNrTmFtZTtcblxuICAgICAgICBsb2dPYmouTnVtYmVyRXhpc3RzID0gdHJ1ZTtcbiAgICAgICAgaWYgKCFyZWdpc3RyYXRpb24uSGFzaCkge1xuICAgICAgICAgICAgLy8gaGFuZGxlIE9sZCBudW1iZXJcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKCdtaWdyYXRpbmcgb2xkIG51bWJlcicpO1xuICAgICAgICAgICAgcmVnaXN0cmF0aW9uLkhhc2ggPSB1bmlxdWVJZC50aW1lKCk7XG4gICAgICAgICAgICByZWdpc3RyYXRpb24uRGlzcGxheVBob25lID0gcmVnaXN0cmF0aW9uLlBob25lTnVtYmVyID8gYCoqKioqKioke3JlZ2lzdHJhdGlvbi5QaG9uZU51bWJlci5zbGljZSgtNCl9YCA6ICcnO1xuICAgICAgICB9XG4gICAgICAgIHVzZXJIaXN0b3J5ID0gJ3Bhc3QnO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKCdyZWdpc3RlcmluZyBuZXcgdXNlcicpO1xuICAgICAgICBsb2dPYmouQWxyZWFkeVJlZ2lzdGVyZWRGb3JFdmVudCA9IGZhbHNlO1xuICAgICAgICAvLyBGb3IgbmV3IHVzZXJcbiAgICAgICAgcmVnaXN0cmF0aW9uID0gbmV3IFJlZ2lzdHJhdGlvbk1vZGVsKGR0byk7XG4gICAgICAgIHJlZ2lzdHJhdGlvbi5IYXNoID0gdW5pcXVlSWQudGltZSgpO1xuICAgICAgICByZWdpc3RyYXRpb24uRGlzcGxheVBob25lID0gcmVnaXN0cmF0aW9uLlBob25lTnVtYmVyID8gYCoqKioqKioke3JlZ2lzdHJhdGlvbi5QaG9uZU51bWJlci5zbGljZSgtNCl9YCA6ICcnO1xuICAgICAgICByZWdpc3RyYXRpb24ubGFzdFByb21vU2VudEF0ID0gbmV3IERhdGUoMjAxNCk7XG4gICAgfVxuXG4gICAgaWYgKCF2ZXJpZmllZCAmJiBzZWxmKSB7XG4gICAgICAgIC8vIHZlcmlmaWNhdGlvbiByZXF1aXJlZFxuICAgICAgICByZWdpc3RyYXRpb24uVmVyaWZpY2F0aW9uQ29kZSA9IE1hdGguZmxvb3IoMTAwMCArIE1hdGgucmFuZG9tKCkgKiA5MDAwKTtcbiAgICAgICAgcmVnaXN0cmF0aW9uLlZlcmlmaWNhdGlvbkNvZGVFeHAgPSBuZXcgRGF0ZShuZXcgRGF0ZSgpLmdldFRpbWUoKSArIDE1ICogNjAgKiAxMDAwKTtcbiAgICAgICAgcmVnaXN0cmF0aW9uLlNlbGZSZWdpc3RlcmVkID0gdHJ1ZTtcbiAgICAgICAgbG9nZ2VyLmluZm8oYHVzZXIgaXMgbm90IHZlcmlmaWVkLCBjb2RlOiAke3JlZ2lzdHJhdGlvbi5WZXJpZmljYXRpb25Db2RlfSBleHA6ICR7cmVnaXN0cmF0aW9uLlZlcmlmaWNhdGlvbkNvZGVFeHB9YCk7XG4gICAgfVxuXG4gICAgY29uc3Qgc2F2ZWRSZWdpc3RyYXRpb24gPSBhd2FpdCByZWdpc3RyYXRpb24uc2F2ZSgpO1xuICAgIGNvbnN0IGV2ZW50UmVnaXN0cmF0aW9uID0gZXZlbnQuUmVnaXN0cmF0aW9ucy5maW5kKHJpZCA9PiB7XG4gICAgICAgIHJldHVybiBzYXZlZFJlZ2lzdHJhdGlvbi5faWQuZXF1YWxzKHJpZCk7XG4gICAgfSk7XG4gICAgbGV0IHJlbGF0ZWRSZWc7XG4gICAgaWYgKGV2ZW50UmVnaXN0cmF0aW9uKSB7XG4gICAgICAgIHJlbGF0ZWRSZWcgPSBldmVudC5SZWdpc3RyYXRpb25zVm90ZUZhY3Rvci5maW5kKHJlZyA9PiB7XG4gICAgICAgICAgICByZXR1cm4gZXZlbnRSZWdpc3RyYXRpb24uX2lkLmVxdWFscyhyZWcuUmVnaXN0cmF0aW9uSWQpO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgY29uc3QgZXhpc3RpbmdWb3RlVXJsID0gcmVsYXRlZFJlZyAmJiByZWxhdGVkUmVnLlZvdGVVcmw7XG4gICAgLy8gR2VuZXJhdGUgYW5kIHN0b3JlIHZvdGUgbGluayBldmVudCBpZiB2b3RpbmcgaWYgbGluayBpcyBlbmFibGVkLCBzbyB0aGF0IGV2ZW50IGVkaXQgZG9uJ3QgaW1wYWN0IHRoaXMuXG4gICAgbG9nT2JqLkZpcnN0TmFtZSA9IHJlZ2lzdHJhdGlvbi5GaXJzdE5hbWU7XG4gICAgbG9nT2JqLkxhc3ROYW1lID0gcmVnaXN0cmF0aW9uLkxhc3ROYW1lO1xuICAgIGxvZ09iai5FbWFpbCA9IHJlZ2lzdHJhdGlvbi5FbWFpbDtcbiAgICBsb2dPYmouUGhvbmVOdW1iZXIgPSByZWdpc3RyYXRpb24uUGhvbmVOdW1iZXI7XG4gICAgbG9nT2JqLlBob25lTnVtYmVySGFzaCA9IHJlZ2lzdHJhdGlvbi5IYXNoO1xuICAgIGxvZ09iai5EaXNwbGF5UGhvbmUgPSByZWdpc3RyYXRpb24uRGlzcGxheVBob25lO1xuICAgIGxvZ09iai5Wb3RlVXJsID0gZXhpc3RpbmdWb3RlVXJsIHx8IGAvdi8ke3VuaXF1ZUlkLnRpbWUoKX1gO1xuICAgIGxvZ09iai5BdWN0aW9uVXJsID0gYCR7cHJvY2Vzcy5lbnYuU0hPUlRfU0lURV9VUkx9L2Evci8ke3JlZ2lzdHJhdGlvbi5IYXNofWA7XG4gICAgbG9nT2JqLlJlZ2lzdGVyZWRBdCA9IGNoYW5uZWw7XG4gICAgY29uc3Qgdm90ZUZhY3RvciA9IGF3YWl0IGNhbGN1bGF0ZVVzZXJWb3RlRmFjdG9yKHJlZ2lzdHJhdGlvbi5QaG9uZU51bWJlcik7XG4gICAgaWYgKHJlZ2lzdHJhdGlvbi5Jc0FydGlzdCkge1xuICAgICAgICB2b3RlRmFjdG9yLnJlc3VsdCA9IFN0YXRlVm90ZUZhY3Rvck1hcFszXTtcbiAgICB9XG4gICAgaWYgKCFldmVudFJlZ2lzdHJhdGlvbikge1xuICAgICAgICAvLyBpZiBpdCBpcyByZWdpc3RyYXRpb24gYnkgYWRtaW4gb3IgdXNlciBpcyB2ZXJpZmllZCB0aGVuIGRvIHRoaXNcbiAgICAgICAgbG9nZ2VyLmluZm8oJ3VzZXIgdmVyaWZpZWQnLCB2ZXJpZmllZCk7XG4gICAgICAgIGNvbnN0IHVzZXJWb3RlRmFjdG9yID0ge1xuICAgICAgICAgICAgUmVnaXN0cmF0aW9uSWQ6IHNhdmVkUmVnaXN0cmF0aW9uLl9pZCxcbiAgICAgICAgICAgIFZvdGVGYWN0b3I6IHZvdGVGYWN0b3IucmVzdWx0LFxuICAgICAgICAgICAgVm90ZUZhY3RvckluZm86IHtcbiAgICAgICAgICAgICAgICBUeXBlOiB1c2VySGlzdG9yeSxcbiAgICAgICAgICAgICAgICBWYWx1ZTogJycgKyB2b3RlRmFjdG9yLnZvdGVDb3VudFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFBob25lTnVtYmVyOiBzYXZlZFJlZ2lzdHJhdGlvbi5QaG9uZU51bWJlcixcbiAgICAgICAgICAgIEhhc2g6IHNhdmVkUmVnaXN0cmF0aW9uLkhhc2gsXG4gICAgICAgICAgICBWb3RlVXJsOiBsb2dPYmouVm90ZVVybCxcbiAgICAgICAgICAgIEVtYWlsOiBzYXZlZFJlZ2lzdHJhdGlvbi5FbWFpbCxcbiAgICAgICAgICAgIFJlZ2lvbkNvZGU6IHNhdmVkUmVnaXN0cmF0aW9uLlJlZ2lvbkNvZGUsXG4gICAgICAgICAgICBGcm9tOiBjaGFubmVsLFxuICAgICAgICAgICAgTmlja05hbWU6IHNhdmVkUmVnaXN0cmF0aW9uLk5pY2tOYW1lLFxuICAgICAgICAgICAgUHJlZmVyZW5jZXM6IHNhdmVkUmVnaXN0cmF0aW9uLlByZWZlcmVuY2VzLFxuICAgICAgICAgICAgU3RhdHVzOiBzYXZlZFJlZ2lzdHJhdGlvbi5Jc0FydGlzdCA/IFN0YXRlc1szXSA6ICcnLFxuICAgICAgICAgICAgQXVjdGlvblVybDogIGxvZ09iai5BdWN0aW9uVXJsXG4gICAgICAgIH07XG4gICAgICAgIGlmICghZXZlbnQuUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3IpIHtcbiAgICAgICAgICAgIGV2ZW50LlJlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yID0gW107XG4gICAgICAgIH1cbiAgICAgICAgZXZlbnQuUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3IucHVzaCh1c2VyVm90ZUZhY3Rvcik7XG4gICAgICAgIGV2ZW50LlJlZ2lzdHJhdGlvbnMucHVzaChzYXZlZFJlZ2lzdHJhdGlvbik7XG4gICAgICAgIGxvZ09iai5BbHJlYWR5UmVnaXN0ZXJlZEZvckV2ZW50ID0gZmFsc2U7XG4gICAgfSBlbHNlIGlmIChldmVudC5SZWdpc3RlckF0U01TVm90ZSkge1xuICAgICAgICBsb2dPYmouQWxyZWFkeVJlZ2lzdGVyZWRGb3JFdmVudCA9IHRydWU7XG4gICAgICAgIC8vIHVzZXJJZCBjaGVjayB3aWxsIGZvcmNlIG5vdCBsb2dnZWQgaW4gdXNlciB0byBsb2dpbiB1c2luZyBvdHBcbiAgICAgICAgaWYgKHZlcmlmaWVkIC8qfHwgc2VsZiovKSB7XG4gICAgICAgICAgICAvLyBubyB2ZXJpZmljYXRpb24gcmVxdWlyZWQgZm9yIHNlbGYgYmVjYXVzZSB1c2VyIGlzIHJlZ2lzdGVyZWQgYnkgYWRtaW4gaW4gdGhlIGV2ZW50XG4gICAgICAgICAgICBsb2dnZXIuaW5mbygnbm8gdmVyaWZpY2F0aW9uIHJlcXVpcmVkLCBhbHJlYWR5IHJlZ2lzdGVyZWQnKTtcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi5WZXJpZmljYXRpb25Db2RlID0gbnVsbDtcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi5WZXJpZmljYXRpb25Db2RlRXhwID0gbnVsbDtcbiAgICAgICAgICAgIHZlcmlmaWVkID0gdHJ1ZTsgLy8gbWFyayB1c2VyIGFzIHZlcmlmaWVkXG4gICAgICAgICAgICBhd2FpdCByZWdpc3RyYXRpb24uc2F2ZSgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChldmVudCkge1xuICAgICAgICBsb2dPYmouRXZlbnRJZCA9IGV2ZW50LmlkO1xuICAgICAgICBsb2dPYmouRXZlbnROYW1lID0gZXZlbnQuTmFtZTtcbiAgICB9XG4gICAgbG9nT2JqLlZvdGVGYWN0b3IgPSB2b3RlRmFjdG9yLnJlc3VsdDtcbiAgICBsb2dPYmouVm90ZUZhY3RvckluZm8gPSB7XG4gICAgICAgIFR5cGU6IHVzZXJIaXN0b3J5LFxuICAgICAgICBWYWx1ZTogJycgKyB2b3RlRmFjdG9yLnZvdGVDb3VudFxuICAgIH07XG5cbiAgICBhd2FpdCBldmVudC5zYXZlKCk7XG5cbiAgICAvLyBjaGVjayBleGlzdGluZyBhY3RpdmUgZXZlbnQgcmVnaXN0cmF0aW9uIHdoZXJlIHNlcnZlciBwaG9uZSBudW1iZXIgaXMgc2FtZSBmb3IgbG9nZ2luZ1xuICAgIGNvbnN0IHJlZ2lzdGVyZWRJbk11bHRpcGxlID0gYXdhaXQgRXZlbnRNb2RlbC5maW5kKHtcbiAgICAgICAgJ1JlZ2lzdHJhdGlvbnMnOiByZWdpc3RyYXRpb24sXG4gICAgICAgICdFbmFibGVkJzogdHJ1ZSxcbiAgICAgICAgJ19pZCc6IHtcbiAgICAgICAgICAgICckbmUnOiBldmVudElkXG4gICAgICAgIH0sXG4gICAgICAgICdQaG9uZU51bWJlcic6IGV2ZW50LlBob25lTnVtYmVyXG4gICAgfSkuY291bnREb2N1bWVudHMoKTtcbiAgICBpZiAoIShyZWdpc3RlcmVkSW5NdWx0aXBsZSA9PT0gMCkpIHtcbiAgICAgICAgY29uc3QgZXJyT2JqOiBFcnJvckRUTyA9IHtcbiAgICAgICAgICAgIHN0YXR1czogNDAzLFxuICAgICAgICAgICAgY29kZTogJ211bF9hY3RfZXZlbnQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYCR7cmVnaXN0cmF0aW9uLlBob25lTnVtYmVyIHx8IHJlZ2lzdHJhdGlvbi5FbWFpbH0gaXMgYWN0aXZlIGluIHRoZSAke3JlZ2lzdGVyZWRJbk11bHRpcGxlfSBldmVudHMuYFxuICAgICAgICB9O1xuICAgICAgICAvLyB0aHJvdyBlcnJPYmo7XG4gICAgICAgIGxvZ2dlci5pbmZvKGVyck9iaik7XG4gICAgfSAvLyBjaGVjayBleGlzdGluZyBhY3RpdmUgZXZlbnQgcmVnaXN0cmF0aW9uIHdoZXJlIHNlcnZlciBwaG9uZSBudW1iZXIgaXMgc2FtZSBmb3IgbG9nZ2luZ1xuXG4gICAgY29uc3QgcmVzdWx0OiBEYXRhT3BlcmF0aW9uUmVzdWx0PFJlZ2lzdHJhdGlvblJlc3BvbnNlRFRPPiA9IHtcbiAgICAgICAgU3VjY2VzczogdHJ1ZSxcbiAgICAgICAgRGF0YToge1xuICAgICAgICAgICAgVm90ZUZhY3RvcjogbG9nT2JqLlZvdGVGYWN0b3IsXG4gICAgICAgICAgICBWb3RlRmFjdG9ySW5mbzogbG9nT2JqLlZvdGVGYWN0b3JJbmZvLFxuICAgICAgICAgICAgUmVnaXN0cmF0aW9uSWQ6IHJlZ2lzdHJhdGlvbi5faWQsXG4gICAgICAgICAgICBQaG9uZU51bWJlcjogcmVnaXN0cmF0aW9uLlBob25lTnVtYmVyLFxuICAgICAgICAgICAgSGFzaDogcmVnaXN0cmF0aW9uLkhhc2gsXG4gICAgICAgICAgICBWb3RlVXJsOiBsb2dPYmouVm90ZVVybCxcbiAgICAgICAgICAgIEF1Y3Rpb25Vcmw6IGxvZ09iai5BdWN0aW9uVXJsLFxuICAgICAgICAgICAgQWxyZWFkeVJlZ2lzdGVyZWQ6IGxvZ09iai5BbHJlYWR5UmVnaXN0ZXJlZEZvckV2ZW50LFxuICAgICAgICAgICAgUmVnaXN0ZXJlZEluTXVsdGlwbGVBY3RpdmVFdmVudDogcmVnaXN0ZXJlZEluTXVsdGlwbGUsXG4gICAgICAgICAgICBFbWFpbDogcmVnaXN0cmF0aW9uLkVtYWlsLFxuICAgICAgICAgICAgUmVnaW9uQ29kZTogcmVnaXN0cmF0aW9uLlJlZ2lvbkNvZGUsXG4gICAgICAgICAgICBSZWdpb25JbWFnZTogcmVnaXN0cmF0aW9uLlJlZ2lvbkNvZGUgJiYgKGV2ZW50LkNvdW50cnkgJiYgZXZlbnQuQ291bnRyeS5jb3VudHJ5X2NvZGUudG9Mb3dlckNhc2UoKSAhPSByZWdpc3RyYXRpb24uUmVnaW9uQ29kZS50b0xvd2VyQ2FzZSgpKSA/IGAvaW1hZ2VzL2NvdW50cmllcy80eDMvJHtyZWdpc3RyYXRpb24uUmVnaW9uQ29kZS50b0xvd2VyQ2FzZSgpfS5zdmdgIDogbnVsbCxcbiAgICAgICAgICAgIFJlZ2lvbkltYWdlUG5nOiByZWdpc3RyYXRpb24uUmVnaW9uQ29kZSAmJiAoZXZlbnQuQ291bnRyeSAmJiBldmVudC5Db3VudHJ5LmNvdW50cnlfY29kZS50b0xvd2VyQ2FzZSgpICE9IHJlZ2lzdHJhdGlvbi5SZWdpb25Db2RlLnRvTG93ZXJDYXNlKCkpID8gYC9pbWFnZXMvY291bnRyaWVzLzR4M19wbmcvJHtyZWdpc3RyYXRpb24uUmVnaW9uQ29kZS50b0xvd2VyQ2FzZSgpfS5wbmdgIDogbnVsbCxcbiAgICAgICAgICAgIFZlcmlmaWNhdGlvbkNvZGU6IHJlZ2lzdHJhdGlvbi5WZXJpZmljYXRpb25Db2RlLFxuICAgICAgICAgICAgVmVyaWZpY2F0aW9uQ29kZUV4cDogcmVnaXN0cmF0aW9uLlZlcmlmaWNhdGlvbkNvZGVFeHAsXG4gICAgICAgICAgICBTZXJ2ZXJQaG9uZU51bWJlcjogZXZlbnQuUGhvbmVOdW1iZXIsXG4gICAgICAgICAgICBOaWNrTmFtZTogcmVnaXN0cmF0aW9uLk5pY2tOYW1lLFxuICAgICAgICAgICAgVmVyaWZpZWQ6IHZlcmlmaWVkLFxuICAgICAgICAgICAgU3RhdHVzOiBsb2dPYmouU3RhdHVzLFxuICAgICAgICAgICAgdXNlclZvdGVGYWN0b3I6IGV2ZW50LlJlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yW2V2ZW50LlJlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yLmxlbmd0aCAtIDFdXG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gSW50ZW50aW9uYWxseSBub3Qgd2FpdGluZyBmb3IgdGhlIGxvZyBlbnRyeSB0byBjb21wbGV0ZVxuICAgIGxvZ09iai5zYXZlKCkuY2F0Y2goZSA9PiB7XG4gICAgICAgIGxvZ2dlci5pbmZvKGAke2UubWVzc2FnZX0gJHtlLnN0YWNrfWApO1xuICAgIH0pO1xuXG4gICAgaWYgKGV2ZW50LlZvdGVCeUxpbmsgJiYgZXZlbnQuU2VuZExpbmtUb0d1ZXN0cyAmJiAhZXZlbnQuU2VuZEF1Y3Rpb25MaW5rVG9HdWVzdHMpIHtcbiAgICAgICAgZXZlbnQuUmVnaXN0cmF0aW9uQ29uZmlybWF0aW9uTWVzc2FnZSArPSBgID4gJHtwcm9jZXNzLmVudi5TSVRFX1VSTH0ke2xvZ09iai5Wb3RlVXJsfWA7XG4gICAgfSBlbHNlIGlmIChldmVudC5TZW5kQXVjdGlvbkxpbmtUb0d1ZXN0cykge1xuICAgICAgICBldmVudC5SZWdpc3RyYXRpb25Db25maXJtYXRpb25NZXNzYWdlICs9IGAgPiAke2xvZ09iai5BdWN0aW9uVXJsfWA7XG4gICAgfVxuXG4gICAgaWYgKCFpc0VtYWlsICYmICFzZWxmKSB7XG4gICAgICAgIC8vIG9ubHkgaWYgdXNlciBpcyByZWdpc3RlcmVkIGJ5IGFkbWluXG4gICAgICAgIGNvbnN0IHR3aWxpb0NsaWVudCA9IFR3aWxpbygpO1xuICAgICAgICB0d2lsaW9DbGllbnQubWVzc2FnZXMuY3JlYXRlKHtcbiAgICAgICAgICAgIGZyb206IGV2ZW50LlBob25lTnVtYmVyLFxuICAgICAgICAgICAgdG86IGR0by5QaG9uZU51bWJlcixcbiAgICAgICAgICAgIGJvZHk6IGV2ZW50LlJlZ2lzdHJhdGlvbkNvbmZpcm1hdGlvbk1lc3NhZ2VcbiAgICAgICAgfSk7XG4gICAgICAgIHBvc3RUb1NsYWNrU01TRmxvb2Qoe1xuICAgICAgICAgICAgJ3RleHQnOiBgJHtyZWdpc3RyYXRpb24uTmlja05hbWV9KCR7ZHRvLlBob25lTnVtYmVyfSkgKHNtcykgXFxuJHtldmVudC5SZWdpc3RyYXRpb25Db25maXJtYXRpb25NZXNzYWdlfSBzb3VyY2U6IFJlZ2lzdHJhdGlvblByb2Nlc3Nvci5SZWdpc3RlclZvdGVyYFxuICAgICAgICB9KS5jYXRjaCgoKSA9PiBsb2dnZXIuZXJyb3IoYG90cCBzbGFjayBmbG9vZCBjYWxsIGZhaWxlZCAkeyBldmVudC5SZWdpc3RyYXRpb25Db25maXJtYXRpb25NZXNzYWdlIH0gc291cmNlOiBSZWdpc3RyYXRpb25Qcm9jZXNzb3IuUmVnaXN0ZXJWb3RlcmApKTtcbiAgICB9IGVsc2UgaWYgKGlzRW1haWwpIHtcbiAgICAgICAgY29uc3QgdHJhbnNwb3J0T3B0aW9uczogU210cE9wdGlvbnMgPSB7XG4gICAgICAgICAgICBob3N0OiBwcm9jZXNzLmVudi5FTUFJTF9IT1NULFxuICAgICAgICAgICAgcG9ydDogcGFyc2VJbnQocHJvY2Vzcy5lbnYuRU1BSUxfUE9SVCksXG4gICAgICAgICAgICBzZWN1cmU6IGZhbHNlLCAvLyB1c2UgVExTXG4gICAgICAgICAgICBhdXRoOiB7XG4gICAgICAgICAgICAgICAgdXNlcjogcHJvY2Vzcy5lbnYuRU1BSUxfVVNFUk5BTUUsXG4gICAgICAgICAgICAgICAgcGFzczogcHJvY2Vzcy5lbnYuRU1BSUxfUEFTU1dPUkRcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwb29sOiB7XG4gICAgICAgICAgICAgICAgcG9vbDogdHJ1ZSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgdHJhbnNwb3J0ZXIgPSBub2RlbWFpbGVyLmNyZWF0ZVRyYW5zcG9ydCh0cmFuc3BvcnRPcHRpb25zKTtcbiAgICAgICAgY29uc3QgbWFpbE9wdGlvbnMgPSB7XG4gICAgICAgICAgICB0bzogZHRvLkVtYWlsLFxuICAgICAgICAgICAgZnJvbTogJ2hlbGxvQGFydGJhdHRsZS5jb20nLFxuICAgICAgICAgICAgc3ViamVjdDogYFZvdGUgbGluayBmb3IgJHtldmVudC5OYW1lfWAsXG4gICAgICAgICAgICB0ZXh0OiBgWW91ciBwZXJzb25hbCBBcnQgQmF0dGxlIHZvdGluZyBVUkwgJHtwcm9jZXNzLmVudi5TSVRFX1VSTH0ke2xvZ09iai5Wb3RlVXJsfVxcbmBcbiAgICAgICAgfTtcbiAgICAgICAgdHJhbnNwb3J0ZXIuc2VuZE1haWwobWFpbE9wdGlvbnMsIChlcnI6IEVycm9yKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oJ0Vycm9yIGluIHNlbmRpbmcgdGhlIHJlZ2lzdHJhdGlvbiBlbWFpbCcsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBsb2dnZXIuaW5mbyhgU3VjY2Vzc2Z1bGx5IHJlZ2lzdGVyZWQgJHtkdG8uRmlyc3ROYW1lfSAke2R0by5MYXN0TmFtZX0gLSAke2R0by5QaG9uZU51bWJlcn0sIHNtcyBib2R5ICR7ZXZlbnQuUmVnaXN0cmF0aW9uQ29uZmlybWF0aW9uTWVzc2FnZX1gKTtcbiAgICAvKnJlcy5qc29uKHJlc3VsdCk7Ki9cbiAgICByZXR1cm4gcmVzdWx0O1xuXG59O1xuXG5jb25zdCBfcGFyc2VOdW1iZXIgPSBmdW5jdGlvbiAocGhvbmVOdW1iZXI6IHN0cmluZykge1xuICAgIGNvbnN0IHBhcnNlZE51bWJlciA9IHBob25lVXRpbC5wYXJzZShwaG9uZU51bWJlcik7XG4gICAgaWYgKCFwaG9uZVV0aWwuaXNWYWxpZE51bWJlcihwYXJzZWROdW1iZXIpKSB7XG4gICAgICAgIHRocm93IHtcbiAgICAgICAgICAgIHN0YXR1czogNDAzLFxuICAgICAgICAgICAgbWVzc2FnZTogJ1Bob25lIG51bWJlciBpcyBpbiBpbnZhbGlkIGZvcm1hdC4nXG4gICAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBwYXJzZWROdW1iZXI7XG59O1xuXG5leHBvcnQgY29uc3QgUmVnaXN0ZXJCeVZvdGVGYWN0b3IgPSBhc3luYyBmdW5jdGlvbiAobWF0Y2hpbmdWb3RlRmFjdG9yOiBSZWdpc3RyYXRpb25Wb3RlRmFjdG9yRFRPKSB7XG4gICAgY29uc3QgcmVnTW9kZWwgPSBuZXcgUmVnaXN0cmF0aW9uTW9kZWwoe1xuICAgICAgICBQaG9uZU51bWJlcjogbWF0Y2hpbmdWb3RlRmFjdG9yLlBob25lTnVtYmVyLFxuICAgICAgICBfaWQ6IG1hdGNoaW5nVm90ZUZhY3Rvci5SZWdpc3RyYXRpb25JZCxcbiAgICAgICAgTmlja05hbWU6IG1hdGNoaW5nVm90ZUZhY3Rvci5OaWNrTmFtZSxcbiAgICAgICAgRW1haWw6IG1hdGNoaW5nVm90ZUZhY3Rvci5FbWFpbCxcbiAgICAgICAgSGFzaDogbWF0Y2hpbmdWb3RlRmFjdG9yLkhhc2gsXG4gICAgICAgIERpc3BsYXlQaG9uZTogYCoqKioqKioke21hdGNoaW5nVm90ZUZhY3Rvci5QaG9uZU51bWJlci5zbGljZSgtNCl9YCxcbiAgICAgICAgUmVnaW9uQ29kZTogbWF0Y2hpbmdWb3RlRmFjdG9yLlJlZ2lvbkNvZGUsXG4gICAgICAgIFByZWZlcmVuY2VzOiBtYXRjaGluZ1ZvdGVGYWN0b3IuUHJlZmVyZW5jZXMsXG4gICAgICAgIGxhc3RQcm9tb1NlbnRBdDogbmV3IERhdGUoMjAxNClcbiAgICB9KTtcbiAgICByZXR1cm4gYXdhaXQgcmVnTW9kZWwuc2F2ZSgpO1xufTsiXX0=
