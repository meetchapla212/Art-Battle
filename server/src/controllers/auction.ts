import { NextFunction, Request, Response } from 'express';
import { DataOperationResult } from '../../../shared/OperationResult';
import EventModel from '../models/Event';
import RoundContestantDTO, { ArtistIndividualImage } from '../../../shared/RoundContestantDTO';
import { AutoCloseStates } from '../common/States';
import LotModel, { LotDocument } from '../models/Lot';
import EventDTO, { UserEventDTO } from '../../../shared/EventDTO';
import { LotResponseInterface } from '../../../shared/LotResponseInterface';
import { ObjectId, ObjectID } from 'bson';
import PreferenceModel, { PreferenceDocument } from '../models/Preference';
import * as Twilio from 'twilio';
import RegistrationDTO from '../../../shared/RegistrationDTO';
import  { sendNotificationIgnoreErr } from '../common/Apns';
import RegistrationModel from '../models/Registration';
import { sign } from 'jsonwebtoken';
import { postToSlackBid, postToSlackSMSFlood } from '../common/Slack';
import { ExportToExcelClass } from '../common/ExportToExcel';
import LotDTO from '../../../shared/LotDTO';
import { BidDTO } from '../../../shared/BidDTO';
// @ts-ignore
import { formatToTimeZone } from 'date-fns-timezone';
// @ts-ignore
import { StatsD } from 'hot-shots';
import logger from '../config/logger';
import { RegisterVoter } from '../common/RegistrationProcessor';
import { MultiCastIgnoreErr } from '../common/FCM';
// @ts-ignore
import csv = require('fast-csv-ifo');
import { EventsInAuction, TopEventDTO } from '../../../shared/EventsInAuctionDTO';
import { ArtistPaidResponse, BuyerPaidResponse, PaymentStatusResponse } from '../../../shared/PaymentStatusResponse';
import PaymentStatusModel from '../models/PaymentStatus';
import PaymentStatusDTO from '../../../shared/PaymentStatusDTO';
import VotingLogModel from '../models/VotingLog';
import ContestantModel from '../models/Contestant';
import CountryDTO from '../../../shared/CountryDTO';
import { AuctionStatus } from '../common/Auction';
import { AddMinutes } from '../common/Date';
import { differenceInMinutes } from 'date-fns';
import { ErrorDTO } from '../../../shared/ErrorDTO';

export async function changeAuctionStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await new AuctionStatus(req.params.eventId,
            req.params.contestantId,
            parseInt(req.params.roundNumber),
            parseInt(req.params.EnableAuction),
            req.app.get('cacheDel')
        ).ChangeAuctionStatus();
        if (!result.Success) {
            res.status(403);
        }
        res.json(result);
    } catch (e) {
        next(e);
    }
}

export async function exportToGoogleSheet(req: Request, res: Response, next: NextFunction) {
    try {
        const eventId: string[] = req.params.eventId;
        const results = await Promise.all([
            LotModel.find({
                Event: eventId
            })
                .populate('Bids.Registration')
                .populate('Event.Rounds.Contestants.Detail'),
            EventModel.findById(req.params.eventId)
                .select(['Rounds', 'Name', 'EID', 'TimeZoneICANN', 'Currency'])
                .populate('Rounds.Contestants.Detail')
                .populate('Currency')
        ]);
        const excelRows: [string[]?] = [];
        const Lots = results[0];
        const event = results[1];
        const lotsByArtIdMap: {[key: string]: LotDTO} = {};
        for (let i = 0; i < Lots.length; i++) {
            lotsByArtIdMap[Lots[i].ArtId.toString()] = Lots[i];
        }
        for (let j = 0; j < event.Rounds.length; j++) {
            for (let k = 0; k < event.Rounds[j].Contestants.length; k++) {
                const artId = `${event.EID}-${event.Rounds[j].RoundNumber}-${event.Rounds[j].Contestants[k].EaselNumber}`;
                if (lotsByArtIdMap[artId.toString()] && event.Rounds[j].Contestants[k].Enabled) {
                    const excelRow: string[] = [];
                    event.Rounds[j].Contestants[k].LastBidPrice = 0;
                    event.Rounds[j].Contestants[k] = JSON.parse(JSON.stringify(event.Rounds[j].Contestants[k]));
                    excelRow.push(event.Name);
                    excelRow.push(artId);
                    excelRow.push(event.Rounds[j].Contestants[k].Detail.Name);
                    excelRow.push(lotsByArtIdMap[artId].Bids.length.toString());

                    let bid: BidDTO;
                    if ( lotsByArtIdMap[artId.toString()].Bids.length > 0) {
                        bid = lotsByArtIdMap[artId.toString()].Bids.reduce((a: BidDTO, b: BidDTO) => {
                            return (a.Amount > b.Amount) ? a : b;
                        });
                    }
                    excelRow.push((event.Currency && event.Currency.currency_symbol || '$') + (bid && bid.Amount || '0'));
                    excelRow.push(event.Currency && event.Currency.currency_label || 'usd');
                    const closeTime = formatToTimeZone(new Date(lotsByArtIdMap[artId].updatedAt), 'YYYY-MM-DD hh:mm A',  { timeZone: event.TimeZoneICANN }).toString();
                    excelRow.push(closeTime);


                    excelRow.push('');
                    excelRow.push('');
                    excelRow.push(bid && bid.Registration.NickName);
                    excelRow.push(bid && bid.Registration.PhoneNumber);
                    excelRow.push(bid && bid.Registration.Email);
                    excelRows.push(excelRow);
                }
            }
        }
        await new ExportToExcelClass().insertInSheet(excelRows);
        res.json(excelRows);
    } catch (e) {
        next(e);
    }
}

export async function eventsWithAuctionHtml(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.header('Authorization');
        let hash: string;
        let token = authHeader && authHeader.replace('Bearer ', '');
        const regHash = req.params.registrationHash;
        logger.info('eventsWithAuctionHtml Token', !token, regHash);
        if (!token && regHash) {
            req.user = await RegistrationModel.findOne({Hash: regHash});
            if (req.user) {
                token = sign({
                    registrationId: req.user._id
                }, process.env.JWT_SECRET,  { expiresIn: process.env.JWT_EXP_TIME || '1y'});
                hash = req.user.Hash;
                res.cookie('jwt', token, {
                    httpOnly: true,
                    sameSite: true,
                    signed: true,
                    secure: false
                });
            }
        } else if (req.user) {
            token = sign({
                registrationId: req.user._id
            }, process.env.JWT_SECRET,  { expiresIn: process.env.JWT_EXP_TIME || '1y'});
            hash = req.user.Hash;
            res.cookie('jwt', token, {
                httpOnly: true,
                sameSite: true,
                signed: true,
                secure: false
            });
        }
        if (req.route.path === '/auction') {
            // redirect to react if its /auction
            res.redirect(307, `${process.env.SITE_URL}/resp/art`);
            return ;
        } else {
            res.render('auction', {
                title: `Auction`,
                token: token,
                showAppLogo: regHash && regHash.length > 0,
                phoneHash: hash,
                // pageImage: images && images[0] && images[images.length - 1]['Thumbnail']['url']
            });
        }
    } catch (e) {
        next(e);
    }
}

