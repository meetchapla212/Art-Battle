"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoClose = exports.sendClosingNotice = exports.artStatHtml = exports.artStat = exports.MarkArtistPaid = exports.MarkBuyerPaid = exports.AuctionPaymentStatusOptions = exports.AuctionPaymentStatus = exports.bidsExport = exports.updateOnlineAuctionPaymentSheet = exports.saveLotConfig = exports.manualBid = exports.sendShortAuctionLink = exports.notifyAuctionOpen = exports.bid = exports.auctionDetail = exports.auctionDetailHtml = exports.eventsWithAuction = exports.eventsWithAuctionHtml = exports.exportToGoogleSheet = exports.changeAuctionStatus = void 0;
const Event_1 = require("../models/Event");
const States_1 = require("../common/States");
const Lot_1 = require("../models/Lot");
const bson_1 = require("bson");
const Preference_1 = require("../models/Preference");
const Twilio = require("twilio");
const Apns_1 = require("../common/Apns");
const Registration_1 = require("../models/Registration");
const jsonwebtoken_1 = require("jsonwebtoken");
const Slack_1 = require("../common/Slack");
const ExportToExcel_1 = require("../common/ExportToExcel");
// @ts-ignore
const date_fns_timezone_1 = require("date-fns-timezone");
// @ts-ignore
const hot_shots_1 = require("hot-shots");
const logger_1 = require("../config/logger");
const RegistrationProcessor_1 = require("../common/RegistrationProcessor");
const FCM_1 = require("../common/FCM");
// @ts-ignore
const csv = require("fast-csv-ifo");
const PaymentStatus_1 = require("../models/PaymentStatus");
const VotingLog_1 = require("../models/VotingLog");
const Contestant_1 = require("../models/Contestant");
const Auction_1 = require("../common/Auction");
const Date_1 = require("../common/Date");
const date_fns_1 = require("date-fns");
async function changeAuctionStatus(req, res, next) {
    try {
        const result = await new Auction_1.AuctionStatus(req.params.eventId, req.params.contestantId, parseInt(req.params.roundNumber), parseInt(req.params.EnableAuction), req.app.get('cacheDel')).ChangeAuctionStatus();
        if (!result.Success) {
            res.status(403);
        }
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
exports.changeAuctionStatus = changeAuctionStatus;
async function exportToGoogleSheet(req, res, next) {
    try {
        const eventId = req.params.eventId;
        const results = await Promise.all([
            Lot_1.default.find({
                Event: eventId
            })
                .populate('Bids.Registration')
                .populate('Event.Rounds.Contestants.Detail'),
            Event_1.default.findById(req.params.eventId)
                .select(['Rounds', 'Name', 'EID', 'TimeZoneICANN', 'Currency'])
                .populate('Rounds.Contestants.Detail')
                .populate('Currency')
        ]);
        const excelRows = [];
        const Lots = results[0];
        const event = results[1];
        const lotsByArtIdMap = {};
        for (let i = 0; i < Lots.length; i++) {
            lotsByArtIdMap[Lots[i].ArtId.toString()] = Lots[i];
        }
        for (let j = 0; j < event.Rounds.length; j++) {
            for (let k = 0; k < event.Rounds[j].Contestants.length; k++) {
                const artId = `${event.EID}-${event.Rounds[j].RoundNumber}-${event.Rounds[j].Contestants[k].EaselNumber}`;
                if (lotsByArtIdMap[artId.toString()] && event.Rounds[j].Contestants[k].Enabled) {
                    const excelRow = [];
                    event.Rounds[j].Contestants[k].LastBidPrice = 0;
                    event.Rounds[j].Contestants[k] = JSON.parse(JSON.stringify(event.Rounds[j].Contestants[k]));
                    excelRow.push(event.Name);
                    excelRow.push(artId);
                    excelRow.push(event.Rounds[j].Contestants[k].Detail.Name);
                    excelRow.push(lotsByArtIdMap[artId].Bids.length.toString());
                    let bid;
                    if (lotsByArtIdMap[artId.toString()].Bids.length > 0) {
                        bid = lotsByArtIdMap[artId.toString()].Bids.reduce((a, b) => {
                            return (a.Amount > b.Amount) ? a : b;
                        });
                    }
                    excelRow.push((event.Currency && event.Currency.currency_symbol || '$') + (bid && bid.Amount || '0'));
                    excelRow.push(event.Currency && event.Currency.currency_label || 'usd');
                    const closeTime = date_fns_timezone_1.formatToTimeZone(new Date(lotsByArtIdMap[artId].updatedAt), 'YYYY-MM-DD hh:mm A', { timeZone: event.TimeZoneICANN }).toString();
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
        await new ExportToExcel_1.ExportToExcelClass().insertInSheet(excelRows);
        res.json(excelRows);
    }
    catch (e) {
        next(e);
    }
}
exports.exportToGoogleSheet = exportToGoogleSheet;
async function eventsWithAuctionHtml(req, res, next) {
    try {
        const authHeader = req.header('Authorization');
        let hash;
        let token = authHeader && authHeader.replace('Bearer ', '');
        const regHash = req.params.registrationHash;
        logger_1.default.info('eventsWithAuctionHtml Token', !token, regHash);
        if (!token && regHash) {
            req.user = await Registration_1.default.findOne({ Hash: regHash });
            if (req.user) {
                token = jsonwebtoken_1.sign({
                    registrationId: req.user._id
                }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXP_TIME || '1y' });
                hash = req.user.Hash;
                res.cookie('jwt', token, {
                    httpOnly: true,
                    sameSite: true,
                    signed: true,
                    secure: false
                });
            }
        }
        else if (req.user) {
            token = jsonwebtoken_1.sign({
                registrationId: req.user._id
            }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXP_TIME || '1y' });
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
            return;
        }
        else {
            res.render('auction', {
                title: `Auction`,
                token: token,
                showAppLogo: regHash && regHash.length > 0,
                phoneHash: hash,
            });
        }
    }
    catch (e) {
        next(e);
    }
}
exports.eventsWithAuctionHtml = eventsWithAuctionHtml;
async function eventsWithAuction(req, res, next) {
    try {
        const { artId, phoneHash } = req.query;
        let { eventId } = req.query;
        let registrationId;
        if (phoneHash && phoneHash.length > 0) {
            const registration = await Registration_1.default.findOne({ Hash: phoneHash });
            if (registration) {
                registrationId = registration._id;
            }
        }
        else if (req.user && req.user.PhoneNumber && req.user.PhoneNumber.length > 0) {
            registrationId = req.user._id;
        }
        const eventQuery = {};
        const topLotByBidsQuery = {
            Status: 1
        };
        if (artId && artId.length > 0) {
            const lot = await Lot_1.default.findOne({ ArtId: artId }).select('Event');
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
        if (!(eventQuery._id || eventQuery.EID)) {
            eventQuery.Enabled = true;
            eventQuery.EnableAuction = true;
        }
        const results = await Promise.all([
            Event_1.default.find(eventQuery)
                .select(['_id', 'Name', 'Rounds', 'Country', 'EID', 'Currency', 'AuctionNotice', 'MinBidIncrement', 'AuctionStartBid', 'RegistrationsVoteFactor'])
                .populate('Rounds.Contestants.Detail')
                .populate('Country')
                .populate('Currency')
                .sort({
                'EventStartDateTime': -1
            }),
            Lot_1.default.aggregate()
                .match(topLotByBidsQuery)
                .sort({ 'Bids.Amount': -1 })
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
        let topEvents = [];
        if (topEventIds.length > 0) {
            topEvents = await Event_1.default.find({
                _id: { '$in': topEventIds },
                Enabled: true,
                EnableAuction: true
            }).select(['_id', 'Name', 'Rounds', 'Country', 'EID', 'Currency', 'AuctionNotice', 'MinBidIncrement', 'AuctionStartBid', 'RegistrationsVoteFactor'])
                .populate('Rounds.Contestants.Detail')
                .populate('Country');
        }
        let eventsArr = [];
        let topEventsArr = [];
        let topEventIndex = -1;
        let topRoundIndex = -1;
        let topArtistIndex = -1;
        const artIdsToSearch = [];
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
            const Lots = await Lot_1.default.find({
                ArtId: {
                    '$in': artIdsToSearch
                }
            });
            if (Lots.length > 0) {
                const LotPriceMap = {};
                const LotEventMap = {};
                const LotBidLengthMap = {};
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
                const findVoteFactor = (event) => {
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
                const manipulateEvents = (eventItems, artIdsToSearch = []) => {
                    const events = [];
                    for (let i = 0; i < eventItems.length; i++) {
                        let event;
                        for (let j = 0; j < eventItems[i].Rounds.length; j++) {
                            for (let k = 0; k < eventItems[i].Rounds[j].Contestants.length; k++) {
                                const Contestant = eventItems[i].Rounds[j].Contestants[k];
                                if (eventItems[i].Rounds[j].Contestants[k].Enabled) {
                                    if (eventItems[i].Rounds[j].Contestants[k]) {
                                        const artIdMan = `${eventItems[i].EID}-${eventItems[i].Rounds[j].RoundNumber}-${Contestant.EaselNumber}`;
                                        if (artIdsToSearch.length > 0) {
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
                    eventItems = events.filter((a) => {
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
                const topEvent = {
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
                        const events = await Event_1.default.find({
                            _id: eventId
                        })
                            .select(['_id', 'Name', 'Rounds', 'Country', 'EID', 'Currency', 'AuctionNotice',
                            'MinBidIncrement', 'AuctionStartBid', 'RegistrationsVoteFactor'])
                            .populate('Rounds.Contestants.Detail')
                            .populate('Country')
                            .sort({
                            'EventStartDateTime': -1
                        });
                        const manipulatedEvents = manipulateEvents(events, artIdsToSearch);
                        if (manipulatedEvents.length > 0) {
                            eventsArr.push(manipulatedEvents[0]);
                        }
                    }
                    else {
                        logger_1.default.error('user passed wrong artId ' + artId);
                    }
                }
            }
        }
        const result = {
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
    }
    catch (e) {
        next(e);
    }
}
exports.eventsWithAuction = eventsWithAuction;
async function auctionDetailHtml(req, res, next) {
    try {
        const authHeader = req.header('Authorization');
        let token = authHeader && authHeader.replace('Bearer ', '');
        const regHash = req.params.registrationHash;
        let hash;
        logger_1.default.info('auctionDetailHtml Token', !token, regHash);
        if (!token && regHash) {
            req.user = await Registration_1.default.findOne({ Hash: regHash });
            if (req.user) {
                token = jsonwebtoken_1.sign({
                    registrationId: req.user._id
                }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXP_TIME || '1y' });
                hash = req.user.Hash;
            }
        }
        else if (req.user) {
            token = jsonwebtoken_1.sign({
                registrationId: req.user._id
            }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXP_TIME || '1y' });
            hash = req.user.Hash;
        }
        const artId = req.params.artId.trim();
        const Lot = await Lot_1.default.findOne({
            ArtId: artId
        }).select(['Event', 'Round', 'EaselNumber']);
        if (!Lot) {
            res.status(404);
            res.json({
                'Success': false,
                'Message': 'Unable to find the matching Art'
            });
            return;
        }
        const Event = await Event_1.default.findById(Lot.Event).select(['Rounds']);
        const contestantInfo = _findArtistImageInEvent(Event, Lot.Round, Lot.EaselNumber);
        const contestant = await Contestant_1.default.findById(contestantInfo.Detail).select(['Name']);
        const images = contestantInfo && contestantInfo.Images;
        res.render('auction_detail', {
            title: `${contestant.Name} - Auction Detail`,
            artId: artId,
            token: token,
            showAppLogo: regHash && regHash.length > 0,
            phoneHash: hash,
            pageImage: images && images[0] && images[images.length - 1]['Thumbnail']['url']
        });
    }
    catch (e) {
        next(e);
    }
}
exports.auctionDetailHtml = auctionDetailHtml;
async function auctionDetail(req, res, next) {
    const cacheGet = req.app.get('cacheGet');
    const cacheSet = req.app.get('cacheSet');
    const cacheKey = `auction-detail-${req.params.ArtId}`;
    try {
        const cachedAuctionDetail = await cacheGet(cacheKey);
        if (cachedAuctionDetail) {
            const auctionDetail = JSON.parse(cachedAuctionDetail);
            const result = {
                'Success': true,
                Data: {
                    _id: auctionDetail._id,
                    ArtistName: auctionDetail.ArtistName,
                    UserName: req.user && (req.user.NickName || req.user.PhoneNumber),
                    SelectArtIndex: auctionDetail.Images && auctionDetail.Images.length - 1,
                    Arts: auctionDetail.Images || [],
                    TopNBids: auctionDetail.TopThreeBids,
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
            logger_1.default.info(`served response from cache ${cacheKey}`);
            return;
        }
        // not found in cache
        const Lot = await Lot_1.default.findOne({
            ArtId: req.params.ArtId
        }).populate(['Bids.Registration', 'Event']);
        if (!Lot) {
            res.status(404);
            res.json({
                'Success': false,
                'Message': 'Unable to find the matching Art'
            });
            return;
        }
        const Event = await Event_1.default.findById(Lot.Event).select(['Name', 'Rounds', 'AdminControlInAuctionPage', 'AuctionStartBid', 'Currency'])
            .populate('Rounds.Contestants.Detail').populate('Currency');
        let isAdmin = false;
        if (Event && req.user && req.user.isAdmin) {
            isAdmin = true;
        }
        else if (Event && req.user && req.user.IsEventAdmin && Array.isArray(req.user.eventIds)) {
            for (let i = 0; i < req.user.eventIds.length; i++) {
                if (`${Event._id}` == `${req.user.eventIds[i]}`) {
                    isAdmin = true;
                    break;
                }
            }
        }
        if (!Event) {
            logger_1.default.error(`Lot seems corrupted ` + JSON.stringify(Lot, null, 1));
            const result = {
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
            if (topThreeBids[i].Registration) {
                topThreeBids[i].Registration.PhoneNumber = topThreeBids[i].Registration.PhoneNumber.substr(topThreeBids[i].Registration.PhoneNumber.length - 4);
            }
            else {
                logger_1.default.error(`Registration not there in top three bid ${JSON.stringify(topThreeBids, null, 3)}`);
            }
        }
        if (topThreeBids.length === 0) {
            // for opening bid, when no bids made
            const dummyReg = {
                _id: '',
                Amount: Event.AuctionStartBid || 50,
                Registration: await Registration_1.default.findById('5b9066ea645b580000cf79ba'),
                createdAt: new Date(),
                IpAddress: ''
            };
            dummyReg.Registration.NickName = 'Artbattle';
            dummyReg.Registration.PhoneNumber = 'Artbattle';
            topThreeBids.push(dummyReg);
        }
        const response = {
            _id: Lot._id,
            ArtistName: contestant && contestant.Detail.Name,
            UserName: req.user && (req.user.NickName || req.user.PhoneNumber),
            SelectArtIndex: images && images.length - 1,
            Arts: images || [],
            TopNBids: topThreeBids,
            Status: Lot.Status,
            EventName: Lot.Event.Name,
            isAdmin: Event.AdminControlInAuctionPage && isAdmin,
            Description: Lot.Description,
            WidthAndHeight: Lot.WidthAndHeight,
            CurrencySymbol: Event.Currency && Event.Currency.currency_symbol || '$',
            TotalBids: Lot.Bids.length
        };
        const result = {
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
    }
    catch (e) {
        next(e);
    }
}
exports.auctionDetail = auctionDetail;
function _findArtistImageInEvent(event, roundNumber, EaselNumber) {
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
async function bid(req, res, next) {
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
        logger_1.default.info(`removing auction-detail-${req.params.artId}`);
        const delRes = await cacheDel(`auction-detail-${req.params.artId}`);
        logger_1.default.info(`removed auction-detail-${req.params.artId}, ${JSON.stringify(delRes, null, 2)}`);
        try {
            await _processBidNotification(response);
        }
        catch (e) {
            console.error('Ignore error', e);
        }
    }
    catch (e) {
        next(e);
    }
}
exports.bid = bid;
async function _bid(artId, bid, registration, ipAddress, manual) {
    if (!registration) {
        throw {
            'Message': `Bidding without registration ${artId} ${bid}, ${registration}, ${ipAddress}, ${manual}`
        };
    }
    const Lot = await Lot_1.default.findOne({
        ArtId: artId
    }).populate('Bids.Registration');
    let Contestant;
    const Event = await Event_1.default.findById(Lot.Event)
        .select(['Currency', 'EID', 'Rounds', 'Registrations', 'RegistrationsVoteFactor', 'AuctionStartBid', 'MinBidIncrement', 'EnableAuction', 'PhoneNumber'])
        .populate('Rounds.Contestants.Detail')
        .populate('Registrations')
        .populate('Currency');
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
    const loserRegistration = [];
    if (higherBid && higherBid.Registration.PhoneNumber != registration.PhoneNumber) {
        // don't send to same person
        loserRegistration.push(higherBid.Registration._id.toString());
    }
    const winnerRegistration = [];
    winnerRegistration.push(registration._id.toString());
    logger_1.default.info(`loserRegistration ${JSON.stringify(loserRegistration)}, 'winnerRegistration', ${JSON.stringify(winnerRegistration)}`);
    const minBidAmount = (higherBid && (higherBid.Amount + (higherBid.Amount * (Event.MinBidIncrement / 100)))) || Event.AuctionStartBid;
    logger_1.default.info(`${artId}, 'bid', ${bid}, 'minBidAmount', ${minBidAmount}`);
    const isLowerBid = bid < minBidAmount;
    if (isLowerBid && !manual) {
        throw {
            status: 400,
            'Message': `Minimum Bid ${minBidAmount}`,
            'code': 'INVALID_BID'
        };
    }
    else {
        sortedBids.push({
            _id: new bson_1.ObjectID(),
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
async function _processBidNotification(obj) {
    const { registration, bid, Contestant, loserRegistration, Event, Lot, winnerRegistration, higherBidUser, isOutbid } = obj;
    const registrationId = registration && registration._id;
    const highBidderRegId = higherBidUser && higherBidUser._id;
    const BidderNickName = `${registration.NickName || registration.PhoneNumber.substr(registration.PhoneNumber.length - 4)}`;
    const highBidderNickName = higherBidUser && `by ${higherBidUser.NickName || higherBidUser.PhoneNumber.substr(higherBidUser.PhoneNumber.length - 4)}`;
    try {
        const dogStatsD = new hot_shots_1.StatsD();
        dogStatsD.increment('vote.bid', bid, [Event.EID, BidderNickName, Contestant.Detail.Name]);
    }
    catch (e) {
        logger_1.default.error(`error in sending vote.bid diagram ${e}`);
    }
    // Send outbid notification to second last bidder
    try {
        function getMessage(Registration) {
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
        function getBidMessage(Registration) {
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
    }
    catch (e) {
        logger_1.default.error(`${e.message} ${e.stack}`);
    }
}
async function _notifyAccordingToUserPreferences(event, allowedRegistrationIds, getMessage, requestPreferences = true, allChannels = false) {
    const preferenceMap = {};
    if (requestPreferences) {
        const preferences = await Preference_1.default.find();
        for (let i = 0; i < preferences.length; i++) {
            preferenceMap[preferences[i]._id] = preferences[i];
        }
    }
    const twilioClient = Twilio();
    const RegistrantTokens = {};
    const RegistrantAndroidTokens = {};
    const RegistrationsById = {};
    const RegistrationMessages = {};
    const RegistrationChannels = {};
    event.RegistrationsVoteFactor.forEach(registrant => {
        // old event don't have From in registrants
        RegistrationChannels[registrant.RegistrationId.toString()] = (registrant.From || 'sms');
    });
    // const isSmsAndAppBothChecked = (smsVote && (appVote || appGlobalVote) );
    const filterByAllowedRegistrations = allowedRegistrationIds.length > 0;
    for (let i = 0; i < event.Registrations.length; i++) {
        const registrant = event.Registrations[i];
        const { pushMessage, smsMessage, title, url, pushTitle } = getMessage(registrant);
        RegistrationMessages[registrant._id] = {
            pushMessage: pushMessage,
            title: title,
            url: url,
            pushTitle: pushTitle
        };
        logger_1.default.info(`${JSON.stringify(allowedRegistrationIds)}, 'filterByAllowedRegistrations', ${JSON.stringify(filterByAllowedRegistrations)}, 'allowedRegistrationIds.indexOf(registrant._id + \'\')', ${allowedRegistrationIds.indexOf(registrant._id.toString())}, ${registrant._id}`);
        const isRegistrantAllowed = (!filterByAllowedRegistrations) || allowedRegistrationIds.indexOf(registrant._id + '') >= 0;
        if ((RegistrationChannels[registrant._id] === 'sms' || allChannels) && isRegistrantAllowed) {
            // if sms and app both are checked then sms should not be sent to a app number
            let twilioRes;
            try {
                logger_1.default.info(`sending sms ${smsMessage} to ${registrant.PhoneNumber}`);
                twilioRes = await twilioClient.messages.create({
                    from: event.PhoneNumber,
                    to: registrant.PhoneNumber,
                    body: smsMessage
                });
                Slack_1.postToSlackSMSFlood({
                    'text': `${registrant.NickName}(${registrant.PhoneNumber}) (sms) \n${smsMessage}, source: auction.ts _notifyAccordingToUserPreferences`
                }).catch(() => logger_1.default.error(`auction slack flood call failed ${smsMessage} source: auction.ts _notifyAccordingToUserPreferences`));
                logger_1.default.info(`sent sms ${smsMessage} ${twilioRes && twilioRes.sid}`);
            }
            catch (e) {
                logger_1.default.error(`failed sms ${smsMessage}`);
                logger_1.default.error(`${e.message} ${e.stack}`);
            }
            Slack_1.postToSlackBid({
                'text': `${registrant.NickName}(${registrant.PhoneNumber}) (sms) \n${smsMessage} twilio sid : ${twilioRes && twilioRes.sid}`
            }).catch(() => logger_1.default.error(`_notifyAccordingToUserPreferences slack call failed ${smsMessage}`));
        }
        let hasSubscribedToEvent = false;
        const userPreference = registrant.Preferences || [];
        if (userPreference) {
            for (let i = 0; i < userPreference.length; i++) {
                // logger.info('userPreference[i]._id', userPreference[i]._id);
                hasSubscribedToEvent = !requestPreferences || preferenceMap[userPreference[i]._id].Type === 'EventRegistered';
            }
        }
        else {
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
            promises.push(Apns_1.sendNotificationIgnoreErr(userTokens, message.pushMessage, message.pushTitle, {
                url: message.url,
                title: message.title
            }));
            promises.push(FCM_1.MultiCastIgnoreErr({
                DeviceTokens: AndroidTokens,
                link: message.url,
                title: message.title,
                message: message.pushMessage,
                priority: 'normal',
                analyticsLabel: message.pushTitle
            }));
            Slack_1.postToSlackBid({
                'text': `${userToNotify.NickName}(${userToNotify.PhoneNumber}) (push) \n${JSON.stringify(message)}`
            }).catch(() => logger_1.default.error(`_notifyAccordingToUserPreferences slack call failed ${message}`));
        }
    }
    return Promise.all(promises);
}
async function notifyAuctionOpen(req, res, next) {
    try {
        const event = await Event_1.default
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
        const RegistrantTokens = {};
        const RegistrantAndroidTokens = {};
        const RegistrationsById = {};
        const RegistrationChannels = {};
        const RegistrationEventHash = {};
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
            logger_1.default.info(`Sending message: ${message} From: ${event.PhoneNumber} To: ${registrant.PhoneNumber}`);
            let twilioRes;
            try {
                twilioRes = await twilioClient.messages.create({
                    from: event.PhoneNumber,
                    to: registrant.PhoneNumber,
                    body: message
                });
                Slack_1.postToSlackSMSFlood({
                    'text': `${registrant.NickName}(${registrant.PhoneNumber}) (sms) \n${message} source: auction.ts notifyAuctionOpen`
                }).catch(() => logger_1.default.error(`Auction personal link slack flood call failed ${message} source: auction.ts notifyAuctionOpen`));
            }
            catch (e) {
                logger_1.default.error(`${e.message} ${e.stack}`);
            } // send 1 by 1
            /*postToSlackBid({
                'text': `${registrant.NickName}(${registrant.PhoneNumber}) (sms) \n${message} twilio sid : ${twilioRes && twilioRes.sid}`
            }).catch(() => logger.error(`notifyAuctionOpen slack call failed ${message}`));*/
            logger_1.default.info(`sent message: ${message} From: ${event.PhoneNumber} To: ${registrant.PhoneNumber}`);
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
                promises.push(Apns_1.sendNotificationIgnoreErr(userTokens, message, event.Name, {
                    url: `${process.env.SITE_URL}${voteFactors[j].VoteUrl}`,
                    title: 'Personal Voting Link'
                }));
                promises.push(FCM_1.MultiCastIgnoreErr({
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
        event.save().catch(e => logger_1.default.error(`Unable to store log message of slack related to announcement ${e.message} ${e.stack}`));
        res.json({
            'Success': true,
            'Message': 'Notification Successful',
            'code': 'SUCCESS'
        });
    }
    catch (e) {
        logger_1.default.error(`${e.message} ${e.stack}`);
        return next(e);
    }
}
exports.notifyAuctionOpen = notifyAuctionOpen;
async function sendShortAuctionLink(req, res, next) {
    try {
        const event = await Event_1.default
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
        const RegistrantTokens = {};
        const RegistrantAndroidTokens = {};
        const RegistrationsById = {};
        const RegistrationChannels = {};
        const RegistrationEventHash = {};
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
            logger_1.default.info(`Sending short auction message: ${message} From: ${event.PhoneNumber} To: ${registrant.PhoneNumber}`);
            let twilioRes;
            try {
                twilioRes = await twilioClient.messages.create({
                    from: event.PhoneNumber,
                    to: registrant.PhoneNumber,
                    body: message
                });
                Slack_1.postToSlackSMSFlood({
                    'text': `${registrant.NickName}(${registrant.PhoneNumber}) (sms) \n${message} source: auction.ts sendShortAuctionLink`
                }).catch(() => logger_1.default.error(`personal auction slack flood call failed ${message} source: auction.ts sendShortAuctionLink`));
            }
            catch (e) {
                logger_1.default.error(`${e.message} ${e.stack}`);
            } // send 1 by 1
            /*postToSlackBid({
                'text': `${registrant.NickName}(${registrant.PhoneNumber}) (sms) \n${message} twilio sid : ${twilioRes && twilioRes.sid}`
            }).catch(() => logger.error(`notifyAuctionOpen slack call failed ${message}`));*/
            logger_1.default.info(`sent message: ${message} From: ${event.PhoneNumber} To: ${registrant.PhoneNumber}`);
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
                promises.push(Apns_1.sendNotificationIgnoreErr(userTokens, message, event.Name, {
                    url: `${process.env.SHORT_SITE_URL}/a/r/${voteFactors[j].Hash}`,
                    title: 'Personal Auction Link'
                }));
                promises.push(FCM_1.MultiCastIgnoreErr({
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
        event.save().catch(e => logger_1.default.error(`Unable to store log message of slack related to announcement ${e.message} ${e.stack}`));
        res.json({
            'Success': true,
            'Message': 'Notification Successful',
            'code': 'SUCCESS'
        });
    }
    catch (e) {
        logger_1.default.error(`${e.message} ${e.stack}`);
        return next(e);
    }
}
exports.sendShortAuctionLink = sendShortAuctionLink;
async function manualBid(req, res, next) {
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
        const result = await RegistrationProcessor_1.RegisterVoter({
            '_id': new bson_1.ObjectId().toHexString(),
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
        const response = await _bid(artId, bid, await Registration_1.default.findById(registrationId), req.connection.remoteAddress, true);
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
        logger_1.default.info(`removing auction-detail-${req.params.artId}`);
        const delRes = await cacheDel(`auction-detail-${req.params.artId}`);
        logger_1.default.info(`removed auction-detail-${req.params.artId}, ${JSON.stringify(delRes, null, 2)}`);
        try {
            await _processBidNotification(response);
        }
        catch (e) {
            logger_1.default.error(`Ignore error ${e.message} ${e.stack}`);
        }
    }
    catch (e) {
        logger_1.default.error(`${e.message} ${e.stack}`);
        next(e);
    }
}
exports.manualBid = manualBid;
async function saveLotConfig(req, res, next) {
    try {
        const artId = req.params.artId;
        const lotModel = await Lot_1.default.findOne({
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
        }
        else if (req.user && req.user.IsEventAdmin && Array.isArray(req.user.eventIds)) {
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
        logger_1.default.info(`removing auction-detail-${artId} due to description/width and height change`);
        const delRes = await cacheDel(`auction-detail-${artId}`);
        logger_1.default.info(`removed auction-detail-${artId}  due to description/width and height change, ${JSON.stringify(delRes, null, 2)}`);
        res.json({
            'Success': true,
            'Message': `Lot Saved`,
            'code': 'SUCCESS'
        });
    }
    catch (e) {
        next(e);
    }
}
exports.saveLotConfig = saveLotConfig;
async function updateOnlineAuctionPaymentSheet(req, res, next) {
    try {
        const artId = req.body.artId;
        const phoneNumber = req.body.phone;
        const email = req.body.email;
        const name = req.body.name;
        const nickname = req.body.nickname;
        const Lot = await Lot_1.default.findOne({
            ArtId: artId
        }).populate('Bids.Registration')
            .populate('Event.Rounds.Contestants.Detail');
        if (!Lot) {
            next({
                status: 403,
                Message: 'Invalid art ID'
            });
            return;
        }
        const lotsByArtIdMap = {};
        lotsByArtIdMap[Lot.ArtId.toString()] = Lot;
        const eventId = Lot.Event._id;
        const event = await Event_1.default.findById(eventId)
            .select(['Rounds', 'Name', 'EID', 'TimeZoneICANN', 'Currency'])
            .populate('Rounds.Contestants.Detail')
            .populate('Currency');
        const excelRows = [];
        for (let j = 0; j < event.Rounds.length; j++) {
            for (let k = 0; k < event.Rounds[j].Contestants.length; k++) {
                const artId = `${event.EID}-${event.Rounds[j].RoundNumber}-${event.Rounds[j].Contestants[k].EaselNumber}`;
                if (artId === req.body.artId) {
                    if (lotsByArtIdMap[artId.toString()] && event.Rounds[j].Contestants[k].Enabled) {
                        const excelRow = [];
                        event.Rounds[j].Contestants[k].LastBidPrice = 0;
                        event.Rounds[j].Contestants[k] = JSON.parse(JSON.stringify(event.Rounds[j].Contestants[k]));
                        excelRow.push(event.Name);
                        excelRow.push(artId);
                        excelRow.push(event.Rounds[j].Contestants[k].Detail.Name);
                        excelRow.push(lotsByArtIdMap[artId].Bids.length.toString());
                        let bid;
                        if (lotsByArtIdMap[artId.toString()].Bids.length > 0) {
                            bid = lotsByArtIdMap[artId.toString()].Bids.reduce((a, b) => {
                                return (a.Amount > b.Amount) ? a : b;
                            });
                        }
                        excelRow.push((event.Currency && event.Currency.currency_symbol || '$') + (bid && bid.Amount || '0'));
                        excelRow.push(event.Currency && event.Currency.currency_label || 'usd');
                        const closeTime = date_fns_timezone_1.formatToTimeZone(new Date(lotsByArtIdMap[artId].updatedAt), 'YYYY-MM-DD hh:mm A', { timeZone: event.TimeZoneICANN }).toString();
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
        await new ExportToExcel_1.ExportToExcelClass().insertInSheet(excelRows);
        res.json(excelRows);
    }
    catch (e) {
        next(e);
    }
}
exports.updateOnlineAuctionPaymentSheet = updateOnlineAuctionPaymentSheet;
async function bidsExport(req, res, next) {
    try {
        const eventId = req.params.eventId;
        const Lots = await Lot_1.default.find({ 'Event': eventId }).populate('Bids.Registration').exec();
        const fields = [
            'ArtId', 'EaselNumber', 'Round', 'Amount', 'PhoneNumber', 'Email',
            'FirstName', 'LastName', 'Status', 'NickName'
        ];
        let totalRows = 1;
        res.setHeader('Content-disposition', `attachment; filename=bids_export_${eventId}.csv`);
        res.set('Content-Type', 'text/csv');
        const csvStream = csv.createWriteStream({ headers: fields });
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
                    totalRows++;
                }
            }
        }
        csvStream.end();
        res.status(200).send();
    }
    catch (e) {
        next(e);
    }
}
exports.bidsExport = bidsExport;
async function AuctionPaymentStatus(req, res, next) {
    try {
        const eventIds = req.body.eventIds;
        if (!eventIds || eventIds.length === 0) {
            res.status(403);
            res.json({
                Success: false,
                Message: 'Event Id is required'
            });
            return;
        }
        const results = await Promise.all([
            Lot_1.default.find({
                Event: { $in: eventIds }
            })
                .populate('Bids.Registration')
                .populate('ArtistPayRecentUser')
                .populate('BuyerPayRecentUser')
                .populate('ArtistPayRecentRegistration')
                .populate('BuyerPayRecentRegistration')
                .select(['ArtId', 'Bids', 'EaselNumber', 'Round', 'ArtistPayRecentStatus', 'ArtistPayRecentDate',
                'BuyerPayRecentStatus', 'Event', 'ArtistPayRecentUser', 'BuyerPayRecentUser', 'BuyerPayRecentDate',
                'BuyerPayRecentRegistration', 'ArtistPayRecentRegistration']),
            Event_1.default.find({ _id: { $in: eventIds } })
                .populate('Rounds.Contestants.Detail')
                .populate('Currency')
                .select(['Rounds', 'EID', 'Name', 'Currency']),
            PaymentStatus_1.default.find()
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
            return;
        }
        if (events.length === 0) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'Event Ids not found'
            });
            return;
        }
        if (paymentStatuses.length === 0) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'No payment statuses in db'
            });
            return;
        }
        const eventIdMap = {};
        const paymentStatusMap = {};
        const artIdContestantMap = {};
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
                const payStatusObj = {
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
            return;
        }
        const result = {
            'Success': true,
            Data: payStatusArr
        };
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
exports.AuctionPaymentStatus = AuctionPaymentStatus;
async function AuctionPaymentStatusOptions(req, res, next) {
    try {
        const paymentStatusOptions = await PaymentStatus_1.default.find({
            active: true
        });
        const result = {
            'Success': true,
            Data: paymentStatusOptions
        };
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
exports.AuctionPaymentStatusOptions = AuctionPaymentStatusOptions;
async function MarkBuyerPaid(req, res, next) {
    try {
        // TODO handle resetting of paid status
        if (!req.body.LotId) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'Please pass LotId'
            });
            return;
        }
        if (!req.body.BuyerPayRecentStatus) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'Please pass BuyerPayRecentStatus'
            });
            return;
        }
        const Lot = await Lot_1.default.findById(req.body.LotId);
        if (!Lot) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'Invalid Lot id'
            });
            return;
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
        const result = {
            Success: true,
            Data: {
                BuyerPayRecentDate: Lot.BuyerPayRecentDate,
                BuyerPayRecentUser: buyerPayerName
            }
        };
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
exports.MarkBuyerPaid = MarkBuyerPaid;
async function MarkArtistPaid(req, res, next) {
    try {
        if (!req.body.LotId) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'Please pass LotId'
            });
            return;
        }
        if (!req.body.ArtistPayRecentStatus) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'Please pass ArtistPayRecentStatus'
            });
            return;
        }
        if (!req.body.ArtistId) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'Please pass ArtistId'
            });
            return;
        }
        const Lot = await Lot_1.default.findById(req.body.LotId);
        if (!Lot) {
            res.status(404);
            res.json({
                Success: false,
                Message: 'Invalid Lot id'
            });
            return;
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
        const result = {
            Success: true,
            Data: {
                ArtistPayRecentDate: Lot.ArtistPayRecentDate,
                ArtistPayRecentUser: artistPayerName
            }
        };
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
exports.MarkArtistPaid = MarkArtistPaid;
async function getArtStat(artId) {
    let artistFlag = '';
    const lots = await Lot_1.default.aggregate()
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
        throw ({
            status: 404,
            Success: false,
            Message: 'Please pass correct artId'
        });
    }
    const lot = lots[0];
    let latestImage;
    let contestantId;
    const topBid = lot.Bids.sort((a, b) => {
        return b.Amount - a.Amount;
    });
    const topBidAmount = topBid[0] && topBid[0].Amount;
    for (let i = 0; lot.event.Rounds.length; i++) {
        const round = lot.event.Rounds[i];
        if (round.RoundNumber === lot.Round) {
            for (let j = 0; j < round.Contestants.length; j++) {
                const contestant = round.Contestants[j];
                if (contestant.EaselNumber === lot.EaselNumber) {
                    contestantId = contestant.Detail;
                    if (Array.isArray(contestant.Images)) {
                        latestImage = contestant.Images[contestant.Images.length - 1];
                    }
                    const reg = await Registration_1.default.findOne({ Artist: contestant.Detail });
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
        VotingLog_1.default.countDocuments({
            Status: 'VOTE_ACCEPTED',
            EventId: lot.event._id,
            RoundNumber: lot.Round,
            EaselNumber: lot.EaselNumber
        }),
        Contestant_1.default.findOne({
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
async function artStat(req, res, next) {
    try {
        res.json(await getArtStat(req.params.artId));
    }
    catch (e) {
        next(e);
    }
}
exports.artStat = artStat;
async function artStatHtml(req, res, next) {
    try {
        res.render('art_stat', {
            title: `Art Stat`,
            stat: await getArtStat(req.params.artId)
        });
    }
    catch (e) {
        next(e);
    }
}
exports.artStatHtml = artStatHtml;
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
async function sendClosingNotice(req, res, next) {
    try {
        const eventId = req.params.eventId;
        const roundNumber = req.params.roundNo;
        const twilioClient = Twilio();
        console.log('e', eventId, roundNumber);
        const lots = await Lot_1.default.find({
            Status: 1,
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
                        logger_1.default.info(`Sending message: ${message} From: ${lot.Event.PhoneNumber} To: ${registration.PhoneNumber}`);
                        let twilioRes;
                        try {
                            twilioRes = await twilioClient.messages.create({
                                from: lot.Event.PhoneNumber,
                                to: registration.PhoneNumber,
                                body: message
                            });
                            Slack_1.postToSlackSMSFlood({
                                'text': `${registration.NickName}(${registration.PhoneNumber}) (sms) \n${message} source: auction.ts sendClosingNotice`
                            }).catch(() => logger_1.default.error(`otp slack flood call failed ${message} source: auction.ts sendClosingNotice`));
                            logger_1.default.info(`sent message: ${message} From: ${lot.Event.PhoneNumber} To: ${registration.PhoneNumber}`);
                        }
                        catch (e) {
                            logger_1.default.error(`message sending failed ${e.message} ${e.stack}`);
                        } // send 1 by 1
                        if (registration.DeviceTokens && registration.DeviceTokens.length > 0) {
                            promises.push(Apns_1.sendNotificationIgnoreErr(registration.DeviceTokens, message, lot.Event.Name, {
                                url: `${auctionUrl}`,
                                title: pushTitle
                            }));
                        }
                        if (registration.AndroidDeviceTokens && registration.AndroidDeviceTokens.length > 0) {
                            promises.push(FCM_1.MultiCastIgnoreErr({
                                DeviceTokens: registration.AndroidDeviceTokens,
                                link: `${auctionUrl}`,
                                title: pushTitle,
                                message: message,
                                priority: 'normal',
                                analyticsLabel: pushTitle
                            }));
                        }
                    }
                    else {
                        // bids other than top
                        const message = `Auction CLOSING on the Round ${lot.Round} painting by ${lot.Contestant.Name}. It will close after no new bids have been received for 5 minutes. You are NOT WINNING and must BID AGAIN to win - ${auctionUrl}`;
                        logger_1.default.info(`Sending message: ${message} From: ${lot.Event.PhoneNumber} To: ${registration.PhoneNumber}`);
                        let twilioRes;
                        try {
                            twilioRes = await twilioClient.messages.create({
                                from: lot.Event.PhoneNumber,
                                to: registration.PhoneNumber,
                                body: message
                            });
                            Slack_1.postToSlackSMSFlood({
                                'text': `${registration.NickName}(${registration.PhoneNumber}) (sms) \n${message} source: auction.ts sendClosingNotice`
                            }).catch(() => logger_1.default.error(`auction closing slack flood call failed ${message} source: auction.ts sendClosingNotice`));
                            logger_1.default.info(`sent message: ${message} From: ${lot.Event.PhoneNumber} To: ${registration.PhoneNumber}`);
                        }
                        catch (e) {
                            logger_1.default.error(`message sending failed ${e.message} ${e.stack}`);
                        }
                        if (registration.DeviceTokens && registration.DeviceTokens.length > 0) {
                            promises.push(Apns_1.sendNotificationIgnoreErr(registration.DeviceTokens, message, lot.Event.Name, {
                                url: `${auctionUrl}`,
                                title: pushTitle
                            }));
                        }
                        if (registration.AndroidDeviceTokens && registration.AndroidDeviceTokens.length > 0) {
                            promises.push(FCM_1.MultiCastIgnoreErr({
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
        const result = {
            'Success': true,
            Data: 'Messages sent.'
        };
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
exports.sendClosingNotice = sendClosingNotice;
async function autoClose(req, res, next) {
    try {
        const eventId = req.params.eventId;
        const enableAutoClose = parseInt(req.params.enableAutoClose);
        const result = await _enableAutoClose(enableAutoClose, eventId);
        if (!result.Success) {
            res.status(403);
        }
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
exports.autoClose = autoClose;
async function _enableAutoClose(autoCloseAuctionIndex, eventId) {
    try {
        logger_1.default.info('enable auto close called' + new Date() + ' ' + eventId);
        if (!States_1.AutoCloseStates[autoCloseAuctionIndex] && (autoCloseAuctionIndex === 2 || autoCloseAuctionIndex === 4)) {
            logger_1.default.error(`Enable Auction should be 2 or 4  ${this.auctionIndex}`);
            const result = {
                'Success': false,
                Data: 'Invalid'
            };
            return result;
        }
        const event = await Event_1.default.findOne({
            _id: eventId
        }).select(['_id', 'RegistrationsVoteFactor', 'PhoneNumber']);
        if (event) {
            if (autoCloseAuctionIndex === 2) {
                event.AuctionCloseStartsAt = Date_1.AddMinutes(new Date(), 15);
            }
            else {
                event.AuctionCloseStartsAt = new Date('1970-01-01');
            }
            console.log('event.AuctionCloseStartsAt', event.AuctionCloseStartsAt);
            await event.save();
            const result = {
                'Success': true,
                Data: {
                    Message: States_1.AutoCloseStates[autoCloseAuctionIndex],
                    AuctionCloseStartsAt: event.AuctionCloseStartsAt
                }
            };
            if (event.AuctionCloseStartsAt === new Date('1970-01-01')) {
                // do not send message if Auction start time is beginning of Epoch
                const result = {
                    'Success': false,
                    Data: 'Invalid'
                };
                return result;
            }
            // intentionally not waiting for this promise to resolve
            _sendClosingMessages(event).then(() => {
                logger_1.default.info(`closing message send successful`);
            }).catch((e) => {
                logger_1.default.error(`closing message send failed`);
                logger_1.default.error(e);
            });
            return result;
        }
        else {
            const result = {
                'Success': false,
                Data: 'Invalid'
            };
            return result;
        }
    }
    catch (e) {
        console.error(e);
        logger_1.default.error(`${e.message} ${e.stack}`);
        const result = {
            'Success': false,
            Data: 'Internal Server Error'
        };
        return result;
    }
}
async function _sendClosingMessages(event) {
    const twilioClient = Twilio();
    for (let i = 0; i < event.RegistrationsVoteFactor.length; i++) {
        const phoneNumber = event.RegistrationsVoteFactor[i].PhoneNumber;
        let voteUrl = `${event.RegistrationsVoteFactor[i].AuctionUrl}`;
        if (voteUrl.indexOf('http') === -1) {
            // old record
            voteUrl = `${process.env.SHORT_SITE_URL}${voteUrl}`;
        }
        logger_1.default.info('sending closing message to ' + phoneNumber + ' ' + new Date());
        const minutesRemaining = date_fns_1.differenceInMinutes(event.AuctionCloseStartsAt, new Date());
        const message = `Auction closing in about ${minutesRemaining} min! Bid now to win your piece - ${voteUrl}`;
        await _sendMessage(twilioClient, message, phoneNumber, event.PhoneNumber, event.RegistrationsVoteFactor[i].NickName);
    }
}
async function _sendMessage(twilioClient, message, phoneNumber, eventPhoneNumber, nickName) {
    try {
        logger_1.default.info(`sending sms ${message} to ${phoneNumber}`);
        const twilioRes = await twilioClient.messages.create({
            from: eventPhoneNumber,
            to: phoneNumber,
            body: message
        });
        Slack_1.postToSlackSMSFlood({
            'text': `${nickName}(${phoneNumber}) (sms) \n${message} source: auction.ts _sendMessage`
        }).catch(() => logger_1.default.error(`auction _sendMessage slack flood call failed ${message} source: auction.ts _sendMessage`));
        logger_1.default.info(`sent sms ${message} ${twilioRes && twilioRes.sid}`);
    }
    catch (e) {
        logger_1.default.error(`failed sms ${message}`);
        logger_1.default.error(`${e.message} ${e.stack}`);
    }
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3BDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtnQkFDOUMsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtvQkFDN0QsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLEVBQUU7d0JBQzVDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksR0FBRyxDQUFDLENBQUM7d0JBQ3BELE1BQU0sU0FBUyxHQUFHLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDMUgsSUFBSSxTQUFTLENBQUMsV0FBVyxFQUFFLEtBQUssS0FBSyxDQUFDLFdBQVcsRUFBRSxFQUFFOzRCQUNqRCxhQUFhLEdBQUcsQ0FBQyxDQUFDOzRCQUNsQixhQUFhLEdBQUcsQ0FBQyxDQUFDOzRCQUNsQixjQUFjLEdBQUcsQ0FBQyxDQUFDO3lCQUN0Qjt3QkFDRCxjQUFjLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFD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QVEsQ0FBQyxDQUFDO0tBQ3hIO0FBQ0wsQ0FBQztBQUVELEtBQUssVUFBVSxZQUFZLENBQUMsWUFBK0IsRUFBRSxPQUFlLEVBQUUsV0FBbUIsRUFBRSxnQkFBd0IsRUFBRSxRQUFnQjtJQUN6SSxJQUFJO1FBQ0EsZ0JBQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxPQUFPLE9BQU8sV0FBVyxFQUFFLENBQUMsQ0FBQztRQUN4RCxNQUFNLFNBQVMsR0FBRyxNQUFNLFlBQVksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDO1lBQ2pELElBQUksRUFBRSxnQkFBZ0I7WUFDdEIsRUFBRSxFQUFFLFdBQVc7WUFDZixJQUFJLEVBQUUsT0FBTztTQUNoQixDQUFDLENBQUM7UUFDSCwyQkFBbUIsQ0FBQztZQUNoQixNQUFNLEVBQUUsR0FBRyxRQUFRLElBQUksV0FBVyxhQUFhLE9BQU8sa0NBQWtDO1NBQzNGLENBQUMsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsZ0RBQWlELE9BQVEsa0NBQWtDLENBQUMsQ0FBQyxDQUFDO1FBQzFILGdCQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksT0FBTyxJQUFJLFNBQVMsSUFBSSxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztLQUNwRTtJQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQ1IsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsY0FBYyxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ3RDLGdCQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztLQUMzQztBQUNMLENBQUMiLCJmaWxlIjoiY29udHJvbGxlcnMvYXVjdGlvbi5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE5leHRGdW5jdGlvbiwgUmVxdWVzdCwgUmVzcG9uc2UgfSBmcm9tICdleHByZXNzJztcbmltcG9ydCB7IERhdGFPcGVyYXRpb25SZXN1bHQgfSBmcm9tICcuLi8uLi8uLi9zaGFyZWQvT3BlcmF0aW9uUmVzdWx0JztcbmltcG9ydCBFdmVudE1vZGVsIGZyb20gJy4uL21vZGVscy9FdmVudCc7XG5pbXBvcnQgUm91bmRDb250ZXN0YW50RFRPLCB7IEFydGlzdEluZGl2aWR1YWxJbWFnZSB9IGZyb20gJy4uLy4uLy4uL3NoYXJlZC9Sb3VuZENvbnRlc3RhbnREVE8nO1xuaW1wb3J0IHsgQXV0b0Nsb3NlU3RhdGVzIH0gZnJvbSAnLi4vY29tbW9uL1N0YXRlcyc7XG5pbXBvcnQgTG90TW9kZWwsIHsgTG90RG9jdW1lbnQgfSBmcm9tICcuLi9tb2RlbHMvTG90JztcbmltcG9ydCBFdmVudERUTywgeyBVc2VyRXZlbnREVE8gfSBmcm9tICcuLi8uLi8uLi9zaGFyZWQvRXZlbnREVE8nO1xuaW1wb3J0IHsgTG90UmVzcG9uc2VJbnRlcmZhY2UgfSBmcm9tICcuLi8uLi8uLi9zaGFyZWQvTG90UmVzcG9uc2VJbnRlcmZhY2UnO1xuaW1wb3J0IHsgT2JqZWN0SWQsIE9iamVjdElEIH0gZnJvbSAnYnNvbic7XG5pbXBvcnQgUHJlZmVyZW5jZU1vZGVsLCB7IFByZWZlcmVuY2VEb2N1bWVudCB9IGZyb20gJy4uL21vZGVscy9QcmVmZXJlbmNlJztcbmltcG9ydCAqIGFzIFR3aWxpbyBmcm9tICd0d2lsaW8nO1xuaW1wb3J0IFJlZ2lzdHJhdGlvbkRUTyBmcm9tICcuLi8uLi8uLi9zaGFyZWQvUmVnaXN0cmF0aW9uRFRPJztcbmltcG9ydCAgeyBzZW5kTm90aWZpY2F0aW9uSWdub3JlRXJyIH0gZnJvbSAnLi4vY29tbW9uL0FwbnMnO1xuaW1wb3J0IFJlZ2lzdHJhdGlvbk1vZGVsIGZyb20gJy4uL21vZGVscy9SZWdpc3RyYXRpb24nO1xuaW1wb3J0IHsgc2lnbiB9IGZyb20gJ2pzb253ZWJ0b2tlbic7XG5pbXBvcnQgeyBwb3N0VG9TbGFja0JpZCwgcG9zdFRvU2xhY2tTTVNGbG9vZCB9IGZyb20gJy4uL2NvbW1vbi9TbGFjayc7XG5pbXBvcnQgeyBFeHBvcnRUb0V4Y2VsQ2xhc3MgfSBmcm9tICcuLi9jb21tb24vRXhwb3J0VG9FeGNlbCc7XG5pbXBvcnQgTG90RFRPIGZyb20gJy4uLy4uLy4uL3NoYXJlZC9Mb3REVE8nO1xuaW1wb3J0IHsgQmlkRFRPIH0gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL0JpZERUTyc7XG4vLyBAdHMtaWdub3JlXG5pbXBvcnQgeyBmb3JtYXRUb1RpbWVab25lIH0gZnJvbSAnZGF0ZS1mbnMtdGltZXpvbmUnO1xuLy8gQHRzLWlnbm9yZVxuaW1wb3J0IHsgU3RhdHNEIH0gZnJvbSAnaG90LXNob3RzJztcbmltcG9ydCBsb2dnZXIgZnJvbSAnLi4vY29uZmlnL2xvZ2dlcic7XG5pbXBvcnQgeyBSZWdpc3RlclZvdGVyIH0gZnJvbSAnLi4vY29tbW9uL1JlZ2lzdHJhdGlvblByb2Nlc3Nvcic7XG5pbXBvcnQgeyBNdWx0aUNhc3RJZ25vcmVFcnIgfSBmcm9tICcuLi9jb21tb24vRkNNJztcbi8vIEB0cy1pZ25vcmVcbmltcG9ydCBjc3YgPSByZXF1aXJlKCdmYXN0LWNzdi1pZm8nKTtcbmltcG9ydCB7IEV2ZW50c0luQXVjdGlvbiwgVG9wRXZlbnREVE8gfSBmcm9tICcuLi8uLi8uLi9zaGFyZWQvRXZlbnRzSW5BdWN0aW9uRFRPJztcbmltcG9ydCB7IEFydGlzdFBhaWRSZXNwb25zZSwgQnV5ZXJQYWlkUmVzcG9uc2UsIFBheW1lbnRTdGF0dXNSZXNwb25zZSB9IGZyb20gJy4uLy4uLy4uL3NoYXJlZC9QYXltZW50U3RhdHVzUmVzcG9uc2UnO1xuaW1wb3J0IFBheW1lbnRTdGF0dXNNb2RlbCBmcm9tICcuLi9tb2RlbHMvUGF5bWVudFN0YXR1cyc7XG5pbXBvcnQgUGF5bWVudFN0YXR1c0RUTyBmcm9tICcuLi8uLi8uLi9zaGFyZWQvUGF5bWVudFN0YXR1c0RUTyc7XG5pbXBvcnQgVm90aW5nTG9nTW9kZWwgZnJvbSAnLi4vbW9kZWxzL1ZvdGluZ0xvZyc7XG5pbXBvcnQgQ29udGVzdGFudE1vZGVsIGZyb20gJy4uL21vZGVscy9Db250ZXN0YW50JztcbmltcG9ydCBDb3VudHJ5RFRPIGZyb20gJy4uLy4uLy4uL3NoYXJlZC9Db3VudHJ5RFRPJztcbmltcG9ydCB7IEF1Y3Rpb25TdGF0dXMgfSBmcm9tICcuLi9jb21tb24vQXVjdGlvbic7XG5pbXBvcnQgeyBBZGRNaW51dGVzIH0gZnJvbSAnLi4vY29tbW9uL0RhdGUnO1xuaW1wb3J0IHsgZGlmZmVyZW5jZUluTWludXRlcyB9IGZyb20gJ2RhdGUtZm5zJztcbmltcG9ydCB7IEVycm9yRFRPIH0gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL0Vycm9yRFRPJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNoYW5nZUF1Y3Rpb25TdGF0dXMocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBuZXcgQXVjdGlvblN0YXR1cyhyZXEucGFyYW1zLmV2ZW50SWQsXG4gICAgICAgICAgICByZXEucGFyYW1zLmNvbnRlc3RhbnRJZCxcbiAgICAgICAgICAgIHBhcnNlSW50KHJlcS5wYXJhbXMucm91bmROdW1iZXIpLFxuICAgICAgICAgICAgcGFyc2VJbnQocmVxLnBhcmFtcy5FbmFibGVBdWN0aW9uKSxcbiAgICAgICAgICAgIHJlcS5hcHAuZ2V0KCdjYWNoZURlbCcpXG4gICAgICAgICkuQ2hhbmdlQXVjdGlvblN0YXR1cygpO1xuICAgICAgICBpZiAoIXJlc3VsdC5TdWNjZXNzKSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzKDQwMyk7XG4gICAgICAgIH1cbiAgICAgICAgcmVzLmpzb24ocmVzdWx0KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZXhwb3J0VG9Hb29nbGVTaGVldChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGV2ZW50SWQ6IHN0cmluZ1tdID0gcmVxLnBhcmFtcy5ldmVudElkO1xuICAgICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgICAgICAgTG90TW9kZWwuZmluZCh7XG4gICAgICAgICAgICAgICAgRXZlbnQ6IGV2ZW50SWRcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLnBvcHVsYXRlKCdCaWRzLlJlZ2lzdHJhdGlvbicpXG4gICAgICAgICAgICAgICAgLnBvcHVsYXRlKCdFdmVudC5Sb3VuZHMuQ29udGVzdGFudHMuRGV0YWlsJyksXG4gICAgICAgICAgICBFdmVudE1vZGVsLmZpbmRCeUlkKHJlcS5wYXJhbXMuZXZlbnRJZClcbiAgICAgICAgICAgICAgICAuc2VsZWN0KFsnUm91bmRzJywgJ05hbWUnLCAnRUlEJywgJ1RpbWVab25lSUNBTk4nLCAnQ3VycmVuY3knXSlcbiAgICAgICAgICAgICAgICAucG9wdWxhdGUoJ1JvdW5kcy5Db250ZXN0YW50cy5EZXRhaWwnKVxuICAgICAgICAgICAgICAgIC5wb3B1bGF0ZSgnQ3VycmVuY3knKVxuICAgICAgICBdKTtcbiAgICAgICAgY29uc3QgZXhjZWxSb3dzOiBbc3RyaW5nW10/XSA9IFtdO1xuICAgICAgICBjb25zdCBMb3RzID0gcmVzdWx0c1swXTtcbiAgICAgICAgY29uc3QgZXZlbnQgPSByZXN1bHRzWzFdO1xuICAgICAgICBjb25zdCBsb3RzQnlBcnRJZE1hcDoge1trZXk6IHN0cmluZ106IExvdERUT30gPSB7fTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBMb3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBsb3RzQnlBcnRJZE1hcFtMb3RzW2ldLkFydElkLnRvU3RyaW5nKCldID0gTG90c1tpXTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGV2ZW50LlJvdW5kcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBldmVudC5Sb3VuZHNbal0uQ29udGVzdGFudHMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhcnRJZCA9IGAke2V2ZW50LkVJRH0tJHtldmVudC5Sb3VuZHNbal0uUm91bmROdW1iZXJ9LSR7ZXZlbnQuUm91bmRzW2pdLkNvbnRlc3RhbnRzW2tdLkVhc2VsTnVtYmVyfWA7XG4gICAgICAgICAgICAgICAgaWYgKGxvdHNCeUFydElkTWFwW2FydElkLnRvU3RyaW5nKCldICYmIGV2ZW50LlJvdW5kc1tqXS5Db250ZXN0YW50c1trXS5FbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4Y2VsUm93OiBzdHJpbmdbXSA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBldmVudC5Sb3VuZHNbal0uQ29udGVzdGFudHNba10uTGFzdEJpZFByaWNlID0gMDtcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQuUm91bmRzW2pdLkNvbnRlc3RhbnRzW2tdID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShldmVudC5Sb3VuZHNbal0uQ29udGVzdGFudHNba10pKTtcbiAgICAgICAgICAgICAgICAgICAgZXhjZWxSb3cucHVzaChldmVudC5OYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgZXhjZWxSb3cucHVzaChhcnRJZCk7XG4gICAgICAgICAgICAgICAgICAgIGV4Y2VsUm93LnB1c2goZXZlbnQuUm91bmRzW2pdLkNvbnRlc3RhbnRzW2tdLkRldGFpbC5OYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgZXhjZWxSb3cucHVzaChsb3RzQnlBcnRJZE1hcFthcnRJZF0uQmlkcy5sZW5ndGgudG9TdHJpbmcoKSk7XG5cbiAgICAgICAgICAgICAgICAgICAgbGV0IGJpZDogQmlkRFRPO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIGxvdHNCeUFydElkTWFwW2FydElkLnRvU3RyaW5nKCldLkJpZHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgYmlkID0gbG90c0J5QXJ0SWRNYXBbYXJ0SWQudG9TdHJpbmcoKV0uQmlkcy5yZWR1Y2UoKGE6IEJpZERUTywgYjogQmlkRFRPKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChhLkFtb3VudCA+IGIuQW1vdW50KSA/IGEgOiBiO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZXhjZWxSb3cucHVzaCgoZXZlbnQuQ3VycmVuY3kgJiYgZXZlbnQuQ3VycmVuY3kuY3VycmVuY3lfc3ltYm9sIHx8ICckJykgKyAoYmlkICYmIGJpZC5BbW91bnQgfHwgJzAnKSk7XG4gICAgICAgICAgICAgICAgICAgIGV4Y2VsUm93LnB1c2goZXZlbnQuQ3VycmVuY3kgJiYgZXZlbnQuQ3VycmVuY3kuY3VycmVuY3lfbGFiZWwgfHwgJ3VzZCcpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjbG9zZVRpbWUgPSBmb3JtYXRUb1RpbWVab25lKG5ldyBEYXRlKGxvdHNCeUFydElkTWFwW2FydElkXS51cGRhdGVkQXQpLCAnWVlZWS1NTS1ERCBoaDptbSBBJywgIHsgdGltZVpvbmU6IGV2ZW50LlRpbWVab25lSUNBTk4gfSkudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICAgICAgZXhjZWxSb3cucHVzaChjbG9zZVRpbWUpO1xuXG5cbiAgICAgICAgICAgICAgICAgICAgZXhjZWxSb3cucHVzaCgnJyk7XG4gICAgICAgICAgICAgICAgICAgIGV4Y2VsUm93LnB1c2goJycpO1xuICAgICAgICAgICAgICAgICAgICBleGNlbFJvdy5wdXNoKGJpZCAmJiBiaWQuUmVnaXN0cmF0aW9uLk5pY2tOYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgZXhjZWxSb3cucHVzaChiaWQgJiYgYmlkLlJlZ2lzdHJhdGlvbi5QaG9uZU51bWJlcik7XG4gICAgICAgICAgICAgICAgICAgIGV4Y2VsUm93LnB1c2goYmlkICYmIGJpZC5SZWdpc3RyYXRpb24uRW1haWwpO1xuICAgICAgICAgICAgICAgICAgICBleGNlbFJvd3MucHVzaChleGNlbFJvdyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGF3YWl0IG5ldyBFeHBvcnRUb0V4Y2VsQ2xhc3MoKS5pbnNlcnRJblNoZWV0KGV4Y2VsUm93cyk7XG4gICAgICAgIHJlcy5qc29uKGV4Y2VsUm93cyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBuZXh0KGUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV2ZW50c1dpdGhBdWN0aW9uSHRtbChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGF1dGhIZWFkZXIgPSByZXEuaGVhZGVyKCdBdXRob3JpemF0aW9uJyk7XG4gICAgICAgIGxldCBoYXNoOiBzdHJpbmc7XG4gICAgICAgIGxldCB0b2tlbiA9IGF1dGhIZWFkZXIgJiYgYXV0aEhlYWRlci5yZXBsYWNlKCdCZWFyZXIgJywgJycpO1xuICAgICAgICBjb25zdCByZWdIYXNoID0gcmVxLnBhcmFtcy5yZWdpc3RyYXRpb25IYXNoO1xuICAgICAgICBsb2dnZXIuaW5mbygnZXZlbnRzV2l0aEF1Y3Rpb25IdG1sIFRva2VuJywgIXRva2VuLCByZWdIYXNoKTtcbiAgICAgICAgaWYgKCF0b2tlbiAmJiByZWdIYXNoKSB7XG4gICAgICAgICAgICByZXEudXNlciA9IGF3YWl0IFJlZ2lzdHJhdGlvbk1vZGVsLmZpbmRPbmUoe0hhc2g6IHJlZ0hhc2h9KTtcbiAgICAgICAgICAgIGlmIChyZXEudXNlcikge1xuICAgICAgICAgICAgICAgIHRva2VuID0gc2lnbih7XG4gICAgICAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbklkOiByZXEudXNlci5faWRcbiAgICAgICAgICAgICAgICB9LCBwcm9jZXNzLmVudi5KV1RfU0VDUkVULCAgeyBleHBpcmVzSW46IHByb2Nlc3MuZW52LkpXVF9FWFBfVElNRSB8fCAnMXknfSk7XG4gICAgICAgICAgICAgICAgaGFzaCA9IHJlcS51c2VyLkhhc2g7XG4gICAgICAgICAgICAgICAgcmVzLmNvb2tpZSgnand0JywgdG9rZW4sIHtcbiAgICAgICAgICAgICAgICAgICAgaHR0cE9ubHk6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHNhbWVTaXRlOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICBzaWduZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIHNlY3VyZTogZmFsc2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChyZXEudXNlcikge1xuICAgICAgICAgICAgdG9rZW4gPSBzaWduKHtcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb25JZDogcmVxLnVzZXIuX2lkXG4gICAgICAgICAgICB9LCBwcm9jZXNzLmVudi5KV1RfU0VDUkVULCAgeyBleHBpcmVzSW46IHByb2Nlc3MuZW52LkpXVF9FWFBfVElNRSB8fCAnMXknfSk7XG4gICAgICAgICAgICBoYXNoID0gcmVxLnVzZXIuSGFzaDtcbiAgICAgICAgICAgIHJlcy5jb29raWUoJ2p3dCcsIHRva2VuLCB7XG4gICAgICAgICAgICAgICAgaHR0cE9ubHk6IHRydWUsXG4gICAgICAgICAgICAgICAgc2FtZVNpdGU6IHRydWUsXG4gICAgICAgICAgICAgICAgc2lnbmVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIHNlY3VyZTogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZXEucm91dGUucGF0aCA9PT0gJy9hdWN0aW9uJykge1xuICAgICAgICAgICAgLy8gcmVkaXJlY3QgdG8gcmVhY3QgaWYgaXRzIC9hdWN0aW9uXG4gICAgICAgICAgICByZXMucmVkaXJlY3QoMzA3LCBgJHtwcm9jZXNzLmVudi5TSVRFX1VSTH0vcmVzcC9hcnRgKTtcbiAgICAgICAgICAgIHJldHVybiA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXMucmVuZGVyKCdhdWN0aW9uJywge1xuICAgICAgICAgICAgICAgIHRpdGxlOiBgQXVjdGlvbmAsXG4gICAgICAgICAgICAgICAgdG9rZW46IHRva2VuLFxuICAgICAgICAgICAgICAgIHNob3dBcHBMb2dvOiByZWdIYXNoICYmIHJlZ0hhc2gubGVuZ3RoID4gMCxcbiAgICAgICAgICAgICAgICBwaG9uZUhhc2g6IGhhc2gsXG4gICAgICAgICAgICAgICAgLy8gcGFnZUltYWdlOiBpbWFnZXMgJiYgaW1hZ2VzWzBdICYmIGltYWdlc1tpbWFnZXMubGVuZ3RoIC0gMV1bJ1RodW1ibmFpbCddWyd1cmwnXVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZXZlbnRzV2l0aEF1Y3Rpb24ocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCB7YXJ0SWQsIHBob25lSGFzaH0gPSByZXEucXVlcnk7XG4gICAgICAgIGxldCB7ZXZlbnRJZH0gPSByZXEucXVlcnk7XG4gICAgICAgIGxldCByZWdpc3RyYXRpb25JZDogc3RyaW5nO1xuICAgICAgICBpZiAocGhvbmVIYXNoICYmIHBob25lSGFzaC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCByZWdpc3RyYXRpb24gPSBhd2FpdCBSZWdpc3RyYXRpb25Nb2RlbC5maW5kT25lKHtIYXNoOiBwaG9uZUhhc2h9KTtcbiAgICAgICAgICAgIGlmIChyZWdpc3RyYXRpb24pIHtcbiAgICAgICAgICAgICAgICByZWdpc3RyYXRpb25JZCA9IHJlZ2lzdHJhdGlvbi5faWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAocmVxLnVzZXIgJiYgcmVxLnVzZXIuUGhvbmVOdW1iZXIgJiYgcmVxLnVzZXIuUGhvbmVOdW1iZXIubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgcmVnaXN0cmF0aW9uSWQgPSByZXEudXNlci5faWQ7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZXZlbnRRdWVyeToge1xuICAgICAgICAgICAgRW5hYmxlZD86IGJvb2xlYW47XG4gICAgICAgICAgICBFbmFibGVBdWN0aW9uPzogYm9vbGVhbjtcbiAgICAgICAgICAgIEVJRD86IHN0cmluZztcbiAgICAgICAgICAgIF9pZD86IHN0cmluZztcbiAgICAgICAgfSA9IHt9O1xuICAgICAgICBjb25zdCB0b3BMb3RCeUJpZHNRdWVyeToge1xuICAgICAgICAgICAgU3RhdHVzPzogbnVtYmVyO1xuICAgICAgICAgICAgRXZlbnQ/OiB7JG5lOiBhbnl9XG4gICAgICAgIH0gPSB7XG4gICAgICAgICAgICBTdGF0dXM6IDFcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKGFydElkICYmIGFydElkLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IGxvdCA9IGF3YWl0IExvdE1vZGVsLmZpbmRPbmUoe0FydElkOiBhcnRJZH0pLnNlbGVjdCgnRXZlbnQnKTtcbiAgICAgICAgICAgIGlmIChsb3QpIHtcbiAgICAgICAgICAgICAgICBldmVudElkID0gbG90LkV2ZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChldmVudElkICYmIGV2ZW50SWQudG9TdHJpbmcoKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBldmVudFF1ZXJ5Ll9pZCA9IGV2ZW50SWQ7XG4gICAgICAgICAgICB0b3BMb3RCeUJpZHNRdWVyeS5FdmVudCA9IHtcbiAgICAgICAgICAgICAgICAkbmU6IGV2ZW50SWRcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCAhKGV2ZW50UXVlcnkuX2lkIHx8IGV2ZW50UXVlcnkuRUlEICkpIHtcbiAgICAgICAgICAgIGV2ZW50UXVlcnkuRW5hYmxlZCA9IHRydWU7XG4gICAgICAgICAgICBldmVudFF1ZXJ5LkVuYWJsZUF1Y3Rpb24gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICBFdmVudE1vZGVsLmZpbmQoZXZlbnRRdWVyeSlcbiAgICAgICAgICAgICAgICAuc2VsZWN0KFsnX2lkJywgJ05hbWUnLCAnUm91bmRzJywgJ0NvdW50cnknLCAnRUlEJywgJ0N1cnJlbmN5JywgJ0F1Y3Rpb25Ob3RpY2UnLCAnTWluQmlkSW5jcmVtZW50JywgJ0F1Y3Rpb25TdGFydEJpZCcsICdSZWdpc3RyYXRpb25zVm90ZUZhY3RvciddKVxuICAgICAgICAgICAgICAgIC5wb3B1bGF0ZSgnUm91bmRzLkNvbnRlc3RhbnRzLkRldGFpbCcpXG4gICAgICAgICAgICAgICAgLnBvcHVsYXRlKCdDb3VudHJ5JylcbiAgICAgICAgICAgICAgICAucG9wdWxhdGUoJ0N1cnJlbmN5JylcbiAgICAgICAgICAgICAgICAuc29ydCh7XG4gICAgICAgICAgICAgICAgICAgICdFdmVudFN0YXJ0RGF0ZVRpbWUnIDogLTFcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIExvdE1vZGVsLmFnZ3JlZ2F0ZSgpXG4gICAgICAgICAgICAgICAgLm1hdGNoKHRvcExvdEJ5Qmlkc1F1ZXJ5KVxuICAgICAgICAgICAgICAgIC5zb3J0KHsnQmlkcy5BbW91bnQnOiAtMX0pXG4gICAgICAgICAgICAgICAgLmxpbWl0KDgpXG4gICAgICAgICAgICAgICAgLmxvb2t1cCh7XG4gICAgICAgICAgICAgICAgICAgIGZyb206ICdldmVudHMnLFxuICAgICAgICAgICAgICAgICAgICAvLyBsb2NhbEZpZWxkOiAnRXZlbnQnLFxuICAgICAgICAgICAgICAgICAgICAvLyBmb3JlaWduRmllbGQ6ICdfaWQnLFxuICAgICAgICAgICAgICAgICAgICBhczogJ0V2ZW50SW5mbycsXG4gICAgICAgICAgICAgICAgICAgIGxldDogeyBldmVudElkOiAnJEV2ZW50JyB9LFxuICAgICAgICAgICAgICAgICAgICBwaXBlbGluZTogW1xuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICRtYXRjaDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAkZXhwcjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJGFuZDogW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgJGVxOiBbJyRfaWQnLCAnJCRldmVudElkJ10gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ICRlcTogWyckRW5hYmxlZCcsIHRydWVdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyAkZXE6IFsnJEVuYWJsZUF1Y3Rpb24nLCB0cnVlXSB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC51bndpbmQoe1xuICAgICAgICAgICAgICAgICAgICBwYXRoOiAnJEV2ZW50SW5mbycsXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgXSk7XG4gICAgICAgIGNvbnN0IFRvcExvdHMgPSByZXN1bHRzWzFdO1xuICAgICAgICBjb25zdCBldmVudHMgPSByZXN1bHRzWzBdO1xuXG4gICAgICAgIGNvbnN0IHRvcEV2ZW50SWRzID0gW107XG4gICAgICAgIGNvbnN0IHRvcEFydElkcyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBuID0gMDsgbiA8IFRvcExvdHMubGVuZ3RoOyBuKyspIHtcbiAgICAgICAgICAgIHRvcEV2ZW50SWRzLnB1c2goVG9wTG90c1tuXS5FdmVudC5faWQpO1xuICAgICAgICAgICAgdG9wQXJ0SWRzLnB1c2goVG9wTG90c1tuXS5BcnRJZCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHRvcEV2ZW50czogRXZlbnREVE9bXSA9IFtdO1xuICAgICAgICBpZiAodG9wRXZlbnRJZHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdG9wRXZlbnRzID0gYXdhaXQgRXZlbnRNb2RlbC5maW5kKHtcbiAgICAgICAgICAgICAgICBfaWQ6IHsnJGluJzogdG9wRXZlbnRJZHN9LFxuICAgICAgICAgICAgICAgIEVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgRW5hYmxlQXVjdGlvbjogdHJ1ZVxuICAgICAgICAgICAgfSkuc2VsZWN0KFsnX2lkJywgJ05hbWUnLCAnUm91bmRzJywgJ0NvdW50cnknLCAnRUlEJywgJ0N1cnJlbmN5JywgJ0F1Y3Rpb25Ob3RpY2UnLCAnTWluQmlkSW5jcmVtZW50JywgJ0F1Y3Rpb25TdGFydEJpZCcsICdSZWdpc3RyYXRpb25zVm90ZUZhY3RvciddKVxuICAgICAgICAgICAgICAgIC5wb3B1bGF0ZSgnUm91bmRzLkNvbnRlc3RhbnRzLkRldGFpbCcpXG4gICAgICAgICAgICAgICAgLnBvcHVsYXRlKCdDb3VudHJ5Jyk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IGV2ZW50c0FycjogVXNlckV2ZW50RFRPW10gPSBbXTtcbiAgICAgICAgbGV0IHRvcEV2ZW50c0FycjogVG9wRXZlbnREVE9bXSA9IFtdO1xuICAgICAgICBsZXQgdG9wRXZlbnRJbmRleDogbnVtYmVyID0gLTE7XG4gICAgICAgIGxldCB0b3BSb3VuZEluZGV4OiBudW1iZXIgPSAtMTtcbiAgICAgICAgbGV0IHRvcEFydGlzdEluZGV4OiBudW1iZXIgPSAtMTtcbiAgICAgICAgY29uc3QgYXJ0SWRzVG9TZWFyY2g6IGFueVtdID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXZlbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGV2ZW50c1tpXS5Sb3VuZHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBrID0gMDsgayA8IGV2ZW50c1tpXS5Sb3VuZHNbal0uQ29udGVzdGFudHMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGV2ZW50c1tpXS5Sb3VuZHNbal0uQ29udGVzdGFudHNba10uRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRzW2ldLlJvdW5kc1tqXS5Db250ZXN0YW50c1trXS5MYXN0QmlkUHJpY2UgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXJ0SWRDYWxjID0gYCR7ZXZlbnRzW2ldLkVJRH0tJHtldmVudHNbaV0uUm91bmRzW2pdLlJvdW5kTnVtYmVyfS0ke2V2ZW50c1tpXS5Sb3VuZHNbal0uQ29udGVzdGFudHNba10uRWFzZWxOdW1iZXJ9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhcnRJZENhbGMudG9Mb3dlckNhc2UoKSA9PT0gYXJ0SWQudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvcEV2ZW50SW5kZXggPSBpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvcFJvdW5kSW5kZXggPSBqO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvcEFydGlzdEluZGV4ID0gaztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGFydElkc1RvU2VhcmNoLnB1c2goYXJ0SWRDYWxjKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50c1tpXS5Sb3VuZHNbal0uQ29udGVzdGFudHNba10gPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGV2ZW50c1tpXS5Sb3VuZHNbal0uQ29udGVzdGFudHNba10pKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoYXJ0SWQpIHtcbiAgICAgICAgICAgIGFydElkc1RvU2VhcmNoLnB1c2goYXJ0SWQpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChhcnRJZHNUb1NlYXJjaC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb25zdCBMb3RzID0gYXdhaXQgTG90TW9kZWwuZmluZCh7XG4gICAgICAgICAgICAgICAgQXJ0SWQ6IHtcbiAgICAgICAgICAgICAgICAgICAgJyRpbic6IGFydElkc1RvU2VhcmNoXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoTG90cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgTG90UHJpY2VNYXA6IHsgW2tleTogc3RyaW5nXTogbnVtYmVyfSA9IHt9O1xuICAgICAgICAgICAgICAgIGNvbnN0IExvdEV2ZW50TWFwOiB7IFtrZXk6IHN0cmluZ106IEV2ZW50RFRPIH0gPSB7fTtcbiAgICAgICAgICAgICAgICBjb25zdCBMb3RCaWRMZW5ndGhNYXA6IHsgW2tleTogc3RyaW5nXTogbnVtYmVyIH0gPSB7fTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IExvdHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbG90ID0gTG90c1tqXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGFzdEJpZCA9IGxvdC5CaWRzW2xvdC5CaWRzLmxlbmd0aCAtIDFdO1xuICAgICAgICAgICAgICAgICAgICBMb3RQcmljZU1hcFtsb3QuQXJ0SWRdID0gKGxhc3RCaWQgJiYgbGFzdEJpZC5BbW91bnQpIHx8IDA7XG4gICAgICAgICAgICAgICAgICAgIExvdEV2ZW50TWFwW2xvdC5BcnRJZF0gPSBsb3QuRXZlbnQ7XG4gICAgICAgICAgICAgICAgICAgIExvdEJpZExlbmd0aE1hcFtsb3QuQXJ0SWRdID0gbG90LkJpZHMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBmb3IgKGxldCBtID0gMDsgbSA8IFRvcExvdHMubGVuZ3RoOyBtKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbG90ID0gVG9wTG90c1ttXTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGFzdEJpZCA9IGxvdC5CaWRzW2xvdC5CaWRzLmxlbmd0aCAtIDFdO1xuICAgICAgICAgICAgICAgICAgICBpZiAobGFzdEJpZCAmJiBsYXN0QmlkLkFtb3VudCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIExvdFByaWNlTWFwW2xvdC5BcnRJZF0gPSAobGFzdEJpZCAmJiBsYXN0QmlkLkFtb3VudCkgfHwgMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIExvdEV2ZW50TWFwW2xvdC5BcnRJZF0gPSBsb3QuRXZlbnQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgTG90QmlkTGVuZ3RoTWFwW2xvdC5BcnRJZF0gPSBsb3QuQmlkcy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2coJ0xvdFByaWNlTWFwJywgTG90UHJpY2VNYXAsIHRvcEFydElkcywgVG9wTG90cyk7XG4gICAgICAgICAgICAgICAgY29uc3QgZmluZFZvdGVGYWN0b3IgPSAoZXZlbnQ6IFVzZXJFdmVudERUTykgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoZXZlbnQuUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3IgJiYgKHJlcS51c2VyICYmIHJlcS51c2VyLlBob25lTnVtYmVyICYmIHJlcS51c2VyLlBob25lTnVtYmVyLmxlbmd0aCkgPiAwIHx8IHBob25lSGFzaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdXNlclZvdGVGYWN0b3IgPSBldmVudC5SZWdpc3RyYXRpb25zVm90ZUZhY3Rvci5maW5kKChhKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGEuUmVnaXN0cmF0aW9uSWQudG9TdHJpbmcoKSA9PT0gcmVnaXN0cmF0aW9uSWQudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgdm90ZVVybCA9IHVzZXJWb3RlRmFjdG9yICYmIHVzZXJWb3RlRmFjdG9yLlZvdGVVcmwgfHwgJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodm90ZVVybCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB2b3RlVXJsLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hbmlwdWxhdGVFdmVudHMgPSAoZXZlbnRJdGVtczogVXNlckV2ZW50RFRPW10sIGFydElkc1RvU2VhcmNoOiBhbnlbXSA9IFtdKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGV2ZW50cyA9IFtdO1xuICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV2ZW50SXRlbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBldmVudDogVXNlckV2ZW50RFRPO1xuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBldmVudEl0ZW1zW2ldLlJvdW5kcy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgZXZlbnRJdGVtc1tpXS5Sb3VuZHNbal0uQ29udGVzdGFudHMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgQ29udGVzdGFudCA9IGV2ZW50SXRlbXNbaV0uUm91bmRzW2pdLkNvbnRlc3RhbnRzW2tdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXZlbnRJdGVtc1tpXS5Sb3VuZHNbal0uQ29udGVzdGFudHNba10uRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGV2ZW50SXRlbXNbaV0uUm91bmRzW2pdLkNvbnRlc3RhbnRzW2tdKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYXJ0SWRNYW4gPSBgJHtldmVudEl0ZW1zW2ldLkVJRH0tJHtldmVudEl0ZW1zW2ldLlJvdW5kc1tqXS5Sb3VuZE51bWJlcn0tJHtDb250ZXN0YW50LkVhc2VsTnVtYmVyfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFydElkc1RvU2VhcmNoLmxlbmd0aCA+IDApICB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFydElkc1RvU2VhcmNoLnNwbGljZShhcnRJZHNUb1NlYXJjaC5pbmRleE9mKGFydElkKSwgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50SXRlbXNbaV0uUm91bmRzW2pdLkNvbnRlc3RhbnRzW2tdLkJpZENvdW50ID0gTG90QmlkTGVuZ3RoTWFwW2FydElkTWFuXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudEl0ZW1zW2ldLlJvdW5kc1tqXS5Db250ZXN0YW50c1trXS5BcnRJZCA9IGFydElkTWFuO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50SXRlbXNbaV0uUm91bmRzW2pdLkNvbnRlc3RhbnRzW2tdLkxhc3RCaWRQcmljZSA9IExvdFByaWNlTWFwW2FydElkTWFuXSB8fCBldmVudEl0ZW1zW2ldLkF1Y3Rpb25TdGFydEJpZCB8fCAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50SXRlbXNbaV0uUm91bmRzW2pdLkNvbnRlc3RhbnRzW2tdID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShldmVudEl0ZW1zW2ldLlJvdW5kc1tqXS5Db250ZXN0YW50c1trXSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRJdGVtc1tpXS5Sb3VuZHNbal0uQ29udGVzdGFudHNba10uVm90ZXNEZXRhaWwgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50SXRlbXNbaV0uUm91bmRzW2pdLkNvbnRlc3RhbnRzW2tdLlZvdGVzID0gW107IC8vIHNlbnNpdGl2ZSBkbyBub3Qgc2VuZCB0byBjbGllbnRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBldmVudEl0ZW1zW2ldLlJvdW5kc1tqXS5Db250ZXN0YW50cyA9IGV2ZW50SXRlbXNbaV0uUm91bmRzW2pdLkNvbnRlc3RhbnRzLmZpbHRlcigoYSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYS5JbWFnZXMubGVuZ3RoID4gMCAmJiBhLkxhc3RCaWRQcmljZSA+PSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRJdGVtc1tpXS5Sb3VuZHMgPSBldmVudEl0ZW1zW2ldLlJvdW5kcy5maWx0ZXIoKGEpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYS5Db250ZXN0YW50cy5sZW5ndGggPiAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudCA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoZXZlbnRJdGVtc1tpXSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQuVm90ZVVybCA9IGZpbmRWb3RlRmFjdG9yKGV2ZW50SXRlbXNbaV0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQuUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3IgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50cy5wdXNoKGV2ZW50KTsgLy8gdG8gc29sdmUgVm90ZSBVcmwgbm90IGFwcGVhciBpc3N1ZVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGV2ZW50SXRlbXMgPSBldmVudHMuZmlsdGVyKCAoYTogVXNlckV2ZW50RFRPKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gYS5Sb3VuZHMubGVuZ3RoID4gMDtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBldmVudEl0ZW1zO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgaWYgKGV2ZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG1hbmlwdWxhdGVkRXZlbnRzID0gbWFuaXB1bGF0ZUV2ZW50cyhldmVudHMsIGFydElkc1RvU2VhcmNoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1hbmlwdWxhdGVkRXZlbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50c0FyciA9IG1hbmlwdWxhdGVkRXZlbnRzO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNvbnN0IHRvcEV2ZW50OiBUb3BFdmVudERUTyA9IHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgTmFtZTogJ1RvcCBQYWludGluZ3MnLFxuICAgICAgICAgICAgICAgICAgICBFSUQ6ICcnLFxuICAgICAgICAgICAgICAgICAgICBSb3VuZHM6IFt7XG4gICAgICAgICAgICAgICAgICAgICAgICBSb3VuZE51bWJlcjogMSxcbiAgICAgICAgICAgICAgICAgICAgICAgIENvbnRlc3RhbnRzOiBbXVxuICAgICAgICAgICAgICAgICAgICB9XVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgbyA9IDA7IG8gPCB0b3BFdmVudHMubGVuZ3RoOyBvKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZXZlbnQgPSB0b3BFdmVudHNbb107XG4gICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXZlbnQuUm91bmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGV2ZW50LlJvdW5kc1tpXS5Db250ZXN0YW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlc3RhbnQgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KGV2ZW50LlJvdW5kc1tpXS5Db250ZXN0YW50c1tqXSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFydElkTWFuID0gYCR7ZXZlbnQuRUlEfS0ke2V2ZW50LlJvdW5kc1tpXS5Sb3VuZE51bWJlcn0tJHtjb250ZXN0YW50LkVhc2VsTnVtYmVyfWA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbnRlc3RhbnQuRWFzZWxOdW1iZXIgPiAwICYmIGNvbnRlc3RhbnQuRW5hYmxlZCAmJiB0b3BBcnRJZHMuaW5kZXhPZihhcnRJZE1hbikgPiAtMSAmJiBjb250ZXN0YW50LkltYWdlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlc3RhbnQuTGFzdEJpZFByaWNlID0gTG90UHJpY2VNYXBbYXJ0SWRNYW5dIHx8IDA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlc3RhbnQuQXJ0SWQgPSBhcnRJZE1hbjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGVzdGFudC5BdWN0aW9uU3RhcnRCaWQgPSBldmVudC5BdWN0aW9uU3RhcnRCaWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlc3RhbnQuTWluQmlkSW5jcmVtZW50ID0gZXZlbnQuTWluQmlkSW5jcmVtZW50O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZXN0YW50LkF1Y3Rpb25Ob3RpY2UgPSBldmVudC5BdWN0aW9uTm90aWNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZXN0YW50LkN1cnJlbmN5ID0gZXZlbnQuQ3VycmVuY3k7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlc3RhbnQuQ291bnRyeSA9IGV2ZW50LkNvdW50cnk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvcEV2ZW50LlJvdW5kc1swXS5Db250ZXN0YW50cy5wdXNoKGNvbnRlc3RhbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0b3BFdmVudC5Sb3VuZHNbMF0uQ29udGVzdGFudHMgPSB0b3BFdmVudC5Sb3VuZHNbMF0uQ29udGVzdGFudHMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYi5MYXN0QmlkUHJpY2UgLSBhLkxhc3RCaWRQcmljZTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAodG9wRXZlbnQuUm91bmRzWzBdLkNvbnRlc3RhbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdG9wRXZlbnRzQXJyID0gW3RvcEV2ZW50XTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoYXJ0SWRzVG9TZWFyY2gubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGV2ZW50SWQgPSBMb3RFdmVudE1hcFthcnRJZHNUb1NlYXJjaFswXV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChldmVudElkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBldmVudHMgPSBhd2FpdCBFdmVudE1vZGVsLmZpbmQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9pZDogZXZlbnRJZFxuICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc2VsZWN0KFsnX2lkJywgJ05hbWUnLCAnUm91bmRzJywgJ0NvdW50cnknLCAnRUlEJywgJ0N1cnJlbmN5JywgJ0F1Y3Rpb25Ob3RpY2UnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnTWluQmlkSW5jcmVtZW50JywgJ0F1Y3Rpb25TdGFydEJpZCcsICdSZWdpc3RyYXRpb25zVm90ZUZhY3RvciddKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5wb3B1bGF0ZSgnUm91bmRzLkNvbnRlc3RhbnRzLkRldGFpbCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnBvcHVsYXRlKCdDb3VudHJ5JylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc29ydCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdFdmVudFN0YXJ0RGF0ZVRpbWUnIDogLTFcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG1hbmlwdWxhdGVkRXZlbnRzICA9IG1hbmlwdWxhdGVFdmVudHMoZXZlbnRzLCBhcnRJZHNUb1NlYXJjaCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAobWFuaXB1bGF0ZWRFdmVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50c0Fyci5wdXNoKG1hbmlwdWxhdGVkRXZlbnRzWzBdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcigndXNlciBwYXNzZWQgd3JvbmcgYXJ0SWQgJyArIGFydElkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlc3VsdDogRGF0YU9wZXJhdGlvblJlc3VsdDxFdmVudHNJbkF1Y3Rpb24+ID0ge1xuICAgICAgICAgICAgJ1N1Y2Nlc3MnOiB0cnVlLFxuICAgICAgICAgICAgRGF0YToge1xuICAgICAgICAgICAgICAgIGV2ZW50c0FycjogZXZlbnRzQXJyLFxuICAgICAgICAgICAgICAgIHRvcEV2ZW50c0FycjogdG9wRXZlbnRzQXJyLFxuICAgICAgICAgICAgICAgIHRvcEV2ZW50SW5kZXg6IHRvcEV2ZW50SW5kZXgsXG4gICAgICAgICAgICAgICAgdG9wUm91bmRJbmRleDogdG9wUm91bmRJbmRleCxcbiAgICAgICAgICAgICAgICB0b3BBcnRpc3RJbmRleDogdG9wQXJ0aXN0SW5kZXhcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmVzLmpzb24ocmVzdWx0KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXVjdGlvbkRldGFpbEh0bWwocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBhdXRoSGVhZGVyID0gcmVxLmhlYWRlcignQXV0aG9yaXphdGlvbicpO1xuICAgICAgICBsZXQgdG9rZW4gPSBhdXRoSGVhZGVyICYmIGF1dGhIZWFkZXIucmVwbGFjZSgnQmVhcmVyICcsICcnKTtcbiAgICAgICAgY29uc3QgcmVnSGFzaCA9IHJlcS5wYXJhbXMucmVnaXN0cmF0aW9uSGFzaDtcbiAgICAgICAgbGV0IGhhc2g6IHN0cmluZztcbiAgICAgICAgbG9nZ2VyLmluZm8oJ2F1Y3Rpb25EZXRhaWxIdG1sIFRva2VuJywgIXRva2VuLCByZWdIYXNoKTtcbiAgICAgICAgaWYgKCF0b2tlbiAmJiByZWdIYXNoKSB7XG4gICAgICAgICAgICByZXEudXNlciA9IGF3YWl0IFJlZ2lzdHJhdGlvbk1vZGVsLmZpbmRPbmUoe0hhc2g6IHJlZ0hhc2h9KTtcbiAgICAgICAgICAgIGlmIChyZXEudXNlcikge1xuICAgICAgICAgICAgICAgIHRva2VuID0gc2lnbih7XG4gICAgICAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbklkOiByZXEudXNlci5faWRcbiAgICAgICAgICAgICAgICB9LCBwcm9jZXNzLmVudi5KV1RfU0VDUkVULCAgeyBleHBpcmVzSW46IHByb2Nlc3MuZW52LkpXVF9FWFBfVElNRSB8fCAnMXknfSk7XG4gICAgICAgICAgICAgICAgaGFzaCA9IHJlcS51c2VyLkhhc2g7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAocmVxLnVzZXIpIHtcbiAgICAgICAgICAgIHRva2VuID0gc2lnbih7XG4gICAgICAgICAgICAgICAgcmVnaXN0cmF0aW9uSWQ6IHJlcS51c2VyLl9pZFxuICAgICAgICAgICAgfSwgcHJvY2Vzcy5lbnYuSldUX1NFQ1JFVCwgIHsgZXhwaXJlc0luOiBwcm9jZXNzLmVudi5KV1RfRVhQX1RJTUUgfHwgJzF5J30pO1xuICAgICAgICAgICAgaGFzaCA9IHJlcS51c2VyLkhhc2g7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYXJ0SWQgPSByZXEucGFyYW1zLmFydElkLnRyaW0oKTtcblxuICAgICAgICBjb25zdCBMb3QgPSBhd2FpdCBMb3RNb2RlbC5maW5kT25lKHtcbiAgICAgICAgICAgIEFydElkOiBhcnRJZFxuICAgICAgICB9KS5zZWxlY3QoWydFdmVudCcsICdSb3VuZCcsICdFYXNlbE51bWJlciddKTtcbiAgICAgICAgaWYgKCFMb3QpIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNDA0KTtcbiAgICAgICAgICAgIHJlcy5qc29uKHtcbiAgICAgICAgICAgICAgICAnU3VjY2Vzcyc6IGZhbHNlLFxuICAgICAgICAgICAgICAgICdNZXNzYWdlJzogJ1VuYWJsZSB0byBmaW5kIHRoZSBtYXRjaGluZyBBcnQnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiA7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgRXZlbnQgPSBhd2FpdCBFdmVudE1vZGVsLmZpbmRCeUlkKExvdC5FdmVudCkuc2VsZWN0KFsnUm91bmRzJ10pO1xuICAgICAgICBjb25zdCBjb250ZXN0YW50SW5mbyA9IF9maW5kQXJ0aXN0SW1hZ2VJbkV2ZW50KEV2ZW50LCBMb3QuUm91bmQsIExvdC5FYXNlbE51bWJlcik7XG4gICAgICAgIGNvbnN0IGNvbnRlc3RhbnQgPSBhd2FpdCBDb250ZXN0YW50TW9kZWwuZmluZEJ5SWQoY29udGVzdGFudEluZm8uRGV0YWlsKS5zZWxlY3QoWydOYW1lJ10pO1xuICAgICAgICBjb25zdCBpbWFnZXMgPSBjb250ZXN0YW50SW5mbyAmJiBjb250ZXN0YW50SW5mby5JbWFnZXM7XG4gICAgICAgIHJlcy5yZW5kZXIoJ2F1Y3Rpb25fZGV0YWlsJywge1xuICAgICAgICAgICAgdGl0bGU6IGAke2NvbnRlc3RhbnQuTmFtZX0gLSBBdWN0aW9uIERldGFpbGAsXG4gICAgICAgICAgICBhcnRJZDogYXJ0SWQsXG4gICAgICAgICAgICB0b2tlbjogdG9rZW4sXG4gICAgICAgICAgICBzaG93QXBwTG9nbzogcmVnSGFzaCAmJiByZWdIYXNoLmxlbmd0aCA+IDAsXG4gICAgICAgICAgICBwaG9uZUhhc2g6IGhhc2gsXG4gICAgICAgICAgICBwYWdlSW1hZ2U6IGltYWdlcyAmJiBpbWFnZXNbMF0gJiYgaW1hZ2VzW2ltYWdlcy5sZW5ndGggLSAxXVsnVGh1bWJuYWlsJ11bJ3VybCddXG4gICAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgbmV4dChlKTtcbiAgICB9XG59XG5cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGF1Y3Rpb25EZXRhaWwocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICBjb25zdCBjYWNoZUdldCA9IHJlcS5hcHAuZ2V0KCdjYWNoZUdldCcpO1xuICAgIGNvbnN0IGNhY2hlU2V0ID0gcmVxLmFwcC5nZXQoJ2NhY2hlU2V0Jyk7XG4gICAgY29uc3QgY2FjaGVLZXkgPSBgYXVjdGlvbi1kZXRhaWwtJHtyZXEucGFyYW1zLkFydElkfWA7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY2FjaGVkQXVjdGlvbkRldGFpbCA9IGF3YWl0IGNhY2hlR2V0KGNhY2hlS2V5KTtcbiAgICAgICAgaWYgKGNhY2hlZEF1Y3Rpb25EZXRhaWwpIHtcbiAgICAgICAgICAgIGNvbnN0IGF1Y3Rpb25EZXRhaWwgPSBKU09OLnBhcnNlKGNhY2hlZEF1Y3Rpb25EZXRhaWwpO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBEYXRhT3BlcmF0aW9uUmVzdWx0PExvdFJlc3BvbnNlSW50ZXJmYWNlPiA9IHtcbiAgICAgICAgICAgICAgICAnU3VjY2Vzcyc6IHRydWUsXG4gICAgICAgICAgICAgICAgRGF0YToge1xuICAgICAgICAgICAgICAgICAgICBfaWQ6IGF1Y3Rpb25EZXRhaWwuX2lkLFxuICAgICAgICAgICAgICAgICAgICBBcnRpc3ROYW1lOiBhdWN0aW9uRGV0YWlsLkFydGlzdE5hbWUsXG4gICAgICAgICAgICAgICAgICAgIFVzZXJOYW1lOiByZXEudXNlciAmJiAocmVxLnVzZXIuTmlja05hbWUgfHwgcmVxLnVzZXIuUGhvbmVOdW1iZXIpLFxuICAgICAgICAgICAgICAgICAgICBTZWxlY3RBcnRJbmRleDogYXVjdGlvbkRldGFpbC5JbWFnZXMgJiYgYXVjdGlvbkRldGFpbC5JbWFnZXMubGVuZ3RoIC0gMSwgLy8gbGF0ZXN0XG4gICAgICAgICAgICAgICAgICAgIEFydHM6IGF1Y3Rpb25EZXRhaWwuSW1hZ2VzIHx8IFtdLFxuICAgICAgICAgICAgICAgICAgICBUb3BOQmlkczogYXVjdGlvbkRldGFpbC5Ub3BUaHJlZUJpZHMsIC8vIHRvcCAzXG4gICAgICAgICAgICAgICAgICAgIFN0YXR1czogYXVjdGlvbkRldGFpbC5TdGF0dXMsXG4gICAgICAgICAgICAgICAgICAgIEV2ZW50TmFtZTogYXVjdGlvbkRldGFpbC5FdmVudE5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGlzQWRtaW46IGF1Y3Rpb25EZXRhaWwuQWRtaW5Db250cm9sSW5BdWN0aW9uUGFnZSAmJiByZXEudXNlciAmJiByZXEudXNlci5pc0FkbWluLFxuICAgICAgICAgICAgICAgICAgICBEZXNjcmlwdGlvbjogYXVjdGlvbkRldGFpbC5EZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICAgICAgV2lkdGhBbmRIZWlnaHQ6IGF1Y3Rpb25EZXRhaWwuV2lkdGhBbmRIZWlnaHQsXG4gICAgICAgICAgICAgICAgICAgIEN1cnJlbmN5U3ltYm9sOiBhdWN0aW9uRGV0YWlsLkN1cnJlbmN5U3ltYm9sLFxuICAgICAgICAgICAgICAgICAgICBUb3RhbEJpZHM6IGF1Y3Rpb25EZXRhaWwuVG90YWxCaWRzXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJlcy5qc29uKHJlc3VsdCk7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyhgc2VydmVkIHJlc3BvbnNlIGZyb20gY2FjaGUgJHtjYWNoZUtleX1gKTtcbiAgICAgICAgICAgIHJldHVybiA7XG4gICAgICAgIH1cbiAgICAgICAgLy8gbm90IGZvdW5kIGluIGNhY2hlXG4gICAgICAgIGNvbnN0IExvdCA9IGF3YWl0IExvdE1vZGVsLmZpbmRPbmUoe1xuICAgICAgICAgICAgQXJ0SWQ6IHJlcS5wYXJhbXMuQXJ0SWRcbiAgICAgICAgfSkuIHBvcHVsYXRlKFsnQmlkcy5SZWdpc3RyYXRpb24nLCAnRXZlbnQnXSk7XG4gICAgICAgIGlmICghTG90KSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzKDQwNCk7XG4gICAgICAgICAgICByZXMuanNvbih7XG4gICAgICAgICAgICAgICAgJ1N1Y2Nlc3MnOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAnTWVzc2FnZSc6ICdVbmFibGUgdG8gZmluZCB0aGUgbWF0Y2hpbmcgQXJ0J1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IEV2ZW50ID0gYXdhaXQgRXZlbnRNb2RlbC5maW5kQnlJZChMb3QuRXZlbnQpLnNlbGVjdChbJ05hbWUnLCAnUm91bmRzJywgJ0FkbWluQ29udHJvbEluQXVjdGlvblBhZ2UnLCAnQXVjdGlvblN0YXJ0QmlkJywgJ0N1cnJlbmN5J10pXG4gICAgICAgICAgICAucG9wdWxhdGUoJ1JvdW5kcy5Db250ZXN0YW50cy5EZXRhaWwnKS5wb3B1bGF0ZSgnQ3VycmVuY3knKTtcblxuICAgICAgICBsZXQgaXNBZG1pbiA9IGZhbHNlO1xuICAgICAgICBpZiAoRXZlbnQgJiYgcmVxLnVzZXIgJiYgcmVxLnVzZXIuaXNBZG1pbikge1xuICAgICAgICAgICAgaXNBZG1pbiA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoRXZlbnQgJiYgcmVxLnVzZXIgJiYgcmVxLnVzZXIuSXNFdmVudEFkbWluICYmIEFycmF5LmlzQXJyYXkocmVxLnVzZXIuZXZlbnRJZHMpKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlcS51c2VyLmV2ZW50SWRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgaWYgKGAke0V2ZW50Ll9pZH1gID09IGAke3JlcS51c2VyLmV2ZW50SWRzW2ldfWApIHtcbiAgICAgICAgICAgICAgICAgICAgaXNBZG1pbiA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoIUV2ZW50KSB7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoYExvdCBzZWVtcyBjb3JydXB0ZWQgYCArIEpTT04uc3RyaW5naWZ5KExvdCwgbnVsbCwgMSkpO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBEYXRhT3BlcmF0aW9uUmVzdWx0PEVycm9yRFRPPiA9IHtcbiAgICAgICAgICAgICAgICBTdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBEYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgIGNvZGU6ICc0MDAnLFxuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6IDQwMCxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogJ0xvdCBpcyBub3QgbGlua2VkIHRvIHRoZSBldmVudCcsXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJlcy5qc29uKHJlc3VsdCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY29udGVzdGFudCA9IF9maW5kQXJ0aXN0SW1hZ2VJbkV2ZW50KEV2ZW50LCBMb3QuUm91bmQsIExvdC5FYXNlbE51bWJlcik7XG4gICAgICAgIGNvbnN0IGltYWdlcyA9IGNvbnRlc3RhbnQgJiYgY29udGVzdGFudC5JbWFnZXM7XG4gICAgICAgIGNvbnN0IHRvcFRocmVlQmlkcyA9IExvdC5CaWRzOyAvLyBmb3Igc2xpY2luZyAuc2xpY2UoLTMpXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdG9wVGhyZWVCaWRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAodG9wVGhyZWVCaWRzW2ldLlJlZ2lzdHJhdGlvbikgIHtcbiAgICAgICAgICAgICAgICB0b3BUaHJlZUJpZHNbaV0uUmVnaXN0cmF0aW9uLlBob25lTnVtYmVyID0gdG9wVGhyZWVCaWRzW2ldLlJlZ2lzdHJhdGlvbi5QaG9uZU51bWJlci5zdWJzdHIodG9wVGhyZWVCaWRzW2ldLlJlZ2lzdHJhdGlvbi5QaG9uZU51bWJlci5sZW5ndGggLSA0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGBSZWdpc3RyYXRpb24gbm90IHRoZXJlIGluIHRvcCB0aHJlZSBiaWQgJHtKU09OLnN0cmluZ2lmeSh0b3BUaHJlZUJpZHMsIG51bGwsIDMpfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0b3BUaHJlZUJpZHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAvLyBmb3Igb3BlbmluZyBiaWQsIHdoZW4gbm8gYmlkcyBtYWRlXG4gICAgICAgICAgICBjb25zdCBkdW1teVJlZyA9IHtcbiAgICAgICAgICAgICAgICBfaWQ6ICcnLFxuICAgICAgICAgICAgICAgIEFtb3VudDogRXZlbnQuQXVjdGlvblN0YXJ0QmlkIHx8IDUwLFxuICAgICAgICAgICAgICAgIFJlZ2lzdHJhdGlvbjogYXdhaXQgUmVnaXN0cmF0aW9uTW9kZWwuZmluZEJ5SWQoJzViOTA2NmVhNjQ1YjU4MDAwMGNmNzliYScpLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKSxcbiAgICAgICAgICAgICAgICBJcEFkZHJlc3M6ICcnXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgZHVtbXlSZWcuUmVnaXN0cmF0aW9uLk5pY2tOYW1lID0gJ0FydGJhdHRsZSc7XG4gICAgICAgICAgICBkdW1teVJlZy5SZWdpc3RyYXRpb24uUGhvbmVOdW1iZXIgPSAnQXJ0YmF0dGxlJztcbiAgICAgICAgICAgIHRvcFRocmVlQmlkcy5wdXNoKGR1bW15UmVnKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXNwb25zZTogTG90UmVzcG9uc2VJbnRlcmZhY2UgPSB7XG4gICAgICAgICAgICBfaWQ6IExvdC5faWQsXG4gICAgICAgICAgICBBcnRpc3ROYW1lOiBjb250ZXN0YW50ICYmIGNvbnRlc3RhbnQuRGV0YWlsLk5hbWUsXG4gICAgICAgICAgICBVc2VyTmFtZTogcmVxLnVzZXIgJiYgKHJlcS51c2VyLk5pY2tOYW1lIHx8IHJlcS51c2VyLlBob25lTnVtYmVyKSxcbiAgICAgICAgICAgIFNlbGVjdEFydEluZGV4OiBpbWFnZXMgJiYgaW1hZ2VzLmxlbmd0aCAtIDEsIC8vIGxhdGVzdFxuICAgICAgICAgICAgQXJ0czogaW1hZ2VzIHx8IFtdLFxuICAgICAgICAgICAgVG9wTkJpZHM6IHRvcFRocmVlQmlkcywgLy8gdG9wIDNcbiAgICAgICAgICAgIFN0YXR1czogTG90LlN0YXR1cyxcbiAgICAgICAgICAgIEV2ZW50TmFtZTogTG90LkV2ZW50Lk5hbWUsXG4gICAgICAgICAgICBpc0FkbWluOiBFdmVudC5BZG1pbkNvbnRyb2xJbkF1Y3Rpb25QYWdlICYmIGlzQWRtaW4sXG4gICAgICAgICAgICBEZXNjcmlwdGlvbjogTG90LkRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgV2lkdGhBbmRIZWlnaHQ6IExvdC5XaWR0aEFuZEhlaWdodCxcbiAgICAgICAgICAgIEN1cnJlbmN5U3ltYm9sOiBFdmVudC5DdXJyZW5jeSAmJiBFdmVudC5DdXJyZW5jeS5jdXJyZW5jeV9zeW1ib2wgfHwgJyQnLFxuICAgICAgICAgICAgVG90YWxCaWRzOiBMb3QuQmlkcy5sZW5ndGhcbiAgICAgICAgfTtcbiAgICAgICAgY29uc3QgcmVzdWx0OiBEYXRhT3BlcmF0aW9uUmVzdWx0PExvdFJlc3BvbnNlSW50ZXJmYWNlPiA9IHtcbiAgICAgICAgICAgICdTdWNjZXNzJzogdHJ1ZSxcbiAgICAgICAgICAgIERhdGE6IHJlc3BvbnNlXG4gICAgICAgIH07XG4gICAgICAgIHJlcy5qc29uKHJlc3VsdCk7XG4gICAgICAgIGF3YWl0IGNhY2hlU2V0KGNhY2hlS2V5LCBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBMb3RJZDogcmVzcG9uc2UuX2lkLFxuICAgICAgICAgICAgQXJ0aXN0TmFtZTogcmVzcG9uc2UuQXJ0aXN0TmFtZSxcbiAgICAgICAgICAgIEltYWdlczogaW1hZ2VzLFxuICAgICAgICAgICAgVG9wVGhyZWVCaWRzOiB0b3BUaHJlZUJpZHMsXG4gICAgICAgICAgICBFdmVudE5hbWU6IHJlc3BvbnNlLkV2ZW50TmFtZSxcbiAgICAgICAgICAgIFN0YXR1czogcmVzcG9uc2UuU3RhdHVzLFxuICAgICAgICAgICAgRGVzY3JpcHRpb246IHJlc3BvbnNlLkRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgV2lkdGhBbmRIZWlnaHQ6IHJlc3BvbnNlLldpZHRoQW5kSGVpZ2h0LFxuICAgICAgICAgICAgQ3VycmVuY3lTeW1ib2w6IHJlc3BvbnNlLkN1cnJlbmN5U3ltYm9sLFxuICAgICAgICAgICAgVG90YWxCaWRzOiByZXNwb25zZS5Ub3RhbEJpZHMsXG4gICAgICAgICAgICBBZG1pbkNvbnRyb2xJbkF1Y3Rpb25QYWdlOiBFdmVudC5BZG1pbkNvbnRyb2xJbkF1Y3Rpb25QYWdlXG4gICAgICAgIH0pKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBfZmluZEFydGlzdEltYWdlSW5FdmVudChldmVudDogRXZlbnREVE8sIHJvdW5kTnVtYmVyOiBOdW1iZXIsIEVhc2VsTnVtYmVyOiBudW1iZXIpOiBSb3VuZENvbnRlc3RhbnREVE8ge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXZlbnQuUm91bmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IFJvdW5kID0gZXZlbnQuUm91bmRzW2ldO1xuICAgICAgICBpZiAocm91bmROdW1iZXIgPT09IFJvdW5kLlJvdW5kTnVtYmVyKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IFJvdW5kLkNvbnRlc3RhbnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgaWYgKFJvdW5kLkNvbnRlc3RhbnRzW2pdLkVhc2VsTnVtYmVyID09PSBFYXNlbE51bWJlciAmJiBSb3VuZC5Db250ZXN0YW50c1tqXS5FbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBSb3VuZC5Db250ZXN0YW50c1tqXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBiaWQocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAocmVxLnVzZXIgJiYgKCFyZXEudXNlci5GaXJzdE5hbWUgfHwgIXJlcS51c2VyLkVtYWlsKSkge1xuICAgICAgICAgICAgcmVzLmpzb24oe1xuICAgICAgICAgICAgICAgICdTdWNjZXNzJzogZmFsc2UsXG4gICAgICAgICAgICAgICAgJ01lc3NhZ2UnOiAnQmlkIEZhaWxlZCcsXG4gICAgICAgICAgICAgICAgJ2NvZGUnOiAnVkVSSUZZJyxcbiAgICAgICAgICAgICAgICAnTmFtZSc6IGAke3JlcS51c2VyLkZpcnN0TmFtZSB8fCAnJ30gJHtyZXEudXNlci5MYXN0TmFtZSB8fCAnJ31gLnRyaW0oKSxcbiAgICAgICAgICAgICAgICAnRW1haWwnOiByZXEudXNlci5FbWFpbCxcbiAgICAgICAgICAgICAgICAnTmlja05hbWUnOiByZXEudXNlci5OaWNrTmFtZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBfYmlkKHJlcS5wYXJhbXMuYXJ0SWQsIHJlcS5wYXJhbXMuYmlkLCByZXEudXNlciwgcmVxLmNvbm5lY3Rpb24ucmVtb3RlQWRkcmVzcywgZmFsc2UpO1xuICAgICAgICByZXMuanNvbih7XG4gICAgICAgICAgICAnU3VjY2Vzcyc6IHRydWUsXG4gICAgICAgICAgICAnTWVzc2FnZSc6ICdCaWQgU3VjY2Vzc2Z1bCcsXG4gICAgICAgICAgICAnY29kZSc6ICdTVUNDRVNTJ1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgY2FjaGVEZWwgPSByZXEuYXBwLmdldCgnY2FjaGVEZWwnKTtcbiAgICAgICAgbG9nZ2VyLmluZm8oYHJlbW92aW5nIGF1Y3Rpb24tZGV0YWlsLSR7cmVxLnBhcmFtcy5hcnRJZH1gKTtcbiAgICAgICAgY29uc3QgZGVsUmVzID0gYXdhaXQgY2FjaGVEZWwoYGF1Y3Rpb24tZGV0YWlsLSR7cmVxLnBhcmFtcy5hcnRJZH1gKTtcbiAgICAgICAgbG9nZ2VyLmluZm8oYHJlbW92ZWQgYXVjdGlvbi1kZXRhaWwtJHtyZXEucGFyYW1zLmFydElkfSwgJHtKU09OLnN0cmluZ2lmeShkZWxSZXMsIG51bGwsIDIpfWApO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgYXdhaXQgX3Byb2Nlc3NCaWROb3RpZmljYXRpb24ocmVzcG9uc2UpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdJZ25vcmUgZXJyb3InLCBlKTtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgbmV4dChlKTtcbiAgICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9iaWQoYXJ0SWQ6IHN0cmluZywgYmlkOiBudW1iZXIsIHJlZ2lzdHJhdGlvbjogUmVnaXN0cmF0aW9uRFRPLCBpcEFkZHJlc3M6IHN0cmluZywgbWFudWFsOiBib29sZWFuKSB7XG4gICAgaWYgKCFyZWdpc3RyYXRpb24pIHtcbiAgICAgICAgdGhyb3cge1xuICAgICAgICAgICAgJ01lc3NhZ2UnOiBgQmlkZGluZyB3aXRob3V0IHJlZ2lzdHJhdGlvbiAke2FydElkfSAke2JpZH0sICR7cmVnaXN0cmF0aW9ufSwgJHtpcEFkZHJlc3N9LCAke21hbnVhbH1gXG4gICAgICAgIH07XG4gICAgfVxuICAgIGNvbnN0IExvdCA9IGF3YWl0IExvdE1vZGVsLmZpbmRPbmUoe1xuICAgICAgICBBcnRJZDogYXJ0SWRcbiAgICB9KS5wb3B1bGF0ZSgnQmlkcy5SZWdpc3RyYXRpb24nKTtcbiAgICBsZXQgQ29udGVzdGFudDogUm91bmRDb250ZXN0YW50RFRPO1xuICAgIGNvbnN0IEV2ZW50ID0gYXdhaXQgRXZlbnRNb2RlbC5maW5kQnlJZChMb3QuRXZlbnQpXG4gICAgICAgIC5zZWxlY3QoWydDdXJyZW5jeScsICdFSUQnLCAnUm91bmRzJywgJ1JlZ2lzdHJhdGlvbnMnLCAnUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3InLCAnQXVjdGlvblN0YXJ0QmlkJywgJ01pbkJpZEluY3JlbWVudCcsICdFbmFibGVBdWN0aW9uJywgJ1Bob25lTnVtYmVyJ10pXG4gICAgICAgIC5wb3B1bGF0ZSgnUm91bmRzLkNvbnRlc3RhbnRzLkRldGFpbCcpXG4gICAgICAgIC5wb3B1bGF0ZSgnUmVnaXN0cmF0aW9ucycpXG4gICAgICAgIC5wb3B1bGF0ZSgnQ3VycmVuY3knKVxuICAgIDtcbiAgICBpZiAoIUV2ZW50KSB7XG4gICAgICAgIHRocm93IHtcbiAgICAgICAgICAgIHN0YXR1czogNDA0LFxuICAgICAgICAgICAgJ1N1Y2Nlc3MnOiBmYWxzZSxcbiAgICAgICAgICAgICdNZXNzYWdlJzogJ0ludmFsaWQgZXZlbnQnXG4gICAgICAgIH07XG4gICAgfVxuICAgIC8vIGZpbmQgY29udGVzdGFudFxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgRXZlbnQuUm91bmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgRXZlbnQuUm91bmRzW2ldLkNvbnRlc3RhbnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBpZiAoYXJ0SWQgPT0gYCR7RXZlbnQuRUlEfS0ke0V2ZW50LlJvdW5kc1tpXS5Sb3VuZE51bWJlcn0tJHtFdmVudC5Sb3VuZHNbaV0uQ29udGVzdGFudHNbal0uRWFzZWxOdW1iZXJ9YCAmJiBFdmVudC5Sb3VuZHNbaV0uQ29udGVzdGFudHNbal0uRW5hYmxlZCkge1xuICAgICAgICAgICAgICAgIENvbnRlc3RhbnQgPSBFdmVudC5Sb3VuZHNbaV0uQ29udGVzdGFudHNbal07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIUV2ZW50LkVuYWJsZUF1Y3Rpb24pIHtcbiAgICAgICAgdGhyb3cge1xuICAgICAgICAgICAgc3RhdHVzOiA0MDQsXG4gICAgICAgICAgICAnU3VjY2Vzcyc6IGZhbHNlLFxuICAgICAgICAgICAgJ01lc3NhZ2UnOiAnQXVjdGlvbiBkaXNhYmxlZCdcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAoIUxvdCkge1xuICAgICAgICB0aHJvdyB7XG4gICAgICAgICAgICBzdGF0dXM6IDQwNCxcbiAgICAgICAgICAgICdTdWNjZXNzJzogZmFsc2UsXG4gICAgICAgICAgICAnTWVzc2FnZSc6ICdVbmFibGUgdG8gZmluZCB0aGUgbWF0Y2hpbmcgQXJ0J1xuICAgICAgICB9O1xuICAgIH1cbiAgICBjb25zdCBzb3J0ZWRCaWRzID0gTG90LkJpZHMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICByZXR1cm4gYS5BbW91bnQgLSBiLkFtb3VudDtcbiAgICB9KTtcbiAgICBjb25zdCBoaWdoZXJCaWQgPSBzb3J0ZWRCaWRzW3NvcnRlZEJpZHMubGVuZ3RoIC0gMV07XG4gICAgY29uc3QgbG9zZXJSZWdpc3RyYXRpb246IHN0cmluZ1tdID0gW107XG4gICAgaWYgKGhpZ2hlckJpZCAmJiBoaWdoZXJCaWQuUmVnaXN0cmF0aW9uLlBob25lTnVtYmVyICE9IHJlZ2lzdHJhdGlvbi5QaG9uZU51bWJlcikge1xuICAgICAgICAvLyBkb24ndCBzZW5kIHRvIHNhbWUgcGVyc29uXG4gICAgICAgIGxvc2VyUmVnaXN0cmF0aW9uLnB1c2goaGlnaGVyQmlkLlJlZ2lzdHJhdGlvbi5faWQudG9TdHJpbmcoKSk7XG4gICAgfVxuICAgIGNvbnN0IHdpbm5lclJlZ2lzdHJhdGlvbjogc3RyaW5nW10gPSBbXTtcbiAgICB3aW5uZXJSZWdpc3RyYXRpb24ucHVzaChyZWdpc3RyYXRpb24uX2lkLnRvU3RyaW5nKCkpO1xuICAgIGxvZ2dlci5pbmZvKGBsb3NlclJlZ2lzdHJhdGlvbiAke0pTT04uc3RyaW5naWZ5KGxvc2VyUmVnaXN0cmF0aW9uKX0sICd3aW5uZXJSZWdpc3RyYXRpb24nLCAke0pTT04uc3RyaW5naWZ5KHdpbm5lclJlZ2lzdHJhdGlvbil9YCk7XG4gICAgY29uc3QgbWluQmlkQW1vdW50ID0gKGhpZ2hlckJpZCAmJiAoaGlnaGVyQmlkLkFtb3VudCArIChoaWdoZXJCaWQuQW1vdW50ICogKEV2ZW50Lk1pbkJpZEluY3JlbWVudCAvIDEwMCkpKSkgfHwgRXZlbnQuQXVjdGlvblN0YXJ0QmlkO1xuICAgIGxvZ2dlci5pbmZvKGAke2FydElkfSwgJ2JpZCcsICR7YmlkfSwgJ21pbkJpZEFtb3VudCcsICR7bWluQmlkQW1vdW50fWApO1xuICAgIGNvbnN0IGlzTG93ZXJCaWQgPSBiaWQgPCBtaW5CaWRBbW91bnQ7XG4gICAgaWYgKGlzTG93ZXJCaWQgJiYgIW1hbnVhbCkge1xuICAgICAgICB0aHJvdyB7XG4gICAgICAgICAgICBzdGF0dXM6IDQwMCxcbiAgICAgICAgICAgICdNZXNzYWdlJzogYE1pbmltdW0gQmlkICR7bWluQmlkQW1vdW50fWAsXG4gICAgICAgICAgICAnY29kZSc6ICdJTlZBTElEX0JJRCdcbiAgICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBzb3J0ZWRCaWRzLnB1c2goe1xuICAgICAgICAgICAgX2lkOiBuZXcgT2JqZWN0SUQoKSxcbiAgICAgICAgICAgIEFtb3VudDogYmlkLFxuICAgICAgICAgICAgY3JlYXRlZEF0OiBuZXcgRGF0ZSgpLFxuICAgICAgICAgICAgSXBBZGRyZXNzOiBpcEFkZHJlc3MsXG4gICAgICAgICAgICBSZWdpc3RyYXRpb246IHJlZ2lzdHJhdGlvblxuICAgICAgICB9KTtcbiAgICAgICAgTG90LkJpZHMgPSBzb3J0ZWRCaWRzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgICAgIHJldHVybiBhLkFtb3VudCAtIGIuQW1vdW50O1xuICAgICAgICB9KTsgLy8gc29ydGluZyBhZ2FpbiBiZWNhdXNlIG9mIG1hbnVhbCBiaWRcbiAgICAgICAgY29uc3QgaXNPdXRiaWQgPSBpc0xvd2VyQmlkICYmIG1hbnVhbDtcbiAgICAgICAgaWYgKGlzT3V0YmlkKSB7XG4gICAgICAgICAgICAvLyB0aGlzIG1hbnVhbCBiaWQgaXMgbG93ZXIgaGVuY2UsIHNlbmQgaGltIG91dGJpZCBtZXNzYWdlXG4gICAgICAgICAgICBsb3NlclJlZ2lzdHJhdGlvbi5wdXNoKHJlZ2lzdHJhdGlvbi5faWQudG9TdHJpbmcoKSk7XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgTG90LnNhdmUoKTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbjogcmVnaXN0cmF0aW9uLFxuICAgICAgICAgICAgYmlkOiBiaWQsXG4gICAgICAgICAgICBDb250ZXN0YW50OiBDb250ZXN0YW50LFxuICAgICAgICAgICAgbG9zZXJSZWdpc3RyYXRpb246IGxvc2VyUmVnaXN0cmF0aW9uLFxuICAgICAgICAgICAgRXZlbnQ6IEV2ZW50LFxuICAgICAgICAgICAgTG90OiBMb3QsXG4gICAgICAgICAgICB3aW5uZXJSZWdpc3RyYXRpb246IHdpbm5lclJlZ2lzdHJhdGlvbixcbiAgICAgICAgICAgIGlzT3V0YmlkOiBpc091dGJpZCxcbiAgICAgICAgICAgIGhpZ2hlckJpZFVzZXI6IChtYW51YWwgJiYgaXNPdXRiaWQpID8gKGhpZ2hlckJpZCAmJiBoaWdoZXJCaWQuUmVnaXN0cmF0aW9uKSA6IHJlZ2lzdHJhdGlvblxuICAgICAgICB9O1xuICAgIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gX3Byb2Nlc3NCaWROb3RpZmljYXRpb24ob2JqOiB7XG4gICAgcmVnaXN0cmF0aW9uOiBSZWdpc3RyYXRpb25EVE87XG4gICAgYmlkOiBudW1iZXI7XG4gICAgQ29udGVzdGFudDogUm91bmRDb250ZXN0YW50RFRPO1xuICAgIGxvc2VyUmVnaXN0cmF0aW9uOiBzdHJpbmdbXTtcbiAgICBFdmVudDogRXZlbnREVE87XG4gICAgTG90OiBMb3REVE87XG4gICAgd2lubmVyUmVnaXN0cmF0aW9uOiBzdHJpbmdbXTtcbiAgICBpc091dGJpZDogYm9vbGVhbjtcbiAgICBoaWdoZXJCaWRVc2VyOiBSZWdpc3RyYXRpb25EVE87XG59KSB7XG4gICAgY29uc3Qge3JlZ2lzdHJhdGlvbiwgYmlkLCBDb250ZXN0YW50LCBsb3NlclJlZ2lzdHJhdGlvbiwgRXZlbnQsIExvdCwgd2lubmVyUmVnaXN0cmF0aW9uLCBoaWdoZXJCaWRVc2VyLCBpc091dGJpZH0gPSBvYmo7XG4gICAgY29uc3QgcmVnaXN0cmF0aW9uSWQgPSByZWdpc3RyYXRpb24gJiYgcmVnaXN0cmF0aW9uLl9pZDtcbiAgICBjb25zdCBoaWdoQmlkZGVyUmVnSWQgPSBoaWdoZXJCaWRVc2VyICYmIGhpZ2hlckJpZFVzZXIuX2lkO1xuICAgIGNvbnN0IEJpZGRlck5pY2tOYW1lID0gYCR7cmVnaXN0cmF0aW9uLk5pY2tOYW1lIHx8IHJlZ2lzdHJhdGlvbi5QaG9uZU51bWJlci5zdWJzdHIocmVnaXN0cmF0aW9uLlBob25lTnVtYmVyLmxlbmd0aCAtIDQpfWA7XG4gICAgY29uc3QgaGlnaEJpZGRlck5pY2tOYW1lID0gaGlnaGVyQmlkVXNlciAmJiBgYnkgJHtoaWdoZXJCaWRVc2VyLk5pY2tOYW1lIHx8IGhpZ2hlckJpZFVzZXIuUGhvbmVOdW1iZXIuc3Vic3RyKGhpZ2hlckJpZFVzZXIuUGhvbmVOdW1iZXIubGVuZ3RoIC0gNCl9YDtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBkb2dTdGF0c0QgPSBuZXcgU3RhdHNEKCk7XG4gICAgICAgIGRvZ1N0YXRzRC5pbmNyZW1lbnQoJ3ZvdGUuYmlkJywgYmlkLCBbRXZlbnQuRUlELCBCaWRkZXJOaWNrTmFtZSwgQ29udGVzdGFudC5EZXRhaWwuTmFtZV0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKGBlcnJvciBpbiBzZW5kaW5nIHZvdGUuYmlkIGRpYWdyYW0gJHtlfWApO1xuICAgIH1cblxuICAgIC8vIFNlbmQgb3V0YmlkIG5vdGlmaWNhdGlvbiB0byBzZWNvbmQgbGFzdCBiaWRkZXJcbiAgICB0cnkge1xuICAgICAgICBmdW5jdGlvbiBnZXRNZXNzYWdlKFJlZ2lzdHJhdGlvbjogUmVnaXN0cmF0aW9uRFRPKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gYE9VVEJJRCBvbiAke0xvdC5BcnRJZH0tJHtDb250ZXN0YW50LkRldGFpbC5OYW1lfSBieSAke2hpZ2hCaWRkZXJOaWNrTmFtZX0gJHtwcm9jZXNzLmVudi5TSVRFX1VSTH0vYS8ke0xvdC5BcnRJZH0vci8ke1JlZ2lzdHJhdGlvbi5IYXNofWA7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHB1c2hNZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgICAgICAgICAgIHNtc01lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgdGl0bGU6IGBBdWN0aW9uIEZvciAke0xvdC5BcnRJZH1gLFxuICAgICAgICAgICAgICAgIHVybDogYCR7cHJvY2Vzcy5lbnYuU0lURV9VUkx9L2EvJHtMb3QuQXJ0SWR9L3IvJHtSZWdpc3RyYXRpb24uSGFzaH1gLFxuICAgICAgICAgICAgICAgIHB1c2hUaXRsZTogYE91dGJpZCBpbiAke0xvdC5BcnRJZH0gYnkgJHtDb250ZXN0YW50LkRldGFpbC5OYW1lfWBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGxvc2VyUmVnaXN0cmF0aW9uLmxlbmd0aCA+IDAgJiYgIShpc091dGJpZCAmJiBoaWdoQmlkZGVyUmVnSWQudG9TdHJpbmcoKSA9PT0gcmVnaXN0cmF0aW9uSWQudG9TdHJpbmcoKSkpIHtcbiAgICAgICAgICAgIC8vIGRvbid0IHNlbmQgb3V0YmlkIHRvIHNhbWUgcGVyc29uIGFnYWluXG4gICAgICAgICAgICBhd2FpdCBfbm90aWZ5QWNjb3JkaW5nVG9Vc2VyUHJlZmVyZW5jZXMoRXZlbnQsIGxvc2VyUmVnaXN0cmF0aW9uLCBnZXRNZXNzYWdlLCBmYWxzZSwgdHJ1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTZW5kIGJpZCBub3RpZmljYXRpb24gdG8gbGFzdCBiaWRkZXJcbiAgICAgICAgZnVuY3Rpb24gZ2V0QmlkTWVzc2FnZShSZWdpc3RyYXRpb246IFJlZ2lzdHJhdGlvbkRUTykge1xuICAgICAgICAgICAgY29uc3QgY3VycmVuY3lTeW1ib2wgPSBFdmVudC5DdXJyZW5jeSAmJiBFdmVudC5DdXJyZW5jeS5jdXJyZW5jeV9zeW1ib2wgfHwgJyQnO1xuICAgICAgICAgICAgY29uc3Qgb25CaWRNZXNzYWdlID0gYCR7Y3VycmVuY3lTeW1ib2x9JHtiaWR9IEJpZCByZWNvcmRlZCBvbiAke0xvdC5BcnRJZH0tJHtDb250ZXN0YW50LkRldGFpbC5OYW1lfSBieSAke0JpZGRlck5pY2tOYW1lfSAke3Byb2Nlc3MuZW52LlNJVEVfVVJMfS9hLyR7TG90LkFydElkfS9yLyR7UmVnaXN0cmF0aW9uLkhhc2h9YDtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgcHVzaE1lc3NhZ2U6IG9uQmlkTWVzc2FnZSxcbiAgICAgICAgICAgICAgICBzbXNNZXNzYWdlOiBvbkJpZE1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgdGl0bGU6IGBBdWN0aW9uIEZvciAke0xvdC5BcnRJZH1gLFxuICAgICAgICAgICAgICAgIHVybDogYCR7cHJvY2Vzcy5lbnYuU0lURV9VUkx9L2EvJHtMb3QuQXJ0SWR9L3IvJHtSZWdpc3RyYXRpb24uSGFzaH1gLFxuICAgICAgICAgICAgICAgIHB1c2hUaXRsZTogYCR7Y3VycmVuY3lTeW1ib2x9JHtiaWR9IEJpZCByZWNvcmRlZCBvbiAke0xvdC5BcnRJZH0tJHtDb250ZXN0YW50LkRldGFpbC5OYW1lfSBgXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmICh3aW5uZXJSZWdpc3RyYXRpb24ubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgYXdhaXQgX25vdGlmeUFjY29yZGluZ1RvVXNlclByZWZlcmVuY2VzKEV2ZW50LCB3aW5uZXJSZWdpc3RyYXRpb24sIGdldEJpZE1lc3NhZ2UsIGZhbHNlLCBmYWxzZSk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcihgJHtlLm1lc3NhZ2V9ICR7ZS5zdGFja31gKTtcbiAgICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9ub3RpZnlBY2NvcmRpbmdUb1VzZXJQcmVmZXJlbmNlcyhldmVudDogRXZlbnREVE8sIGFsbG93ZWRSZWdpc3RyYXRpb25JZHM6IHN0cmluZ1tdLCBnZXRNZXNzYWdlOiAoUmVnaXN0cmF0aW9uOiBSZWdpc3RyYXRpb25EVE8pID0+IHtcbiAgICBwdXNoTWVzc2FnZTogc3RyaW5nO1xuICAgIHNtc01lc3NhZ2U6IHN0cmluZztcbiAgICB0aXRsZTogc3RyaW5nO1xuICAgIHVybDogc3RyaW5nO1xuICAgIHB1c2hUaXRsZTogc3RyaW5nO1xufSwgcmVxdWVzdFByZWZlcmVuY2VzID0gdHJ1ZSwgYWxsQ2hhbm5lbHMgPSBmYWxzZSkge1xuICAgIGNvbnN0IHByZWZlcmVuY2VNYXA6IHtcbiAgICAgICAgW2tleTogc3RyaW5nXTogUHJlZmVyZW5jZURvY3VtZW50XG4gICAgfSA9IHt9O1xuICAgIGlmIChyZXF1ZXN0UHJlZmVyZW5jZXMpIHtcbiAgICAgICAgY29uc3QgcHJlZmVyZW5jZXMgPSBhd2FpdCBQcmVmZXJlbmNlTW9kZWwuZmluZCgpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByZWZlcmVuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBwcmVmZXJlbmNlTWFwW3ByZWZlcmVuY2VzW2ldLl9pZF0gPSBwcmVmZXJlbmNlc1tpXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHR3aWxpb0NsaWVudCA9IFR3aWxpbygpO1xuICAgIGNvbnN0IFJlZ2lzdHJhbnRUb2tlbnM6IHtcbiAgICAgICAgW2tleTogc3RyaW5nXTogc3RyaW5nW11cbiAgICB9ID0ge307XG4gICAgY29uc3QgUmVnaXN0cmFudEFuZHJvaWRUb2tlbnM6IHtcbiAgICAgICAgW2tleTogc3RyaW5nXTogc3RyaW5nW11cbiAgICB9ID0ge307XG4gICAgY29uc3QgUmVnaXN0cmF0aW9uc0J5SWQ6IHtcbiAgICAgICAgW2tleTogc3RyaW5nXTogUmVnaXN0cmF0aW9uRFRPXG4gICAgfSA9IHt9O1xuICAgIGNvbnN0IFJlZ2lzdHJhdGlvbk1lc3NhZ2VzOiB7XG4gICAgICAgIFtrZXk6IHN0cmluZ106IHtcbiAgICAgICAgICAgIHB1c2hNZXNzYWdlOiBzdHJpbmc7XG4gICAgICAgICAgICB0aXRsZTogc3RyaW5nO1xuICAgICAgICAgICAgdXJsOiBzdHJpbmc7XG4gICAgICAgICAgICBwdXNoVGl0bGU6IHN0cmluZztcbiAgICAgICAgfVxuICAgIH0gPSB7fTtcbiAgICBjb25zdCBSZWdpc3RyYXRpb25DaGFubmVsczoge1xuICAgICAgICBba2V5OiBzdHJpbmddOiBzdHJpbmdcbiAgICB9ID0ge307XG4gICAgZXZlbnQuUmVnaXN0cmF0aW9uc1ZvdGVGYWN0b3IuZm9yRWFjaChyZWdpc3RyYW50ID0+IHtcbiAgICAgICAgLy8gb2xkIGV2ZW50IGRvbid0IGhhdmUgRnJvbSBpbiByZWdpc3RyYW50c1xuICAgICAgICBSZWdpc3RyYXRpb25DaGFubmVsc1tyZWdpc3RyYW50LlJlZ2lzdHJhdGlvbklkLnRvU3RyaW5nKCldID0gKHJlZ2lzdHJhbnQuRnJvbSB8fCAnc21zJyk7XG4gICAgfSk7XG4gICAgLy8gY29uc3QgaXNTbXNBbmRBcHBCb3RoQ2hlY2tlZCA9IChzbXNWb3RlICYmIChhcHBWb3RlIHx8IGFwcEdsb2JhbFZvdGUpICk7XG4gICAgY29uc3QgZmlsdGVyQnlBbGxvd2VkUmVnaXN0cmF0aW9ucyA9IGFsbG93ZWRSZWdpc3RyYXRpb25JZHMubGVuZ3RoID4gMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV2ZW50LlJlZ2lzdHJhdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgcmVnaXN0cmFudCA9IGV2ZW50LlJlZ2lzdHJhdGlvbnNbaV07XG4gICAgICAgIGNvbnN0IHtwdXNoTWVzc2FnZSwgc21zTWVzc2FnZSwgdGl0bGUsIHVybCwgcHVzaFRpdGxlfSA9IGdldE1lc3NhZ2UocmVnaXN0cmFudCk7XG4gICAgICAgIFJlZ2lzdHJhdGlvbk1lc3NhZ2VzW3JlZ2lzdHJhbnQuX2lkXSA9IHtcbiAgICAgICAgICAgIHB1c2hNZXNzYWdlOiBwdXNoTWVzc2FnZSxcbiAgICAgICAgICAgIHRpdGxlOiB0aXRsZSxcbiAgICAgICAgICAgIHVybDogdXJsLFxuICAgICAgICAgICAgcHVzaFRpdGxlOiBwdXNoVGl0bGVcbiAgICAgICAgfTtcbiAgICAgICAgbG9nZ2VyLmluZm8oYCR7SlNPTi5zdHJpbmdpZnkoYWxsb3dlZFJlZ2lzdHJhdGlvbklkcyl9LCAnZmlsdGVyQnlBbGxvd2VkUmVnaXN0cmF0aW9ucycsICR7SlNPTi5zdHJpbmdpZnkoZmlsdGVyQnlBbGxvd2VkUmVnaXN0cmF0aW9ucyl9LCAnYWxsb3dlZFJlZ2lzdHJhdGlvbklkcy5pbmRleE9mKHJlZ2lzdHJhbnQuX2lkICsgXFwnXFwnKScsICR7YWxsb3dlZFJlZ2lzdHJhdGlvbklkcy5pbmRleE9mKHJlZ2lzdHJhbnQuX2lkLnRvU3RyaW5nKCkpfSwgJHtyZWdpc3RyYW50Ll9pZH1gKTtcbiAgICAgICAgY29uc3QgaXNSZWdpc3RyYW50QWxsb3dlZCA9ICghZmlsdGVyQnlBbGxvd2VkUmVnaXN0cmF0aW9ucykgfHwgYWxsb3dlZFJlZ2lzdHJhdGlvbklkcy5pbmRleE9mKHJlZ2lzdHJhbnQuX2lkICsgJycpID49IDA7XG4gICAgICAgIGlmICgoUmVnaXN0cmF0aW9uQ2hhbm5lbHNbcmVnaXN0cmFudC5faWRdID09PSAnc21zJyB8fCBhbGxDaGFubmVscykgJiYgaXNSZWdpc3RyYW50QWxsb3dlZCkge1xuICAgICAgICAgICAgLy8gaWYgc21zIGFuZCBhcHAgYm90aCBhcmUgY2hlY2tlZCB0aGVuIHNtcyBzaG91bGQgbm90IGJlIHNlbnQgdG8gYSBhcHAgbnVtYmVyXG4gICAgICAgICAgICBsZXQgdHdpbGlvUmVzOiBhbnk7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBzZW5kaW5nIHNtcyAke3Ntc01lc3NhZ2V9IHRvICR7cmVnaXN0cmFudC5QaG9uZU51bWJlcn1gKTtcbiAgICAgICAgICAgICAgICB0d2lsaW9SZXMgPSBhd2FpdCB0d2lsaW9DbGllbnQubWVzc2FnZXMuY3JlYXRlKHtcbiAgICAgICAgICAgICAgICAgICAgZnJvbTogZXZlbnQuUGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgICAgIHRvOiByZWdpc3RyYW50LlBob25lTnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICBib2R5OiBzbXNNZXNzYWdlXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcG9zdFRvU2xhY2tTTVNGbG9vZCh7XG4gICAgICAgICAgICAgICAgICAgICd0ZXh0JzogYCR7cmVnaXN0cmFudC5OaWNrTmFtZX0oJHtyZWdpc3RyYW50LlBob25lTnVtYmVyfSkgKHNtcykgXFxuJHtzbXNNZXNzYWdlfSwgc291cmNlOiBhdWN0aW9uLnRzIF9ub3RpZnlBY2NvcmRpbmdUb1VzZXJQcmVmZXJlbmNlc2BcbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiBsb2dnZXIuZXJyb3IoYGF1Y3Rpb24gc2xhY2sgZmxvb2QgY2FsbCBmYWlsZWQgJHsgc21zTWVzc2FnZSB9IHNvdXJjZTogYXVjdGlvbi50cyBfbm90aWZ5QWNjb3JkaW5nVG9Vc2VyUHJlZmVyZW5jZXNgKSk7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oYHNlbnQgc21zICR7c21zTWVzc2FnZX0gJHt0d2lsaW9SZXMgJiYgdHdpbGlvUmVzLnNpZH1gKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoYGZhaWxlZCBzbXMgJHtzbXNNZXNzYWdlfWApO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihgJHtlLm1lc3NhZ2V9ICR7ZS5zdGFja31gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHBvc3RUb1NsYWNrQmlkKHtcbiAgICAgICAgICAgICAgICAndGV4dCc6IGAke3JlZ2lzdHJhbnQuTmlja05hbWV9KCR7cmVnaXN0cmFudC5QaG9uZU51bWJlcn0pIChzbXMpIFxcbiR7c21zTWVzc2FnZX0gdHdpbGlvIHNpZCA6ICR7dHdpbGlvUmVzICYmIHR3aWxpb1Jlcy5zaWR9YFxuICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4gbG9nZ2VyLmVycm9yKGBfbm90aWZ5QWNjb3JkaW5nVG9Vc2VyUHJlZmVyZW5jZXMgc2xhY2sgY2FsbCBmYWlsZWQgJHtzbXNNZXNzYWdlfWApKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgaGFzU3Vic2NyaWJlZFRvRXZlbnQgPSBmYWxzZTtcbiAgICAgICAgY29uc3QgdXNlclByZWZlcmVuY2UgPSByZWdpc3RyYW50LlByZWZlcmVuY2VzIHx8IFtdO1xuICAgICAgICBpZiAodXNlclByZWZlcmVuY2UpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdXNlclByZWZlcmVuY2UubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAvLyBsb2dnZXIuaW5mbygndXNlclByZWZlcmVuY2VbaV0uX2lkJywgdXNlclByZWZlcmVuY2VbaV0uX2lkKTtcbiAgICAgICAgICAgICAgICBoYXNTdWJzY3JpYmVkVG9FdmVudCA9ICFyZXF1ZXN0UHJlZmVyZW5jZXMgfHwgcHJlZmVyZW5jZU1hcFt1c2VyUHJlZmVyZW5jZVtpXS5faWRdLlR5cGUgPT09ICdFdmVudFJlZ2lzdGVyZWQnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaGFzU3Vic2NyaWJlZFRvRXZlbnQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGhhc1N1YnNjcmliZWRUb0V2ZW50ICYmIGlzUmVnaXN0cmFudEFsbG93ZWQgJiYgcmVnaXN0cmFudC5EZXZpY2VUb2tlbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgUmVnaXN0cmFudFRva2Vuc1tyZWdpc3RyYW50Ll9pZF0gPSByZWdpc3RyYW50LkRldmljZVRva2VucztcbiAgICAgICAgICAgIFJlZ2lzdHJhbnRBbmRyb2lkVG9rZW5zW3JlZ2lzdHJhbnQuX2lkXSA9IHJlZ2lzdHJhbnQuQW5kcm9pZERldmljZVRva2VucztcbiAgICAgICAgICAgIFJlZ2lzdHJhdGlvbnNCeUlkW3JlZ2lzdHJhbnQuX2lkXSA9IHJlZ2lzdHJhbnQ7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLy8gQWZ0ZXIgc2VuZGluZyByZXNwb25zZSBzZW5kIG1lc3NhZ2UgdG8gc2xhY2sgY2hhbm5lbFxuICAgIC8vIHNlbmQgcHVzaCBub3RpZmljYXRpb25zXG4gICAgY29uc3QgcHJvbWlzZXMgPSBbXTtcbiAgICBjb25zdCB2b3RlRmFjdG9ycyA9IGV2ZW50LlJlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yO1xuICAgIGZvciAobGV0IGogPSAwOyBqIDwgdm90ZUZhY3RvcnMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgY29uc3QgdXNlclRvTm90aWZ5ID0gUmVnaXN0cmF0aW9uc0J5SWRbdm90ZUZhY3RvcnNbal0uUmVnaXN0cmF0aW9uSWQgKyAnJ107XG4gICAgICAgIGlmICh1c2VyVG9Ob3RpZnkpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBSZWdpc3RyYXRpb25NZXNzYWdlc1t2b3RlRmFjdG9yc1tqXS5SZWdpc3RyYXRpb25JZCArICcnXTtcbiAgICAgICAgICAgIGNvbnN0IHVzZXJUb2tlbnMgPSBSZWdpc3RyYW50VG9rZW5zW3ZvdGVGYWN0b3JzW2pdLlJlZ2lzdHJhdGlvbklkICsgJyddO1xuICAgICAgICAgICAgY29uc3QgQW5kcm9pZFRva2VucyA9IFJlZ2lzdHJhbnRBbmRyb2lkVG9rZW5zW3ZvdGVGYWN0b3JzW2pdLlJlZ2lzdHJhdGlvbklkICsgJyddO1xuICAgICAgICAgICAgcHJvbWlzZXMucHVzaChzZW5kTm90aWZpY2F0aW9uSWdub3JlRXJyKHVzZXJUb2tlbnMsIG1lc3NhZ2UucHVzaE1lc3NhZ2UsIG1lc3NhZ2UucHVzaFRpdGxlLFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgdXJsOiBtZXNzYWdlLnVybCxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6IG1lc3NhZ2UudGl0bGVcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICBwcm9taXNlcy5wdXNoKE11bHRpQ2FzdElnbm9yZUVycih7XG4gICAgICAgICAgICAgICAgRGV2aWNlVG9rZW5zOiBBbmRyb2lkVG9rZW5zLFxuICAgICAgICAgICAgICAgIGxpbms6IG1lc3NhZ2UudXJsLFxuICAgICAgICAgICAgICAgIHRpdGxlOiBtZXNzYWdlLnRpdGxlLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UucHVzaE1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgcHJpb3JpdHk6ICdub3JtYWwnLFxuICAgICAgICAgICAgICAgIGFuYWx5dGljc0xhYmVsOiBtZXNzYWdlLnB1c2hUaXRsZVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgcG9zdFRvU2xhY2tCaWQoe1xuICAgICAgICAgICAgICAgICd0ZXh0JzogYCR7dXNlclRvTm90aWZ5Lk5pY2tOYW1lfSgke3VzZXJUb05vdGlmeS5QaG9uZU51bWJlcn0pIChwdXNoKSBcXG4ke0pTT04uc3RyaW5naWZ5KG1lc3NhZ2UpfWBcbiAgICAgICAgICAgIH0pLmNhdGNoKCgpID0+IGxvZ2dlci5lcnJvcihgX25vdGlmeUFjY29yZGluZ1RvVXNlclByZWZlcmVuY2VzIHNsYWNrIGNhbGwgZmFpbGVkICR7bWVzc2FnZX1gKSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHByb21pc2VzKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG5vdGlmeUF1Y3Rpb25PcGVuKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZXZlbnQgPSBhd2FpdCBFdmVudE1vZGVsXG4gICAgICAgICAgICAuZmluZEJ5SWQocmVxLnBhcmFtcy5ldmVudElkKVxuICAgICAgICAgICAgLnBvcHVsYXRlKCdSZWdpc3RyYXRpb25zJyk7XG5cbiAgICAgICAgLyogY29uc3QgcHJlZmVyZW5jZXMgPSBhd2FpdCBQcmVmZXJlbmNlTW9kZWwuZmluZCgpO1xuICAgICAgICBjb25zdCBwcmVmZXJlbmNlTWFwOiB7XG4gICAgICAgICAgICBba2V5OiBzdHJpbmddOiBQcmVmZXJlbmNlRG9jdW1lbnRcbiAgICAgICAgfSA9IHt9O1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByZWZlcmVuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBwcmVmZXJlbmNlTWFwW3ByZWZlcmVuY2VzW2ldLl9pZF0gPSBwcmVmZXJlbmNlc1tpXTtcbiAgICAgICAgfSAqL1xuXG4gICAgICAgIGNvbnN0IHR3aWxpb0NsaWVudCA9IFR3aWxpbygpO1xuICAgICAgICBjb25zdCBSZWdpc3RyYW50VG9rZW5zOiB7XG4gICAgICAgICAgICBba2V5OiBzdHJpbmddOiBzdHJpbmdbXVxuICAgICAgICB9ID0ge307XG4gICAgICAgIGNvbnN0IFJlZ2lzdHJhbnRBbmRyb2lkVG9rZW5zOiB7XG4gICAgICAgICAgICBba2V5OiBzdHJpbmddOiBzdHJpbmdbXVxuICAgICAgICB9ID0ge307XG4gICAgICAgIGNvbnN0IFJlZ2lzdHJhdGlvbnNCeUlkOiB7XG4gICAgICAgICAgICBba2V5OiBzdHJpbmddOiBSZWdpc3RyYXRpb25EVE9cbiAgICAgICAgfSA9IHt9O1xuICAgICAgICBjb25zdCBSZWdpc3RyYXRpb25DaGFubmVsczoge1xuICAgICAgICAgICAgW2tleTogc3RyaW5nXTogc3RyaW5nXG4gICAgICAgIH0gPSB7fTtcbiAgICAgICAgY29uc3QgUmVnaXN0cmF0aW9uRXZlbnRIYXNoOiB7XG4gICAgICAgICAgICBba2V5OiBzdHJpbmddOiBzdHJpbmdcbiAgICAgICAgfSA9IHt9O1xuICAgICAgICBldmVudC5SZWdpc3RyYXRpb25zVm90ZUZhY3Rvci5mb3JFYWNoKHJlZ2lzdHJhbnQgPT4ge1xuICAgICAgICAgICAgLy8gb2xkIGV2ZW50IGRvbid0IGhhdmUgRnJvbSBpbiByZWdpc3RyYW50c1xuICAgICAgICAgICAgUmVnaXN0cmF0aW9uQ2hhbm5lbHNbcmVnaXN0cmFudC5SZWdpc3RyYXRpb25JZC50b1N0cmluZygpXSA9IChyZWdpc3RyYW50LkZyb20gfHwgJ3NtcycpO1xuICAgICAgICAgICAgUmVnaXN0cmF0aW9uRXZlbnRIYXNoW3JlZ2lzdHJhbnQuUmVnaXN0cmF0aW9uSWQudG9TdHJpbmcoKV0gPSByZWdpc3RyYW50LlZvdGVVcmwudG9TdHJpbmcoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIC8vIGNvbnN0IGlzU21zQW5kQXBwQm90aENoZWNrZWQgPSAoc21zVm90ZSAmJiAoYXBwVm90ZSB8fCBhcHBHbG9iYWxWb3RlKSApO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV2ZW50LlJlZ2lzdHJhdGlvbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHJlZ2lzdHJhbnQgPSBldmVudC5SZWdpc3RyYXRpb25zW2ldO1xuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGBZb3VyIHBlcnNvbmFsIGxpbms6ICR7cHJvY2Vzcy5lbnYuU0lURV9VUkx9JHtSZWdpc3RyYXRpb25FdmVudEhhc2hbcmVnaXN0cmFudC5faWQudG9TdHJpbmcoKV19YDtcbiAgICAgICAgICAgIC8vIGlmIChSZWdpc3RyYXRpb25DaGFubmVsc1tyZWdpc3RyYW50Ll9pZF0gPT09ICdzbXMnKSB7XG4gICAgICAgICAgICAvLyBpZiBzbXMgYW5kIGFwcCBib3RoIGFyZSBjaGVja2VkIHRoZW4gc21zIHNob3VsZCBub3QgYmUgc2VudCB0byBhIGFwcCBudW1iZXJcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBTZW5kaW5nIG1lc3NhZ2U6ICR7bWVzc2FnZX0gRnJvbTogJHtldmVudC5QaG9uZU51bWJlcn0gVG86ICR7cmVnaXN0cmFudC5QaG9uZU51bWJlcn1gKTtcbiAgICAgICAgICAgIGxldCB0d2lsaW9SZXM7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHR3aWxpb1JlcyA9IGF3YWl0IHR3aWxpb0NsaWVudC5tZXNzYWdlcy5jcmVhdGUoe1xuICAgICAgICAgICAgICAgICAgICBmcm9tOiBldmVudC5QaG9uZU51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgdG86IHJlZ2lzdHJhbnQuUGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgICAgIGJvZHk6IG1lc3NhZ2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBwb3N0VG9TbGFja1NNU0Zsb29kKHtcbiAgICAgICAgICAgICAgICAgICAgJ3RleHQnOiBgJHtyZWdpc3RyYW50Lk5pY2tOYW1lfSgke3JlZ2lzdHJhbnQuUGhvbmVOdW1iZXJ9KSAoc21zKSBcXG4ke21lc3NhZ2V9IHNvdXJjZTogYXVjdGlvbi50cyBub3RpZnlBdWN0aW9uT3BlbmBcbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiBsb2dnZXIuZXJyb3IoYEF1Y3Rpb24gcGVyc29uYWwgbGluayBzbGFjayBmbG9vZCBjYWxsIGZhaWxlZCAkeyBtZXNzYWdlIH0gc291cmNlOiBhdWN0aW9uLnRzIG5vdGlmeUF1Y3Rpb25PcGVuYCkpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihgJHtlLm1lc3NhZ2V9ICR7ZS5zdGFja31gKTtcbiAgICAgICAgICAgIH0gLy8gc2VuZCAxIGJ5IDFcbiAgICAgICAgICAgIC8qcG9zdFRvU2xhY2tCaWQoe1xuICAgICAgICAgICAgICAgICd0ZXh0JzogYCR7cmVnaXN0cmFudC5OaWNrTmFtZX0oJHtyZWdpc3RyYW50LlBob25lTnVtYmVyfSkgKHNtcykgXFxuJHttZXNzYWdlfSB0d2lsaW8gc2lkIDogJHt0d2lsaW9SZXMgJiYgdHdpbGlvUmVzLnNpZH1gXG4gICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiBsb2dnZXIuZXJyb3IoYG5vdGlmeUF1Y3Rpb25PcGVuIHNsYWNrIGNhbGwgZmFpbGVkICR7bWVzc2FnZX1gKSk7Ki9cbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBzZW50IG1lc3NhZ2U6ICR7bWVzc2FnZX0gRnJvbTogJHtldmVudC5QaG9uZU51bWJlcn0gVG86ICR7cmVnaXN0cmFudC5QaG9uZU51bWJlcn1gKTtcbiAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICAgIC8vIGxldCBoYXNTdWJzY3JpYmVkVG9FdmVudCA9IGZhbHNlO1xuICAgICAgICAgICAgLypcbiAgICAgICAgICAgIGNvbnN0IHVzZXJQcmVmZXJlbmNlID0gcmVnaXN0cmFudC5QcmVmZXJlbmNlcyB8fCBbXTtcbiAgICAgICAgICAgIGlmICh1c2VyUHJlZmVyZW5jZSkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdXNlclByZWZlcmVuY2UubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gbG9nZ2VyLmluZm8oJ3VzZXJQcmVmZXJlbmNlW2ldLl9pZCcsIHVzZXJQcmVmZXJlbmNlW2ldLl9pZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmICggcHJlZmVyZW5jZU1hcFt1c2VyUHJlZmVyZW5jZVtpXS5faWRdLlR5cGUgPT09ICdFdmVudFJlZ2lzdGVyZWQnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBoYXNTdWJzY3JpYmVkVG9FdmVudCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGhhc1N1YnNjcmliZWRUb0V2ZW50ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChoYXNTdWJzY3JpYmVkVG9FdmVudCkgeyovXG4gICAgICAgICAgICBSZWdpc3RyYW50VG9rZW5zW3JlZ2lzdHJhbnQuX2lkXSA9IHJlZ2lzdHJhbnQuRGV2aWNlVG9rZW5zO1xuICAgICAgICAgICAgUmVnaXN0cmFudEFuZHJvaWRUb2tlbnNbcmVnaXN0cmFudC5faWRdID0gcmVnaXN0cmFudC5BbmRyb2lkRGV2aWNlVG9rZW5zO1xuICAgICAgICAgICAgUmVnaXN0cmF0aW9uc0J5SWRbcmVnaXN0cmFudC5faWRdID0gcmVnaXN0cmFudDtcbiAgICAgICAgICAgIC8qfSovXG4gICAgICAgIH1cbiAgICAgICAgLy8gQWZ0ZXIgc2VuZGluZyByZXNwb25zZSBzZW5kIG1lc3NhZ2UgdG8gc2xhY2sgY2hhbm5lbFxuICAgICAgICAvLyBzZW5kIHB1c2ggbm90aWZpY2F0aW9uc1xuICAgICAgICBjb25zdCBwcm9taXNlcyA9IFtdO1xuICAgICAgICBjb25zdCB2b3RlRmFjdG9ycyA9IGV2ZW50LlJlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yO1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHZvdGVGYWN0b3JzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBjb25zdCB1c2VyVG9Ob3RpZnkgPSBSZWdpc3RyYXRpb25zQnlJZFt2b3RlRmFjdG9yc1tqXS5SZWdpc3RyYXRpb25JZCArICcnXTtcbiAgICAgICAgICAgIGlmICh1c2VyVG9Ob3RpZnkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gYFlvdXIgcGVyc29uYWwgbGluay5gO1xuICAgICAgICAgICAgICAgIGNvbnN0IHVzZXJUb2tlbnMgPSBSZWdpc3RyYW50VG9rZW5zW3ZvdGVGYWN0b3JzW2pdLlJlZ2lzdHJhdGlvbklkICsgJyddO1xuICAgICAgICAgICAgICAgIGNvbnN0IEFuZHJvaWRUb2tlbnMgPSBSZWdpc3RyYW50QW5kcm9pZFRva2Vuc1t2b3RlRmFjdG9yc1tqXS5SZWdpc3RyYXRpb25JZCArICcnXTtcbiAgICAgICAgICAgICAgICAvKnBvc3RUb1NsYWNrQmlkKHtcbiAgICAgICAgICAgICAgICAgICAgJ3RleHQnOiBgJHt1c2VyVG9Ob3RpZnkuTmlja05hbWV9KCR7dXNlclRvTm90aWZ5LlBob25lTnVtYmVyfSkgKHB1c2gpIFxcbiR7SlNPTi5zdHJpbmdpZnkobWVzc2FnZSl9YFxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKCgpID0+IGxvZ2dlci5lcnJvcihgbm90aWZ5QXVjdGlvbk9wZW4gc2xhY2sgY2FsbCBmYWlsZWQgJHttZXNzYWdlfWApKTsqL1xuICAgICAgICAgICAgICAgIHByb21pc2VzLnB1c2goc2VuZE5vdGlmaWNhdGlvbklnbm9yZUVycih1c2VyVG9rZW5zLCBtZXNzYWdlLCBldmVudC5OYW1lLFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1cmw6IGAke3Byb2Nlc3MuZW52LlNJVEVfVVJMfSR7dm90ZUZhY3RvcnNbal0uVm90ZVVybH1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdQZXJzb25hbCBWb3RpbmcgTGluaydcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIHByb21pc2VzLnB1c2goTXVsdGlDYXN0SWdub3JlRXJyKHtcbiAgICAgICAgICAgICAgICAgICAgRGV2aWNlVG9rZW5zOiBBbmRyb2lkVG9rZW5zLFxuICAgICAgICAgICAgICAgICAgICBsaW5rOiBgJHtwcm9jZXNzLmVudi5TSVRFX1VSTH0ke3ZvdGVGYWN0b3JzW2pdLlZvdGVVcmx9YCxcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6ICdQZXJzb25hbCBWb3RpbmcgTGluaycsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIHByaW9yaXR5OiAnbm9ybWFsJyxcbiAgICAgICAgICAgICAgICAgICAgYW5hbHl0aWNzTGFiZWw6ICdQZXJzb25hbCBWb3RpbmcgTGluaydcbiAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuICAgICAgICBldmVudC5Mb2dzLnB1c2goe1xuICAgICAgICAgICAgTWVzc2FnZTogYFNlbnQgQXVjdGlvbiBtZXNzYWdlIHRvIHJlZ2lzdHJhbnRzYCxcbiAgICAgICAgICAgIENyZWF0ZWREYXRlOiBuZXcgRGF0ZSgpXG4gICAgICAgIH0pO1xuICAgICAgICBldmVudC5zYXZlKCkuY2F0Y2goZSA9PiBsb2dnZXIuZXJyb3IoYFVuYWJsZSB0byBzdG9yZSBsb2cgbWVzc2FnZSBvZiBzbGFjayByZWxhdGVkIHRvIGFubm91bmNlbWVudCAke2UubWVzc2FnZX0gJHtlLnN0YWNrfWApKTtcbiAgICAgICAgcmVzLmpzb24oe1xuICAgICAgICAgICAgJ1N1Y2Nlc3MnOiB0cnVlLFxuICAgICAgICAgICAgJ01lc3NhZ2UnOiAnTm90aWZpY2F0aW9uIFN1Y2Nlc3NmdWwnLFxuICAgICAgICAgICAgJ2NvZGUnOiAnU1VDQ0VTUydcbiAgICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBsb2dnZXIuZXJyb3IoYCR7ZS5tZXNzYWdlfSAke2Uuc3RhY2t9YCk7XG4gICAgICAgIHJldHVybiBuZXh0KGUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNlbmRTaG9ydEF1Y3Rpb25MaW5rKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZXZlbnQgPSBhd2FpdCBFdmVudE1vZGVsXG4gICAgICAgICAgICAuZmluZEJ5SWQocmVxLnBhcmFtcy5ldmVudElkKVxuICAgICAgICAgICAgLnBvcHVsYXRlKCdSZWdpc3RyYXRpb25zJyk7XG5cbiAgICAgICAgLyogY29uc3QgcHJlZmVyZW5jZXMgPSBhd2FpdCBQcmVmZXJlbmNlTW9kZWwuZmluZCgpO1xuICAgICAgICBjb25zdCBwcmVmZXJlbmNlTWFwOiB7XG4gICAgICAgICAgICBba2V5OiBzdHJpbmddOiBQcmVmZXJlbmNlRG9jdW1lbnRcbiAgICAgICAgfSA9IHt9O1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByZWZlcmVuY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBwcmVmZXJlbmNlTWFwW3ByZWZlcmVuY2VzW2ldLl9pZF0gPSBwcmVmZXJlbmNlc1tpXTtcbiAgICAgICAgfSAqL1xuXG4gICAgICAgIGNvbnN0IHR3aWxpb0NsaWVudCA9IFR3aWxpbygpO1xuICAgICAgICBjb25zdCBSZWdpc3RyYW50VG9rZW5zOiB7XG4gICAgICAgICAgICBba2V5OiBzdHJpbmddOiBTdHJpbmdbXVxuICAgICAgICB9ID0ge307XG4gICAgICAgIGNvbnN0IFJlZ2lzdHJhbnRBbmRyb2lkVG9rZW5zOiB7XG4gICAgICAgICAgICBba2V5OiBzdHJpbmddOiBzdHJpbmdbXVxuICAgICAgICB9ID0ge307XG4gICAgICAgIGNvbnN0IFJlZ2lzdHJhdGlvbnNCeUlkOiB7XG4gICAgICAgICAgICBba2V5OiBzdHJpbmddOiBSZWdpc3RyYXRpb25EVE9cbiAgICAgICAgfSA9IHt9O1xuICAgICAgICBjb25zdCBSZWdpc3RyYXRpb25DaGFubmVsczoge1xuICAgICAgICAgICAgW2tleTogc3RyaW5nXTogc3RyaW5nXG4gICAgICAgIH0gPSB7fTtcbiAgICAgICAgY29uc3QgUmVnaXN0cmF0aW9uRXZlbnRIYXNoOiB7XG4gICAgICAgICAgICBba2V5OiBzdHJpbmddOiBzdHJpbmdcbiAgICAgICAgfSA9IHt9O1xuICAgICAgICBldmVudC5SZWdpc3RyYXRpb25zVm90ZUZhY3Rvci5mb3JFYWNoKHJlZ2lzdHJhbnQgPT4ge1xuICAgICAgICAgICAgLy8gb2xkIGV2ZW50IGRvbid0IGhhdmUgRnJvbSBpbiByZWdpc3RyYW50c1xuICAgICAgICAgICAgUmVnaXN0cmF0aW9uQ2hhbm5lbHNbcmVnaXN0cmFudC5SZWdpc3RyYXRpb25JZC50b1N0cmluZygpXSA9IChyZWdpc3RyYW50LkZyb20gfHwgJ3NtcycpO1xuICAgICAgICAgICAgUmVnaXN0cmF0aW9uRXZlbnRIYXNoW3JlZ2lzdHJhbnQuUmVnaXN0cmF0aW9uSWQudG9TdHJpbmcoKV0gPSBgL2Evci8ke3JlZ2lzdHJhbnQuSGFzaH1gO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gY29uc3QgaXNTbXNBbmRBcHBCb3RoQ2hlY2tlZCA9IChzbXNWb3RlICYmIChhcHBWb3RlIHx8IGFwcEdsb2JhbFZvdGUpICk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXZlbnQuUmVnaXN0cmF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgcmVnaXN0cmFudCA9IGV2ZW50LlJlZ2lzdHJhdGlvbnNbaV07XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gYFlvdXIgcGVyc29uYWwgYXVjdGlvbiBsaW5rOiAke3Byb2Nlc3MuZW52LlNIT1JUX1NJVEVfVVJMIHx8IHByb2Nlc3MuZW52LlNJVEVfVVJMfSR7UmVnaXN0cmF0aW9uRXZlbnRIYXNoW3JlZ2lzdHJhbnQuX2lkLnRvU3RyaW5nKCldfWA7XG4gICAgICAgICAgICAvLyBpZiAoUmVnaXN0cmF0aW9uQ2hhbm5lbHNbcmVnaXN0cmFudC5faWRdID09PSAnc21zJykge1xuICAgICAgICAgICAgLy8gaWYgc21zIGFuZCBhcHAgYm90aCBhcmUgY2hlY2tlZCB0aGVuIHNtcyBzaG91bGQgbm90IGJlIHNlbnQgdG8gYSBhcHAgbnVtYmVyXG4gICAgICAgICAgICBsb2dnZXIuaW5mbyhgU2VuZGluZyBzaG9ydCBhdWN0aW9uIG1lc3NhZ2U6ICR7bWVzc2FnZX0gRnJvbTogJHtldmVudC5QaG9uZU51bWJlcn0gVG86ICR7cmVnaXN0cmFudC5QaG9uZU51bWJlcn1gKTtcbiAgICAgICAgICAgIGxldCB0d2lsaW9SZXM7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHR3aWxpb1JlcyA9IGF3YWl0IHR3aWxpb0NsaWVudC5tZXNzYWdlcy5jcmVhdGUoe1xuICAgICAgICAgICAgICAgICAgICBmcm9tOiBldmVudC5QaG9uZU51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgdG86IHJlZ2lzdHJhbnQuUGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgICAgIGJvZHk6IG1lc3NhZ2VcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBwb3N0VG9TbGFja1NNU0Zsb29kKHtcbiAgICAgICAgICAgICAgICAgICAgJ3RleHQnOiBgJHtyZWdpc3RyYW50Lk5pY2tOYW1lfSgke3JlZ2lzdHJhbnQuUGhvbmVOdW1iZXJ9KSAoc21zKSBcXG4ke21lc3NhZ2V9IHNvdXJjZTogYXVjdGlvbi50cyBzZW5kU2hvcnRBdWN0aW9uTGlua2BcbiAgICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiBsb2dnZXIuZXJyb3IoYHBlcnNvbmFsIGF1Y3Rpb24gc2xhY2sgZmxvb2QgY2FsbCBmYWlsZWQgJHsgbWVzc2FnZSB9IHNvdXJjZTogYXVjdGlvbi50cyBzZW5kU2hvcnRBdWN0aW9uTGlua2ApKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoYCR7ZS5tZXNzYWdlfSAke2Uuc3RhY2t9YCk7XG4gICAgICAgICAgICB9IC8vIHNlbmQgMSBieSAxXG4gICAgICAgICAgICAvKnBvc3RUb1NsYWNrQmlkKHtcbiAgICAgICAgICAgICAgICAndGV4dCc6IGAke3JlZ2lzdHJhbnQuTmlja05hbWV9KCR7cmVnaXN0cmFudC5QaG9uZU51bWJlcn0pIChzbXMpIFxcbiR7bWVzc2FnZX0gdHdpbGlvIHNpZCA6ICR7dHdpbGlvUmVzICYmIHR3aWxpb1Jlcy5zaWR9YFxuICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4gbG9nZ2VyLmVycm9yKGBub3RpZnlBdWN0aW9uT3BlbiBzbGFjayBjYWxsIGZhaWxlZCAke21lc3NhZ2V9YCkpOyovXG4gICAgICAgICAgICBsb2dnZXIuaW5mbyhgc2VudCBtZXNzYWdlOiAke21lc3NhZ2V9IEZyb206ICR7ZXZlbnQuUGhvbmVOdW1iZXJ9IFRvOiAke3JlZ2lzdHJhbnQuUGhvbmVOdW1iZXJ9YCk7XG4gICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICAvLyBsZXQgaGFzU3Vic2NyaWJlZFRvRXZlbnQgPSBmYWxzZTtcbiAgICAgICAgICAgIC8qXG4gICAgICAgICAgICBjb25zdCB1c2VyUHJlZmVyZW5jZSA9IHJlZ2lzdHJhbnQuUHJlZmVyZW5jZXMgfHwgW107XG4gICAgICAgICAgICBpZiAodXNlclByZWZlcmVuY2UpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHVzZXJQcmVmZXJlbmNlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGxvZ2dlci5pbmZvKCd1c2VyUHJlZmVyZW5jZVtpXS5faWQnLCB1c2VyUHJlZmVyZW5jZVtpXS5faWQpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHByZWZlcmVuY2VNYXBbdXNlclByZWZlcmVuY2VbaV0uX2lkXS5UeXBlID09PSAnRXZlbnRSZWdpc3RlcmVkJykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaGFzU3Vic2NyaWJlZFRvRXZlbnQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBoYXNTdWJzY3JpYmVkVG9FdmVudCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaGFzU3Vic2NyaWJlZFRvRXZlbnQpIHsqL1xuICAgICAgICAgICAgUmVnaXN0cmFudFRva2Vuc1tyZWdpc3RyYW50Ll9pZF0gPSByZWdpc3RyYW50LkRldmljZVRva2VucztcbiAgICAgICAgICAgIFJlZ2lzdHJhbnRBbmRyb2lkVG9rZW5zW3JlZ2lzdHJhbnQuX2lkXSA9IHJlZ2lzdHJhbnQuQW5kcm9pZERldmljZVRva2VucztcbiAgICAgICAgICAgIFJlZ2lzdHJhdGlvbnNCeUlkW3JlZ2lzdHJhbnQuX2lkXSA9IHJlZ2lzdHJhbnQ7XG4gICAgICAgICAgICAvKn0qL1xuICAgICAgICB9XG4gICAgICAgIC8vIEFmdGVyIHNlbmRpbmcgcmVzcG9uc2Ugc2VuZCBtZXNzYWdlIHRvIHNsYWNrIGNoYW5uZWxcbiAgICAgICAgLy8gc2VuZCBwdXNoIG5vdGlmaWNhdGlvbnNcbiAgICAgICAgY29uc3QgcHJvbWlzZXMgPSBbXTtcbiAgICAgICAgY29uc3Qgdm90ZUZhY3RvcnMgPSBldmVudC5SZWdpc3RyYXRpb25zVm90ZUZhY3RvcjtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCB2b3RlRmFjdG9ycy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgY29uc3QgdXNlclRvTm90aWZ5ID0gUmVnaXN0cmF0aW9uc0J5SWRbdm90ZUZhY3RvcnNbal0uUmVnaXN0cmF0aW9uSWQgKyAnJ107XG4gICAgICAgICAgICBpZiAodXNlclRvTm90aWZ5KSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGBZb3VyIHBlcnNvbmFsIGF1Y3Rpb24gbGluay5gO1xuICAgICAgICAgICAgICAgIGNvbnN0IHVzZXJUb2tlbnMgPSBSZWdpc3RyYW50VG9rZW5zW3ZvdGVGYWN0b3JzW2pdLlJlZ2lzdHJhdGlvbklkICsgJyddO1xuICAgICAgICAgICAgICAgIGNvbnN0IEFuZHJvaWRUb2tlbnMgPSBSZWdpc3RyYW50QW5kcm9pZFRva2Vuc1t2b3RlRmFjdG9yc1tqXS5SZWdpc3RyYXRpb25JZCArICcnXTtcbiAgICAgICAgICAgICAgICAvKnBvc3RUb1NsYWNrQmlkKHtcbiAgICAgICAgICAgICAgICAgICAgJ3RleHQnOiBgJHt1c2VyVG9Ob3RpZnkuTmlja05hbWV9KCR7dXNlclRvTm90aWZ5LlBob25lTnVtYmVyfSkgKHB1c2gpIFxcbiR7SlNPTi5zdHJpbmdpZnkobWVzc2FnZSl9YFxuICAgICAgICAgICAgICAgIH0pLmNhdGNoKCgpID0+IGxvZ2dlci5lcnJvcihgbm90aWZ5QXVjdGlvbk9wZW4gc2xhY2sgY2FsbCBmYWlsZWQgJHttZXNzYWdlfWApKTsqL1xuICAgICAgICAgICAgICAgIHByb21pc2VzLnB1c2goc2VuZE5vdGlmaWNhdGlvbklnbm9yZUVycih1c2VyVG9rZW5zLCBtZXNzYWdlLCBldmVudC5OYW1lLFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICB1cmw6IGAke3Byb2Nlc3MuZW52LlNIT1JUX1NJVEVfVVJMfS9hL3IvJHt2b3RlRmFjdG9yc1tqXS5IYXNofWAsXG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1BlcnNvbmFsIEF1Y3Rpb24gTGluaydcbiAgICAgICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgICAgIHByb21pc2VzLnB1c2goTXVsdGlDYXN0SWdub3JlRXJyKHtcbiAgICAgICAgICAgICAgICAgICAgRGV2aWNlVG9rZW5zOiBBbmRyb2lkVG9rZW5zLFxuICAgICAgICAgICAgICAgICAgICBsaW5rOiBgJHtwcm9jZXNzLmVudi5TSE9SVF9TSVRFX1VSTH0vYS9yLyR7dm90ZUZhY3RvcnNbal0uSGFzaH1gLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ1BlcnNvbmFsIEF1Y3Rpb24gTGluaycsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIHByaW9yaXR5OiAnbm9ybWFsJyxcbiAgICAgICAgICAgICAgICAgICAgYW5hbHl0aWNzTGFiZWw6ICdQZXJzb25hbCBBdWN0aW9uIExpbmsnXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcbiAgICAgICAgZXZlbnQuTG9ncy5wdXNoKHtcbiAgICAgICAgICAgIE1lc3NhZ2U6IGBTZW50IEF1Y3Rpb24gbWVzc2FnZSB0byByZWdpc3RyYW50c2AsXG4gICAgICAgICAgICBDcmVhdGVkRGF0ZTogbmV3IERhdGUoKVxuICAgICAgICB9KTtcbiAgICAgICAgZXZlbnQuc2F2ZSgpLmNhdGNoKGUgPT4gbG9nZ2VyLmVycm9yKGBVbmFibGUgdG8gc3RvcmUgbG9nIG1lc3NhZ2Ugb2Ygc2xhY2sgcmVsYXRlZCB0byBhbm5vdW5jZW1lbnQgJHtlLm1lc3NhZ2V9ICR7ZS5zdGFja31gKSk7XG4gICAgICAgIHJlcy5qc29uKHtcbiAgICAgICAgICAgICdTdWNjZXNzJzogdHJ1ZSxcbiAgICAgICAgICAgICdNZXNzYWdlJzogJ05vdGlmaWNhdGlvbiBTdWNjZXNzZnVsJyxcbiAgICAgICAgICAgICdjb2RlJzogJ1NVQ0NFU1MnXG4gICAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgbG9nZ2VyLmVycm9yKGAke2UubWVzc2FnZX0gJHtlLnN0YWNrfWApO1xuICAgICAgICByZXR1cm4gbmV4dChlKTtcbiAgICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBtYW51YWxCaWQocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBwaG9uZSA9IHJlcS5ib2R5LnBob25lO1xuICAgICAgICBjb25zdCBuYW1lID0gcmVxLmJvZHkubmFtZTtcbiAgICAgICAgY29uc3QgYmlkID0gcGFyc2VGbG9hdChyZXEuYm9keS5iaWQpO1xuICAgICAgICBsZXQgZmlyc3ROYW1lID0gJyc7XG4gICAgICAgIGxldCBsYXN0TmFtZSA9ICcnO1xuICAgICAgICBpZiAobmFtZSkge1xuICAgICAgICAgICAgY29uc3QgbmFtZUFyciA9IG5hbWUuc3BsaXQoJyAnKTtcbiAgICAgICAgICAgIGZpcnN0TmFtZSA9IG5hbWVBcnJbMF07XG4gICAgICAgICAgICBsYXN0TmFtZSA9IG5hbWVBcnJbMV07XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZW1haWwgPSByZXEuYm9keS5lbWFpbDtcbiAgICAgICAgY29uc3QgYXJ0SWQgPSByZXEuYm9keS5hcnRJZDtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgUmVnaXN0ZXJWb3Rlcih7XG4gICAgICAgICAgICAnX2lkJzogbmV3IE9iamVjdElkKCkudG9IZXhTdHJpbmcoKSxcbiAgICAgICAgICAgICdGaXJzdE5hbWUnOiBmaXJzdE5hbWUsXG4gICAgICAgICAgICAnTGFzdE5hbWUnOiBsYXN0TmFtZSxcbiAgICAgICAgICAgICdFbWFpbCc6IGVtYWlsLFxuICAgICAgICAgICAgJ1Bob25lTnVtYmVyJzogcGhvbmUsXG4gICAgICAgICAgICAnSGFzaCc6ICcnLFxuICAgICAgICAgICAgJ0Rpc3BsYXlQaG9uZSc6ICcnLFxuICAgICAgICAgICAgJ1JlZ2lvbkNvZGUnOiAnJyxcbiAgICAgICAgICAgICdQcmVmZXJlbmNlcyc6IFtdLFxuICAgICAgICAgICAgJ05pY2tOYW1lJzogJycsXG4gICAgICAgICAgICBBcnRCYXR0bGVOZXdzOiBmYWxzZSxcbiAgICAgICAgICAgIE5vdGlmaWNhdGlvbkVtYWlsczogZmFsc2UsXG4gICAgICAgICAgICBMb3lhbHR5T2ZmZXJzOiBmYWxzZSxcbiAgICAgICAgICAgIFJlZ2lzdGVyZWRBdDogJ2Rvb3InXG4gICAgICAgIH0sIHJlcS5ib2R5LmV2ZW50SWQsIGZhbHNlLCAxLCB0cnVlKTtcbiAgICAgICAgY29uc3QgcmVnaXN0cmF0aW9uSWQgPSByZXN1bHQuRGF0YS5SZWdpc3RyYXRpb25JZDtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBfYmlkKGFydElkLCBiaWQsIGF3YWl0IFJlZ2lzdHJhdGlvbk1vZGVsLmZpbmRCeUlkKHJlZ2lzdHJhdGlvbklkKSwgcmVxLmNvbm5lY3Rpb24ucmVtb3RlQWRkcmVzcywgdHJ1ZSk7XG4gICAgICAgIGxldCBtZXNzYWdlID0gJ0JpZCBSZWNvcmRlZCc7XG4gICAgICAgIGlmIChyZXNwb25zZS5pc091dGJpZCkge1xuICAgICAgICAgICAgbWVzc2FnZSA9ICdCaWQgUmVjb3JkZWQgJiBPdXRiaWQnO1xuICAgICAgICB9XG4gICAgICAgIHJlcy5qc29uKHtcbiAgICAgICAgICAgICdTdWNjZXNzJzogdHJ1ZSxcbiAgICAgICAgICAgICdNZXNzYWdlJzogbWVzc2FnZSxcbiAgICAgICAgICAgICdjb2RlJzogJ1NVQ0NFU1MnXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCBjYWNoZURlbCA9IHJlcS5hcHAuZ2V0KCdjYWNoZURlbCcpO1xuICAgICAgICBsb2dnZXIuaW5mbyhgcmVtb3ZpbmcgYXVjdGlvbi1kZXRhaWwtJHtyZXEucGFyYW1zLmFydElkfWApO1xuICAgICAgICBjb25zdCBkZWxSZXMgPSBhd2FpdCBjYWNoZURlbChgYXVjdGlvbi1kZXRhaWwtJHtyZXEucGFyYW1zLmFydElkfWApO1xuICAgICAgICBsb2dnZXIuaW5mbyhgcmVtb3ZlZCBhdWN0aW9uLWRldGFpbC0ke3JlcS5wYXJhbXMuYXJ0SWR9LCAke0pTT04uc3RyaW5naWZ5KGRlbFJlcywgbnVsbCwgMil9YCk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCBfcHJvY2Vzc0JpZE5vdGlmaWNhdGlvbihyZXNwb25zZSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihgSWdub3JlIGVycm9yICR7ZS5tZXNzYWdlfSAke2Uuc3RhY2t9YCk7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcihgJHtlLm1lc3NhZ2V9ICR7ZS5zdGFja31gKTtcbiAgICAgICAgbmV4dChlKTtcbiAgICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzYXZlTG90Q29uZmlnKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgYXJ0SWQgPSByZXEucGFyYW1zLmFydElkO1xuICAgICAgICBjb25zdCBsb3RNb2RlbCA9IGF3YWl0IExvdE1vZGVsLmZpbmRPbmUoe1xuICAgICAgICAgICAgQXJ0SWQ6IGFydElkXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIWxvdE1vZGVsKSB7XG4gICAgICAgICAgICByZXMuanNvbih7XG4gICAgICAgICAgICAgICAgc3RhdHVzOiA0MDQsXG4gICAgICAgICAgICAgICAgTWVzc2FnZTogJ05vdCBGb3VuZCcsXG4gICAgICAgICAgICAgICAgY29kZTogJ0ZBSUwnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBpc0FkbWluID0gZmFsc2U7XG4gICAgICAgIGlmIChyZXEudXNlciAmJiByZXEudXNlci5pc0FkbWluKSB7XG4gICAgICAgICAgICBpc0FkbWluID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChyZXEudXNlciAmJiByZXEudXNlci5Jc0V2ZW50QWRtaW4gJiYgQXJyYXkuaXNBcnJheShyZXEudXNlci5ldmVudElkcykpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVxLnVzZXIuZXZlbnRJZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoYCR7bG90TW9kZWwuRXZlbnQuX2lkfWAgPT0gYCR7cmVxLnVzZXIuZXZlbnRJZHNbaV19YCkge1xuICAgICAgICAgICAgICAgICAgICBpc0FkbWluID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghaXNBZG1pbikge1xuICAgICAgICAgICAgcmVzLmpzb24oe1xuICAgICAgICAgICAgICAgIHN0YXR1czogNDAzLFxuICAgICAgICAgICAgICAgIE1lc3NhZ2U6ICdGb3JiaWRkZW4nLFxuICAgICAgICAgICAgICAgIGNvZGU6ICdGQUlMJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgbG90TW9kZWwuRGVzY3JpcHRpb24gPSByZXEuYm9keS5EZXNjcmlwdGlvbjtcbiAgICAgICAgbG90TW9kZWwuV2lkdGhBbmRIZWlnaHQgPSByZXEuYm9keS5XaWR0aEFuZEhlaWdodDtcbiAgICAgICAgYXdhaXQgbG90TW9kZWwuc2F2ZSgpO1xuICAgICAgICBjb25zdCBjYWNoZURlbCA9IHJlcS5hcHAuZ2V0KCdjYWNoZURlbCcpO1xuICAgICAgICBsb2dnZXIuaW5mbyhgcmVtb3ZpbmcgYXVjdGlvbi1kZXRhaWwtJHthcnRJZH0gZHVlIHRvIGRlc2NyaXB0aW9uL3dpZHRoIGFuZCBoZWlnaHQgY2hhbmdlYCk7XG4gICAgICAgIGNvbnN0IGRlbFJlcyA9IGF3YWl0IGNhY2hlRGVsKGBhdWN0aW9uLWRldGFpbC0ke2FydElkfWApO1xuICAgICAgICBsb2dnZXIuaW5mbyhgcmVtb3ZlZCBhdWN0aW9uLWRldGFpbC0ke2FydElkfSAgZHVlIHRvIGRlc2NyaXB0aW9uL3dpZHRoIGFuZCBoZWlnaHQgY2hhbmdlLCAke0pTT04uc3RyaW5naWZ5KGRlbFJlcywgbnVsbCwgMil9YCk7XG4gICAgICAgIHJlcy5qc29uKHtcbiAgICAgICAgICAgICdTdWNjZXNzJzogdHJ1ZSxcbiAgICAgICAgICAgICdNZXNzYWdlJzogYExvdCBTYXZlZGAsXG4gICAgICAgICAgICAnY29kZSc6ICdTVUNDRVNTJ1xuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdXBkYXRlT25saW5lQXVjdGlvblBheW1lbnRTaGVldChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGFydElkID0gcmVxLmJvZHkuYXJ0SWQ7XG4gICAgICAgIGNvbnN0IHBob25lTnVtYmVyID0gcmVxLmJvZHkucGhvbmU7XG4gICAgICAgIGNvbnN0IGVtYWlsID0gcmVxLmJvZHkuZW1haWw7XG4gICAgICAgIGNvbnN0IG5hbWUgPSByZXEuYm9keS5uYW1lO1xuICAgICAgICBjb25zdCBuaWNrbmFtZSA9IHJlcS5ib2R5Lm5pY2tuYW1lO1xuICAgICAgICBjb25zdCBMb3QgPSBhd2FpdCBMb3RNb2RlbC5maW5kT25lKHtcbiAgICAgICAgICAgIEFydElkOiBhcnRJZFxuICAgICAgICB9KS5wb3B1bGF0ZSgnQmlkcy5SZWdpc3RyYXRpb24nKVxuICAgICAgICAgICAgLnBvcHVsYXRlKCdFdmVudC5Sb3VuZHMuQ29udGVzdGFudHMuRGV0YWlsJyk7XG4gICAgICAgIGlmICghTG90KSB7XG4gICAgICAgICAgICBuZXh0KHtcbiAgICAgICAgICAgICAgICBzdGF0dXM6IDQwMyxcbiAgICAgICAgICAgICAgICBNZXNzYWdlOiAnSW52YWxpZCBhcnQgSUQnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiA7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgbG90c0J5QXJ0SWRNYXA6IHtba2V5OiBzdHJpbmddOiBMb3REVE99ID0ge307XG4gICAgICAgIGxvdHNCeUFydElkTWFwW0xvdC5BcnRJZC50b1N0cmluZygpXSA9IExvdDtcbiAgICAgICAgY29uc3QgZXZlbnRJZCA9IExvdC5FdmVudC5faWQ7XG4gICAgICAgIGNvbnN0IGV2ZW50ID0gYXdhaXQgRXZlbnRNb2RlbC5maW5kQnlJZChldmVudElkKVxuICAgICAgICAgICAgLnNlbGVjdChbJ1JvdW5kcycsICdOYW1lJywgJ0VJRCcsICdUaW1lWm9uZUlDQU5OJywgJ0N1cnJlbmN5J10pXG4gICAgICAgICAgICAucG9wdWxhdGUoJ1JvdW5kcy5Db250ZXN0YW50cy5EZXRhaWwnKVxuICAgICAgICAgICAgLnBvcHVsYXRlKCdDdXJyZW5jeScpO1xuICAgICAgICBjb25zdCBleGNlbFJvd3M6IFtzdHJpbmdbXT9dID0gW107XG5cbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBldmVudC5Sb3VuZHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgZXZlbnQuUm91bmRzW2pdLkNvbnRlc3RhbnRzLmxlbmd0aDsgaysrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYXJ0SWQgPSBgJHtldmVudC5FSUR9LSR7ZXZlbnQuUm91bmRzW2pdLlJvdW5kTnVtYmVyfS0ke2V2ZW50LlJvdW5kc1tqXS5Db250ZXN0YW50c1trXS5FYXNlbE51bWJlcn1gO1xuICAgICAgICAgICAgICAgIGlmIChhcnRJZCA9PT0gcmVxLmJvZHkuYXJ0SWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxvdHNCeUFydElkTWFwW2FydElkLnRvU3RyaW5nKCldICYmIGV2ZW50LlJvdW5kc1tqXS5Db250ZXN0YW50c1trXS5FbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleGNlbFJvdzogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50LlJvdW5kc1tqXS5Db250ZXN0YW50c1trXS5MYXN0QmlkUHJpY2UgPSAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnQuUm91bmRzW2pdLkNvbnRlc3RhbnRzW2tdID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShldmVudC5Sb3VuZHNbal0uQ29udGVzdGFudHNba10pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4Y2VsUm93LnB1c2goZXZlbnQuTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBleGNlbFJvdy5wdXNoKGFydElkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4Y2VsUm93LnB1c2goZXZlbnQuUm91bmRzW2pdLkNvbnRlc3RhbnRzW2tdLkRldGFpbC5OYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4Y2VsUm93LnB1c2gobG90c0J5QXJ0SWRNYXBbYXJ0SWRdLkJpZHMubGVuZ3RoLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGJpZDogQmlkRFRPO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCBsb3RzQnlBcnRJZE1hcFthcnRJZC50b1N0cmluZygpXS5CaWRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBiaWQgPSBsb3RzQnlBcnRJZE1hcFthcnRJZC50b1N0cmluZygpXS5CaWRzLnJlZHVjZSgoYTogQmlkRFRPLCBiOiBCaWREVE8pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChhLkFtb3VudCA+IGIuQW1vdW50KSA/IGEgOiBiO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgZXhjZWxSb3cucHVzaCgoZXZlbnQuQ3VycmVuY3kgJiYgZXZlbnQuQ3VycmVuY3kuY3VycmVuY3lfc3ltYm9sIHx8ICckJykgKyAoYmlkICYmIGJpZC5BbW91bnQgfHwgJzAnKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBleGNlbFJvdy5wdXNoKGV2ZW50LkN1cnJlbmN5ICYmIGV2ZW50LkN1cnJlbmN5LmN1cnJlbmN5X2xhYmVsIHx8ICd1c2QnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsb3NlVGltZSA9IGZvcm1hdFRvVGltZVpvbmUobmV3IERhdGUobG90c0J5QXJ0SWRNYXBbYXJ0SWRdLnVwZGF0ZWRBdCksICdZWVlZLU1NLUREIGhoOm1tIEEnLCAgeyB0aW1lWm9uZTogZXZlbnQuVGltZVpvbmVJQ0FOTiB9KS50b1N0cmluZygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXhjZWxSb3cucHVzaChjbG9zZVRpbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZXhjZWxSb3cucHVzaChyZXEuYm9keS5zZWNyZXRfY29kZSk7IC8vIGNyZWRpdCBhcHBsaWVkXG4gICAgICAgICAgICAgICAgICAgICAgICBleGNlbFJvdy5wdXNoKHJlcS5ib2R5LnRvdGFsKTsgLy8gZmluYWwgcGF5bWVudFxuICAgICAgICAgICAgICAgICAgICAgICAgZXhjZWxSb3cucHVzaChuaWNrbmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBleGNlbFJvdy5wdXNoKHBob25lTnVtYmVyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4Y2VsUm93LnB1c2gobmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBleGNlbFJvdy5wdXNoKGVtYWlsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4Y2VsUm93LnB1c2gocmVxLmJvZHkuY2FyZF90eXBlKTsgLy8gQnV5ZXIgUGFpZD9cbiAgICAgICAgICAgICAgICAgICAgICAgIGV4Y2VsUm93LnB1c2gocmVxLmJvZHkuZGVsaXZlcnkpOyAvLyBEZWxpdmVyeSBPcHRpb25cbiAgICAgICAgICAgICAgICAgICAgICAgIGV4Y2VsUm93LnB1c2gocmVxLmJvZHkuc3RyZWV0X2FkZHJlc3MpOyAvLyBBZGRyZXNzIDFcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4Y2VsUm93LnB1c2gocmVxLmJvZHkuc3RyZWV0X2FkZHJlc3NfbGluZTIpOyAvLyBBZGRyZXNzIDJcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4Y2VsUm93LnB1c2gocmVxLmJvZHkuY2l0eSk7IC8vIEFkZHJlc3MgQ2l0eVxuICAgICAgICAgICAgICAgICAgICAgICAgZXhjZWxSb3cucHVzaChyZXEuYm9keS56aXApOyAvLyBBZGRyZXNzIFppcFxuICAgICAgICAgICAgICAgICAgICAgICAgZXhjZWxSb3cucHVzaCgnJyk7IC8vXG4gICAgICAgICAgICAgICAgICAgICAgICBleGNlbFJvdy5wdXNoKHJlcS5ib2R5LmNhcmRfdHlwZSk7IC8vIEFydGlzdCBQYWlkP1xuICAgICAgICAgICAgICAgICAgICAgICAgZXhjZWxSb3dzLnB1c2goZXhjZWxSb3cpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgbmV3IEV4cG9ydFRvRXhjZWxDbGFzcygpLmluc2VydEluU2hlZXQoZXhjZWxSb3dzKTtcbiAgICAgICAgcmVzLmpzb24oZXhjZWxSb3dzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYmlkc0V4cG9ydChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGV2ZW50SWQgPSByZXEucGFyYW1zLmV2ZW50SWQ7XG4gICAgICAgIGNvbnN0IExvdHMgPSBhd2FpdCBMb3RNb2RlbC5maW5kKHsnRXZlbnQnOiBldmVudElkfSkucG9wdWxhdGUoJ0JpZHMuUmVnaXN0cmF0aW9uJykuZXhlYygpO1xuICAgICAgICBjb25zdCBmaWVsZHMgPSBbXG4gICAgICAgICAgICAnQXJ0SWQnLCAnRWFzZWxOdW1iZXInLCAnUm91bmQnLCAnQW1vdW50JywgJ1Bob25lTnVtYmVyJywgJ0VtYWlsJyxcbiAgICAgICAgICAgICdGaXJzdE5hbWUnLCAnTGFzdE5hbWUnLCAnU3RhdHVzJywgJ05pY2tOYW1lJ1xuICAgICAgICBdO1xuICAgICAgICBsZXQgdG90YWxSb3dzID0gMTtcbiAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1kaXNwb3NpdGlvbicsIGBhdHRhY2htZW50OyBmaWxlbmFtZT1iaWRzX2V4cG9ydF8ke2V2ZW50SWR9LmNzdmApO1xuICAgICAgICByZXMuc2V0KCdDb250ZW50LVR5cGUnLCAndGV4dC9jc3YnKTtcbiAgICAgICAgY29uc3QgY3N2U3RyZWFtID0gY3N2LmNyZWF0ZVdyaXRlU3RyZWFtKHtoZWFkZXJzOiBmaWVsZHN9KTtcbiAgICAgICAgY3N2U3RyZWFtLnBpcGUocmVzKTtcbiAgICAgICAgY3N2U3RyZWFtLndyaXRlKFtdKTtcbiAgICAgICAgaWYgKExvdHMpIHtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgTG90cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGxldCBoaWdoZXJCaWQgPSAwO1xuICAgICAgICAgICAgICAgIGxldCBoaWdoZXJCaWRkZXJJbmRleCA9IDA7XG4gICAgICAgICAgICAgICAgY29uc3QgTG90RWxlbWVudCA9IHtcbiAgICAgICAgICAgICAgICAgICAgJ0FydElkJzogTG90c1tpXS5BcnRJZCxcbiAgICAgICAgICAgICAgICAgICAgJ0Vhc2VsTnVtYmVyJzogTG90c1tpXS5FYXNlbE51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgJ1JvdW5kJzogTG90c1tpXS5Sb3VuZCxcbiAgICAgICAgICAgICAgICAgICAgJ0JpZHMnOiBMb3RzW2ldLkJpZHMubWFwKChCaWQsIGluZGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoQmlkLkFtb3VudCA+IGhpZ2hlckJpZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhpZ2hlckJpZCA9IEJpZC5BbW91bnQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGlnaGVyQmlkZGVySW5kZXggPSBpbmRleDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ0Ftb3VudCc6IEJpZC5BbW91bnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1Bob25lTnVtYmVyJzogQmlkLlJlZ2lzdHJhdGlvbi5QaG9uZU51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnRW1haWwnOiBCaWQuUmVnaXN0cmF0aW9uLkVtYWlsLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdGaXJzdE5hbWUnOiBCaWQuUmVnaXN0cmF0aW9uLkZpcnN0TmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAnTGFzdE5hbWUnOiBCaWQuUmVnaXN0cmF0aW9uLkxhc3ROYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdTdGF0dXMnOiAnQmlkZGVycycsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ05pY2tOYW1lJzogQmlkLlJlZ2lzdHJhdGlvbi5OaWNrTmFtZVxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgaWYgKExvdEVsZW1lbnQuQmlkc1toaWdoZXJCaWRkZXJJbmRleF0pIHtcbiAgICAgICAgICAgICAgICAgICAgTG90RWxlbWVudC5CaWRzW2hpZ2hlckJpZGRlckluZGV4XS5TdGF0dXMgPSAnV2lubmVyJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgayA9IDA7IGsgPCBMb3RFbGVtZW50LkJpZHMubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2h1bmsgPSBbXG4gICAgICAgICAgICAgICAgICAgICAgICBMb3RFbGVtZW50LkFydElkLFxuICAgICAgICAgICAgICAgICAgICAgICAgTG90RWxlbWVudC5FYXNlbE51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgIExvdEVsZW1lbnQuUm91bmQsXG4gICAgICAgICAgICAgICAgICAgICAgICBMb3RFbGVtZW50LkJpZHNba10uQW1vdW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgTG90RWxlbWVudC5CaWRzW2tdLlBob25lTnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgTG90RWxlbWVudC5CaWRzW2tdLkVtYWlsLFxuICAgICAgICAgICAgICAgICAgICAgICAgTG90RWxlbWVudC5CaWRzW2tdLkZpcnN0TmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIExvdEVsZW1lbnQuQmlkc1trXS5MYXN0TmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIExvdEVsZW1lbnQuQmlkc1trXS5TdGF0dXMsXG4gICAgICAgICAgICAgICAgICAgICAgICBMb3RFbGVtZW50LkJpZHNba10uTmlja05hbWVcbiAgICAgICAgICAgICAgICAgICAgXTtcbiAgICAgICAgICAgICAgICAgICAgY3N2U3RyZWFtLndyaXRlKGNodW5rKTtcbiAgICAgICAgICAgICAgICAgICAgdG90YWxSb3dzICsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjc3ZTdHJlYW0uZW5kKCk7XG4gICAgICAgIHJlcy5zdGF0dXMoMjAwKS5zZW5kKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBuZXh0KGUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIEF1Y3Rpb25QYXltZW50U3RhdHVzKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZXZlbnRJZHMgPSByZXEuYm9keS5ldmVudElkcztcbiAgICAgICAgaWYgKCFldmVudElkcyB8fCBldmVudElkcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNDAzKTtcbiAgICAgICAgICAgIHJlcy5qc29uKHtcbiAgICAgICAgICAgICAgICBTdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBNZXNzYWdlOiAnRXZlbnQgSWQgaXMgcmVxdWlyZWQnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiA7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgICAgIExvdE1vZGVsLmZpbmQoe1xuICAgICAgICAgICAgICAgIEV2ZW50OiB7JGluOiBldmVudElkc31cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLnBvcHVsYXRlKCdCaWRzLlJlZ2lzdHJhdGlvbicpXG4gICAgICAgICAgICAgICAgLnBvcHVsYXRlKCdBcnRpc3RQYXlSZWNlbnRVc2VyJylcbiAgICAgICAgICAgICAgICAucG9wdWxhdGUoJ0J1eWVyUGF5UmVjZW50VXNlcicpXG4gICAgICAgICAgICAgICAgLnBvcHVsYXRlKCdBcnRpc3RQYXlSZWNlbnRSZWdpc3RyYXRpb24nKVxuICAgICAgICAgICAgICAgIC5wb3B1bGF0ZSgnQnV5ZXJQYXlSZWNlbnRSZWdpc3RyYXRpb24nKVxuICAgICAgICAgICAgICAgIC5zZWxlY3QoWydBcnRJZCcsICdCaWRzJywgJ0Vhc2VsTnVtYmVyJywgJ1JvdW5kJywgJ0FydGlzdFBheVJlY2VudFN0YXR1cycsICdBcnRpc3RQYXlSZWNlbnREYXRlJyxcbiAgICAgICAgICAgICAgICAgICAgJ0J1eWVyUGF5UmVjZW50U3RhdHVzJywgJ0V2ZW50JywgJ0FydGlzdFBheVJlY2VudFVzZXInLCAnQnV5ZXJQYXlSZWNlbnRVc2VyJywgJ0J1eWVyUGF5UmVjZW50RGF0ZScsXG4gICAgICAgICAgICAgICAgICAgICdCdXllclBheVJlY2VudFJlZ2lzdHJhdGlvbicsICdBcnRpc3RQYXlSZWNlbnRSZWdpc3RyYXRpb24nXSksXG4gICAgICAgICAgICBFdmVudE1vZGVsLmZpbmQoe19pZDogeyRpbjogZXZlbnRJZHN9fSlcbiAgICAgICAgICAgICAgICAucG9wdWxhdGUoJ1JvdW5kcy5Db250ZXN0YW50cy5EZXRhaWwnKVxuICAgICAgICAgICAgICAgIC5wb3B1bGF0ZSgnQ3VycmVuY3knKVxuICAgICAgICAgICAgICAgIC5zZWxlY3QoWydSb3VuZHMnLCAnRUlEJywgJ05hbWUnLCAnQ3VycmVuY3knXSksXG4gICAgICAgICAgICBQYXltZW50U3RhdHVzTW9kZWwuZmluZCgpXG4gICAgICAgIF0pO1xuICAgICAgICBjb25zdCBldmVudHMgPSByZXN1bHRzWzFdO1xuICAgICAgICBjb25zdCBMb3RzID0gcmVzdWx0c1swXTtcbiAgICAgICAgY29uc3QgcGF5bWVudFN0YXR1c2VzID0gcmVzdWx0c1syXTtcbiAgICAgICAgaWYgKExvdHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzKDQwNCk7XG4gICAgICAgICAgICByZXMuanNvbih7XG4gICAgICAgICAgICAgICAgU3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgTWVzc2FnZTogJ05vIExvdHMgcHJlc2VudCBpbiBldmVudCdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmVzLnN0YXR1cyg0MDQpO1xuICAgICAgICAgICAgcmVzLmpzb24oe1xuICAgICAgICAgICAgICAgIFN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIE1lc3NhZ2U6ICdFdmVudCBJZHMgbm90IGZvdW5kJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwYXltZW50U3RhdHVzZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzKDQwNCk7XG4gICAgICAgICAgICByZXMuanNvbih7XG4gICAgICAgICAgICAgICAgU3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgTWVzc2FnZTogJ05vIHBheW1lbnQgc3RhdHVzZXMgaW4gZGInXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiA7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZXZlbnRJZE1hcDoge1trZXk6IHN0cmluZ106IEV2ZW50RFRPfSA9IHt9O1xuICAgICAgICBjb25zdCBwYXltZW50U3RhdHVzTWFwOiB7W2tleTogc3RyaW5nXTogUGF5bWVudFN0YXR1c0RUT30gPSB7fTtcbiAgICAgICAgY29uc3QgYXJ0SWRDb250ZXN0YW50TWFwOiB7W2tleTogc3RyaW5nXTogUm91bmRDb250ZXN0YW50RFRPfSA9IHt9O1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV2ZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZXZlbnQgPSBldmVudHNbaV07XG4gICAgICAgICAgICBldmVudElkTWFwW2V2ZW50Ll9pZF0gPSBldmVudDtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXZlbnQuUm91bmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgcm91bmQgPSBldmVudC5Sb3VuZHNbaV07XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCByb3VuZC5Db250ZXN0YW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250ZXN0YW50ID0gcm91bmQuQ29udGVzdGFudHNbal07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFydElkID0gYCR7ZXZlbnQuRUlEfS0ke3JvdW5kLlJvdW5kTnVtYmVyfS0ke2NvbnRlc3RhbnQuRWFzZWxOdW1iZXJ9YDtcbiAgICAgICAgICAgICAgICAgICAgYXJ0SWRDb250ZXN0YW50TWFwW2FydElkXSA9IGNvbnRlc3RhbnQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgcGF5bWVudFN0YXR1c2VzLmxlbmd0aDsgaysrKSB7XG4gICAgICAgICAgICBwYXltZW50U3RhdHVzTWFwW3BheW1lbnRTdGF0dXNlc1trXS5faWRdID0gcGF5bWVudFN0YXR1c2VzW2tdO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBheVN0YXR1c0FyciA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IExvdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IExvdCA9IExvdHNbaV07XG4gICAgICAgICAgICBjb25zdCBjb250ZXN0YW50ID0gYXJ0SWRDb250ZXN0YW50TWFwW0xvdC5BcnRJZF07XG4gICAgICAgICAgICBjb25zdCBldmVudCA9IGV2ZW50SWRNYXBbTG90LkV2ZW50Ll9pZF07XG4gICAgICAgICAgICBpZiAoY29udGVzdGFudCAmJiBldmVudCkge1xuICAgICAgICAgICAgICAgIGxldCBhcnRpc3RQYXllck5hbWU7XG4gICAgICAgICAgICAgICAgbGV0IGJ1eWVyUGF5ZXJOYW1lO1xuICAgICAgICAgICAgICAgIGlmIChMb3QuQXJ0aXN0UGF5UmVjZW50UmVnaXN0cmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIGFydGlzdFBheWVyTmFtZSA9IExvdC5BcnRpc3RQYXlSZWNlbnRSZWdpc3RyYXRpb24uRW1haWwgfHwgYCR7TG90LkFydGlzdFBheVJlY2VudFJlZ2lzdHJhdGlvbi5GaXJzdE5hbWUgfHwgJyd9ICR7TG90LkFydGlzdFBheVJlY2VudFJlZ2lzdHJhdGlvbi5MYXN0TmFtZSB8fCAnJ31gO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoTG90LkFydGlzdFBheVJlY2VudFVzZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgYXJ0aXN0UGF5ZXJOYW1lID0gYCR7TG90LkFydGlzdFBheVJlY2VudFVzZXIuZW1haWx9YDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKExvdC5CdXllclBheVJlY2VudFJlZ2lzdHJhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBidXllclBheWVyTmFtZSA9IExvdC5CdXllclBheVJlY2VudFJlZ2lzdHJhdGlvbi5FbWFpbCB8fCBgJHtMb3QuQnV5ZXJQYXlSZWNlbnRSZWdpc3RyYXRpb24uRmlyc3ROYW1lIHx8ICcnfSAke0xvdC5CdXllclBheVJlY2VudFJlZ2lzdHJhdGlvbi5MYXN0TmFtZSB8fCAnJ31gO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoTG90LkJ1eWVyUGF5UmVjZW50VXNlcikge1xuICAgICAgICAgICAgICAgICAgICBidXllclBheWVyTmFtZSA9IGAke0xvdC5CdXllclBheVJlY2VudFVzZXIuZW1haWx9YDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc3QgQXJ0aXN0UGF5UmVjZW50U3RhdHVzID0gTG90LkFydGlzdFBheVJlY2VudFN0YXR1cyAmJiBMb3QuQXJ0aXN0UGF5UmVjZW50U3RhdHVzLl9pZCA/IHBheW1lbnRTdGF0dXNNYXBbTG90LkFydGlzdFBheVJlY2VudFN0YXR1cyAmJiBMb3QuQXJ0aXN0UGF5UmVjZW50U3RhdHVzLl9pZF0gOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgY29uc3QgQnV5ZXJQYXlSZWNlbnRTdGF0dXMgPSBMb3QuQnV5ZXJQYXlSZWNlbnRTdGF0dXMgJiYgTG90LkJ1eWVyUGF5UmVjZW50U3RhdHVzLl9pZCA/IHBheW1lbnRTdGF0dXNNYXBbTG90LkJ1eWVyUGF5UmVjZW50U3RhdHVzICYmIExvdC5CdXllclBheVJlY2VudFN0YXR1cy5faWRdIDogdW5kZWZpbmVkO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBheVN0YXR1c09iajogUGF5bWVudFN0YXR1c1Jlc3BvbnNlID0ge1xuICAgICAgICAgICAgICAgICAgICBMb3RJZDogTG90Ll9pZCxcbiAgICAgICAgICAgICAgICAgICAgQXJ0aXN0TmFtZTogY29udGVzdGFudC5EZXRhaWwuTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgQXJ0aXN0SWQ6IGNvbnRlc3RhbnQuX2lkLFxuICAgICAgICAgICAgICAgICAgICBCaWRzOiBMb3QuQmlkcyxcbiAgICAgICAgICAgICAgICAgICAgRXZlbnROYW1lOiBldmVudC5OYW1lLFxuICAgICAgICAgICAgICAgICAgICBBcnRJZDogTG90LkFydElkLFxuICAgICAgICAgICAgICAgICAgICBBcnRpc3RQYXlSZWNlbnRTdGF0dXM6IEFydGlzdFBheVJlY2VudFN0YXR1cyxcbiAgICAgICAgICAgICAgICAgICAgQnV5ZXJQYXlSZWNlbnRTdGF0dXM6IEJ1eWVyUGF5UmVjZW50U3RhdHVzLFxuICAgICAgICAgICAgICAgICAgICBJbWFnZTogY29udGVzdGFudC5JbWFnZXNbY29udGVzdGFudC5JbWFnZXMubGVuZ3RoIC0gMV0sXG4gICAgICAgICAgICAgICAgICAgIEJ1eWVyUGF5UmVjZW50RGF0ZTogTG90LkJ1eWVyUGF5UmVjZW50RGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgQXJ0aXN0UGF5UmVjZW50RGF0ZTogTG90LkFydGlzdFBheVJlY2VudERhdGUsXG4gICAgICAgICAgICAgICAgICAgIEJ1eWVyUGF5UmVjZW50VXNlcjogYnV5ZXJQYXllck5hbWUgfHwgJycsXG4gICAgICAgICAgICAgICAgICAgIEFydGlzdFBheVJlY2VudFVzZXI6IGFydGlzdFBheWVyTmFtZSB8fCAnJyxcbiAgICAgICAgICAgICAgICAgICAgQ3VycmVuY3lTeW1ib2w6IGV2ZW50LkN1cnJlbmN5ICYmIGV2ZW50LkN1cnJlbmN5LmN1cnJlbmN5X3N5bWJvbCB8fCAnJCdcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHBheVN0YXR1c0Fyci5wdXNoKHBheVN0YXR1c09iaik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBheVN0YXR1c0Fyci5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNDA0KTtcbiAgICAgICAgICAgIHJlcy5qc29uKHtcbiAgICAgICAgICAgICAgICBTdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBNZXNzYWdlOiAnTm8gTG90cydcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8UGF5bWVudFN0YXR1c1Jlc3BvbnNlW10+ID0ge1xuICAgICAgICAgICAgJ1N1Y2Nlc3MnOiB0cnVlLFxuICAgICAgICAgICAgRGF0YTogcGF5U3RhdHVzQXJyXG4gICAgICAgIH07XG4gICAgICAgIHJlcy5qc29uKHJlc3VsdCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBuZXh0KGUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIEF1Y3Rpb25QYXltZW50U3RhdHVzT3B0aW9ucyhyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHBheW1lbnRTdGF0dXNPcHRpb25zID0gYXdhaXQgUGF5bWVudFN0YXR1c01vZGVsLmZpbmQoe1xuICAgICAgICAgICAgYWN0aXZlOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8UGF5bWVudFN0YXR1c0RUT1tdPiA9IHtcbiAgICAgICAgICAgICdTdWNjZXNzJzogdHJ1ZSxcbiAgICAgICAgICAgIERhdGE6IHBheW1lbnRTdGF0dXNPcHRpb25zXG4gICAgICAgIH07XG4gICAgICAgIHJlcy5qc29uKHJlc3VsdCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBuZXh0KGUpO1xuICAgIH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIE1hcmtCdXllclBhaWQocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICB0cnkge1xuICAgICAgICAvLyBUT0RPIGhhbmRsZSByZXNldHRpbmcgb2YgcGFpZCBzdGF0dXNcbiAgICAgICAgaWYgKCFyZXEuYm9keS5Mb3RJZCkge1xuICAgICAgICAgICAgcmVzLnN0YXR1cyg0MDQpO1xuICAgICAgICAgICAgcmVzLmpzb24oe1xuICAgICAgICAgICAgICAgIFN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIE1lc3NhZ2U6ICdQbGVhc2UgcGFzcyBMb3RJZCdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXJlcS5ib2R5LkJ1eWVyUGF5UmVjZW50U3RhdHVzKSB7XG4gICAgICAgICAgICByZXMuc3RhdHVzKDQwNCk7XG4gICAgICAgICAgICByZXMuanNvbih7XG4gICAgICAgICAgICAgICAgU3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgTWVzc2FnZTogJ1BsZWFzZSBwYXNzIEJ1eWVyUGF5UmVjZW50U3RhdHVzJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgTG90ID0gYXdhaXQgTG90TW9kZWwuZmluZEJ5SWQocmVxLmJvZHkuTG90SWQpO1xuICAgICAgICBpZiAoIUxvdCkge1xuICAgICAgICAgICAgcmVzLnN0YXR1cyg0MDQpO1xuICAgICAgICAgICAgcmVzLmpzb24oe1xuICAgICAgICAgICAgICAgIFN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIE1lc3NhZ2U6ICdJbnZhbGlkIExvdCBpZCdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBkYXRlT2JqID0gbmV3IERhdGUoKTtcbiAgICAgICAgY29uc3QgdXNlclJlZyA9IHJlcS51c2VyLlBob25lTnVtYmVyID8gcmVxLnVzZXIgOiB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnN0IHVzZXIgPSAhcmVxLnVzZXIuUGhvbmVOdW1iZXIgPyByZXEudXNlciA6IHVuZGVmaW5lZDtcbiAgICAgICAgTG90LkJ1eWVyUGF5UmVjZW50U3RhdHVzID0gcmVxLmJvZHkuQnV5ZXJQYXlSZWNlbnRTdGF0dXM7XG4gICAgICAgIExvdC5CdXllclBheVJlY2VudERhdGUgPSBkYXRlT2JqO1xuICAgICAgICBMb3QuQnV5ZXJQYWlkQ2hhbmdlTG9nLnB1c2goe1xuICAgICAgICAgICAgUmVnaXN0cmF0aW9uOiByZXEudXNlci5QaG9uZU51bWJlciA/IHJlcS51c2VyIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgVXNlcjogIXJlcS51c2VyLlBob25lTnVtYmVyID8gcmVxLnVzZXIgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICBjcmVhdGVkQXQ6IGRhdGVPYmosXG4gICAgICAgICAgICBQYWlkU3RhdHVzOiByZXEuYm9keS5CdXllclBheVJlY2VudFN0YXR1cyxcbiAgICAgICAgICAgIEJ1eWVyOiBMb3QuQmlkcy5zb3J0KChhLCBiKSA9PiBiLkFtb3VudCAtIGEuQW1vdW50KVswXS5SZWdpc3RyYXRpb25cbiAgICAgICAgfSk7XG4gICAgICAgIExvdC5CdXllclBheVJlY2VudERhdGUgPSBkYXRlT2JqO1xuICAgICAgICBMb3QuQnV5ZXJQYXlSZWNlbnRSZWdpc3RyYXRpb24gPSB1c2VyUmVnO1xuICAgICAgICBMb3QuQnV5ZXJQYXlSZWNlbnRVc2VyID0gdXNlcjtcbiAgICAgICAgYXdhaXQgTG90LnNhdmUoKTtcbiAgICAgICAgbGV0IGJ1eWVyUGF5ZXJOYW1lO1xuICAgICAgICBpZiAoTG90LkJ1eWVyUGF5UmVjZW50UmVnaXN0cmF0aW9uKSB7XG4gICAgICAgICAgICBidXllclBheWVyTmFtZSA9IExvdC5CdXllclBheVJlY2VudFJlZ2lzdHJhdGlvbi5FbWFpbCB8fCBgJHtMb3QuQnV5ZXJQYXlSZWNlbnRSZWdpc3RyYXRpb24uRmlyc3ROYW1lfSAke0xvdC5CdXllclBheVJlY2VudFJlZ2lzdHJhdGlvbi5MYXN0TmFtZX1gO1xuICAgICAgICB9XG4gICAgICAgIGlmIChMb3QuQnV5ZXJQYXlSZWNlbnRVc2VyKSB7XG4gICAgICAgICAgICBidXllclBheWVyTmFtZSA9IGAke0xvdC5CdXllclBheVJlY2VudFVzZXIuZW1haWx9YDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8QnV5ZXJQYWlkUmVzcG9uc2U+ID0ge1xuICAgICAgICAgICAgU3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgIERhdGE6IHtcbiAgICAgICAgICAgICAgICBCdXllclBheVJlY2VudERhdGU6IExvdC5CdXllclBheVJlY2VudERhdGUsXG4gICAgICAgICAgICAgICAgQnV5ZXJQYXlSZWNlbnRVc2VyOiBidXllclBheWVyTmFtZVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICByZXMuanNvbihyZXN1bHQpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgbmV4dChlKTtcbiAgICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBNYXJrQXJ0aXN0UGFpZChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICghcmVxLmJvZHkuTG90SWQpIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNDA0KTtcbiAgICAgICAgICAgIHJlcy5qc29uKHtcbiAgICAgICAgICAgICAgICBTdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBNZXNzYWdlOiAnUGxlYXNlIHBhc3MgTG90SWQnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFyZXEuYm9keS5BcnRpc3RQYXlSZWNlbnRTdGF0dXMpIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNDA0KTtcbiAgICAgICAgICAgIHJlcy5qc29uKHtcbiAgICAgICAgICAgICAgICBTdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBNZXNzYWdlOiAnUGxlYXNlIHBhc3MgQXJ0aXN0UGF5UmVjZW50U3RhdHVzJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXR1cm4gO1xuICAgICAgICB9XG4gICAgICAgIGlmICghcmVxLmJvZHkuQXJ0aXN0SWQpIHtcbiAgICAgICAgICAgIHJlcy5zdGF0dXMoNDA0KTtcbiAgICAgICAgICAgIHJlcy5qc29uKHtcbiAgICAgICAgICAgICAgICBTdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBNZXNzYWdlOiAnUGxlYXNlIHBhc3MgQXJ0aXN0SWQnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiA7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgTG90ID0gYXdhaXQgTG90TW9kZWwuZmluZEJ5SWQocmVxLmJvZHkuTG90SWQpO1xuICAgICAgICBpZiAoIUxvdCkge1xuICAgICAgICAgICAgcmVzLnN0YXR1cyg0MDQpO1xuICAgICAgICAgICAgcmVzLmpzb24oe1xuICAgICAgICAgICAgICAgIFN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIE1lc3NhZ2U6ICdJbnZhbGlkIExvdCBpZCdcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBkYXRlT2JqID0gbmV3IERhdGUoKTtcbiAgICAgICAgY29uc3QgdXNlclJlZyA9IHJlcS51c2VyLlBob25lTnVtYmVyID8gcmVxLnVzZXIgOiB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnN0IHVzZXIgPSAhcmVxLnVzZXIuUGhvbmVOdW1iZXIgPyByZXEudXNlciA6IHVuZGVmaW5lZDtcbiAgICAgICAgTG90LkFydGlzdFBheVJlY2VudFN0YXR1cyA9IHJlcS5ib2R5LkFydGlzdFBheVJlY2VudFN0YXR1cztcbiAgICAgICAgTG90LkFydGlzdFBhaWRDaGFuZ2VMb2cucHVzaCh7XG4gICAgICAgICAgICBSZWdpc3RyYXRpb246IHVzZXJSZWcsXG4gICAgICAgICAgICBVc2VyOiB1c2VyLFxuICAgICAgICAgICAgY3JlYXRlZEF0OiBkYXRlT2JqLFxuICAgICAgICAgICAgUGFpZFN0YXR1czogcmVxLmJvZHkuQXJ0aXN0UGF5UmVjZW50U3RhdHVzLFxuICAgICAgICAgICAgQXJ0aXN0OiByZXEuYm9keS5BcnRpc3RJZFxuICAgICAgICB9KTtcbiAgICAgICAgTG90LkFydGlzdFBheVJlY2VudERhdGUgPSBkYXRlT2JqO1xuICAgICAgICBMb3QuQXJ0aXN0UGF5UmVjZW50UmVnaXN0cmF0aW9uID0gdXNlclJlZztcbiAgICAgICAgTG90LkFydGlzdFBheVJlY2VudFVzZXIgPSB1c2VyO1xuICAgICAgICBhd2FpdCBMb3Quc2F2ZSgpO1xuICAgICAgICBsZXQgYXJ0aXN0UGF5ZXJOYW1lO1xuICAgICAgICBpZiAoTG90LkFydGlzdFBheVJlY2VudFJlZ2lzdHJhdGlvbikge1xuICAgICAgICAgICAgYXJ0aXN0UGF5ZXJOYW1lID0gTG90LkFydGlzdFBheVJlY2VudFJlZ2lzdHJhdGlvbi5FbWFpbCB8fCBgJHtMb3QuQXJ0aXN0UGF5UmVjZW50UmVnaXN0cmF0aW9uLkZpcnN0TmFtZX0gJHtMb3QuQXJ0aXN0UGF5UmVjZW50UmVnaXN0cmF0aW9uLkxhc3ROYW1lfWA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKExvdC5BcnRpc3RQYXlSZWNlbnRVc2VyKSB7XG4gICAgICAgICAgICBhcnRpc3RQYXllck5hbWUgPSBgJHtMb3QuQXJ0aXN0UGF5UmVjZW50VXNlci5lbWFpbCB8fCAnJ31gO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVzdWx0OiBEYXRhT3BlcmF0aW9uUmVzdWx0PEFydGlzdFBhaWRSZXNwb25zZT4gPSB7XG4gICAgICAgICAgICBTdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgRGF0YToge1xuICAgICAgICAgICAgICAgIEFydGlzdFBheVJlY2VudERhdGU6IExvdC5BcnRpc3RQYXlSZWNlbnREYXRlLFxuICAgICAgICAgICAgICAgIEFydGlzdFBheVJlY2VudFVzZXI6IGFydGlzdFBheWVyTmFtZVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICByZXMuanNvbihyZXN1bHQpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgbmV4dChlKTtcbiAgICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEFydFN0YXQoYXJ0SWQ6IHN0cmluZykge1xuICAgIGludGVyZmFjZSBMb3RDb21iaW5lZEludGVyZmFjZSBleHRlbmRzIExvdERvY3VtZW50IHtcbiAgICAgICAgZXZlbnQ6IEV2ZW50RFRPO1xuICAgICAgICBjdXJyZW5jeTogQ291bnRyeURUTztcbiAgICB9XG4gICAgbGV0IGFydGlzdEZsYWc6IHN0cmluZyA9ICcnO1xuICAgIGNvbnN0IGxvdHM6IExvdENvbWJpbmVkSW50ZXJmYWNlW10gPSBhd2FpdCBMb3RNb2RlbC5hZ2dyZWdhdGUoKVxuICAgICAgICAubWF0Y2goe1xuICAgICAgICAgICAgQXJ0SWQ6IGFydElkXG4gICAgICAgIH0pXG4gICAgICAgIC5sb29rdXAoe1xuICAgICAgICAgICAgZnJvbTogJ2V2ZW50cycsXG4gICAgICAgICAgICBsb2NhbEZpZWxkOiAnRXZlbnQnLFxuICAgICAgICAgICAgZm9yZWlnbkZpZWxkOiAnX2lkJyxcbiAgICAgICAgICAgIGFzOiAnZXZlbnQnXG4gICAgICAgIH0pXG4gICAgICAgIC51bndpbmQoe1xuICAgICAgICAgICAgcGF0aDogJyRldmVudCcsXG4gICAgICAgICAgICBwcmVzZXJ2ZU51bGxBbmRFbXB0eUFycmF5czogZmFsc2VcbiAgICAgICAgfSlcbiAgICAgICAgLmxvb2t1cCh7XG4gICAgICAgICAgICBmcm9tOiAnY291bnRyaWVzJyxcbiAgICAgICAgICAgIGxvY2FsRmllbGQ6ICdldmVudC5DdXJyZW5jeScsXG4gICAgICAgICAgICBmb3JlaWduRmllbGQ6ICdfaWQnLFxuICAgICAgICAgICAgYXM6ICdjdXJyZW5jeSdcbiAgICAgICAgfSlcbiAgICAgICAgLnVud2luZCh7XG4gICAgICAgICAgICBwYXRoOiAnJGN1cnJlbmN5JyxcbiAgICAgICAgICAgIHByZXNlcnZlTnVsbEFuZEVtcHR5QXJyYXlzOiBmYWxzZVxuICAgICAgICB9KS5hbGxvd0Rpc2tVc2UodHJ1ZSk7XG5cbiAgICBpZiAoIWxvdHMgfHwgbG90cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgdGhyb3coe1xuICAgICAgICAgICAgc3RhdHVzOiA0MDQsXG4gICAgICAgICAgICBTdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgIE1lc3NhZ2U6ICdQbGVhc2UgcGFzcyBjb3JyZWN0IGFydElkJ1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgY29uc3QgbG90ICA9IGxvdHNbMF07XG4gICAgbGV0IGxhdGVzdEltYWdlOiBBcnRpc3RJbmRpdmlkdWFsSW1hZ2U7XG4gICAgbGV0IGNvbnRlc3RhbnRJZDtcbiAgICBjb25zdCB0b3BCaWQgPSBsb3QuQmlkcy5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIHJldHVybiBiLkFtb3VudCAtIGEuQW1vdW50O1xuICAgIH0pO1xuICAgIGNvbnN0IHRvcEJpZEFtb3VudCA9IHRvcEJpZFswXSAmJiB0b3BCaWRbMF0uQW1vdW50O1xuICAgIGZvciAobGV0IGkgPSAwOyBsb3QuZXZlbnQuUm91bmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IHJvdW5kID0gbG90LmV2ZW50LlJvdW5kc1tpXTtcbiAgICAgICAgaWYgKHJvdW5kLlJvdW5kTnVtYmVyICA9PT0gbG90LlJvdW5kKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHJvdW5kLkNvbnRlc3RhbnRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVzdGFudCA9IHJvdW5kLkNvbnRlc3RhbnRzW2pdO1xuICAgICAgICAgICAgICAgIGlmIChjb250ZXN0YW50LkVhc2VsTnVtYmVyID09PSBsb3QuRWFzZWxOdW1iZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGVzdGFudElkID0gY29udGVzdGFudC5EZXRhaWw7XG4gICAgICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvbnRlc3RhbnQuSW1hZ2VzKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgbGF0ZXN0SW1hZ2UgPSBjb250ZXN0YW50LkltYWdlc1tjb250ZXN0YW50LkltYWdlcy5sZW5ndGggLSAxXTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZWcgPSBhd2FpdCBSZWdpc3RyYXRpb25Nb2RlbC5maW5kT25lKHtBcnRpc3Q6IGNvbnRlc3RhbnQuRGV0YWlsfSk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWcgJiYgcmVnLlJlZ2lvbkNvZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFydGlzdEZsYWcgPSBgL2ltYWdlcy9jb3VudHJpZXMvNHgzLyR7cmVnLlJlZ2lvbkNvZGUudG9Mb3dlckNhc2UoKX0uc3ZnYDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWNvbnRlc3RhbnRJZCkge1xuICAgICAgICB0aHJvdyAoe1xuICAgICAgICAgICAgc3RhdHVzOiA0MDQsXG4gICAgICAgICAgICBTdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgIE1lc3NhZ2U6ICdJbnZhbGlkIGxvdCdcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgVm90aW5nTG9nTW9kZWwuY291bnREb2N1bWVudHMoe1xuICAgICAgICAgICAgU3RhdHVzOiAnVk9URV9BQ0NFUFRFRCcsXG4gICAgICAgICAgICBFdmVudElkOiBsb3QuZXZlbnQuX2lkLFxuICAgICAgICAgICAgUm91bmROdW1iZXI6IGxvdC5Sb3VuZCxcbiAgICAgICAgICAgIEVhc2VsTnVtYmVyOiBsb3QuRWFzZWxOdW1iZXJcbiAgICAgICAgfSksXG4gICAgICAgIENvbnRlc3RhbnRNb2RlbC5maW5kT25lKHtcbiAgICAgICAgICAgIF9pZDogY29udGVzdGFudElkXG4gICAgICAgIH0pLnBvcHVsYXRlKCdDaXR5JylcbiAgICBdKTtcbiAgICBjb25zdCB2b3RlQ291bnQgPSByZXN1bHRbMF07XG4gICAgY29uc3QgYXJ0aXN0TmFtZSA9IHJlc3VsdFsxXSAmJiByZXN1bHRbMV0uTmFtZSB8fCAnJztcbiAgICBjb25zdCBhcnRpc3RDaXR5ID0gcmVzdWx0WzFdICYmIHJlc3VsdFsxXS5DaXR5ICYmIHJlc3VsdFsxXS5DaXR5Lk5hbWUgfHwgcmVzdWx0WzFdLkNpdHlUZXh0IHx8IGBFYXNlbCAke2xvdC5FYXNlbE51bWJlcn0sIFJvdW5kICR7bG90LlJvdW5kfWA7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgVm90ZUNvdW50OiB2b3RlQ291bnQsXG4gICAgICAgIFRvcEJpZEFtb3VudDogdG9wQmlkQW1vdW50LFxuICAgICAgICBSb3VuZDogbG90LlJvdW5kLFxuICAgICAgICBFYXNlbE51bWJlcjogbG90LkVhc2VsTnVtYmVyLFxuICAgICAgICBBcnRpc3ROYW1lOiBhcnRpc3ROYW1lLFxuICAgICAgICBDdXJyZW5jeTogbG90LmN1cnJlbmN5ICYmIGxvdC5jdXJyZW5jeS5jdXJyZW5jeV9zeW1ib2wgfHwgJyQnLFxuICAgICAgICBMYXRlc3RJbWFnZTogbGF0ZXN0SW1hZ2UsXG4gICAgICAgIEFydGlzdEZsYWc6IGFydGlzdEZsYWcsXG4gICAgICAgIEFydGlzdENpdHk6IGFydGlzdENpdHlcbiAgICB9O1xufVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFydFN0YXQocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICB0cnkge1xuICAgICAgICByZXMuanNvbihhd2FpdCBnZXRBcnRTdGF0KHJlcS5wYXJhbXMuYXJ0SWQpKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYXJ0U3RhdEh0bWwocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICB0cnkge1xuICAgICAgICByZXMucmVuZGVyKCdhcnRfc3RhdCcsIHtcbiAgICAgICAgICAgIHRpdGxlOiBgQXJ0IFN0YXRgLFxuICAgICAgICAgICAgc3RhdDogYXdhaXQgZ2V0QXJ0U3RhdChyZXEucGFyYW1zLmFydElkKVxuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufVxuXG4vKlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFydFN0YXRJbWFnZUh0bWwocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICB0cnkge1xuICAgICAgICByZXMucmVuZGVyKCdhcnRfc3RhdF9pbWFnZScsIHtcbiAgICAgICAgICAgIHRpdGxlOiBgQXJ0IFN0YXRgLFxuICAgICAgICAgICAgc3RhdDogYXdhaXQgZ2V0QXJ0U3RhdChyZXEucGFyYW1zLmFydElkKVxuICAgICAgICB9KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIG5leHQoZSk7XG4gICAgfVxufVxuKi9cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNlbmRDbG9zaW5nTm90aWNlKHJlcTogUmVxdWVzdCwgcmVzOiBSZXNwb25zZSwgbmV4dDogTmV4dEZ1bmN0aW9uKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgZXZlbnRJZCA9IHJlcS5wYXJhbXMuZXZlbnRJZDtcbiAgICAgICAgY29uc3Qgcm91bmROdW1iZXIgPSByZXEucGFyYW1zLnJvdW5kTm87XG4gICAgICAgIGNvbnN0IHR3aWxpb0NsaWVudCA9IFR3aWxpbygpO1xuICAgICAgICBjb25zb2xlLmxvZygnZScsIGV2ZW50SWQsIHJvdW5kTnVtYmVyKTtcbiAgICAgICAgY29uc3QgbG90cyA9IGF3YWl0IExvdE1vZGVsLmZpbmQoe1xuICAgICAgICAgICAgU3RhdHVzOiAxLCAvLyBhdWN0aW9uIG9wZW5cbiAgICAgICAgICAgIFJvdW5kOiByb3VuZE51bWJlcixcbiAgICAgICAgICAgIEV2ZW50OiBldmVudElkXG4gICAgICAgIH0pLnBvcHVsYXRlKCdCaWRzLlJlZ2lzdHJhdGlvbicpXG4gICAgICAgICAgICAucG9wdWxhdGUoJ0V2ZW50JylcbiAgICAgICAgICAgIC5wb3B1bGF0ZSgnQ29udGVzdGFudCcpO1xuICAgICAgICBjb25zdCBwcm9taXNlcyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxvdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGxvdCA9IGxvdHNbaV07XG4gICAgICAgICAgICBjb25zdCBiaWRzID0gbG90LkJpZHMuc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgICAgICAgIHJldHVybiBiLkFtb3VudCAtIGEuQW1vdW50O1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBhbHJlYWR5U2VudFRvID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGJpZHMubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWdpc3RyYXRpb24gPSBiaWRzW2pdLlJlZ2lzdHJhdGlvbjtcbiAgICAgICAgICAgICAgICBjb25zdCBhdWN0aW9uVXJsID0gYCAke3Byb2Nlc3MuZW52LlNIT1JUX1NJVEVfVVJMfS9hLyR7bG90LkFydElkfS9yLyR7cmVnaXN0cmF0aW9uLkhhc2h9YDtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhiaWRzW2pdKTtcbiAgICAgICAgICAgICAgICBpZiAoYWxyZWFkeVNlbnRUby5pbmRleE9mKHJlZ2lzdHJhdGlvbi5IYXNoKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgYWxyZWFkeVNlbnRUby5wdXNoKHJlZ2lzdHJhdGlvbi5IYXNoKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcHVzaFRpdGxlID0gYCR7bG90LkNvbnRlc3RhbnQuTmFtZX06IFJvdW5kICR7bG90LlJvdW5kfWA7XG4gICAgICAgICAgICAgICAgICAgIGlmIChqID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyB0b3AgYmlkXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0aXRsZSA9IGBBdWN0aW9uIENMT1NJTkcgb24gdGhlIFJvdW5kICR7bG90LlJvdW5kfSBwYWludGluZyBieSAke2xvdC5Db250ZXN0YW50Lk5hbWV9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgJHt0aXRsZX0sIGFuZCB3aWxsIGNsb3NlIGFmdGVyIG5vIG5ldyBiaWRzIGhhdmUgYmVlbiByZWNlaXZlZCBmb3IgNSBtaW51dGVzLiBZb3UgYXJlIGN1cnJlbnRseSB0aGUgVE9QIEJJRCBhdCAkJHtiaWRzW2pdLkFtb3VudH0gLSAke2F1Y3Rpb25Vcmx9YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBTZW5kaW5nIG1lc3NhZ2U6ICR7bWVzc2FnZX0gRnJvbTogJHtsb3QuRXZlbnQuUGhvbmVOdW1iZXJ9IFRvOiAke3JlZ2lzdHJhdGlvbi5QaG9uZU51bWJlcn1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB0d2lsaW9SZXM7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR3aWxpb1JlcyA9IGF3YWl0IHR3aWxpb0NsaWVudC5tZXNzYWdlcy5jcmVhdGUoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcm9tOiBsb3QuRXZlbnQuUGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvOiByZWdpc3RyYXRpb24uUGhvbmVOdW1iZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvZHk6IG1lc3NhZ2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwb3N0VG9TbGFja1NNU0Zsb29kKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RleHQnOiBgJHtyZWdpc3RyYXRpb24uTmlja05hbWV9KCR7cmVnaXN0cmF0aW9uLlBob25lTnVtYmVyfSkgKHNtcykgXFxuJHttZXNzYWdlfSBzb3VyY2U6IGF1Y3Rpb24udHMgc2VuZENsb3NpbmdOb3RpY2VgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSkuY2F0Y2goKCkgPT4gbG9nZ2VyLmVycm9yKGBvdHAgc2xhY2sgZmxvb2QgY2FsbCBmYWlsZWQgJHsgbWVzc2FnZSB9IHNvdXJjZTogYXVjdGlvbi50cyBzZW5kQ2xvc2luZ05vdGljZWApKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2dnZXIuaW5mbyhgc2VudCBtZXNzYWdlOiAke21lc3NhZ2V9IEZyb206ICR7bG90LkV2ZW50LlBob25lTnVtYmVyfSBUbzogJHtyZWdpc3RyYXRpb24uUGhvbmVOdW1iZXJ9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGBtZXNzYWdlIHNlbmRpbmcgZmFpbGVkICR7ZS5tZXNzYWdlfSAke2Uuc3RhY2t9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IC8vIHNlbmQgMSBieSAxXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVnaXN0cmF0aW9uLkRldmljZVRva2VucyAmJiByZWdpc3RyYXRpb24uRGV2aWNlVG9rZW5zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9taXNlcy5wdXNoKHNlbmROb3RpZmljYXRpb25JZ25vcmVFcnIocmVnaXN0cmF0aW9uLkRldmljZVRva2VucywgbWVzc2FnZSwgbG90LkV2ZW50Lk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVybDogYCR7YXVjdGlvblVybH1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IHB1c2hUaXRsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocmVnaXN0cmF0aW9uLkFuZHJvaWREZXZpY2VUb2tlbnMgJiYgcmVnaXN0cmF0aW9uLkFuZHJvaWREZXZpY2VUb2tlbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb21pc2VzLnB1c2goTXVsdGlDYXN0SWdub3JlRXJyKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgRGV2aWNlVG9rZW5zOiByZWdpc3RyYXRpb24uQW5kcm9pZERldmljZVRva2VucyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGluazogYCR7YXVjdGlvblVybH1gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogcHVzaFRpdGxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmlvcml0eTogJ25vcm1hbCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFuYWx5dGljc0xhYmVsOiBwdXNoVGl0bGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBiaWRzIG90aGVyIHRoYW4gdG9wXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gYEF1Y3Rpb24gQ0xPU0lORyBvbiB0aGUgUm91bmQgJHtsb3QuUm91bmR9IHBhaW50aW5nIGJ5ICR7bG90LkNvbnRlc3RhbnQuTmFtZX0uIEl0IHdpbGwgY2xvc2UgYWZ0ZXIgbm8gbmV3IGJpZHMgaGF2ZSBiZWVuIHJlY2VpdmVkIGZvciA1IG1pbnV0ZXMuIFlvdSBhcmUgTk9UIFdJTk5JTkcgYW5kIG11c3QgQklEIEFHQUlOIHRvIHdpbiAtICR7YXVjdGlvblVybH1gO1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLmluZm8oYFNlbmRpbmcgbWVzc2FnZTogJHttZXNzYWdlfSBGcm9tOiAke2xvdC5FdmVudC5QaG9uZU51bWJlcn0gVG86ICR7cmVnaXN0cmF0aW9uLlBob25lTnVtYmVyfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHR3aWxpb1JlcztcbiAgICAgICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdHdpbGlvUmVzID0gYXdhaXQgdHdpbGlvQ2xpZW50Lm1lc3NhZ2VzLmNyZWF0ZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyb206IGxvdC5FdmVudC5QaG9uZU51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG86IHJlZ2lzdHJhdGlvbi5QaG9uZU51bWJlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYm9keTogbWVzc2FnZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBvc3RUb1NsYWNrU01TRmxvb2Qoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAndGV4dCc6IGAke3JlZ2lzdHJhdGlvbi5OaWNrTmFtZX0oJHtyZWdpc3RyYXRpb24uUGhvbmVOdW1iZXJ9KSAoc21zKSBcXG4ke21lc3NhZ2V9IHNvdXJjZTogYXVjdGlvbi50cyBzZW5kQ2xvc2luZ05vdGljZWBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KS5jYXRjaCgoKSA9PiBsb2dnZXIuZXJyb3IoYGF1Y3Rpb24gY2xvc2luZyBzbGFjayBmbG9vZCBjYWxsIGZhaWxlZCAkeyBtZXNzYWdlIH0gc291cmNlOiBhdWN0aW9uLnRzIHNlbmRDbG9zaW5nTm90aWNlYCkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBzZW50IG1lc3NhZ2U6ICR7bWVzc2FnZX0gRnJvbTogJHtsb3QuRXZlbnQuUGhvbmVOdW1iZXJ9IFRvOiAke3JlZ2lzdHJhdGlvbi5QaG9uZU51bWJlcn1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoYG1lc3NhZ2Ugc2VuZGluZyBmYWlsZWQgJHtlLm1lc3NhZ2V9ICR7ZS5zdGFja31gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZWdpc3RyYXRpb24uRGV2aWNlVG9rZW5zICYmIHJlZ2lzdHJhdGlvbi5EZXZpY2VUb2tlbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb21pc2VzLnB1c2goc2VuZE5vdGlmaWNhdGlvbklnbm9yZUVycihyZWdpc3RyYXRpb24uRGV2aWNlVG9rZW5zLCBtZXNzYWdlLCBsb3QuRXZlbnQuTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdXJsOiBgJHthdWN0aW9uVXJsfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZTogcHVzaFRpdGxlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZWdpc3RyYXRpb24uQW5kcm9pZERldmljZVRva2VucyAmJiByZWdpc3RyYXRpb24uQW5kcm9pZERldmljZVRva2Vucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvbWlzZXMucHVzaChNdWx0aUNhc3RJZ25vcmVFcnIoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBEZXZpY2VUb2tlbnM6IHJlZ2lzdHJhdGlvbi5BbmRyb2lkRGV2aWNlVG9rZW5zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaW5rOiBgJHthdWN0aW9uVXJsfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlOiBwdXNoVGl0bGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByaW9yaXR5OiAnbm9ybWFsJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYW5hbHl0aWNzTGFiZWw6IHB1c2hUaXRsZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG4gICAgICAgIGNvbnN0IHJlc3VsdDogRGF0YU9wZXJhdGlvblJlc3VsdDxzdHJpbmc+ID0ge1xuICAgICAgICAgICAgJ1N1Y2Nlc3MnOiB0cnVlLFxuICAgICAgICAgICAgRGF0YTogJ01lc3NhZ2VzIHNlbnQuJ1xuICAgICAgICB9O1xuICAgICAgICByZXMuanNvbihyZXN1bHQpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgbmV4dChlKTtcbiAgICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhdXRvQ2xvc2UocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlLCBuZXh0OiBOZXh0RnVuY3Rpb24pIHtcbiAgICB0cnkge1xuICAgICAgICBjb25zdCBldmVudElkID0gcmVxLnBhcmFtcy5ldmVudElkO1xuICAgICAgICBjb25zdCBlbmFibGVBdXRvQ2xvc2UgPSBwYXJzZUludChyZXEucGFyYW1zLmVuYWJsZUF1dG9DbG9zZSk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IF9lbmFibGVBdXRvQ2xvc2UoZW5hYmxlQXV0b0Nsb3NlLCBldmVudElkKTtcbiAgICAgICAgaWYgKCFyZXN1bHQuU3VjY2Vzcykge1xuICAgICAgICAgICAgcmVzLnN0YXR1cyg0MDMpO1xuICAgICAgICB9XG4gICAgICAgIHJlcy5qc29uKHJlc3VsdCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBuZXh0KGUpO1xuICAgIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gX2VuYWJsZUF1dG9DbG9zZShhdXRvQ2xvc2VBdWN0aW9uSW5kZXg6IG51bWJlciwgZXZlbnRJZDogYW55KSB7XG4gICAgdHJ5IHtcbiAgICAgICAgbG9nZ2VyLmluZm8oJ2VuYWJsZSBhdXRvIGNsb3NlIGNhbGxlZCcgKyBuZXcgRGF0ZSgpICsgJyAnICsgZXZlbnRJZCk7XG4gICAgICAgIGlmICghQXV0b0Nsb3NlU3RhdGVzW2F1dG9DbG9zZUF1Y3Rpb25JbmRleF0gJiYgKGF1dG9DbG9zZUF1Y3Rpb25JbmRleCA9PT0gMiB8fCBhdXRvQ2xvc2VBdWN0aW9uSW5kZXggPT09IDQpKSB7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoYEVuYWJsZSBBdWN0aW9uIHNob3VsZCBiZSAyIG9yIDQgICR7dGhpcy5hdWN0aW9uSW5kZXh9YCk7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8c3RyaW5nPiA9IHtcbiAgICAgICAgICAgICAgICAnU3VjY2Vzcyc6IGZhbHNlLFxuICAgICAgICAgICAgICAgIERhdGE6ICdJbnZhbGlkJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZXZlbnQgPSBhd2FpdCBFdmVudE1vZGVsLmZpbmRPbmUoe1xuICAgICAgICAgICAgX2lkOiBldmVudElkXG4gICAgICAgIH0pLnNlbGVjdChbJ19pZCcsICdSZWdpc3RyYXRpb25zVm90ZUZhY3RvcicsICdQaG9uZU51bWJlciddKTtcbiAgICAgICAgaWYgKGV2ZW50KSB7XG4gICAgICAgICAgICBpZiAoYXV0b0Nsb3NlQXVjdGlvbkluZGV4ID09PSAyKSB7XG4gICAgICAgICAgICAgICAgZXZlbnQuQXVjdGlvbkNsb3NlU3RhcnRzQXQgPSBBZGRNaW51dGVzKG5ldyBEYXRlKCksIDE1KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXZlbnQuQXVjdGlvbkNsb3NlU3RhcnRzQXQgPSBuZXcgRGF0ZSgnMTk3MC0wMS0wMScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc29sZS5sb2coJ2V2ZW50LkF1Y3Rpb25DbG9zZVN0YXJ0c0F0JywgZXZlbnQuQXVjdGlvbkNsb3NlU3RhcnRzQXQpO1xuICAgICAgICAgICAgYXdhaXQgZXZlbnQuc2F2ZSgpO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0OiBEYXRhT3BlcmF0aW9uUmVzdWx0PHtNZXNzYWdlOiBzdHJpbmc7IEF1Y3Rpb25DbG9zZVN0YXJ0c0F0OiBEYXRlfT4gPSB7XG4gICAgICAgICAgICAgICAgJ1N1Y2Nlc3MnOiB0cnVlLFxuICAgICAgICAgICAgICAgIERhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgTWVzc2FnZTogQXV0b0Nsb3NlU3RhdGVzW2F1dG9DbG9zZUF1Y3Rpb25JbmRleF0sXG4gICAgICAgICAgICAgICAgICAgIEF1Y3Rpb25DbG9zZVN0YXJ0c0F0OiBldmVudC5BdWN0aW9uQ2xvc2VTdGFydHNBdFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBpZiAoZXZlbnQuQXVjdGlvbkNsb3NlU3RhcnRzQXQgPT09IG5ldyBEYXRlKCcxOTcwLTAxLTAxJykpIHtcbiAgICAgICAgICAgICAgICAvLyBkbyBub3Qgc2VuZCBtZXNzYWdlIGlmIEF1Y3Rpb24gc3RhcnQgdGltZSBpcyBiZWdpbm5pbmcgb2YgRXBvY2hcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8c3RyaW5nPiA9IHtcbiAgICAgICAgICAgICAgICAgICAgJ1N1Y2Nlc3MnOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgRGF0YTogJ0ludmFsaWQnXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gaW50ZW50aW9uYWxseSBub3Qgd2FpdGluZyBmb3IgdGhpcyBwcm9taXNlIHRvIHJlc29sdmVcbiAgICAgICAgICAgIF9zZW5kQ2xvc2luZ01lc3NhZ2VzKGV2ZW50KS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICBsb2dnZXIuaW5mbyhgY2xvc2luZyBtZXNzYWdlIHNlbmQgc3VjY2Vzc2Z1bGApO1xuICAgICAgICAgICAgfSkuIGNhdGNoKChlKSA9PiB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGBjbG9zaW5nIG1lc3NhZ2Ugc2VuZCBmYWlsZWRgKTtcbiAgICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8c3RyaW5nPiA9IHtcbiAgICAgICAgICAgICAgICAnU3VjY2Vzcyc6IGZhbHNlLFxuICAgICAgICAgICAgICAgIERhdGE6ICdJbnZhbGlkJ1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cblxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihlKTtcbiAgICAgICAgbG9nZ2VyLmVycm9yKGAke2UubWVzc2FnZX0gJHtlLnN0YWNrfWApO1xuICAgICAgICBjb25zdCByZXN1bHQ6IERhdGFPcGVyYXRpb25SZXN1bHQ8c3RyaW5nPiA9IHtcbiAgICAgICAgICAgICdTdWNjZXNzJzogZmFsc2UsXG4gICAgICAgICAgICBEYXRhOiAnSW50ZXJuYWwgU2VydmVyIEVycm9yJ1xuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gX3NlbmRDbG9zaW5nTWVzc2FnZXMoZXZlbnQ6IEV2ZW50RFRPKSB7XG4gICAgY29uc3QgdHdpbGlvQ2xpZW50ID0gVHdpbGlvKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBldmVudC5SZWdpc3RyYXRpb25zVm90ZUZhY3Rvci5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBwaG9uZU51bWJlciA9IGV2ZW50LlJlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yW2ldLlBob25lTnVtYmVyO1xuICAgICAgICBsZXQgdm90ZVVybCA9IGAke2V2ZW50LlJlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yW2ldLkF1Y3Rpb25Vcmx9YDtcbiAgICAgICAgaWYgKHZvdGVVcmwuaW5kZXhPZignaHR0cCcpID09PSAtMSkge1xuICAgICAgICAgICAgLy8gb2xkIHJlY29yZFxuICAgICAgICAgICAgdm90ZVVybCA9IGAke3Byb2Nlc3MuZW52LlNIT1JUX1NJVEVfVVJMfSR7dm90ZVVybH1gO1xuICAgICAgICB9XG4gICAgICAgIGxvZ2dlci5pbmZvKCdzZW5kaW5nIGNsb3NpbmcgbWVzc2FnZSB0byAnICsgcGhvbmVOdW1iZXIgKyAnICcgKyBuZXcgRGF0ZSgpKTtcbiAgICAgICAgY29uc3QgbWludXRlc1JlbWFpbmluZyA9IGRpZmZlcmVuY2VJbk1pbnV0ZXMoZXZlbnQuQXVjdGlvbkNsb3NlU3RhcnRzQXQsIG5ldyBEYXRlKCkpO1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gYEF1Y3Rpb24gY2xvc2luZyBpbiBhYm91dCAke21pbnV0ZXNSZW1haW5pbmd9IG1pbiEgQmlkIG5vdyB0byB3aW4geW91ciBwaWVjZSAtICR7dm90ZVVybH1gO1xuICAgICAgICBhd2FpdCBfc2VuZE1lc3NhZ2UodHdpbGlvQ2xpZW50LCBtZXNzYWdlLCBwaG9uZU51bWJlciwgZXZlbnQuUGhvbmVOdW1iZXIsIGV2ZW50LlJlZ2lzdHJhdGlvbnNWb3RlRmFjdG9yW2ldLk5pY2tOYW1lKTtcbiAgICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9zZW5kTWVzc2FnZSh0d2lsaW9DbGllbnQ6IFR3aWxpby5SZXN0Q2xpZW50LCBtZXNzYWdlOiBzdHJpbmcsIHBob25lTnVtYmVyOiBzdHJpbmcsIGV2ZW50UGhvbmVOdW1iZXI6IHN0cmluZywgbmlja05hbWU6IHN0cmluZykge1xuICAgIHRyeSB7XG4gICAgICAgIGxvZ2dlci5pbmZvKGBzZW5kaW5nIHNtcyAke21lc3NhZ2V9IHRvICR7cGhvbmVOdW1iZXJ9YCk7XG4gICAgICAgIGNvbnN0IHR3aWxpb1JlcyA9IGF3YWl0IHR3aWxpb0NsaWVudC5tZXNzYWdlcy5jcmVhdGUoe1xuICAgICAgICAgICAgZnJvbTogZXZlbnRQaG9uZU51bWJlcixcbiAgICAgICAgICAgIHRvOiBwaG9uZU51bWJlcixcbiAgICAgICAgICAgIGJvZHk6IG1lc3NhZ2VcbiAgICAgICAgfSk7XG4gICAgICAgIHBvc3RUb1NsYWNrU01TRmxvb2Qoe1xuICAgICAgICAgICAgJ3RleHQnOiBgJHtuaWNrTmFtZX0oJHtwaG9uZU51bWJlcn0pIChzbXMpIFxcbiR7bWVzc2FnZX0gc291cmNlOiBhdWN0aW9uLnRzIF9zZW5kTWVzc2FnZWBcbiAgICAgICAgfSkuY2F0Y2goKCkgPT4gbG9nZ2VyLmVycm9yKGBhdWN0aW9uIF9zZW5kTWVzc2FnZSBzbGFjayBmbG9vZCBjYWxsIGZhaWxlZCAkeyBtZXNzYWdlIH0gc291cmNlOiBhdWN0aW9uLnRzIF9zZW5kTWVzc2FnZWApKTtcbiAgICAgICAgbG9nZ2VyLmluZm8oYHNlbnQgc21zICR7bWVzc2FnZX0gJHt0d2lsaW9SZXMgJiYgdHdpbGlvUmVzLnNpZH1gKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcihgZmFpbGVkIHNtcyAke21lc3NhZ2V9YCk7XG4gICAgICAgIGxvZ2dlci5lcnJvcihgJHtlLm1lc3NhZ2V9ICR7ZS5zdGFja31gKTtcbiAgICB9XG59Il19
