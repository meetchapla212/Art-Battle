import { AuctionAdminStats } from './States';
import logger from '../config/logger';
import { DataOperationResult } from '../../../shared/OperationResult';
import EventModel, { EventDocument } from '../models/Event';
import RoundContestantDTO from '../../../shared/RoundContestantDTO';
import LotModel, { LotDocument } from '../models/Lot';
import * as Twilio from 'twilio';
import { ShortUrlGenerator } from './ShortUrlGenerator';
import { postToSlackBid, postToSlackSMSFlood } from './Slack';
import { sendNotificationIgnoreErr } from './Apns';
import { MultiCastIgnoreErr } from './FCM';

export class AuctionStatus {
    private readonly roundNumber: number;
    private readonly eventId: any;
    private contestantId: string;
    private cacheDel: (arg0: string) => void;
    private auctionIndex: number;
    private isModified: boolean;
    private contestantName: string;
    public event: EventDocument;
    private lotModel: any;
    public hardcodedConversionRate: {[key: string]: number} = {
        'USD':  1,
        'CAD': 1,
        'AUD': 0.678501, // was au
        'EURO': 1.08,
        'GBP': 1.30,
        'PEN': 0.30,
        'INR': 0.014,
        'ZAR': 0.066,
        'MXN': 0.053
    };
    public currencyUrlMap: {[key: string]: string} = {
        'USD': 'https://artb.art/b',
        'CAD': 'https://artbattle.com',
        'AUD': 'https://buy.artbattle.com', // was au
        'EURO': 'https://buy.artbattle.com',
        'GBP': 'https://buy.artbattle.com',
        'PEN': 'https://buy.artbattle.com',
        'INR': 'https://buy.artbattle.com',
        'ZAR': 'https://buy.artbattle.com',
        'MXN': 'https://buy.artbattle.com'
    };

    constructor(eventId: any, contestantId: string, roundNumber: number, auctionIndex: number, cacheDel: (arg0: string) => void) {
        this.eventId = eventId;
        this.contestantId = contestantId;
        this.roundNumber = roundNumber;
        this.auctionIndex = auctionIndex;
        this.cacheDel = cacheDel;
        this.isModified = false;
        this.contestantName = '';
    }

    async ChangeAuctionStatus() {
        try {
            if (!AuctionAdminStats[this.auctionIndex]) {
                logger.error(`Enable Auction should be 0 or 1  ${this.auctionIndex}`);
                const result: DataOperationResult<string> = {
                    'Success': false,
                    Data: 'Invalid'
                };
                return result;
            }
            this.event = await EventModel.findOne({
                _id: this.eventId
            }).populate('Rounds.Contestants.Detail').populate('Country').populate('Currency');
            if (this.event) {
                await this.updateAuctionIndex();

                if (this.isModified) {
                    await this.event.save();
                    const result: DataOperationResult<string> = {
                        'Success': true,
                        Data: AuctionAdminStats[this.auctionIndex]
                    };
                    if (this.auctionIndex === 2 && this.lotModel) {
                        await this.closeAuction();
                    }
                    const artId = this.lotModel.ArtId;
                    logger.info(`removing auction-detail-${artId} due to status change`);
                    const delRes = await this.cacheDel(`auction-detail-${artId}`);
                    logger.info(`removed auction-detail-${artId}  due to status change, ${JSON.stringify(delRes, null, 2)}`);
                    return result;
                } else {
                    logger.info(`nothing modified ${this.eventId}`);
                    const result: DataOperationResult<string> = {
                        'Success': false,
                        Data: 'Invalid'
                    };
                    return result;
                }
            } else {
                logger.info(`matching event not found ${this.eventId}`);
                const result: DataOperationResult<string> = {
                    'Success': false,
                    Data: 'Invalid'
                };
                return result;
            }

        } catch (e) {
            console.error(e);
            logger.error(`${e.message} ${e.stack}`);
            const result: DataOperationResult<string> = {
                'Success': false,
                Data: 'Internal Server Error'
            };
            return result;
        }
    }

    updateContestant(contestants: RoundContestantDTO[]) {
        for (let j = 0; j < contestants.length; j++) {
            const contestant = contestants[j];
            if (contestant._id == this.contestantId) {
                contestant.EnableAuction = this.auctionIndex;
                this.isModified = true;
                return {contestants, contestant};
            }
        }
        return {
            contestants: undefined,
            contestant: undefined,
        };
    }

    async updateAuctionIndex() {
        const roundNumber = this.roundNumber;
        const auctionIndex = this.auctionIndex;
        const event = this.event;
        for (let i = 0; i < event.Rounds.length; i++) {
            const round = event.Rounds[i];
            if (round.RoundNumber === roundNumber) {
                const {contestants, contestant} = this.updateContestant(round.Contestants);
                round.Contestants = contestants;
                if (contestant && contestant.EaselNumber && contestant.Lot) {
                    // find Auction doc
                    this.lotModel = await LotModel.findOne(contestant.Lot).populate('Bids.Registration');
                    this.lotModel.Status = auctionIndex;
                    await this.lotModel.save();
                    this.isModified = true;
                    this.contestantName = contestant.Detail.Name;
                } else {
                    throw {
                        message: 'Invalid Artist selected'
                    };
                }
                const currentRoundNumber =  event.CurrentRound && event.CurrentRound.RoundNumber;
                if (this.isModified && round.RoundNumber === currentRoundNumber) {
                    // reflect in current round object too
                    const {contestants} = this.updateContestant(event.CurrentRound.Contestants);
                    event.CurrentRound.Contestants = contestants;
                }
                break;
            }
        }
    }