export async function eventsWithAuction(req: Request, res: Response, next: NextFunction) {
    try {
        const {artId, phoneHash} = req.query;
        let {eventId} = req.query;
        let registrationId: string;
        if (phoneHash && phoneHash.length > 0) {
            const registration = await RegistrationModel.findOne({Hash: phoneHash});
            if (registration) {
                registrationId = registration._id;
            }
        } else if (req.user && req.user.PhoneNumber && req.user.PhoneNumber.length > 0) {
            registrationId = req.user._id;
        }
        const eventQuery: {
            Enabled?: boolean;
            EnableAuction?: boolean;
            EID?: string;
            _id?: string;
        } = {};
        const topLotByBidsQuery: {
            Status?: number;
            Event?: {$ne: any}
        } = {
            Status: 1
        };
        if (artId && artId.length > 0) {
            const lot = await LotModel.findOne({ArtId: artId}).select('Event');
            if (lot) {
                eventId = lot.Event;
            }
        }
        if (eventId && eventId.toString().length > 0) {
            eventQuery._id = eventId;
            topLotByBidsQuery.Event = {
                $ne: eventId
            };
        }
        if ( !(eventQuery._id || eventQuery.EID )) {
            eventQuery.Enabled = true;
            eventQuery.EnableAuction = true;
        }
        const results = await Promise.all([
            EventModel.find(eventQuery)
                .select(['_id', 'Name', 'Rounds', 'Country', 'EID', 'Currency', 'AuctionNotice', 'MinBidIncrement', 'AuctionStartBid', 'RegistrationsVoteFactor'])
                .populate('Rounds.Contestants.Detail')
                .populate('Country')
                .populate('Currency')
                .sort({
                    'EventStartDateTime' : -1
                }),
            LotModel.aggregate()
                .match(topLotByBidsQuery)
                .sort({'Bids.Amount': -1})
                .limit(8)
                .lookup({
                    from: 'events',
                    // localField: 'Event',
                    // foreignField: '_id',
                    as: 'EventInfo',
                    let: { eventId: '$Event' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$_id', '$$eventId'] },
                                        { $eq: ['$Enabled', true] },
                                        { $eq: ['$EnableAuction', true] }
                                    ]
                                }
                            }
                        }
                    ]
                })
                .unwind({
                    path: '$EventInfo',
                })
        ]);
        const TopLots = results[1];
        const events = results[0];

        const topEventIds = [];
        const topArtIds = [];
        for (let n = 0; n < TopLots.length; n++) {
            topEventIds.push(TopLots[n].Event._id);
            topArtIds.push(TopLots[n].ArtId);
        }
        let topEvents: EventDTO[] = [];
        if (topEventIds.length > 0) {
            topEvents = await EventModel.find({
                _id: {'$in': topEventIds},
                Enabled: true,
                EnableAuction: true
            }).select(['_id', 'Name', 'Rounds', 'Country', 'EID', 'Currency', 'AuctionNotice', 'MinBidIncrement', 'AuctionStartBid', 'RegistrationsVoteFactor'])
                .populate('Rounds.Contestants.Detail')
                .populate('Country');
        }
        let eventsArr: UserEventDTO[] = [];
        let topEventsArr: TopEventDTO[] = [];
        let topEventIndex: number = -1;
        let topRoundIndex: number = -1;
        let topArtistIndex: number = -1;
        const artIdsToSearch: any[] = [];
        for (let i = 0; i < events.length; i++) {
            for (let j = 0; j < events[i].Rounds.length; j++) {
                for (let k = 0; k < events[i].Rounds[j].Contestants.length; k++) {
                    if (events[i].Rounds[j].Contestants[k].Enabled) {
                        events[i].Rounds[j].Contestants[k].LastBidPrice = 0;
                        const artIdCalc = `${events[i].EID}-${events[i].Rounds[j].RoundNumber}-${events[i].Rounds[j].Contestants[k].EaselNumber}`;
                        if (artIdCalc.toLowerCase() === artId.toLowerCase()) {
                            topEventIndex = i;
                            topRoundIndex = j;
                            topArtistIndex = k;
                        }
                        artIdsToSearch.push(artIdCalc);
                        events[i].Rounds[j].Contestants[k] = JSON.parse(JSON.stringify(events[i].Rounds[j].Contestants[k]));
                    }
                }
            }
        }
        if (artId) {
            artIdsToSearch.push(artId);
        }
        if (artIdsToSearch.length > 0) {
            const Lots = await LotModel.find({
                ArtId: {
                    '$in': artIdsToSearch
                }
            });
            if (Lots.length > 0) {
                const LotPriceMap: { [key: string]: number} = {};
                const LotEventMap: { [key: string]: EventDTO } = {};
                const LotBidLengthMap: { [key: string]: number } = {};
                for (let j = 0; j < Lots.length; j++) {
                    const lot = Lots[j];
                    const lastBid = lot.Bids[lot.Bids.length - 1];
                    LotPriceMap[lot.ArtId] = (lastBid && lastBid.Amount) || 0;
                    LotEventMap[lot.ArtId] = lot.Event;
                    LotBidLengthMap[lot.ArtId] = lot.Bids.length;
                }
                for (let m = 0; m < TopLots.length; m++) {
                    const lot = TopLots[m];
                    const lastBid = lot.Bids[lot.Bids.length - 1];
                    if (lastBid && lastBid.Amount > 0) {
                        LotPriceMap[lot.ArtId] = (lastBid && lastBid.Amount) || 0;
                        LotEventMap[lot.ArtId] = lot.Event;
                    }
                    LotBidLengthMap[lot.ArtId] = lot.Bids.length;
                }

                // console.log('LotPriceMap', LotPriceMap, topArtIds, TopLots);
                const findVoteFactor = (event: UserEventDTO) => {
                    if (event.RegistrationsVoteFactor && (req.user && req.user.PhoneNumber && req.user.PhoneNumber.length) > 0 || phoneHash) {
                        const userVoteFactor = event.RegistrationsVoteFactor.find((a) => {
                            return a.RegistrationId.toString() === registrationId.toString();
                        });
                        const voteUrl = userVoteFactor && userVoteFactor.VoteUrl || '';
                        if (voteUrl) {
                            return voteUrl.toString();
                        }
                        return '';
                    }
                };
                const manipulateEvents = (eventItems: UserEventDTO[], artIdsToSearch: any[] = []) => {
                    const events = [];
                    for (let i = 0; i < eventItems.length; i++) {
                        let event: UserEventDTO;
                        for (let j = 0; j < eventItems[i].Rounds.length; j++) {
                            for (let k = 0; k < eventItems[i].Rounds[j].Contestants.length; k++) {
                                const Contestant = eventItems[i].Rounds[j].Contestants[k];
                                if (eventItems[i].Rounds[j].Contestants[k].Enabled) {
                                    if (eventItems[i].Rounds[j].Contestants[k]) {
                                        const artIdMan = `${eventItems[i].EID}-${eventItems[i].Rounds[j].RoundNumber}-${Contestant.EaselNumber}`;
                                        if (artIdsToSearch.length > 0)  {
                                            artIdsToSearch.splice(artIdsToSearch.indexOf(artId), 1);
                                        }
                                        eventItems[i].Rounds[j].Contestants[k].BidCount = LotBidLengthMap[artIdMan];
                                        eventItems[i].Rounds[j].Contestants[k].ArtId = artIdMan;
                                        eventItems[i].Rounds[j].Contestants[k].LastBidPrice = LotPriceMap[artIdMan] || eventItems[i].AuctionStartBid || 0;
                                        eventItems[i].Rounds[j].Contestants[k] = JSON.parse(JSON.stringify(eventItems[i].Rounds[j].Contestants[k]));
                                    }
                                    eventItems[i].Rounds[j].Contestants[k].VotesDetail = [];
                                    eventItems[i].Rounds[j].Contestants[k].Votes = []; // sensitive do not send to client
                                }
                            }
                            eventItems[i].Rounds[j].Contestants = eventItems[i].Rounds[j].Contestants.filter((a) => {
                                return a.Images.length > 0 && a.LastBidPrice >= 0;
                            });
                        }
                        eventItems[i].Rounds = eventItems[i].Rounds.filter((a) => {
                            return a.Contestants.length > 0;
                        });
                        event = JSON.parse(JSON.stringify(eventItems[i]));
                        event.VoteUrl = findVoteFactor(eventItems[i]);
                        event.RegistrationsVoteFactor = [];
                        events.push(event); // to solve Vote Url not appear issue
                    }
                    eventItems = events.filter( (a: UserEventDTO) => {
                        return a.Rounds.length > 0;
                    });
                    return eventItems;
                };
                if (events.length > 0) {
                    const manipulatedEvents = manipulateEvents(events, artIdsToSearch);
                    if (manipulatedEvents.length > 0) {
                        eventsArr = manipulatedEvents;
                    }
                }
                const topEvent: TopEventDTO = {
                    _id: '',
                    Name: 'Top Paintings',
                    EID: '',
                    Rounds: [{
                        RoundNumber: 1,
                        Contestants: []
                    }]
                };
                for (let o = 0; o < topEvents.length; o++) {
                    const event = topEvents[o];
                    for (let i = 0; i < event.Rounds.length; i++) {
                        for (let j = 0; j < event.Rounds[i].Contestants.length; j++) {
                            const contestant = JSON.parse(JSON.stringify(event.Rounds[i].Contestants[j]));
                            const artIdMan = `${event.EID}-${event.Rounds[i].RoundNumber}-${contestant.EaselNumber}`;
                            if (contestant.EaselNumber > 0 && contestant.Enabled && topArtIds.indexOf(artIdMan) > -1 && contestant.Images.length > 0) {
                                contestant.LastBidPrice = LotPriceMap[artIdMan] || 0;
                                contestant.ArtId = artIdMan;
                                contestant.AuctionStartBid = event.AuctionStartBid;
                                contestant.MinBidIncrement = event.MinBidIncrement;
                                contestant.AuctionNotice = event.AuctionNotice;
                                contestant.Currency = event.Currency;
                                contestant.Country = event.Country;
                                topEvent.Rounds[0].Contestants.push(contestant);
                            }
                        }
                    }
                }
                topEvent.Rounds[0].Contestants = topEvent.Rounds[0].Contestants.sort((a, b) => {
                    return b.LastBidPrice - a.LastBidPrice;
                });
                if (topEvent.Rounds[0].Contestants.length > 0) {
                    topEventsArr = [topEvent];
                }

                if (artIdsToSearch.length === 1) {
                    const eventId = LotEventMap[artIdsToSearch[0]];
                    if (eventId) {
                        const events = await EventModel.find({
                            _id: eventId
                        })
                            .select(['_id', 'Name', 'Rounds', 'Country', 'EID', 'Currency', 'AuctionNotice',
                                'MinBidIncrement', 'AuctionStartBid', 'RegistrationsVoteFactor'])
                            .populate('Rounds.Contestants.Detail')
                            .populate('Country')
                            .sort({
                                'EventStartDateTime' : -1
                            });
                        const manipulatedEvents  = manipulateEvents(events, artIdsToSearch);
                        if (manipulatedEvents.length > 0) {
                            eventsArr.push(manipulatedEvents[0]);
                        }
                    } else {
                        logger.error('user passed wrong artId ' + artId);
                    }
                }
            }
        }

        const result: DataOperationResult<EventsInAuction> = {
            'Success': true,
            Data: {
                eventsArr: eventsArr,
                topEventsArr: topEventsArr,
                topEventIndex: topEventIndex,
                topRoundIndex: topRoundIndex,
                topArtistIndex: topArtistIndex
            }
        };
        res.json(result);
    } catch (e) {
        next(e);
    }
}

export async function auctionDetailHtml(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.header('Authorization');
        let token = authHeader && authHeader.replace('Bearer ', '');
        const regHash = req.params.registrationHash;
        let hash: string;
        logger.info('auctionDetailHtml Token', !token, regHash);
        if (!token && regHash) {
            req.user = await RegistrationModel.findOne({Hash: regHash});
            if (req.user) {
                token = sign({
                    registrationId: req.user._id
                }, process.env.JWT_SECRET,  { expiresIn: process.env.JWT_EXP_TIME || '1y'});
                hash = req.user.Hash;
            }
        } else if (req.user) {
            token = sign({
                registrationId: req.user._id
            }, process.env.JWT_SECRET,  { expiresIn: process.env.JWT_EXP_TIME || '1y'});
            hash = req.user.Hash;
        }
        const artId = req.params.artId.trim();

        const Lot = await LotModel.findOne({
            ArtId: artId
        }).select(['Event', 'Round', 'EaselNumber']);
        if (!Lot) {
            res.status(404);
            res.json({
                'Success': false,
                'Message': 'Unable to find the matching Art'
            });
            return ;
        }
        const Event = await EventModel.findById(Lot.Event).select(['Rounds']);
        const contestantInfo = _findArtistImageInEvent(Event, Lot.Round, Lot.EaselNumber);
        const contestant = await ContestantModel.findById(contestantInfo.Detail).select(['Name']);
        const images = contestantInfo && contestantInfo.Images;
        res.render('auction_detail', {
            title: `${contestant.Name} - Auction Detail`,
            artId: artId,
            token: token,
            showAppLogo: regHash && regHash.length > 0,
            phoneHash: hash,
            pageImage: images && images[0] && images[images.length - 1]['Thumbnail']['url']
        });
    } catch (e) {
        next(e);
    }
}


