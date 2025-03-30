import RegistrationDTO from '../../../shared/RegistrationDTO';
import { default as RegistrationLogModel } from '../models/RegistrationLog';
import { IsEmail } from '../utils';
import EventModel from '../models/Event';
import RegistrationModel from '../models/Registration';
import { ErrorDTO } from '../../../shared/ErrorDTO';
import { RegistrationVoteFactorDTO } from '../../../shared/RoundContestantDTO';
import { DataOperationResult } from '../../../shared/OperationResult';
import * as Twilio from 'twilio';
import { SmtpOptions } from 'nodemailer-smtp-transport';
import * as nodemailer from 'nodemailer';
import { calculateUserVoteFactor } from '../controllers/register';
import { PhoneNumberUtil } from 'google-libphonenumber';
const uniqueId = require('uniqid');
const phoneUtil = PhoneNumberUtil.getInstance();
import logger from '../config/logger';
import { RegistrationResponseDTO } from '../../../shared/RegistrationResponse';
import { States, StateVoteFactorMap } from './States';
import { postToSlackSMSFlood } from './Slack';

export let RegisterVoter: (dto: RegistrationDTO, eventId: any, self?: boolean, voteFactorNumber?: number, verified?: boolean, userId?: boolean) => Promise<DataOperationResult<RegistrationResponseDTO>>;
RegisterVoter = async (dto: RegistrationDTO, eventId: any, self = true, voteFactorNumber = 0.1, verified = false, userId = false) => {
    const logObj = new RegistrationLogModel();
    let channel = 'sms';
    if (self && voteFactorNumber === 0.1) {
        channel = 'app-global';
    } else if (self) {
        channel = 'app';
    }
    if (eventId === 'dummy') {
        eventId = '5e3c5f6624ca9a7ed1e9f517'; // assume static
    }
    logger.info(`Registering ${dto.PhoneNumber}, self ${self}, verified ${verified} userId ${userId}`);

    if (!dto.PhoneNumber) {
        const error = 'Invalid registration record. No PhoneNumber provided.';
        logger.info(error);
        throw error;
    }
    const isEmail = IsEmail(dto.PhoneNumber);
    const event = await EventModel.findById(eventId).populate('Country');
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
        } catch (e) {
            logger.info(`phone parse error ${e.message} `);
            e.status = 403;

            throw {
                status: e.status,
                message: e.message
            };
        }
    } else {
        dto.Email = '' + dto.PhoneNumber;
        condition = {
            Email: dto.Email
        };
        dto.PhoneNumber = null;
    }
    let userHistory = 'new';
    let registration = await RegistrationModel.findOne(condition);
    if (registration) {
        registration.FirstName = dto.FirstName || registration.FirstName;
        registration.LastName = dto.LastName || registration.LastName;
        registration.Email = dto.Email || registration.Email;
        registration.PhoneNumber = dto.PhoneNumber;
        registration.NickName = dto.NickName || registration.NickName;

        logObj.NumberExists = true;
        if (!registration.Hash) {
            // handle Old number
            logger.info('migrating old number');
            registration.Hash = uniqueId.time();
            registration.DisplayPhone = registration.PhoneNumber ? `*******${registration.PhoneNumber.slice(-4)}` : '';
        }
        userHistory = 'past';
    } else {
        logger.info('registering new user');
        logObj.AlreadyRegisteredForEvent = false;
        // For new user
        registration = new RegistrationModel(dto);
        registration.Hash = uniqueId.time();
        registration.DisplayPhone = registration.PhoneNumber ? `*******${registration.PhoneNumber.slice(-4)}` : '';
        registration.lastPromoSentAt = new Date(2014);
    }

    if (!verified && self) {
        // verification required
        registration.VerificationCode = Math.floor(1000 + Math.random() * 9000);
        registration.VerificationCodeExp = new Date(new Date().getTime() + 15 * 60 * 1000);
        registration.SelfRegistered = true;
        logger.info(`user is not verified, code: ${registration.VerificationCode} exp: ${registration.VerificationCodeExp}`);
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
    const voteFactor = await calculateUserVoteFactor(registration.PhoneNumber);
    if (registration.IsArtist) {
        voteFactor.result = StateVoteFactorMap[3];
    }
    if (!eventRegistration) {
        // if it is registration by admin or user is verified then do this
        logger.info('user verified', verified);
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
            Status: savedRegistration.IsArtist ? States[3] : '',
            AuctionUrl:  logObj.AuctionUrl
        };
        if (!event.RegistrationsVoteFactor) {
            event.RegistrationsVoteFactor = [];
        }
        event.RegistrationsVoteFactor.push(userVoteFactor);
        event.Registrations.push(savedRegistration);
        logObj.AlreadyRegisteredForEvent = false;
    } else if (event.RegisterAtSMSVote) {
        logObj.AlreadyRegisteredForEvent = true;
        // userId check will force not logged in user to login using otp
        if (verified /*|| self*/) {
            // no verification required for self because user is registered by admin in the event
            logger.info('no verification required, already registered');
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
    const registeredInMultiple = await EventModel.find({
        'Registrations': registration,
        'Enabled': true,
        '_id': {
            '$ne': eventId
        },
        'PhoneNumber': event.PhoneNumber
    }).countDocuments();
    if (!(registeredInMultiple === 0)) {
        const errObj: ErrorDTO = {
            status: 403,
            code: 'mul_act_event',
            message: `${registration.PhoneNumber || registration.Email} is active in the ${registeredInMultiple} events.`
        };
        // throw errObj;
        logger.info(errObj);
    } // check existing active event registration where server phone number is same for logging

    const result: DataOperationResult<RegistrationResponseDTO> = {
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
        logger.info(`${e.message} ${e.stack}`);
    });

    if (event.VoteByLink && event.SendLinkToGuests && !event.SendAuctionLinkToGuests) {
        event.RegistrationConfirmationMessage += ` > ${process.env.SITE_URL}${logObj.VoteUrl}`;
    } else if (event.SendAuctionLinkToGuests) {
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
        postToSlackSMSFlood({
            'text': `${registration.NickName}(${dto.PhoneNumber}) (sms) \n${event.RegistrationConfirmationMessage} source: RegistrationProcessor.RegisterVoter`
        }).catch(() => logger.error(`otp slack flood call failed ${ event.RegistrationConfirmationMessage } source: RegistrationProcessor.RegisterVoter`));
    } else if (isEmail) {
        const transportOptions: SmtpOptions = {
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT),
            secure: false, // use TLS
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
        transporter.sendMail(mailOptions, (err: Error) => {
            if (err) {
                logger.info('Error in sending the registration email', err);
            }
        });
    }
    logger.info(`Successfully registered ${dto.FirstName} ${dto.LastName} - ${dto.PhoneNumber}, sms body ${event.RegistrationConfirmationMessage}`);
    /*res.json(result);*/
    return result;

};

const _parseNumber = function (phoneNumber: string) {
    const parsedNumber = phoneUtil.parse(phoneNumber);
    if (!phoneUtil.isValidNumber(parsedNumber)) {
        throw {
            status: 403,
            message: 'Phone number is in invalid format.'
        };
    }
    return parsedNumber;
};

export const RegisterByVoteFactor = async function (matchingVoteFactor: RegistrationVoteFactorDTO) {
    const regModel = new RegistrationModel({
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