    async closeAuction() {
        // Send Notification to winner on Auction close
        const lotModel: LotDocument = this.lotModel;
        const event = this.event;
        const contestantName = this.contestantName;
        const bids = lotModel.Bids.sort((a, b) => {
            return b.Amount - a.Amount;
        });
        const hardcodedConversionRate = this.hardcodedConversionRate;
        const currency = this.event && this.event.Currency && this.event.Currency.currency_label || 'USD';
        const buyHost = this.currencyUrlMap[currency] || this.currencyUrlMap['USD'];
        if (bids[0]) {
            const opr = bids[0].Amount;
            if (hardcodedConversionRate[event.Currency && event.Currency.currency_label || 'USD'] !== 1) {
                bids[0].Amount = bids[0].Amount * hardcodedConversionRate[event.Currency.currency_label];
                // event.Currency.currency_label = 'USD';
            }
            const PhoneNumber = bids[0].Registration.PhoneNumber;
            const NickName = bids[0].Registration.NickName || '';
            const DeviceTokens = bids[0].Registration.DeviceTokens;
            const AndroidDeviceTokens = bids[0].Registration.AndroidDeviceTokens;
            let userVoteChannel = 'sms';
            for (let i = 0; i < event.RegistrationsVoteFactor.length; i++) {
                if (event.RegistrationsVoteFactor[i].PhoneNumber === PhoneNumber) {
                    userVoteChannel = event.RegistrationsVoteFactor[i].From;
                    break;
                }
            }
            const twilioClient = Twilio();
            let link = `${buyHost}/buy/?id=${lotModel.ArtId}&pr=${bids[0].Amount}`;
            if (currency === 'USD') {
                link = link.replace('/buy', '');
            }
            if (bids[0].Amount !== opr) {
                link += `&opr=${opr}`;
            }
            link += `&ph=${PhoneNumber}&nn=${encodeURIComponent(NickName)}`;
            link += `&bn=${bids[0].Registration.FirstName || '' + ' ' + bids[0].Registration.LastName || ''}`;
            link += `&em=${bids[0].Registration.Email || ''}`;
            link += `&cur=${event.Currency && event.Currency.currency_label || 'USD'}`;
            link += `&loc=${event.Country && event.Country.country_code || 'US'}`;
            link += `&tr=${event.Tax}`;
            const shortUrl = await new ShortUrlGenerator().generateAndSaveUrl(link);
            const message = `You have won ${lotModel.ArtId} by ${contestantName}! Click to pay online or reply with any questions - ${process.env.SITE_URL}/b/${shortUrl.Hash}`;
            // message += `Click to pay online show your host the PAID receipt - ${process.env.SITE_URL}/b/${shortUrl.Hash}`;
            // if sms and app both are checked then sms should not be sent to a app number
            logger.info(`Sending message: ${message} From: ${event.PhoneNumber} To: ${PhoneNumber}`);
            let twilioRes;
            try {
                twilioRes = await twilioClient.messages.create({
                    from: event.PhoneNumber,
                    to: PhoneNumber,
                    body: message
                });
            } catch (e) {
                logger.error(`${e.message} ${e.stack}`);
            }
            postToSlackSMSFlood({
                'text': `${NickName}(${PhoneNumber}) (sms) \n${message} twilio sid : ${twilioRes && twilioRes.sid} source: Auction.ts CloseAuction`
            }).catch(() => logger.error(`changeAuctionStatus slack flood call failed  ${message} source: Auction.ts CloseAuction`));
            postToSlackBid({
                'text': `${NickName}(${PhoneNumber}) (sms) \n${message} twilio sid : ${twilioRes && twilioRes.sid}`
            }).catch(() => logger.error(`changeAuctionStatus slack call failed  ${message}`));
            logger.info(`sent message: ${message} From: ${event.PhoneNumber} To: ${PhoneNumber}`);
            logger.info(`winner DeviceTokens`, DeviceTokens);
            if (userVoteChannel != 'sms' && DeviceTokens.length > 0) {
                await Promise.all([
                    sendNotificationIgnoreErr(DeviceTokens, message, event.Name,
                        {
                            url: `${link}`,
                            title: 'You have Won!'
                        }),
                    MultiCastIgnoreErr({
                        DeviceTokens: AndroidDeviceTokens,
                        link: link,
                        title: 'You have Won!',
                        message: message,
                        priority: 'normal',
                        analyticsLabel: 'won-push'
                    })
                ]);
                postToSlackBid({
                    'text': `${NickName}(${PhoneNumber}) (push) \n${JSON.stringify(message)}`
                }).catch(() => logger.error(`changeAuctionStatus slack call failed ${ message }`));
            }
        } else {
            logger.info('auction close, but no bidder');
        }
    }
}