export async function auctionDetail(req: Request, res: Response, next: NextFunction) {
    const cacheGet = req.app.get('cacheGet');
    const cacheSet = req.app.get('cacheSet');
    const cacheKey = `auction-detail-${req.params.ArtId}`;
    try {
        const cachedAuctionDetail = await cacheGet(cacheKey);
        if (cachedAuctionDetail) {
            const auctionDetail = JSON.parse(cachedAuctionDetail);
            const result: DataOperationResult<LotResponseInterface> = {
                'Success': true,
                Data: {
                    _id: auctionDetail._id,
                    ArtistName: auctionDetail.ArtistName,
                    UserName: req.user && (req.user.NickName || req.user.PhoneNumber),
                    SelectArtIndex: auctionDetail.Images && auctionDetail.Images.length - 1, // latest
                    Arts: auctionDetail.Images || [],
                    TopNBids: auctionDetail.TopThreeBids, // top 3
                    Status: auctionDetail.Status,
                    EventName: auctionDetail.EventName,
                    isAdmin: auctionDetail.AdminControlInAuctionPage && req.user && req.user.isAdmin,
                    Description: auctionDetail.Description,
                    WidthAndHeight: auctionDetail.WidthAndHeight,
                    CurrencySymbol: auctionDetail.CurrencySymbol,
                    TotalBids: auctionDetail.TotalBids
                }
            };
            res.json(result);
            logger.info(`served response from cache ${cacheKey}`);
            return ;
        }
        // not found in cache
        const Lot = await LotModel.findOne({
            ArtId: req.params.ArtId
        }). populate(['Bids.Registration', 'Event']);
        if (!Lot) {
            res.status(404);
            res.json({
                'Success': false,
                'Message': 'Unable to find the matching Art'
            });
            return ;
        }
        const Event = await EventModel.findById(Lot.Event).select(['Name', 'Rounds', 'AdminControlInAuctionPage', 'AuctionStartBid', 'Currency'])
            .populate('Rounds.Contestants.Detail').populate('Currency');

        let isAdmin = false;
        if (Event && req.user && req.user.isAdmin) {
            isAdmin = true;
        } else if (Event && req.user && req.user.IsEventAdmin && Array.isArray(req.user.eventIds)) {
            for (let i = 0; i < req.user.eventIds.length; i++) {
                if (`${Event._id}` == `${req.user.eventIds[i]}`) {
                    isAdmin = true;
                    break;
                }
            }
        }
        if (!Event) {
            logger.error(`Lot seems corrupted ` + JSON.stringify(Lot, null, 1));
            const result: DataOperationResult<ErrorDTO> = {
                Success: false,
                Data: {
                    code: '400',
                    status: 400,
                    message: 'Lot is not linked to the event',
                }
            };
            res.json(result);
            return;
        }
        const contestant = _findArtistImageInEvent(Event, Lot.Round, Lot.EaselNumber);
        const images = contestant && contestant.Images;
        const topThreeBids = Lot.Bids; // for slicing .slice(-3)
        for (let i = 0; i < topThreeBids.length; i++) {
            if (topThreeBids[i].Registration)  {
                topThreeBids[i].Registration.PhoneNumber = topThreeBids[i].Registration.PhoneNumber.substr(topThreeBids[i].Registration.PhoneNumber.length - 4);
            } else {
                logger.error(`Registration not there in top three bid ${JSON.stringify(topThreeBids, null, 3)}`);
            }
        }
        if (topThreeBids.length === 0) {
            // for opening bid, when no bids made
            const dummyReg = {
                _id: '',
                Amount: Event.AuctionStartBid || 50,
                Registration: await RegistrationModel.findById('5b9066ea645b580000cf79ba'),
                createdAt: new Date(),
                IpAddress: ''
            };
            dummyReg.Registration.NickName = 'Artbattle';
            dummyReg.Registration.PhoneNumber = 'Artbattle';
            topThreeBids.push(dummyReg);
        }
        const response: LotResponseInterface = {
            _id: Lot._id,
            ArtistName: contestant && contestant.Detail.Name,
            UserName: req.user && (req.user.NickName || req.user.PhoneNumber),
            SelectArtIndex: images && images.length - 1, // latest
            Arts: images || [],
            TopNBids: topThreeBids, // top 3
            Status: Lot.Status,
            EventName: Lot.Event.Name,
            isAdmin: Event.AdminControlInAuctionPage && isAdmin,
            Description: Lot.Description,
            WidthAndHeight: Lot.WidthAndHeight,
            CurrencySymbol: Event.Currency && Event.Currency.currency_symbol || '$',
            TotalBids: Lot.Bids.length
        };
        const result: DataOperationResult<LotResponseInterface> = {
            'Success': true,
            Data: response
        };
        res.json(result);
        await cacheSet(cacheKey, JSON.stringify({
            LotId: response._id,
            ArtistName: response.ArtistName,
            Images: images,
            TopThreeBids: topThreeBids,
            EventName: response.EventName,
            Status: response.Status,
            Description: response.Description,
            WidthAndHeight: response.WidthAndHeight,
            CurrencySymbol: response.CurrencySymbol,
            TotalBids: response.TotalBids,
            AdminControlInAuctionPage: Event.AdminControlInAuctionPage
        }));
    } catch (e) {
        next(e);
    }
}

function _findArtistImageInEvent(event: EventDTO, roundNumber: Number, EaselNumber: number): RoundContestantDTO {
    for (let i = 0; i < event.Rounds.length; i++) {
        const Round = event.Rounds[i];
        if (roundNumber === Round.RoundNumber) {
            for (let j = 0; j < Round.Contestants.length; j++) {
                if (Round.Contestants[j].EaselNumber === EaselNumber && Round.Contestants[j].Enabled) {
                    return Round.Contestants[j];
                }
            }
        }
    }
}

export async function bid(req: Request, res: Response, next: NextFunction) {
    try {
        if (req.user && (!req.user.FirstName || !req.user.Email)) {
            res.json({
                'Success': false,
                'Message': 'Bid Failed',
                'code': 'VERIFY',
                'Name': `${req.user.FirstName || ''} ${req.user.LastName || ''}`.trim(),
                'Email': req.user.Email,
                'NickName': req.user.NickName
            });
            return;
        }
        const response = await _bid(req.params.artId, req.params.bid, req.user, req.connection.remoteAddress, false);
        res.json({
            'Success': true,
            'Message': 'Bid Successful',
            'code': 'SUCCESS'
        });
        const cacheDel = req.app.get('cacheDel');
        logger.info(`removing auction-detail-${req.params.artId}`);
        const delRes = await cacheDel(`auction-detail-${req.params.artId}`);
        logger.info(`removed auction-detail-${req.params.artId}, ${JSON.stringify(delRes, null, 2)}`);
        try {
            await _processBidNotification(response);
        } catch (e) {
            console.error('Ignore error', e);
        }
    } catch (e) {
        next(e);
    }
}

async function _bid(artId: string, bid: number, registration: RegistrationDTO, ipAddress: string, manual: boolean) {
    if (!registration) {
        throw {
            'Message': `Bidding without registration ${artId} ${bid}, ${registration}, ${ipAddress}, ${manual}`
        };
    }
    const Lot = await LotModel.findOne({
        ArtId: artId
    }).populate('Bids.Registration');
    let Contestant: RoundContestantDTO;
    const Event = await EventModel.findById(Lot.Event)
        .select(['Currency', 'EID', 'Rounds', 'Registrations', 'RegistrationsVoteFactor', 'AuctionStartBid', 'MinBidIncrement', 'EnableAuction', 'PhoneNumber'])
        .populate('Rounds.Contestants.Detail')
        .populate('Registrations')
        .populate('Currency')
    ;
    if (!Event) {
        throw {
            status: 404,
            'Success': false,
            'Message': 'Invalid event'
        };
    }
    // find contestant
    for (let i = 0; i < Event.Rounds.length; i++) {
        for (let j = 0; j < Event.Rounds[i].Contestants.length; j++) {
            if (artId == `${Event.EID}-${Event.Rounds[i].RoundNumber}-${Event.Rounds[i].Contestants[j].EaselNumber}` && Event.Rounds[i].Contestants[j].Enabled) {
                Contestant = Event.Rounds[i].Contestants[j];
                break;
            }
        }
    }

    if (!Event.EnableAuction) {
        throw {
            status: 404,
            'Success': false,
            'Message': 'Auction disabled'
        };
    }

    if (!Lot) {
        throw {
            status: 404,
            'Success': false,
            'Message': 'Unable to find the matching Art'
        };
    }
    const sortedBids = Lot.Bids.sort((a, b) => {
        return a.Amount - b.Amount;
    });
    const higherBid = sortedBids[sortedBids.length - 1];
    const loserRegistration: string[] = [];
    if (higherBid && higherBid.Registration.PhoneNumber != registration.PhoneNumber) {
        // don't send to same person
        loserRegistration.push(higherBid.Registration._id.toString());
    }
    const winnerRegistration: string[] = [];
    winnerRegistration.push(registration._id.toString());
    logger.info(`loserRegistration ${JSON.stringify(loserRegistration)}, 'winnerRegistration', ${JSON.stringify(winnerRegistration)}`);
    const minBidAmount = (higherBid && (higherBid.Amount + (higherBid.Amount * (Event.MinBidIncrement / 100)))) || Event.AuctionStartBid;
    logger.info(`${artId}, 'bid', ${bid}, 'minBidAmount', ${minBidAmount}`);
    const isLowerBid = bid < minBidAmount;
    if (isLowerBid && !manual) {
        throw {
            status: 400,
            'Message': `Minimum Bid ${minBidAmount}`,
            'code': 'INVALID_BID'
        };
    } else {
        sortedBids.push({
            _id: new ObjectID(),
            Amount: bid,
            createdAt: new Date(),
            IpAddress: ipAddress,
            Registration: registration
        });
        Lot.Bids = sortedBids.sort((a, b) => {
            return a.Amount - b.Amount;
        }); // sorting again because of manual bid
        const isOutbid = isLowerBid && manual;
        if (isOutbid) {
            // this manual bid is lower hence, send him outbid message
            loserRegistration.push(registration._id.toString());
        }
        await Lot.save();
        return {
            registration: registration,
            bid: bid,
            Contestant: Contestant,
            loserRegistration: loserRegistration,
            Event: Event,
            Lot: Lot,
            winnerRegistration: winnerRegistration,
            isOutbid: isOutbid,
            higherBidUser: (manual && isOutbid) ? (higherBid && higherBid.Registration) : registration
        };
    }
}

