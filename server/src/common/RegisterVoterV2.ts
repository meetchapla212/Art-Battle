import RegistrationDTO from '../../../shared/RegistrationDTO';
import logger from '../config/logger';
import * as Twilio from 'twilio';
import RegistrationModel, { RegistrationDocument } from '../models/Registration';
import EventPhoneNumberModel from '../models/EventPhoneNumber';
import { PhoneNumberUtil } from 'google-libphonenumber';
import { sign } from 'jsonwebtoken';
import { postToSlackSMSFlood } from './Slack';
const uniqueId = require('uniqid');
const phoneUtil = PhoneNumberUtil.getInstance();

export class RegisterVoterV2 {
    public PhoneNumber: string;
    public iOS: boolean;
    public android: boolean;
    public web: boolean;
    public Registration: RegistrationDTO;
    public cacheSet: any;
    public cacheGet: any;
    public VerificationCode: string;
    public OtpCacheKey: string;
    public ClientRegionCode: string;
    public VerifyOTP: boolean;

    constructor (phoneNumber: string, userAgentHeader: string, cacheSet?: any, cacheGet?: any,
                 registration?: RegistrationDTO, VerifyOTP?: boolean) {
        this.PhoneNumber = phoneNumber;
        if (userAgentHeader.indexOf('Battle') > -1) {
            this.iOS = true;
        } else if (userAgentHeader.indexOf('okhttp') > -1) {
            this.android = true;
        } else {
            this.web = true;
        }
        this.Registration = registration;
        this.cacheGet = cacheGet;
        this.cacheSet = cacheSet;
        this.VerifyOTP = VerifyOTP;
    }

    async Login(): Promise<RegistrationDTO> {
        if (!this.Registration) {
            throw 'Registration Object is required for login';
        }
        let parsedNumber;
        try {
            parsedNumber = phoneUtil.parse(this.Registration.PhoneNumber);
        } catch (e) {
            logger.error(`Invalid login number ${this.Registration && JSON.stringify(this.Registration, null, 1)} ${e}`);
        }
        if (!parsedNumber) {
            throw {
                message: 'Invalid Phone Number'
            };
        }
        this.ClientRegionCode = phoneUtil.getRegionCodeForNumber(parsedNumber);


        this.OtpCacheKey = `otp-${this.Registration._id}`;
        await this.SendVerificationCode();
        return this.Registration;
    }

    async Register(): Promise<RegistrationDocument> {
        let parsedNumber;
        try {
            parsedNumber = phoneUtil.parse(this.PhoneNumber);
        } catch (e) {
            logger.error(`Invalid registration number ${this.Registration && JSON.stringify(this.Registration, null, 1)} ${e}`);
        }
        if (!parsedNumber) {
            throw {
                status: 400,
                message: 'Invalid Phone Number'
            };
        }
        const registrationModel = new RegistrationModel({
            PhoneNumber: this.PhoneNumber,
            lastPromoSentAt: new Date(2014), // PAST date
            DisplayPhone: `*******${this.PhoneNumber.slice(-4)}`,
            DeviceTokens: [],
            AndroidDeviceTokens: [],
            Hash: uniqueId.time(),
            SelfRegistered: true,
            RegionCode: phoneUtil.getRegionCodeForNumber(parsedNumber),
            IsArtist: false
        });
        const savedRegistration = await registrationModel.save();
        this.Registration = registrationModel;
        this.ClientRegionCode = registrationModel.RegionCode;
        if (this.VerifyOTP) {
            this.OtpCacheKey = `otp-${this.Registration._id}`;
            await this.SendVerificationCode();
        }
        return savedRegistration;
    }

    async SendVerificationCode() {
        const obj = {
            VerificationCode: `${Math.floor(1000 + Math.random() * 9000)}`,
            VerificationCodeExp: new Date(new Date().getTime() + 15 * 60 * 1000).getTime()
        };
        await this.cacheSet(this.OtpCacheKey, JSON.stringify(obj));
        logger.info(`sending otp sms(RegisterVoterV2) ${obj.VerificationCode}`);
        let body = `Please use ${obj.VerificationCode} to login`;
        if (this.android) {
            body = `<#> ${body} YOIpYCJPwnV`;
        }
        const serverNo = await this.findAppropriateServerNumber();
        const twilioClient = Twilio();
        try {
            const twilioRes = await twilioClient.messages.create({
                from: serverNo,
                to: this.Registration.PhoneNumber,
                body: body,
            });
            postToSlackSMSFlood({
                'text': `${this.Registration.NickName}(${this.Registration.PhoneNumber}) (sms) \n${body.replace(obj.VerificationCode, '****')}  source: RegisterVoteV2.SendVerificationCode`
            }).catch(() => logger.error(`verification code slack flood call failed ${ body } source: RegisterVoteV2.SendVerificationCode`));
            logger.info(`sent otp sms(RegisterVoterV2) ${obj.VerificationCode}, ${twilioRes && twilioRes.sid}
                to ${this.Registration.PhoneNumber}, server ${serverNo}`);
        } catch (e) {
            if (
                (typeof e === 'string' && e.indexOf('blacklist rule') > -1)
                || (typeof e.message === 'string' && e.message.indexOf('blacklist rule') > -1)
            ) {
                e = `Please send START to ${serverNo} then register again.`;
            }
            throw e;
        }
    }

    async findAppropriateServerNumber() {
        const promises = [
            EventPhoneNumberModel.findOne({
                'RegionCode': this.ClientRegionCode,
                'type': 'vote'
                }),
            EventPhoneNumberModel.findOne({
                'RegionCode': 'US',
                'type': 'vote'
            })
        ];
        const results = await Promise.all(promises);
        if (results[0]) {
            return results[0].phone;
        } else {
            logger.info(`user region code not found ${this.ClientRegionCode} using US number`);
            return results[1].phone;
        }
    }

    async VerifyCode(verificationCode: string) {
        this.OtpCacheKey = `otp-${this.Registration._id}`;
        const otpStr = await this.cacheGet(this.OtpCacheKey);
        if (otpStr) {
            const otpObj = JSON.parse(otpStr);
            if (otpObj.VerficationCodeExp < new Date().getTime()) {
                return -1;
            } else if (otpObj.VerificationCode === verificationCode) {
                return 1;
            } else {
                return 0;
            }
        } else {
            return 0;
        }
    }

    GetToken() {
        return sign({
            registrationId: this.Registration._id,
        }, process.env.JWT_SECRET,  { expiresIn: process.env.JWT_EXP_TIME || '1y'});
    }
}