async function _processBidNotification(obj: {
    registration: RegistrationDTO;
    bid: number;
    Contestant: RoundContestantDTO;
    loserRegistration: string[];
    Event: EventDTO;
    Lot: LotDTO;
    winnerRegistration: string[];
    isOutbid: boolean;
    higherBidUser: RegistrationDTO;
}) {
    const {registration, bid, Contestant, loserRegistration, Event, Lot, winnerRegistration, higherBidUser, isOutbid} = obj;
    const registrationId = registration && registration._id;
    const highBidderRegId = higherBidUser && higherBidUser._id;
    const BidderNickName = `${registration.NickName || registration.PhoneNumber.substr(registration.PhoneNumber.length - 4)}`;
    const highBidderNickName = higherBidUser && `by ${higherBidUser.NickName || higherBidUser.PhoneNumber.substr(higherBidUser.PhoneNumber.length - 4)}`;
    try {
        const dogStatsD = new StatsD();
        dogStatsD.increment('vote.bid', bid, [Event.EID, BidderNickName, Contestant.Detail.Name]);
    } catch (e) {
        logger.error(`error in sending vote.bid diagram ${e}`);
    }

    // Send outbid notification to second last bidder
    try {
        function getMessage(Registration: RegistrationDTO) {
            const message = `OUTBID on ${Lot.ArtId}-${Contestant.Detail.Name} by ${highBidderNickName} ${process.env.SITE_URL}/a/${Lot.ArtId}/r/${Registration.Hash}`;
            return {
                pushMessage: message,
                smsMessage: message,
                title: `Auction For ${Lot.ArtId}`,
                url: `${process.env.SITE_URL}/a/${Lot.ArtId}/r/${Registration.Hash}`,
                pushTitle: `Outbid in ${Lot.ArtId} by ${Contestant.Detail.Name}`
            };
        }
        if (loserRegistration.length > 0 && !(isOutbid && highBidderRegId.toString() === registrationId.toString())) {
            // don't send outbid to same person again
            await _notifyAccordingToUserPreferences(Event, loserRegistration, getMessage, false, true);
        }

        // Send bid notification to last bidder
        function getBidMessage(Registration: RegistrationDTO) {
            const currencySymbol = Event.Currency && Event.Currency.currency_symbol || '$';
            const onBidMessage = `${currencySymbol}${bid} Bid recorded on ${Lot.ArtId}-${Contestant.Detail.Name} by ${BidderNickName} ${process.env.SITE_URL}/a/${Lot.ArtId}/r/${Registration.Hash}`;
            return {
                pushMessage: onBidMessage,
                smsMessage: onBidMessage,
                title: `Auction For ${Lot.ArtId}`,
                url: `${process.env.SITE_URL}/a/${Lot.ArtId}/r/${Registration.Hash}`,
                pushTitle: `${currencySymbol}${bid} Bid recorded on ${Lot.ArtId}-${Contestant.Detail.Name} `
            };
        }
        if (winnerRegistration.length > 0) {
            await _notifyAccordingToUserPreferences(Event, winnerRegistration, getBidMessage, false, false);
        }
    } catch (e) {
        logger.error(`${e.message} ${e.stack}`);
    }
}

async function _notifyAccordingToUserPreferences(event: EventDTO, allowedRegistrationIds: string[], getMessage: (Registration: RegistrationDTO) => {
    pushMessage: string;
    smsMessage: string;
    title: string;
    url: string;
    pushTitle: string;
}, requestPreferences = true, allChannels = false) {
    const preferenceMap: {
        [key: string]: PreferenceDocument
    } = {};
    if (requestPreferences) {
        const preferences = await PreferenceModel.find();
        for (let i = 0; i < preferences.length; i++) {
            preferenceMap[preferences[i]._id] = preferences[i];
        }
    }

    const twilioClient = Twilio();
    const RegistrantTokens: {
        [key: string]: string[]
    } = {};
    const RegistrantAndroidTokens: {
        [key: string]: string[]
    } = {};
    const RegistrationsById: {
        [key: string]: RegistrationDTO
    } = {};
    const RegistrationMessages: {
        [key: string]: {
            pushMessage: string;
            title: string;
            url: string;
            pushTitle: string;
        }
    } = {};
    const RegistrationChannels: {
        [key: string]: string
    } = {};
    event.RegistrationsVoteFactor.forEach(registrant => {
        // old event don't have From in registrants
        RegistrationChannels[registrant.RegistrationId.toString()] = (registrant.From || 'sms');
    });
    // const isSmsAndAppBothChecked = (smsVote && (appVote || appGlobalVote) );
    const filterByAllowedRegistrations = allowedRegistrationIds.length > 0;
    for (let i = 0; i < event.Registrations.length; i++) {
        const registrant = event.Registrations[i];
        const {pushMessage, smsMessage, title, url, pushTitle} = getMessage(registrant);
        RegistrationMessages[registrant._id] = {
            pushMessage: pushMessage,
            title: title,
            url: url,
            pushTitle: pushTitle
        };
        logger.info(`${JSON.stringify(allowedRegistrationIds)}, 'filterByAllowedRegistrations', ${JSON.stringify(filterByAllowedRegistrations)}, 'allowedRegistrationIds.indexOf(registrant._id + \'\')', ${allowedRegistrationIds.indexOf(registrant._id.toString())}, ${registrant._id}`);
        const isRegistrantAllowed = (!filterByAllowedRegistrations) || allowedRegistrationIds.indexOf(registrant._id + '') >= 0;
        if ((RegistrationChannels[registrant._id] === 'sms' || allChannels) && isRegistrantAllowed) {
            // if sms and app both are checked then sms should not be sent to a app number
            let twilioRes: any;
            try {
                logger.info(`sending sms ${smsMessage} to ${registrant.PhoneNumber}`);
                twilioRes = await twilioClient.messages.create({
                    from: event.PhoneNumber,
                    to: registrant.PhoneNumber,
                    body: smsMessage
                });
                postToSlackSMSFlood({
                    'text': `${registrant.NickName}(${registrant.PhoneNumber}) (sms) \n${smsMessage}, source: auction.ts _notifyAccordingToUserPreferences`
                }).catch(() => logger.error(`auction slack flood call failed ${ smsMessage } source: auction.ts _notifyAccordingToUserPreferences`));
                logger.info(`sent sms ${smsMessage} ${twilioRes && twilioRes.sid}`);
            } catch (e) {
                logger.error(`failed sms ${smsMessage}`);
                logger.error(`${e.message} ${e.stack}`);
            }
            postToSlackBid({
                'text': `${registrant.NickName}(${registrant.PhoneNumber}) (sms) \n${smsMessage} twilio sid : ${twilioRes && twilioRes.sid}`
            }).catch(() => logger.error(`_notifyAccordingToUserPreferences slack call failed ${smsMessage}`));
        }
        let hasSubscribedToEvent = false;
        const userPreference = registrant.Preferences || [];
        if (userPreference) {
            for (let i = 0; i < userPreference.length; i++) {
                // logger.info('userPreference[i]._id', userPreference[i]._id);
                hasSubscribedToEvent = !requestPreferences || preferenceMap[userPreference[i]._id].Type === 'EventRegistered';
            }
        } else {
            hasSubscribedToEvent = true;
        }

        if (hasSubscribedToEvent && isRegistrantAllowed && registrant.DeviceTokens.length > 0) {
            RegistrantTokens[registrant._id] = registrant.DeviceTokens;
            RegistrantAndroidTokens[registrant._id] = registrant.AndroidDeviceTokens;
            RegistrationsById[registrant._id] = registrant;
        }
    }
    // After sending response send message to slack channel
    // send push notifications
    const promises = [];
    const voteFactors = event.RegistrationsVoteFactor;
    for (let j = 0; j < voteFactors.length; j++) {
        const userToNotify = RegistrationsById[voteFactors[j].RegistrationId + ''];
        if (userToNotify) {
            const message = RegistrationMessages[voteFactors[j].RegistrationId + ''];
            const userTokens = RegistrantTokens[voteFactors[j].RegistrationId + ''];
            const AndroidTokens = RegistrantAndroidTokens[voteFactors[j].RegistrationId + ''];
            promises.push(sendNotificationIgnoreErr(userTokens, message.pushMessage, message.pushTitle,
                {
                    url: message.url,
                    title: message.title
                }));
            promises.push(MultiCastIgnoreErr({
                DeviceTokens: AndroidTokens,
                link: message.url,
                title: message.title,
                message: message.pushMessage,
                priority: 'normal',
                analyticsLabel: message.pushTitle
            }));
            postToSlackBid({
                'text': `${userToNotify.NickName}(${userToNotify.PhoneNumber}) (push) \n${JSON.stringify(message)}`
            }).catch(() => logger.error(`_notifyAccordingToUserPreferences slack call failed ${message}`));
        }
    }
    return Promise.all(promises);
}

export async function notifyAuctionOpen(req: Request, res: Response, next: NextFunction) {
    try {
        const event = await EventModel
            .findById(req.params.eventId)
            .populate('Registrations');

        /* const preferences = await PreferenceModel.find();
        const preferenceMap: {
            [key: string]: PreferenceDocument
        } = {};
        for (let i = 0; i < preferences.length; i++) {
            preferenceMap[preferences[i]._id] = preferences[i];
        } */

        const twilioClient = Twilio();
        const RegistrantTokens: {
            [key: string]: string[]
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
        const RegistrationEventHash: {
            [key: string]: string
        } = {};
        event.RegistrationsVoteFactor.forEach(registrant => {
            // old event don't have From in registrants
            RegistrationChannels[registrant.RegistrationId.toString()] = (registrant.From || 'sms');
            RegistrationEventHash[registrant.RegistrationId.toString()] = registrant.VoteUrl.toString();
        });
        // const isSmsAndAppBothChecked = (smsVote && (appVote || appGlobalVote) );
        for (let i = 0; i < event.Registrations.length; i++) {
            const registrant = event.Registrations[i];
            const message = `Your personal link: ${process.env.SITE_URL}${RegistrationEventHash[registrant._id.toString()]}`;
            // if (RegistrationChannels[registrant._id] === 'sms') {
            // if sms and app both are checked then sms should not be sent to a app number
            logger.info(`Sending message: ${message} From: ${event.PhoneNumber} To: ${registrant.PhoneNumber}`);
            let twilioRes;
            try {
                twilioRes = await twilioClient.messages.create({
                    from: event.PhoneNumber,
                    to: registrant.PhoneNumber,
                    body: message
                });
                postToSlackSMSFlood({
                    'text': `${registrant.NickName}(${registrant.PhoneNumber}) (sms) \n${message} source: auction.ts notifyAuctionOpen`
                }).catch(() => logger.error(`Auction personal link slack flood call failed ${ message } source: auction.ts notifyAuctionOpen`));
            } catch (e) {
                logger.error(`${e.message} ${e.stack}`);
            } // send 1 by 1
            /*postToSlackBid({
                'text': `${registrant.NickName}(${registrant.PhoneNumber}) (sms) \n${message} twilio sid : ${twilioRes && twilioRes.sid}`
            }).catch(() => logger.error(`notifyAuctionOpen slack call failed ${message}`));*/
            logger.info(`sent message: ${message} From: ${event.PhoneNumber} To: ${registrant.PhoneNumber}`);
            // }
            // let hasSubscribedToEvent = false;
            /*
            const userPreference = registrant.Preferences || [];
            if (userPreference) {
                for (let i = 0; i < userPreference.length; i++) {
                    // logger.info('userPreference[i]._id', userPreference[i]._id);
                    if ( preferenceMap[userPreference[i]._id].Type === 'EventRegistered') {
                        hasSubscribedToEvent = true;
                    }
                }
            } else {
                hasSubscribedToEvent = true;
            }
            if (hasSubscribedToEvent) {*/
            RegistrantTokens[registrant._id] = registrant.DeviceTokens;
            RegistrantAndroidTokens[registrant._id] = registrant.AndroidDeviceTokens;
            RegistrationsById[registrant._id] = registrant;
            /*}*/
        }
        // After sending response send message to slack channel
        // send push notifications
        const promises = [];
        const voteFactors = event.RegistrationsVoteFactor;
        for (let j = 0; j < voteFactors.length; j++) {
            const userToNotify = RegistrationsById[voteFactors[j].RegistrationId + ''];
            if (userToNotify) {
                const message = `Your personal link.`;
                const userTokens = RegistrantTokens[voteFactors[j].RegistrationId + ''];
                const AndroidTokens = RegistrantAndroidTokens[voteFactors[j].RegistrationId + ''];
                /*postToSlackBid({
                    'text': `${userToNotify.NickName}(${userToNotify.PhoneNumber}) (push) \n${JSON.stringify(message)}`
                }).catch(() => logger.error(`notifyAuctionOpen slack call failed ${message}`));*/
                promises.push(sendNotificationIgnoreErr(userTokens, message, event.Name,
                    {
                        url: `${process.env.SITE_URL}${voteFactors[j].VoteUrl}`,
                        title: 'Personal Voting Link'
                    }));
                promises.push(MultiCastIgnoreErr({
                    DeviceTokens: AndroidTokens,
                    link: `${process.env.SITE_URL}${voteFactors[j].VoteUrl}`,
                    title: 'Personal Voting Link',
                    message: message,
                    priority: 'normal',
                    analyticsLabel: 'Personal Voting Link'
                }));
            }
        }
        await Promise.all(promises);
        event.Logs.push({
            Message: `Sent Auction message to registrants`,
            CreatedDate: new Date()
        });
        event.save().catch(e => logger.error(`Unable to store log message of slack related to announcement ${e.message} ${e.stack}`));
        res.json({
            'Success': true,
            'Message': 'Notification Successful',
            'code': 'SUCCESS'
        });
    } catch (e) {
        logger.error(`${e.message} ${e.stack}`);
        return next(e);
    }
}

export async function sendShortAuctionLink(req: Request, res: Response, next: NextFunction) {
    try {
        const event = await EventModel
            .findById(req.params.eventId)
            .populate('Registrations');

        /* const preferences = await PreferenceModel.find();
        const preferenceMap: {
            [key: string]: PreferenceDocument
        } = {};
        for (let i = 0; i < preferences.length; i++) {
            preferenceMap[preferences[i]._id] = preferences[i];
        } */

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
        const RegistrationEventHash: {
            [key: string]: string
        } = {};
        event.RegistrationsVoteFactor.forEach(registrant => {
            // old event don't have From in registrants
            RegistrationChannels[registrant.RegistrationId.toString()] = (registrant.From || 'sms');
            RegistrationEventHash[registrant.RegistrationId.toString()] = `/a/r/${registrant.Hash}`;
        });
        // const isSmsAndAppBothChecked = (smsVote && (appVote || appGlobalVote) );
        for (let i = 0; i < event.Registrations.length; i++) {
            const registrant = event.Registrations[i];
            const message = `Your personal auction link: ${process.env.SHORT_SITE_URL || process.env.SITE_URL}${RegistrationEventHash[registrant._id.toString()]}`;
            // if (RegistrationChannels[registrant._id] === 'sms') {
            // if sms and app both are checked then sms should not be sent to a app number
            logger.info(`Sending short auction message: ${message} From: ${event.PhoneNumber} To: ${registrant.PhoneNumber}`);
            let twilioRes;
            try {
                twilioRes = await twilioClient.messages.create({
                    from: event.PhoneNumber,
                    to: registrant.PhoneNumber,
                    body: message
                });
                postToSlackSMSFlood({
                    'text': `${registrant.NickName}(${registrant.PhoneNumber}) (sms) \n${message} source: auction.ts sendShortAuctionLink`
                }).catch(() => logger.error(`personal auction slack flood call failed ${ message } source: auction.ts sendShortAuctionLink`));
            } catch (e) {
                logger.error(`${e.message} ${e.stack}`);
            } // send 1 by 1
            /*postToSlackBid({
                'text': `${registrant.NickName}(${registrant.PhoneNumber}) (sms) \n${message} twilio sid : ${twilioRes && twilioRes.sid}`
            }).catch(() => logger.error(`notifyAuctionOpen slack call failed ${message}`));*/
            logger.info(`sent message: ${message} From: ${event.PhoneNumber} To: ${registrant.PhoneNumber}`);
            // }
            // let hasSubscribedToEvent = false;
            /*
            const userPreference = registrant.Preferences || [];
            if (userPreference) {
                for (let i = 0; i < userPreference.length; i++) {
                    // logger.info('userPreference[i]._id', userPreference[i]._id);
                    if ( preferenceMap[userPreference[i]._id].Type === 'EventRegistered') {
                        hasSubscribedToEvent = true;
                    }
                }
            } else {
                hasSubscribedToEvent = true;
            }
            if (hasSubscribedToEvent) {*/
            RegistrantTokens[registrant._id] = registrant.DeviceTokens;
            RegistrantAndroidTokens[registrant._id] = registrant.AndroidDeviceTokens;
            RegistrationsById[registrant._id] = registrant;
            /*}*/
        }
        // After sending response send message to slack channel
        // send push notifications
        const promises = [];
        const voteFactors = event.RegistrationsVoteFactor;
        for (let j = 0; j < voteFactors.length; j++) {
            const userToNotify = RegistrationsById[voteFactors[j].RegistrationId + ''];
            if (userToNotify) {
                const message = `Your personal auction link.`;
                const userTokens = RegistrantTokens[voteFactors[j].RegistrationId + ''];
                const AndroidTokens = RegistrantAndroidTokens[voteFactors[j].RegistrationId + ''];
                /*postToSlackBid({
                    'text': `${userToNotify.NickName}(${userToNotify.PhoneNumber}) (push) \n${JSON.stringify(message)}`
                }).catch(() => logger.error(`notifyAuctionOpen slack call failed ${message}`));*/
                promises.push(sendNotificationIgnoreErr(userTokens, message, event.Name,
                    {
                        url: `${process.env.SHORT_SITE_URL}/a/r/${voteFactors[j].Hash}`,
                        title: 'Personal Auction Link'
                    }));
                promises.push(MultiCastIgnoreErr({
                    DeviceTokens: AndroidTokens,
                    link: `${process.env.SHORT_SITE_URL}/a/r/${voteFactors[j].Hash}`,
                    title: 'Personal Auction Link',
                    message: message,
                    priority: 'normal',
                    analyticsLabel: 'Personal Auction Link'
                }));
            }
        }
        await Promise.all(promises);
        event.Logs.push({
            Message: `Sent Auction message to registrants`,
            CreatedDate: new Date()
        });
        event.save().catch(e => logger.error(`Unable to store log message of slack related to announcement ${e.message} ${e.stack}`));
        res.json({
            'Success': true,
            'Message': 'Notification Successful',
            'code': 'SUCCESS'
        });
    } catch (e) {
        logger.error(`${e.message} ${e.stack}`);
        return next(e);
    }
}

export async function manualBid(req: Request, res: Response, next: NextFunction) {
    try {
        const phone = req.body.phone;
        const name = req.body.name;
        const bid = parseFloat(req.body.bid);
        let firstName = '';
        let lastName = '';
        if (name) {
            const nameArr = name.split(' ');
            firstName = nameArr[0];
            lastName = nameArr[1];
        }
        const email = req.body.email;
        const artId = req.body.artId;
        const result = await RegisterVoter({
            '_id': new ObjectId().toHexString(),
            'FirstName': firstName,
            'LastName': lastName,
            'Email': email,
            'PhoneNumber': phone,
            'Hash': '',
            'DisplayPhone': '',
            'RegionCode': '',
            'Preferences': [],
            'NickName': '',
            ArtBattleNews: false,
            NotificationEmails: false,
            LoyaltyOffers: false,
            RegisteredAt: 'door'
        }, req.body.eventId, false, 1, true);
        const registrationId = result.Data.RegistrationId;
        const response = await _bid(artId, bid, await RegistrationModel.findById(registrationId), req.connection.remoteAddress, true);
        let message = 'Bid Recorded';
        if (response.isOutbid) {
            message = 'Bid Recorded & Outbid';
        }
        res.json({
            'Success': true,
            'Message': message,
            'code': 'SUCCESS'
        });
        const cacheDel = req.app.get('cacheDel');
        logger.info(`removing auction-detail-${req.params.artId}`);
        const delRes = await cacheDel(`auction-detail-${req.params.artId}`);
        logger.info(`removed auction-detail-${req.params.artId}, ${JSON.stringify(delRes, null, 2)}`);
        try {
            await _processBidNotification(response);
        } catch (e) {
            logger.error(`Ignore error ${e.message} ${e.stack}`);
        }
    } catch (e) {
        logger.error(`${e.message} ${e.stack}`);
        next(e);
    }
}

export async function saveLotConfig(req: Request, res: Response, next: NextFunction) {
    try {
        const artId = req.params.artId;
        const lotModel = await LotModel.findOne({
            ArtId: artId
        });
        if (!lotModel) {
            res.json({
                status: 404,
                Message: 'Not Found',
                code: 'FAIL'
            });
            return;
        }

        let isAdmin = false;
        if (req.user && req.user.isAdmin) {
            isAdmin = true;
        } else if (req.user && req.user.IsEventAdmin && Array.isArray(req.user.eventIds)) {
            for (let i = 0; i < req.user.eventIds.length; i++) {
                if (`${lotModel.Event._id}` == `${req.user.eventIds[i]}`) {
                    isAdmin = true;
                    break;
                }
            }
        }
        if (!isAdmin) {
            res.json({
                status: 403,
                Message: 'Forbidden',
                code: 'FAIL'
            });
        }
        lotModel.Description = req.body.Description;
        lotModel.WidthAndHeight = req.body.WidthAndHeight;
        await lotModel.save();
        const cacheDel = req.app.get('cacheDel');
        logger.info(`removing auction-detail-${artId} due to description/width and height change`);
        const delRes = await cacheDel(`auction-detail-${artId}`);
        logger.info(`removed auction-detail-${artId}  due to description/width and height change, ${JSON.stringify(delRes, null, 2)}`);
        res.json({
            'Success': true,
            'Message': `Lot Saved`,
            'code': 'SUCCESS'
        });
    } catch (e) {
        next(e);
    }
}

export async function updateOnlineAuctionPaymentSheet(req: Request, res: Response, next: NextFunction) {
    try {
        const artId = req.body.artId;
        const phoneNumber = req.body.phone;
        const email = req.body.email;
        const name = req.body.name;
        const nickname = req.body.nickname;
        const Lot = await LotModel.findOne({
            ArtId: artId
        }).populate('Bids.Registration')
            .populate('Event.Rounds.Contestants.Detail');
        if (!Lot) {
            next({
                status: 403,
                Message: 'Invalid art ID'
            });
            return ;
        }
        const lotsByArtIdMap: {[key: string]: LotDTO} = {};
        lotsByArtIdMap[Lot.ArtId.toString()] = Lot;
        const eventId = Lot.Event._id;
        const event = await EventModel.findById(eventId)
            .select(['Rounds', 'Name', 'EID', 'TimeZoneICANN', 'Currency'])
            .populate('Rounds.Contestants.Detail')
            .populate('Currency');
        const excelRows: [string[]?] = [];

        for (let j = 0; j < event.Rounds.length; j++) {
            for (let k = 0; k < event.Rounds[j].Contestants.length; k++) {
                const artId = `${event.EID}-${event.Rounds[j].RoundNumber}-${event.Rounds[j].Contestants[k].EaselNumber}`;
                if (artId === req.body.artId) {
                    if (lotsByArtIdMap[artId.toString()] && event.Rounds[j].Contestants[k].Enabled) {
                        const excelRow: string[] = [];
                        event.Rounds[j].Contestants[k].LastBidPrice = 0;
                        event.Rounds[j].Contestants[k] = JSON.parse(JSON.stringify(event.Rounds[j].Contestants[k]));
                        excelRow.push(event.Name);
                        excelRow.push(artId);
                        excelRow.push(event.Rounds[j].Contestants[k].Detail.Name);
                        excelRow.push(lotsByArtIdMap[artId].Bids.length.toString());
                        let bid: BidDTO;
                        if ( lotsByArtIdMap[artId.toString()].Bids.length > 0) {
                            bid = lotsByArtIdMap[artId.toString()].Bids.reduce((a: BidDTO, b: BidDTO) => {
                                return (a.Amount > b.Amount) ? a : b;
                            });
                        }
                        excelRow.push((event.Currency && event.Currency.currency_symbol || '$') + (bid && bid.Amount || '0'));
                        excelRow.push(event.Currency && event.Currency.currency_label || 'usd');
                        const closeTime = formatToTimeZone(new Date(lotsByArtIdMap[artId].updatedAt), 'YYYY-MM-DD hh:mm A',  { timeZone: event.TimeZoneICANN }).toString();
                        excelRow.push(closeTime);
                        excelRow.push(req.body.secret_code); // credit applied
                        excelRow.push(req.body.total); // final payment
                        excelRow.push(nickname);
                        excelRow.push(phoneNumber);
                        excelRow.push(name);
                        excelRow.push(email);
                        excelRow.push(req.body.card_type); // Buyer Paid?
                        excelRow.push(req.body.delivery); // Delivery Option
                        excelRow.push(req.body.street_address); // Address 1
                        excelRow.push(req.body.street_address_line2); // Address 2
                        excelRow.push(req.body.city); // Address City
                        excelRow.push(req.body.zip); // Address Zip
                        excelRow.push(''); //
                        excelRow.push(req.body.card_type); // Artist Paid?
                        excelRows.push(excelRow);
                        break;
                    }
                }
            }
        }
        await new ExportToExcelClass().insertInSheet(excelRows);
        res.json(excelRows);
    } catch (e) {
        next(e);
    }
}

export async function bidsExport(req: Request, res: Response, next: NextFunction) {
    try {
        const eventId = req.params.eventId;
        const Lots = await LotModel.find({'Event': eventId}).populate('Bids.Registration').exec();
        const fields = [
            'ArtId', 'EaselNumber', 'Round', 'Amount', 'PhoneNumber', 'Email',
            'FirstName', 'LastName', 'Status', 'NickName'
        ];
        let totalRows = 1;
        res.setHeader('Content-disposition', `attachment; filename=bids_export_${eventId}.csv`);
        res.set('Content-Type', 'text/csv');
        const csvStream = csv.createWriteStream({headers: fields});
        csvStream.pipe(res);
        csvStream.write([]);
        if (Lots) {
            for (let i = 0; i < Lots.length; i++) {
                let higherBid = 0;
                let higherBidderIndex = 0;
                const LotElement = {
                    'ArtId': Lots[i].ArtId,
                    'EaselNumber': Lots[i].EaselNumber,
                    'Round': Lots[i].Round,
                    'Bids': Lots[i].Bids.map((Bid, index) => {
                        if (Bid.Amount > higherBid) {
                            higherBid = Bid.Amount;
                            higherBidderIndex = index;
                        }
                        return {
                            'Amount': Bid.Amount,
                            'PhoneNumber': Bid.Registration.PhoneNumber,
                            'Email': Bid.Registration.Email,
                            'FirstName': Bid.Registration.FirstName,
                            'LastName': Bid.Registration.LastName,
                            'Status': 'Bidders',
                            'NickName': Bid.Registration.NickName
                        };
                    })
                };

                if (LotElement.Bids[higherBidderIndex]) {
                    LotElement.Bids[higherBidderIndex].Status = 'Winner';
                }
                for (let k = 0; k < LotElement.Bids.length; k++) {
                    const chunk = [
                        LotElement.ArtId,
                        LotElement.EaselNumber,
                        LotElement.Round,
                        LotElement.Bids[k].Amount,
                        LotElement.Bids[k].PhoneNumber,
                        LotElement.Bids[k].Email,
                        LotElement.Bids[k].FirstName,
                        LotElement.Bids[k].LastName,
                        LotElement.Bids[k].Status,
                        LotElement.Bids[k].NickName
                    ];
                    csvStream.write(chunk);
                    totalRows ++;
                }
            }
        }
        csvStream.end();
        res.status(200).send();
    } catch (e) {
        next(e);
    }
}

export async function AuctionPaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const eventIds = req.body.eventIds;
        if (!eventIds || eventIds.length === 0) {
            res.status(403);
            res.json({
                Success: false,
                Message: 'Event Id is required'
            });
            return ;
        }
        const results = await Promise.all([
            LotModel.find({
                Event: {$in: eventIds}
            })
                .populate('Bids.Registration')
                .populate('ArtistPayRecentUser')
                .populate('BuyerPayRecentUser')
                .populate('ArtistPayRecentRegistration')
                .populate('BuyerPayRecentRegistration')
                .select(['ArtId', 'Bids', 'EaselNumber', 'Round', 'ArtistPayRecentStatus', 'ArtistPayRecentDate',
                    'BuyerPayRecentStatus', 'Event', 'ArtistPayRecentUser', 'BuyerPayRecentUser', 'BuyerPayRecentDate',
                    'BuyerPayRecentRegistration', 'ArtistPayRecentRegistration']),
            EventModel.find({_id: {$in: eventIds}})
                .populate('Rounds.Contestants.Detail')
                .populate('Currency')
                .select(['Rounds', 'EID', 'Name', 'Currency']),
            PaymentStatusModel.find()
        ]);
        const events = results[1];
        const Lots = results[0];
        const paymentStatuses = results[2];
        if (Lots.length === 0) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'No Lots present in event'
            });
            return ;
        }
        if (events.length === 0) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'Event Ids not found'
            });
            return ;
        }
        if (paymentStatuses.length === 0) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'No payment statuses in db'
            });
            return ;
        }
        const eventIdMap: {[key: string]: EventDTO} = {};
        const paymentStatusMap: {[key: string]: PaymentStatusDTO} = {};
        const artIdContestantMap: {[key: string]: RoundContestantDTO} = {};
        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            eventIdMap[event._id] = event;
            for (let i = 0; i < event.Rounds.length; i++) {
                const round = event.Rounds[i];
                for (let j = 0; j < round.Contestants.length; j++) {
                    const contestant = round.Contestants[j];
                    const artId = `${event.EID}-${round.RoundNumber}-${contestant.EaselNumber}`;
                    artIdContestantMap[artId] = contestant;
                }
            }
        }
        for (let k = 0; k < paymentStatuses.length; k++) {
            paymentStatusMap[paymentStatuses[k]._id] = paymentStatuses[k];
        }
        const payStatusArr = [];
        for (let i = 0; i < Lots.length; i++) {
            const Lot = Lots[i];
            const contestant = artIdContestantMap[Lot.ArtId];
            const event = eventIdMap[Lot.Event._id];
            if (contestant && event) {
                let artistPayerName;
                let buyerPayerName;
                if (Lot.ArtistPayRecentRegistration) {
                    artistPayerName = Lot.ArtistPayRecentRegistration.Email || `${Lot.ArtistPayRecentRegistration.FirstName || ''} ${Lot.ArtistPayRecentRegistration.LastName || ''}`;
                }
                if (Lot.ArtistPayRecentUser) {
                    artistPayerName = `${Lot.ArtistPayRecentUser.email}`;
                }
                if (Lot.BuyerPayRecentRegistration) {
                    buyerPayerName = Lot.BuyerPayRecentRegistration.Email || `${Lot.BuyerPayRecentRegistration.FirstName || ''} ${Lot.BuyerPayRecentRegistration.LastName || ''}`;
                }
                if (Lot.BuyerPayRecentUser) {
                    buyerPayerName = `${Lot.BuyerPayRecentUser.email}`;
                }
                const ArtistPayRecentStatus = Lot.ArtistPayRecentStatus && Lot.ArtistPayRecentStatus._id ? paymentStatusMap[Lot.ArtistPayRecentStatus && Lot.ArtistPayRecentStatus._id] : undefined;
                const BuyerPayRecentStatus = Lot.BuyerPayRecentStatus && Lot.BuyerPayRecentStatus._id ? paymentStatusMap[Lot.BuyerPayRecentStatus && Lot.BuyerPayRecentStatus._id] : undefined;
                const payStatusObj: PaymentStatusResponse = {
                    LotId: Lot._id,
                    ArtistName: contestant.Detail.Name,
                    ArtistId: contestant._id,
                    Bids: Lot.Bids,
                    EventName: event.Name,
                    ArtId: Lot.ArtId,
                    ArtistPayRecentStatus: ArtistPayRecentStatus,
                    BuyerPayRecentStatus: BuyerPayRecentStatus,
                    Image: contestant.Images[contestant.Images.length - 1],
                    BuyerPayRecentDate: Lot.BuyerPayRecentDate,
                    ArtistPayRecentDate: Lot.ArtistPayRecentDate,
                    BuyerPayRecentUser: buyerPayerName || '',
                    ArtistPayRecentUser: artistPayerName || '',
                    CurrencySymbol: event.Currency && event.Currency.currency_symbol || '$'
                };
                payStatusArr.push(payStatusObj);
            }
        }
        if (payStatusArr.length === 0) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'No Lots'
            });
            return ;
        }
        const result: DataOperationResult<PaymentStatusResponse[]> = {
            'Success': true,
            Data: payStatusArr
        };
        res.json(result);
    } catch (e) {
        next(e);
    }
}

export async function AuctionPaymentStatusOptions(req: Request, res: Response, next: NextFunction) {
    try {
        const paymentStatusOptions = await PaymentStatusModel.find({
            active: true
        });
        const result: DataOperationResult<PaymentStatusDTO[]> = {
            'Success': true,
            Data: paymentStatusOptions
        };
        res.json(result);
    } catch (e) {
        next(e);
    }
}

export async function MarkBuyerPaid(req: Request, res: Response, next: NextFunction) {
    try {
        // TODO handle resetting of paid status
        if (!req.body.LotId) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'Please pass LotId'
            });
            return ;
        }
        if (!req.body.BuyerPayRecentStatus) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'Please pass BuyerPayRecentStatus'
            });
            return ;
        }

        const Lot = await LotModel.findById(req.body.LotId);
        if (!Lot) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'Invalid Lot id'
            });
            return ;
        }
        const dateObj = new Date();
        const userReg = req.user.PhoneNumber ? req.user : undefined;
        const user = !req.user.PhoneNumber ? req.user : undefined;
        Lot.BuyerPayRecentStatus = req.body.BuyerPayRecentStatus;
        Lot.BuyerPayRecentDate = dateObj;
        Lot.BuyerPaidChangeLog.push({
            Registration: req.user.PhoneNumber ? req.user : undefined,
            User: !req.user.PhoneNumber ? req.user : undefined,
            createdAt: dateObj,
            PaidStatus: req.body.BuyerPayRecentStatus,
            Buyer: Lot.Bids.sort((a, b) => b.Amount - a.Amount)[0].Registration
        });
        Lot.BuyerPayRecentDate = dateObj;
        Lot.BuyerPayRecentRegistration = userReg;
        Lot.BuyerPayRecentUser = user;
        await Lot.save();
        let buyerPayerName;
        if (Lot.BuyerPayRecentRegistration) {
            buyerPayerName = Lot.BuyerPayRecentRegistration.Email || `${Lot.BuyerPayRecentRegistration.FirstName} ${Lot.BuyerPayRecentRegistration.LastName}`;
        }
        if (Lot.BuyerPayRecentUser) {
            buyerPayerName = `${Lot.BuyerPayRecentUser.email}`;
        }
        const result: DataOperationResult<BuyerPaidResponse> = {
            Success: true,
            Data: {
                BuyerPayRecentDate: Lot.BuyerPayRecentDate,
                BuyerPayRecentUser: buyerPayerName
            }
        };
        res.json(result);
    } catch (e) {
        next(e);
    }
}

export async function MarkArtistPaid(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.body.LotId) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'Please pass LotId'
            });
            return ;
        }
        if (!req.body.ArtistPayRecentStatus) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'Please pass ArtistPayRecentStatus'
            });
            return ;
        }
        if (!req.body.ArtistId) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'Please pass ArtistId'
            });
            return ;
        }
        const Lot = await LotModel.findById(req.body.LotId);
        if (!Lot) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'Invalid Lot id'
            });
            return ;
        }
        const dateObj = new Date();
        const userReg = req.user.PhoneNumber ? req.user : undefined;
        const user = !req.user.PhoneNumber ? req.user : undefined;
        Lot.ArtistPayRecentStatus = req.body.ArtistPayRecentStatus;
        Lot.ArtistPaidChangeLog.push({
            Registration: userReg,
            User: user,
            createdAt: dateObj,
            PaidStatus: req.body.ArtistPayRecentStatus,
            Artist: req.body.ArtistId
        });
        Lot.ArtistPayRecentDate = dateObj;
        Lot.ArtistPayRecentRegistration = userReg;
        Lot.ArtistPayRecentUser = user;
        await Lot.save();
        let artistPayerName;
        if (Lot.ArtistPayRecentRegistration) {
            artistPayerName = Lot.ArtistPayRecentRegistration.Email || `${Lot.ArtistPayRecentRegistration.FirstName} ${Lot.ArtistPayRecentRegistration.LastName}`;
        }
        if (Lot.ArtistPayRecentUser) {
            artistPayerName = `${Lot.ArtistPayRecentUser.email || ''}`;
        }

        const result: DataOperationResult<ArtistPaidResponse> = {
            Success: true,
            Data: {
                ArtistPayRecentDate: Lot.ArtistPayRecentDate,
                ArtistPayRecentUser: artistPayerName
            }
        };
        res.json(result);
    } catch (e) {
        next(e);
    }
}

async function getArtStat(artId: string) {
    interface LotCombinedInterface extends LotDocument {
        event: EventDTO;
        currency: CountryDTO;
    }
    let artistFlag: string = '';
    const lots: LotCombinedInterface[] = await LotModel.aggregate()
        .match({
            ArtId: artId
        })
        .lookup({
            from: 'events',
            localField: 'Event',
            foreignField: '_id',
            as: 'event'
        })
        .unwind({
            path: '$event',
            preserveNullAndEmptyArrays: false
        })
        .lookup({
            from: 'countries',
            localField: 'event.Currency',
            foreignField: '_id',
            as: 'currency'
        })
        .unwind({
            path: '$currency',
            preserveNullAndEmptyArrays: false
        }).allowDiskUse(true);

    if (!lots || lots.length === 0) {
        throw({
            status: 404,
            Success: false,
            Message: 'Please pass correct artId'
        });
    }
    const lot  = lots[0];
    let latestImage: ArtistIndividualImage;
    let contestantId;
    const topBid = lot.Bids.sort((a, b) => {
        return b.Amount - a.Amount;
    });
    const topBidAmount = topBid[0] && topBid[0].Amount;
    for (let i = 0; lot.event.Rounds.length; i++) {
        const round = lot.event.Rounds[i];
        if (round.RoundNumber  === lot.Round) {
            for (let j = 0; j < round.Contestants.length; j++) {
                const contestant = round.Contestants[j];
                if (contestant.EaselNumber === lot.EaselNumber) {
                    contestantId = contestant.Detail;
                    if (Array.isArray(contestant.Images)) {
                        latestImage = contestant.Images[contestant.Images.length - 1];
                    }
                    const reg = await RegistrationModel.findOne({Artist: contestant.Detail});
                    if (reg && reg.RegionCode) {
                        artistFlag = `/images/countries/4x3/${reg.RegionCode.toLowerCase()}.svg`;
                    }
                    break;
                }
            }
            break;
        }
    }
    if (!contestantId) {
        throw ({
            status: 404,
            Success: false,
            Message: 'Invalid lot'
        });
    }
    const result = await Promise.all([
        VotingLogModel.countDocuments({
            Status: 'VOTE_ACCEPTED',
            EventId: lot.event._id,
            RoundNumber: lot.Round,
            EaselNumber: lot.EaselNumber
        }),
        ContestantModel.findOne({
            _id: contestantId
        }).populate('City')
    ]);
    const voteCount = result[0];
    const artistName = result[1] && result[1].Name || '';
    const artistCity = result[1] && result[1].City && result[1].City.Name || result[1].CityText || `Easel ${lot.EaselNumber}, Round ${lot.Round}`;
    return {
        VoteCount: voteCount,
        TopBidAmount: topBidAmount,
        Round: lot.Round,
        EaselNumber: lot.EaselNumber,
        ArtistName: artistName,
        Currency: lot.currency && lot.currency.currency_symbol || '$',
        LatestImage: latestImage,
        ArtistFlag: artistFlag,
        ArtistCity: artistCity
    };
}
export async function artStat(req: Request, res: Response, next: NextFunction) {
    try {
        res.json(await getArtStat(req.params.artId));
    } catch (e) {
        next(e);
    }
}

export async function artStatHtml(req: Request, res: Response, next: NextFunction) {
    try {
        res.render('art_stat', {
            title: `Art Stat`,
            stat: await getArtStat(req.params.artId)
        });
    } catch (e) {
        next(e);
    }
}

/*
export async function artStatImageHtml(req: Request, res: Response, next: NextFunction) {
    try {
        res.render('art_stat_image', {
            title: `Art Stat`,
            stat: await getArtStat(req.params.artId)
        });
    } catch (e) {
        next(e);
    }
}
*/

export async function sendClosingNotice(req: Request, res: Response, next: NextFunction) {
    try {
        const eventId = req.params.eventId;
        const roundNumber = req.params.roundNo;
        const twilioClient = Twilio();
        console.log('e', eventId, roundNumber);
        const lots = await LotModel.find({
            Status: 1, // auction open
            Round: roundNumber,
            Event: eventId
        }).populate('Bids.Registration')
            .populate('Event')
            .populate('Contestant');
        const promises = [];
        for (let i = 0; i < lots.length; i++) {
            const lot = lots[i];
            const bids = lot.Bids.sort((a, b) => {
                return b.Amount - a.Amount;
            });
            const alreadySentTo = [];
            for (let j = 0; j < bids.length; j++) {
                const registration = bids[j].Registration;
                const auctionUrl = ` ${process.env.SHORT_SITE_URL}/a/${lot.ArtId}/r/${registration.Hash}`;
                console.log(bids[j]);
                if (alreadySentTo.indexOf(registration.Hash) === -1) {
                    alreadySentTo.push(registration.Hash);
                    const pushTitle = `${lot.Contestant.Name}: Round ${lot.Round}`;
                    if (j === 0) {
                        // top bid
                        const title = `Auction CLOSING on the Round ${lot.Round} painting by ${lot.Contestant.Name}`;
                        const message = `${title}, and will close after no new bids have been received for 5 minutes. You are currently the TOP BID at $${bids[j].Amount} - ${auctionUrl}`;
                        logger.info(`Sending message: ${message} From: ${lot.Event.PhoneNumber} To: ${registration.PhoneNumber}`);
                        let twilioRes;
                        try {
                            twilioRes = await twilioClient.messages.create({
                                from: lot.Event.PhoneNumber,
                                to: registration.PhoneNumber,
                                body: message
                            });
                            postToSlackSMSFlood({
                                'text': `${registration.NickName}(${registration.PhoneNumber}) (sms) \n${message} source: auction.ts sendClosingNotice`
                            }).catch(() => logger.error(`otp slack flood call failed ${ message } source: auction.ts sendClosingNotice`));
                            logger.info(`sent message: ${message} From: ${lot.Event.PhoneNumber} To: ${registration.PhoneNumber}`);
                        } catch (e) {
                            logger.error(`message sending failed ${e.message} ${e.stack}`);
                        } // send 1 by 1
                        if (registration.DeviceTokens && registration.DeviceTokens.length > 0) {
                            promises.push(sendNotificationIgnoreErr(registration.DeviceTokens, message, lot.Event.Name,
                                {
                                    url: `${auctionUrl}`,
                                    title: pushTitle
                                }));
                        }
                        if (registration.AndroidDeviceTokens && registration.AndroidDeviceTokens.length > 0) {
                            promises.push(MultiCastIgnoreErr({
                                DeviceTokens: registration.AndroidDeviceTokens,
                                link: `${auctionUrl}`,
                                title: pushTitle,
                                message: message,
                                priority: 'normal',
                                analyticsLabel: pushTitle
                            }));
                        }
                    } else {
                        // bids other than top
                        const message = `Auction CLOSING on the Round ${lot.Round} painting by ${lot.Contestant.Name}. It will close after no new bids have been received for 5 minutes. You are NOT WINNING and must BID AGAIN to win - ${auctionUrl}`;
                        logger.info(`Sending message: ${message} From: ${lot.Event.PhoneNumber} To: ${registration.PhoneNumber}`);
                        let twilioRes;
                        try {
                            twilioRes = await twilioClient.messages.create({
                                from: lot.Event.PhoneNumber,
                                to: registration.PhoneNumber,
                                body: message
                            });
                            postToSlackSMSFlood({
                                'text': `${registration.NickName}(${registration.PhoneNumber}) (sms) \n${message} source: auction.ts sendClosingNotice`
                            }).catch(() => logger.error(`auction closing slack flood call failed ${ message } source: auction.ts sendClosingNotice`));
                            logger.info(`sent message: ${message} From: ${lot.Event.PhoneNumber} To: ${registration.PhoneNumber}`);
                        } catch (e) {
                            logger.error(`message sending failed ${e.message} ${e.stack}`);
                        }
                        if (registration.DeviceTokens && registration.DeviceTokens.length > 0) {
                            promises.push(sendNotificationIgnoreErr(registration.DeviceTokens, message, lot.Event.Name,
                                {
                                    url: `${auctionUrl}`,
                                    title: pushTitle
                                }));
                        }
                        if (registration.AndroidDeviceTokens && registration.AndroidDeviceTokens.length > 0) {
                            promises.push(MultiCastIgnoreErr({
                                DeviceTokens: registration.AndroidDeviceTokens,
                                link: `${auctionUrl}`,
                                title: pushTitle,
                                message: message,
                                priority: 'normal',
                                analyticsLabel: pushTitle
                            }));
                        }
                    }
                }
            }
        }
        await Promise.all(promises);
        const result: DataOperationResult<string> = {
            'Success': true,
            Data: 'Messages sent.'
        };
        res.json(result);
    } catch (e) {
        next(e);
    }
}

export async function autoClose(req: Request, res: Response, next: NextFunction) {
    try {
        const eventId = req.params.eventId;
        const enableAutoClose = parseInt(req.params.enableAutoClose);
        const result = await _enableAutoClose(enableAutoClose, eventId);
        if (!result.Success) {
            res.status(403);
        }
        res.json(result);
    } catch (e) {
        next(e);
    }
}

async function _enableAutoClose(autoCloseAuctionIndex: number, eventId: any) {
    try {
        logger.info('enable auto close called' + new Date() + ' ' + eventId);
        if (!AutoCloseStates[autoCloseAuctionIndex] && (autoCloseAuctionIndex === 2 || autoCloseAuctionIndex === 4)) {
            logger.error(`Enable Auction should be 2 or 4  ${this.auctionIndex}`);
            const result: DataOperationResult<string> = {
                'Success': false,
                Data: 'Invalid'
            };
            return result;
        }
        const event = await EventModel.findOne({
            _id: eventId
        }).select(['_id', 'RegistrationsVoteFactor', 'PhoneNumber']);
        if (event) {
            if (autoCloseAuctionIndex === 2) {
                event.AuctionCloseStartsAt = AddMinutes(new Date(), 15);
            } else {
                event.AuctionCloseStartsAt = new Date('1970-01-01');
            }
            console.log('event.AuctionCloseStartsAt', event.AuctionCloseStartsAt);
            await event.save();
            const result: DataOperationResult<{Message: string; AuctionCloseStartsAt: Date}> = {
                'Success': true,
                Data: {
                    Message: AutoCloseStates[autoCloseAuctionIndex],
                    AuctionCloseStartsAt: event.AuctionCloseStartsAt
                }
            };
            if (event.AuctionCloseStartsAt === new Date('1970-01-01')) {
                // do not send message if Auction start time is beginning of Epoch
                const result: DataOperationResult<string> = {
                    'Success': false,
                    Data: 'Invalid'
                };
                return result;
            }
            // intentionally not waiting for this promise to resolve
            _sendClosingMessages(event).then(() => {
                logger.info(`closing message send successful`);
            }). catch((e) => {
                logger.error(`closing message send failed`);
                logger.error(e);
            });
            return result;
        } else {
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

async function _sendClosingMessages(event: EventDTO) {
    const twilioClient = Twilio();
    for (let i = 0; i < event.RegistrationsVoteFactor.length; i++) {
        const phoneNumber = event.RegistrationsVoteFactor[i].PhoneNumber;
        let voteUrl = `${event.RegistrationsVoteFactor[i].AuctionUrl}`;
        if (voteUrl.indexOf('http') === -1) {
            // old record
            voteUrl = `${process.env.SHORT_SITE_URL}${voteUrl}`;
        }
        logger.info('sending closing message to ' + phoneNumber + ' ' + new Date());
        const minutesRemaining = differenceInMinutes(event.AuctionCloseStartsAt, new Date());
        const message = `Auction closing in about ${minutesRemaining} min! Bid now to win your piece - ${voteUrl}`;
        await _sendMessage(twilioClient, message, phoneNumber, event.PhoneNumber, event.RegistrationsVoteFactor[i].NickName);
    }
}

async function _sendMessage(twilioClient: Twilio.RestClient, message: string, phoneNumber: string, eventPhoneNumber: string, nickName: string) {
    try {
        logger.info(`sending sms ${message} to ${phoneNumber}`);
        const twilioRes = await twilioClient.messages.create({
            from: eventPhoneNumber,
            to: phoneNumber,
            body: message
        });
        postToSlackSMSFlood({
            'text': `${nickName}(${phoneNumber}) (sms) \n${message} source: auction.ts _sendMessage`
        }).catch(() => logger.error(`auction _sendMessage slack flood call failed ${ message } source: auction.ts _sendMessage`));
        logger.info(`sent sms ${message} ${twilioRes && twilioRes.sid}`);
    } catch (e) {
        logger.error(`failed sms ${message}`);
        logger.error(`${e.message} ${e.stack}`);
    }
}