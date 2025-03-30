"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArtistService = void 0;
const logger_1 = require("../config/logger");
const Contestant_1 = require("../models/Contestant");
const Registration_1 = require("../models/Registration");
const RegisterVoterV2_1 = require("./RegisterVoterV2");
const City_1 = require("../models/City");
const Event_1 = require("../models/Event");
const ArtistWiseImages_1 = require("./ArtistWiseImages");
const mongoose = require("mongoose");
const RegistrationLog_1 = require("../models/RegistrationLog");
const VotingLog_1 = require("../models/VotingLog");
const url = require("url");
const path = require("path");
const fs = require("fs-extra");
const sharp = require("sharp");
const ArtistWooCommerce_1 = require("../models/ArtistWooCommerce");
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
const fetch = require('node-fetch');
class ArtistService {
    constructor() {
        this._wooCommerceApi = new WooCommerceRestApi({
            url: 'https://artbattle.com',
            consumerKey: 'ck_529bf7ac7628d895d342e9fb4c7ab4138c6c957b',
            consumerSecret: 'cs_6b46cce2efd6fddeb8a38b587536feb90cb751a5',
            version: 'wc/v3'
        });
    }
    async Update(contestantId, obj, userAgent) {
        if (!contestantId) {
            const message = `contestant Id is required`;
            logger_1.default.error(message);
            throw {
                Success: false,
                status: 403,
                message: message
            };
        }
        const Contestant = await Contestant_1.default.findById(contestantId);
        if (!Contestant) {
            const message = `Invalid contestant Id passed ${contestantId}`;
            logger_1.default.error(message);
            throw {
                Success: false,
                status: 404,
                message: message
            };
        }
        return this.Save(Contestant, obj, userAgent);
    }
    async Add(obj, userAgent) {
        return this.Save(new Contestant_1.default(), obj, userAgent, true);
    }
    async Save(Contestant, obj, userAgent, IsAdd) {
        const { Name, Email, EntryId, Website, City, PhoneNumber } = obj;
        if (!Email || (Email && Email.length === 0)) {
            throw {
                Success: false,
                status: 403,
                message: 'Email is required'
            };
        }
        if (Name && Name.length > 0) {
            Contestant.Name = Name;
        }
        if (Website && Website.length > 0) {
            Contestant.Website = Website;
        }
        if (City) {
            Contestant.City = City;
        }
        Contestant = await this.TagIfDuplicate(parseInt(String(EntryId)), Email, PhoneNumber, Contestant, IsAdd);
        const result = await this.MapContestantRegistration({
            Contestant, userAgent
        });
        Contestant = result.Contestant;
        return Contestant;
    }
    async TagIfDuplicate(EntryId, Email, PhoneNumber, Contestant, IsAdd) {
        if (EntryId && EntryId > 0) {
            // Entry id should be unique
            const query = {
                EntryId: EntryId
            };
            const matchedContestant = await ArtistService.findDuplicate(query, Contestant);
            if (matchedContestant && !IsAdd) {
                Contestant = await this._saveMatchedContestant(matchedContestant, Contestant);
            }
            else if (matchedContestant && IsAdd) {
                throw {
                    status: 403,
                    message: `Duplicate contestant ${matchedContestant.Name} (${matchedContestant.EntryId}) found with same Entry Id ${EntryId}`
                };
            }
            if (!Contestant.IsDuplicate) {
                Contestant.EntryId = EntryId;
            }
        }
        if (Email && Email.length > 0) {
            // Email should be unique
            const query = {
                Email: Email
            };
            const matchedContestant = await ArtistService.findDuplicate(query, Contestant);
            if (matchedContestant && !IsAdd) {
                Contestant = await this._saveMatchedContestant(matchedContestant, Contestant);
            }
            else if (matchedContestant && IsAdd) {
                throw {
                    status: 403,
                    message: `Duplicate contestant ${matchedContestant.Name} (${matchedContestant.EntryId}) found with same Email ${Email}`
                };
            }
            if (!Contestant.IsDuplicate) {
                Contestant.Email = Email;
            }
        }
        if (PhoneNumber && PhoneNumber.length > 0) {
            // PhoneNumber should be unique
            const query = {
                PhoneNumber: PhoneNumber,
            };
            const matchedContestant = await ArtistService.findDuplicate(query, Contestant);
            if (matchedContestant && !IsAdd) {
                Contestant = await this._saveMatchedContestant(matchedContestant, Contestant);
            }
            else if (matchedContestant && IsAdd) {
                throw {
                    status: 403,
                    message: `Duplicate contestant ${matchedContestant.Name} (${matchedContestant.EntryId}) found with same Phone number ${PhoneNumber}`
                };
            }
            if (!Contestant.IsDuplicate) {
                Contestant.PhoneNumber = PhoneNumber;
            }
        }
        return Contestant;
    }
    static async findDuplicate(query, Contestant) {
        query.IsDuplicate = { $in: [null, false] };
        query._id = {};
        if (Contestant._id) {
            query._id = { $ne: Contestant._id };
        }
        return Contestant_1.default.findOne(query);
    }
    async _saveMatchedContestant(matchedContestant, Contestant) {
        Contestant.IsDuplicate = true;
        matchedContestant.ChildContestants = matchedContestant.ChildContestants || [];
        if (matchedContestant.ChildContestants.indexOf(Contestant._id) === -1) {
            matchedContestant.ChildContestants.push(Contestant._id);
        }
        await matchedContestant.save();
        await this.ReplaceContestantInEvents(matchedContestant._id, Contestant._id);
        return Contestant;
    }
    async MapContestantRegistration(obj) {
        let { Contestant } = obj;
        const { userAgent } = obj;
        if (!Contestant.PhoneNumber || Contestant.IsDuplicate) {
            await Contestant.save();
            return { registration: false, Contestant };
        }
        let registration = await Registration_1.default.findOne({ PhoneNumber: Contestant.PhoneNumber })
            .populate('Artist');
        if (registration && registration.Artist
            && registration.Artist._id.toString() !== Contestant._id.toString()) {
            throw {
                Success: false,
                status: 403,
                code: 'PHONE_IN_USE',
                message: `This phone number is already registered with ${registration.Artist.Name}
                Entry id: ${registration.ArtistProfile && registration.ArtistProfile.EntryId}`,
                contestantId: registration.Artist._id
            };
        }
        if (!registration) {
            const registrationModel = await new RegisterVoterV2_1.RegisterVoterV2(Contestant.PhoneNumber, userAgent, null, null, null, false).Register();
            registrationModel.Artist = Contestant._id;
            registration = await registrationModel.save();
        }
        if (!registration.Artist) {
            registration.Artist = Contestant._id;
        }
        registration = this.AddRegProfileIfDoesNotExist(registration);
        Contestant = await this.AddContestantProfileIfDoesNotExist(registration, Contestant);
        await registration.save();
        if (!Contestant.IsDuplicate) {
            Contestant.Registration = registration;
        }
        await Contestant.save();
        return { Contestant, registration };
    }
    async AddContestantProfileIfDoesNotExist(registration, Contestant) {
        if (!Contestant.Email) {
            Contestant.Email = registration.Email;
        }
        if (!Contestant.EntryId && registration.ArtistProfile && registration.ArtistProfile.EntryId) {
            Contestant.EntryId = parseInt(registration.ArtistProfile && registration.ArtistProfile.EntryId);
        }
        if (!Contestant.City && registration.ArtistProfile && registration.ArtistProfile.City) {
            Contestant.CityText = registration.ArtistProfile && registration.ArtistProfile.City;
            Contestant.City = await City_1.default.findOne({ 'Name': Contestant.Name });
        }
        if (!Contestant.Website && registration.ArtistProfile && registration.ArtistProfile.Website) {
            Contestant.Website = registration.ArtistProfile && registration.ArtistProfile.Website;
        }
        if (!Contestant.Name && registration.ArtistProfile && registration.ArtistProfile.Name) {
            Contestant.Name = registration.ArtistProfile && registration.ArtistProfile.Name;
        }
        return Contestant;
    }
    AddRegProfileIfDoesNotExist(registration) {
        registration.ArtistProfile.Processed = true;
        if (registration.Artist.Name && (!registration.ArtistProfile.Name || registration.ArtistProfile.Name != registration.Artist.Name)) {
            registration.ArtistProfile.Name = registration.Artist.Name;
        }
        if (registration.Artist.Email && (!registration.ArtistProfile.Name || registration.ArtistProfile.Email != registration.Artist.Email)) {
            registration.ArtistProfile.Email = registration.Artist.Email;
        }
        if (registration.Artist.CityText && (!registration.ArtistProfile.City || registration.ArtistProfile.City != registration.Artist.CityText)) {
            registration.ArtistProfile.City = registration.Artist.CityText;
        }
        if (registration.Artist.Website && (!registration.ArtistProfile.Website || registration.ArtistProfile.Website != registration.Artist.Website)) {
            registration.ArtistProfile.Website = registration.Artist.Website;
        }
        if (registration.Artist.PhoneNumber && (!registration.ArtistProfile.PhoneNumber || registration.ArtistProfile.PhoneNumber != registration.Artist.PhoneNumber)) {
            registration.ArtistProfile.PhoneNumber = registration.Artist.PhoneNumber;
        }
        if (registration.Artist.EntryId && (!registration.ArtistProfile.EntryId || parseInt(registration.ArtistProfile.EntryId) != registration.Artist.EntryId)) {
            registration.ArtistProfile.EntryId = `${registration.Artist.EntryId}`;
        }
        return registration;
    }
    async ReplaceContestantInEvents(replacement, search) {
        await Promise.all([
            Event_1.default.updateMany({}, {
                $set: {
                    'Rounds.$[].Contestants.$[contestant].Detail': replacement
                }
            }, {
                arrayFilters: [
                    {
                        'contestant.Detail': search
                    }
                ]
            }),
            Event_1.default.updateMany({}, {
                $set: {
                    'Contestants.$[contestant]': replacement
                }
            }, {
                arrayFilters: [
                    {
                        'contestant': search
                    }
                ]
            })
        ]);
    }
    async getArtistProfile(contestantId) {
        const promises = [
            Event_1.default.find({
                'Contestants': contestantId,
            })
                .select(['Name', 'Rounds', 'Contestants', 'Country', 'EventStartDateTime'])
                .populate('Rounds.Contestants.Detail')
                .populate('Country'),
            Contestant_1.default.findById(contestantId).select(['Name', 'CityText', 'EntryId', 'FollowersCount', 'Score']),
        ];
        const results = await Promise.all(promises);
        const events = results[0];
        const contestant = results[1];
        let wpProfile = {
            bio: '',
            instagram: '',
            images: [],
            website: '',
            adminBio: '',
            adminNotes: ''
        };
        let wooProducts = [];
        if (contestant.EntryId) {
            wpProfile = await ArtistService._fetchBioFromWp(contestant.EntryId);
            wooProducts = await this.fetchWooCommerceProducts(contestant.EntryId);
        }
        if (!contestant) {
            const message = `Invalid contestant Id passed ${contestantId}`;
            logger_1.default.error(message);
            throw {
                Success: false,
                status: 404,
                message: message
            };
        }
        const artistEvents = [];
        for (let i = 0; i < events.length; i++) {
            const eventDoc = events[i];
            const totalRounds = eventDoc.Rounds.length;
            const roundWiseImages = [];
            for (let j = 0; j < totalRounds; j++) {
                const artistsInRound = eventDoc.Rounds[j].Contestants;
                const artistsImages = ArtistWiseImages_1.default(artistsInRound, null, contestantId);
                const response = {
                    EventId: eventDoc.id,
                    EID: eventDoc.EID,
                    RoundNumber: eventDoc.Rounds[j].RoundNumber,
                    Artists: artistsImages.artists,
                    IsCurrentRound: false,
                    HasOpenRound: !eventDoc.Rounds[j].IsFinished,
                    HasImages: artistsImages.hasImages,
                    EnableAuction: false
                };
                roundWiseImages.push(response);
            }
            artistEvents.push({
                EventId: eventDoc.id,
                EID: eventDoc.EID,
                Country: eventDoc.Country,
                Name: eventDoc.Name,
                roundWiseImages: roundWiseImages,
                EventStartDateTime: eventDoc.EventStartDateTime || '2018-01-01T00:00:00.000+00:00'
            });
        }
        if (/\d/.test(contestant.CityText)) {
            contestant.CityText = '';
        }
        const result = {
            Name: contestant.Name,
            ParsedName: ArtistService._parseName(contestant.Name),
            CityText: contestant.CityText,
            // EntryId: contestant.EntryId,
            ArtistInEvents: artistEvents,
            IsFollowing: false,
            Bio: '',
            Instagram: '',
            Images: [],
            Website: '',
            AdminBio: '',
            AdminNotes: '',
            FollowersCount: contestant.FollowersCount,
            Score: contestant.Score,
            WooProducts: wooProducts
        };
        if (wpProfile) {
            result.Bio = wpProfile.bio || '';
            result.Instagram = wpProfile.instagram || '';
            result.Images = Array.isArray(wpProfile.images) && wpProfile.images || [];
            result.Website = wpProfile.website || '';
            result.AdminBio = wpProfile.adminBio || '';
            result.AdminNotes = wpProfile.adminNotes || '';
        }
        return result;
    }
    async cachedArtistProfile(cacheSet, cacheGet, contestantId, regId, phoneNumber) {
        const cacheKey = `artist-profile-${contestantId}-1`;
        const artistProfileJson = await cacheGet(cacheKey);
        let artistProfile;
        if (!artistProfileJson) {
            logger_1.default.info(`artist profile not found in cache`);
            artistProfile = await this.getArtistProfile(contestantId);
            await cacheSet(cacheKey, JSON.stringify(artistProfile), 'EX', 864000); // 10 day
            logger_1.default.info(`saved artist profile from cache`);
        }
        else {
            logger_1.default.info(`serving artist profile from cache`);
            artistProfile = JSON.parse(artistProfileJson);
        }
        for (let i = 0; i < artistProfile.ArtistInEvents.length; i++) {
            if (phoneNumber) {
                const registrationLog = await RegistrationLog_1.default.findOne({
                    PhoneNumber: phoneNumber,
                    EventId: artistProfile.ArtistInEvents[i].EventId
                });
                if (registrationLog) {
                    artistProfile.ArtistInEvents[i].UserVoteHash = registrationLog.VoteUrl && registrationLog.VoteUrl.replace('/v/', '');
                }
            }
        }
        artistProfile.IsFollowing = await this.isFollowingArtistProfile(regId, contestantId);
        return artistProfile;
    }
    async isFollowingArtistProfile(regId, contestantId) {
        const followingResult = await Contestant_1.default.aggregate().match({
            _id: mongoose.Types.ObjectId(contestantId)
        }).project({
            index: { $indexOfArray: ['$Followers', mongoose.Types.ObjectId(regId)] },
        }).exec();
        return followingResult[0] && followingResult[0].index >= 0;
    }
    static async _fetchBioFromWp(entryId) {
        try {
            const arUrl = `https://artbattle.com/wp-json/gravityview/v1/views/207610/entries/${entryId}.json`;
            logger_1.default.info(`Downloading Artist profile ${arUrl}`);
            const result = await fetch(arUrl, {
                method: 'get',
                headers: {
                    host: 'artbattle.com',
                    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.5 Safari/605.1.15',
                    'accept-language': 'en-us',
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });
            if (!result.ok) {
                logger_1.default.error(`url result ${result.status} ${await result.text()}`);
            }
            else {
                const body = JSON.parse(await result.text());
                return {
                    bio: body[6],
                    instagram: body[17],
                    images: [
                        // TODO optimize images in our end
                        await ArtistService._cacheImage(body[28].replace(/\|:\|/g, '')),
                        await ArtistService._cacheImage(body[29].replace(/\|:\|/g, '')),
                        await ArtistService._cacheImage(body[30].replace(/\|:\|/g, ''))
                    ],
                    website: body[72],
                    adminBio: body[95],
                    adminNotes: body[96]
                };
            }
        }
        catch (e) {
            logger_1.default.error(e);
        }
    }
    static async _cacheImage(externalUrl) {
        if (parseInt(process.env.FILE_SERVER) !== 1) {
            return externalUrl;
        }
        const parsedUrl = url.parse(externalUrl);
        const baseName = path.basename(parsedUrl.path);
        const extension = path.extname(baseName);
        const dir = path.resolve(`${__dirname}/../public/uploads/${parsedUrl.path.replace(baseName, '')}`);
        const newFilePath = `${dir}/cached-${baseName.replace(extension, '.jpg')}`;
        let fileExists = false;
        try {
            await fs.stat(newFilePath);
            fileExists = true;
        }
        catch (e) { }
        const cachedUrl = `${process.env.MEDIA_SITE_URL}${newFilePath.replace(path.resolve(`${__dirname}/../public/`), '')}`;
        if (fileExists) {
            return cachedUrl;
        }
        logger_1.default.info(`downloading external image ${externalUrl}`);
        const result = await fetch(externalUrl, {
            method: 'get',
            headers: {
                host: 'artbattle.com',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.5 Safari/605.1.15',
                'accept-language': 'en-us',
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
        });
        if (!result.ok) {
            logger_1.default.error(`image cache failed ${result.status} ${await result.text()}`);
            return externalUrl;
        }
        const imgBuffer = await result.buffer();
        await fs.mkdirp(dir);
        const resizeResult = await sharp(imgBuffer).rotate().resize(1200).jpeg({
            quality: 75,
            chromaSubsampling: '4:4:4',
        }).toFile(newFilePath);
        logger_1.default.info(`cached AB image of Artist ${JSON.stringify(resizeResult, null, 1)} ${cachedUrl}`);
        return cachedUrl;
    }
    static _parseName(name) {
        const names = name.trim().split(' ');
        let firstName = '';
        let lastName = '';
        // to highlight first name
        for (let i = 0; i < names.length; i++) {
            if (i !== (names.length - 1)) {
                if (i > 0) {
                    firstName += ' ';
                }
                if (names[i].trim() !== '') {
                    firstName += names[i];
                }
            }
            else {
                lastName = ' ' + names[i];
            }
        }
        return {
            firstName: firstName,
            lastName: lastName
        };
    }
    async fetchWooCommerceProducts(entryId) {
        try {
            const termId = await this.getAttributeTermIdByEntryId(entryId);
            if (!termId) {
                return [];
            }
            return this._getProductsByTermId(termId);
        }
        catch (e) {
            if (e && e.data) {
                logger_1.default.error(e && e.data);
            }
            else {
                logger_1.default.error(e);
            }
        }
    }
    async _getProductsByTermId(termId) {
        return this._makeGetProductsApiCall({
            attribute_term: termId,
            attribute: 'pa_ai'
        });
    }
    async _getWooProductById(productId) {
        const response = await this._wooCommerceApi.get(`products/${productId}`);
        if (response && response.status === 200 && response.data) {
            return response.data;
        }
        else {
            logger_1.default.error(`unable to find product by ${productId} ${response.status} ${response.data}`);
        }
    }
    async _makeGetProductsApiCall(params) {
        const response = await this._wooCommerceApi.get(`products`, params);
        if (response && response.status === 200 && Array.isArray(response.data)) {
            logger_1.default.info('woo commerce product call' + JSON.stringify(response.data, null, 1));
            const wooProducts = response.data;
            const artistProducts = [];
            for (let i = 0; i < wooProducts.length; i++) {
                artistProducts.push({
                    description: wooProducts[i].description,
                    permalink: wooProducts[i].permalink,
                    name: wooProducts[i].name,
                    purchasable: wooProducts[i].purchasable,
                    images: wooProducts[i].images,
                    price: `$${wooProducts[i].price}`
                });
            }
            return artistProducts;
        }
        else {
            logger_1.default.error(`unable to find product for the given ${params}, response ${response.status} ${response.data}`);
        }
        return [];
    }
    async Follow(contestantId, userId, IsFollowing) {
        if (!userId) {
            const message = `user Id is required`;
            logger_1.default.error(message);
            throw ({
                Success: false,
                status: 403,
                message: message
            });
        }
        if (!contestantId) {
            const message = `contestant Id is required`;
            logger_1.default.error(message);
            throw ({
                Success: false,
                status: 403,
                message: message
            });
        }
        const contestant = await Contestant_1.default.findById(contestantId);
        if (!contestantId) {
            const message = `Invalid contestant Id.`;
            logger_1.default.error(message);
            throw ({
                Success: false,
                status: 404,
                message: message
            });
        }
        if (!(IsFollowing === true || IsFollowing === false)) {
            const message = `Is Following must be boolean.`;
            logger_1.default.error(message);
            throw ({
                Success: false,
                status: 404,
                message: message
            });
        }
        const contestantIndex = contestant.Followers.indexOf(userId.toString());
        if (IsFollowing && -1 === contestantIndex) {
            contestant.Followers.push(userId);
        }
        else if (!IsFollowing && contestantIndex > -1) {
            contestant.Followers.splice(contestantIndex, 1);
        }
        contestant.FollowersCount = contestant.FollowersCount + 1;
        contestant.Score = contestant.VotesCount + contestant.FollowersCount;
        await contestant.save();
    }
    async List(hash, cacheSet, cacheGet) {
        const processedContestantIds = [];
        const contestantList = [];
        const cacheKey = 'artist-list';
        const cachedList = await cacheGet(cacheKey);
        let contestantInRecentEvents;
        if (cachedList) {
            contestantInRecentEvents = JSON.parse(cachedList);
        }
        else {
            contestantInRecentEvents = await ArtistService._getArtistInRecentEvents();
            await cacheSet(cacheKey, JSON.stringify(contestantInRecentEvents), 'EX', 900);
        }
        for (let i = 0; i < contestantInRecentEvents.length; i++) {
            const contestant = contestantInRecentEvents[i];
            if (contestant.contestantDetail[0]) {
                let artIndex = processedContestantIds.indexOf(contestant.contestantDetail[0]._id.toString());
                if (artIndex === -1) {
                    const arrLen = processedContestantIds.push(contestant.contestantDetail[0]._id.toString());
                    artIndex = arrLen - 1;
                }
                if (!contestantList[artIndex]) {
                    contestantList[artIndex] = {
                        _id: contestant.contestantDetail[0]._id,
                        Link: `/ar/${contestant.contestantDetail[0]._id}/${hash || ''}`,
                        Name: contestant.contestantDetail[0].Name,
                        Images: contestant.Rounds.Contestants.Images
                    };
                }
                else {
                    contestantList[artIndex].Images = contestantList[artIndex].Images.concat(contestant.Rounds.Contestants.Images);
                }
            }
        }
        return contestantList;
    }
    static async _getArtistInRecentEvents() {
        return Event_1.default.aggregate()
            .sort({
            _id: -1
        })
            .limit(3)
            .unwind({
            path: '$Rounds',
            // includeArrayIndex: 'roundIndex',
            preserveNullAndEmptyArrays: false
        })
            .unwind({
            path: '$Rounds.Contestants',
            // includeArrayIndex: 'contestantIndex',
            preserveNullAndEmptyArrays: false
        })
            .match({
            'Rounds.Contestants.Enabled': true
        })
            .lookup({
            from: 'contestants',
            localField: 'Rounds.Contestants.Detail',
            foreignField: '_id',
            as: 'contestantDetail'
        });
    }
    async getArtistPageData(userId, hash, cacheSet, cacheGet) {
        const promises = [
            this._topArtistsByFollowersAndVotes(hash, cacheSet, cacheGet),
        ];
        if (userId) {
            promises.push(this._yourArtists(userId, hash));
        }
        const results = await Promise.all(promises);
        results[0] = this._randomSort(results[0]);
        return results;
    }
    async _yourArtists(userId, hash) {
        const promises = [
            this._usersFollowings(userId, hash),
            this._usersVotes(userId, hash)
        ];
        const results = await Promise.all(promises);
        const contestantList1 = results[0];
        const contestantList2 = results[1];
        const processedContestants = [];
        const uniqueContestantList = [];
        for (let i = 0; i < contestantList1.length; i++) {
            if (processedContestants.indexOf(contestantList1[i]._id.toString()) === -1) {
                processedContestants.push(contestantList1[i]._id.toString());
                uniqueContestantList.push(contestantList1[i]);
            }
        }
        for (let i = 0; i < contestantList2.length; i++) {
            if (processedContestants.indexOf(contestantList2[i]._id.toString()) === -1) {
                processedContestants.push(contestantList2[i]._id.toString());
                uniqueContestantList.push(contestantList2[i]);
            }
        }
        return uniqueContestantList;
    }
    async _topArtistsByFollowersAndVotes(hash, cacheSet, cacheGet) {
        const cacheKey = '_topArtistsByFollowersAndVotes1';
        const cachedList = await cacheGet(cacheKey);
        if (cachedList) {
            logger_1.default.info(`serving top artist by cache`);
            return JSON.parse(cachedList);
        }
        const contestants = await Contestant_1.default.find()
            .sort({
            Score: -1
        })
            .limit(200);
        const contestantList = [];
        for (let i = 0; i < contestants.length; i++) {
            contestantList.push({
                _id: contestants[i]._id,
                Name: contestants[i].Name,
                FollowersCount: contestants[i].FollowersCount,
                Link: `/ar/${contestants[i]._id}/${hash || ''}`,
                Images: [],
                VotesCount: contestants[i].VotesCount,
                Score: contestants[i].Score
            });
        }
        await cacheSet(cacheKey, JSON.stringify(contestantList), 'EX', 24 * 60 * 60);
        // sort random
        return contestantList;
    }
    _randomSort(contestantList) {
        return contestantList.sort((a, b) => {
            return 0.5 - Math.random();
        });
    }
    async _usersFollowings(userId, hash) {
        const contestants = await Contestant_1.default.find({ Followers: userId }).select(['_id', 'Name']);
        const contestantList = [];
        for (let i = 0; i < contestants.length; i++) {
            contestantList.push({
                _id: contestants[i]._id,
                Name: contestants[i].Name,
                FollowersCount: contestants[i].FollowersCount,
                Link: `/ar/${contestants[i]._id}/${hash || ''}`,
                Images: [],
                VotesCount: contestants[i].VotesCount,
                Score: contestants[i].Score
            });
        }
        return contestantList;
    }
    async _usersVotes(userId, hash) {
        const contestantList = [];
        const aggContestants = await VotingLog_1.default.aggregate()
            .match({
            Registration: userId
        })
            .lookup({
            from: 'contestants',
            localField: 'Contestant',
            foreignField: '_id',
            as: 'ContestantData'
        })
            .unwind({
            path: '$ContestantData'
        });
        for (let i = 0; i < aggContestants.length; i++) {
            const contestant = aggContestants[i].ContestantData;
            if (contestant && contestant._id) {
                contestantList.push({
                    _id: contestant._id,
                    Name: contestant.Name,
                    FollowersCount: contestant.FollowersCount,
                    Link: `/ar/${contestant._id}/${hash || ''}`,
                    Images: [],
                    VotesCount: contestant.VotesCount,
                    Score: contestant.Score
                });
            }
            else {
                logger_1.default.error(`artist not recorded properly ${JSON.stringify(aggContestants[i], null, 1)}`);
            }
        }
        return contestantList;
    }
    async searchArtists(searchTerm, limit, page, cacheSet, cacheGet) {
        if (searchTerm.length === 0) {
            const topArtists = await this._topArtistsByFollowersAndVotesForAdmin(cacheSet, cacheGet);
            const resp = {
                Success: true,
                Data: {
                    Contestants: topArtists,
                    Count: topArtists.length
                }
            };
            return resp;
        }
        const or = [
            {
                $text: {
                    $search: searchTerm,
                }
            },
            {
                Email: searchTerm
            }
        ];
        const entryId = parseInt(searchTerm);
        if (!isNaN(entryId)) {
            or.push({
                EntryId: entryId
            });
        }
        let query = {};
        if (searchTerm.length > 0) {
            query = {
                $or: or
            };
        }
        query.IsDuplicate = { $in: [null, false] };
        query.EntryId = { $exists: true };
        const results = await Promise.all([Contestant_1.default.
                find(query, { score: { $meta: 'textScore' } })
                .limit(limit)
                .skip((page - 1) * 10)
                .sort({ score: { $meta: 'textScore' } })
                .populate('Registration'),
            Contestant_1.default.countDocuments(query)
        ]);
        const contestants = results[0];
        const count = results[1];
        const resp = {
            Success: true,
            Data: {
                Contestants: contestants,
                Count: count
            }
        };
        return resp;
    }
    async _topArtistsByFollowersAndVotesForAdmin(cacheSet, cacheGet) {
        const cacheKey = '_topArtistsByFollowersAndVotesForAdmin1';
        const cachedList = await cacheGet(cacheKey);
        if (cachedList) {
            logger_1.default.info(`serving top artist for admin by cache`);
            return JSON.parse(cachedList);
        }
        const contestants = await Contestant_1.default.find()
            .populate('Registration')
            .sort({
            Score: -1
        })
            .limit(200);
        await cacheSet(cacheKey, JSON.stringify(contestants), 'EX', 60 * 60);
        // sort random
        return contestants;
    }
    async getAttributeTermIdByEntryId(entryId) {
        const result = await this._wooCommerceApi.get(`products/attributes/1/terms`, {
            per_page: 1,
            slug: entryId
        });
        console.log('terms', result.data, `products/attributes/1/terms?slug=${entryId}`);
        if (Array.isArray(result.data) && result.data.length > 0) {
            return parseInt(result.data[0].name) === entryId ? result.data[0].id : undefined;
        }
    }
    async getProducts(searchTerm, limit, page) {
        let query = {};
        if (searchTerm && searchTerm.length > 0) {
            query = {
                ProductId: searchTerm
            };
        }
        logger_1.default.info(`limit ${limit}`);
        logger_1.default.info(`${(page - 1) * limit}`);
        const results = await Promise.all([ArtistWooCommerce_1.default.find(query)
                .limit(limit)
                .populate('Contestant')
                .skip((page - 1) * limit),
            ArtistWooCommerce_1.default.countDocuments(query)
        ]);
        const products = results[0];
        const count = results[1];
        const resp = {
            Success: true,
            Data: {
                Products: products,
                Count: count
            }
        };
        return resp;
    }
    async updateProduct(payload, product, cacheSet, cacheGet) {
        logger_1.default.info('updating product ' + JSON.stringify(payload, null, 1));
        return this._saveProduct(payload, product, cacheSet, cacheGet);
    }
    async _saveProduct(payload, product, cacheSet, cacheGet) {
        const cacheKey = `artist-products-${payload.ContestantId}`;
        const contestant = await this._findContestantOrThrow(payload.ContestantId);
        const artistProductJson = await cacheGet(cacheKey);
        let artistProduct;
        if (!artistProductJson) {
            artistProduct = this._getProductCacheObj(contestant);
        }
        else {
            artistProduct = JSON.parse(artistProductJson);
        }
        product.ProductId = payload.ProductId;
        product.Confirmation = payload.Confirmation;
        product.Contestant = contestant._id;
        // TODO call WS, save output in mongo & calculate cache
        let wooProduct;
        try {
            wooProduct = await this._getWooProductById(product.ProductId);
        }
        catch (e) {
            logger_1.default.error(`unable to find product by ${product.ProductId}`);
            logger_1.default.error(e);
        }
        if (wooProduct) {
            logger_1.default.info(`saving woo product info` + JSON.stringify(wooProduct, null, 1));
            console.log(JSON.stringify(wooProduct, null, 1));
            product.Description = wooProduct.description;
            product.Permalink = wooProduct.permalink;
            product.Name = wooProduct.name;
            product.Purchasable = wooProduct.purchasable === true;
            product.Images = wooProduct.images;
            product.Price = `$${wooProduct.price}`;
        }
        const savedProduct = await product.save();
        artistProduct.Products[savedProduct._id] = product; // pushing into cache
        if (contestant.WooProducts.indexOf(savedProduct._id) === -1) {
            contestant.WooProducts.push(savedProduct);
            await contestant.save();
        }
        await cacheSet(cacheKey, JSON.stringify(artistProduct));
        const resp = {
            Success: true,
            Data: {
                Product: savedProduct,
            }
        };
        return resp;
    }
    async _findContestantOrThrow(contestantId) {
        const contestant = await Contestant_1.default.findById(contestantId);
        if (!contestant) {
            throw new Error('Contestant not found');
        }
        return contestant;
    }
    async addProduct(payload, cacheSet, cacheGet) {
        logger_1.default.info('adding product ' + JSON.stringify(payload, null, 1));
        const product = new ArtistWooCommerce_1.default();
        return this._saveProduct(payload, product, cacheSet, cacheGet);
    }
    async removeProduct(productId, cacheSet, cacheGet) {
        const product = await ArtistWooCommerce_1.default.findById({ _id: productId }).populate('Contestant');
        if (!product) {
            throw new Error('Invalid product id');
        }
        await ArtistWooCommerce_1.default.deleteOne({ _id: productId });
        const cacheKey = `artist-products-${product.Contestant._id}`;
        const artistProductJson = await cacheGet(cacheKey);
        let artistProduct;
        if (!artistProductJson) {
            artistProduct = this._getProductCacheObj(product.Contestant);
        }
        else {
            artistProduct = JSON.parse(artistProductJson);
            delete artistProduct.Products[productId];
        }
        await cacheSet(cacheKey, JSON.stringify(artistProduct));
    }
    async updateProductCache(productId, cacheSet, cacheGet) {
        let artistProduct;
        const product = await ArtistWooCommerce_1.default.findById({ _id: productId }).populate('Contestant');
        if (product) {
            const contestant = product.Contestant;
            const cacheKey = `artist-products-${contestant._id}`;
            const artistProductJson = await cacheGet(cacheKey);
            if (!artistProductJson) {
                artistProduct = this._getProductCacheObj(contestant);
            }
            else {
                artistProduct = JSON.parse(artistProductJson);
            }
            artistProduct.Products[product._id] = product; // pushing into cache
            await cacheSet(cacheKey, JSON.stringify(artistProduct));
        }
    }
    _getProductCacheObj(contestant) {
        return {
            _id: contestant._id,
            Name: contestant.Name,
            Products: {}
        };
    }
}
exports.ArtistService = ArtistService;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFVLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDckQsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNuRCxJQUFJLENBQUMsaUJBQWlCLEVBQUU7Z0JBQ3BCLGFBQWEsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsVUFBVSxDQUFDLENBQUM7YUFDeEQ7aUJBQU07Z0JBQ0gsYUFBYSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQzthQUNqRDtZQUNELGFBQWEsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDLHFCQUFxQjtZQUNwRSxNQUFNLFFBQVEsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1NBQzNEO0lBQ0wsQ0FBQztJQUVELG1CQUFtQixDQUFDLFVBQXlCO1FBQ3pDLE9BQU87WUFDSCxHQUFHLEVBQUUsVUFBVSxDQUFDLEdBQUc7WUFDbkIsSUFBSSxFQUFFLFVBQVUsQ0FBQyxJQUFJO1lBQ3JCLFFBQVEsRUFBRSxFQUFFO1NBQ2YsQ0FBQztJQUNOLENBQUM7Q0FDSjtBQWhoQ0Qsc0NBZ2hDQyIsImZpbGUiOiJjb21tb24vQXJ0aXN0U2VydmljZS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBsb2dnZXIgZnJvbSAnLi4vY29uZmlnL2xvZ2dlcic7XG5pbXBvcnQgQ29udGVzdGFudE1vZGVsLCB7IENvbnRlc3RhbnREb2N1bWVudCB9IGZyb20gJy4uL21vZGVscy9Db250ZXN0YW50JztcbmltcG9ydCBSZWdpc3RyYXRpb25Nb2RlbCwgeyBSZWdpc3RyYXRpb25Eb2N1bWVudCB9IGZyb20gJy4uL21vZGVscy9SZWdpc3RyYXRpb24nO1xuaW1wb3J0IHsgUmVnaXN0ZXJWb3RlclYyIH0gZnJvbSAnLi9SZWdpc3RlclZvdGVyVjInO1xuaW1wb3J0IHsgQ2l0eURUTyB9IGZyb20gJy4uLy4uLy4uL3NoYXJlZC9DaXR5RFRPJztcblxuaW1wb3J0IENpdHlNb2RlbCBmcm9tICcuLi9tb2RlbHMvQ2l0eSc7XG5pbXBvcnQgRXZlbnRNb2RlbCBmcm9tICcuLi9tb2RlbHMvRXZlbnQnO1xuaW1wb3J0IGFydGlzdFdpc2VJbWFnZXMgZnJvbSAnLi9BcnRpc3RXaXNlSW1hZ2VzJztcbmltcG9ydCB7IFJvdW5kQXJ0aXN0c0ludGVyZmFjZSB9IGZyb20gJy4uLy4uLy4uL3NoYXJlZC9BcnRpc3RJbWFnZURUTyc7XG4vLyBAdHMtaWdub3JlXG5pbXBvcnQgeyBBcnRpc3RQcm9maWxlRFRPLCBXb29Qcm9kdWN0IH0gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL0FydGlzdFByb2ZpbGVEVE8nO1xuaW1wb3J0ICogYXMgbW9uZ29vc2UgZnJvbSAnbW9uZ29vc2UnO1xuaW1wb3J0IHsgQXJ0aXN0TGlzdERUTywgQXJ0aXN0TGlzdFYyIH0gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL0FydGlzdExpc3REVE8nO1xuaW1wb3J0IFJlZ2lzdHJhdGlvbkxvZ01vZGVsIGZyb20gJy4uL21vZGVscy9SZWdpc3RyYXRpb25Mb2cnO1xuaW1wb3J0IFZvdGluZ0xvZ01vZGVsIGZyb20gJy4uL21vZGVscy9Wb3RpbmdMb2cnO1xuaW1wb3J0IENvbnRlc3RhbnREVE8gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL0NvbnRlc3RhbnREVE8nO1xuaW1wb3J0IHsgRGF0YU9wZXJhdGlvblJlc3VsdCB9IGZyb20gJy4uLy4uLy4uL3NoYXJlZC9PcGVyYXRpb25SZXN1bHQnO1xuaW1wb3J0ICogYXMgdXJsIGZyb20gJ3VybCc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMtZXh0cmEnO1xuaW1wb3J0ICogYXMgc2hhcnAgZnJvbSAnc2hhcnAnO1xuaW1wb3J0IEFydGlzdFdvb0NvbW1lcmNlTW9kZWwsIHsgQXJ0aXN0V29vQ29tbWVyY2VEb2N1bWVudCB9IGZyb20gJy4uL21vZGVscy9BcnRpc3RXb29Db21tZXJjZSc7XG5pbXBvcnQgeyBBcnRpc3RQcm9kdWN0Q2FjaGVEVE8sIEFydGlzdFdvb0NvbW1lcmNlRFRPIH0gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL0FydGlzdFdvb0NvbW1lcmNlRFRPJztcbmNvbnN0IFdvb0NvbW1lcmNlUmVzdEFwaSA9IHJlcXVpcmUoJ0B3b29jb21tZXJjZS93b29jb21tZXJjZS1yZXN0LWFwaScpLmRlZmF1bHQ7XG5jb25zdCBmZXRjaCA9IHJlcXVpcmUoJ25vZGUtZmV0Y2gnKTtcbmludGVyZmFjZSBDb250ZXN0YW50UGF5bG9hZCB7XG4gICAgTmFtZTogc3RyaW5nO1xuICAgIEVudHJ5SWQ6IG51bWJlcjtcbiAgICBXZWJzaXRlOiBzdHJpbmc7XG4gICAgQ2l0eTogQ2l0eURUTztcbiAgICBQaG9uZU51bWJlcjogc3RyaW5nO1xuICAgIEVtYWlsOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBBcnRpc3RTZXJ2aWNlIHtcbiAgICBwcml2YXRlIF93b29Db21tZXJjZUFwaSA9IG5ldyBXb29Db21tZXJjZVJlc3RBcGkoe1xuICAgICAgICB1cmw6ICdodHRwczovL2FydGJhdHRsZS5jb20nLFxuICAgICAgICBjb25zdW1lcktleTogJ2NrXzUyOWJmN2FjNzYyOGQ4OTVkMzQyZTlmYjRjN2FiNDEzOGM2Yzk1N2InLFxuICAgICAgICBjb25zdW1lclNlY3JldDogJ2NzXzZiNDZjY2UyZWZkNmZkZGViOGEzOGI1ODc1MzZmZWI5MGNiNzUxYTUnLFxuICAgICAgICB2ZXJzaW9uOiAnd2MvdjMnXG4gICAgfSk7XG5cbiAgICBwdWJsaWMgYXN5bmMgVXBkYXRlKGNvbnRlc3RhbnRJZDogYW55LCBvYmo6IENvbnRlc3RhbnRQYXlsb2FkLCB1c2VyQWdlbnQ6IHN0cmluZykge1xuICAgICAgICBpZiAoIWNvbnRlc3RhbnRJZCkge1xuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGBjb250ZXN0YW50IElkIGlzIHJlcXVpcmVkYDtcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgIHRocm93IHtcbiAgICAgICAgICAgICAgICBTdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzdGF0dXM6IDQwMyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IENvbnRlc3RhbnQgPSBhd2FpdCBDb250ZXN0YW50TW9kZWwuZmluZEJ5SWQoY29udGVzdGFudElkKTtcbiAgICAgICAgaWYgKCFDb250ZXN0YW50KSB7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gYEludmFsaWQgY29udGVzdGFudCBJZCBwYXNzZWQgJHtjb250ZXN0YW50SWR9YDtcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihtZXNzYWdlKTtcbiAgICAgICAgICAgIHRocm93IHtcbiAgICAgICAgICAgICAgICBTdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzdGF0dXM6IDQwNCxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLlNhdmUoQ29udGVzdGFudCwgb2JqLCB1c2VyQWdlbnQpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBBZGQob2JqOiBDb250ZXN0YW50UGF5bG9hZCwgdXNlckFnZW50OiBzdHJpbmcpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuU2F2ZShuZXcgQ29udGVzdGFudE1vZGVsKCksIG9iaiwgdXNlckFnZW50LCB0cnVlKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgU2F2ZShDb250ZXN0YW50OiBDb250ZXN0YW50RG9jdW1lbnQsIG9iajogQ29udGVzdGFudFBheWxvYWQsIHVzZXJBZ2VudDogc3RyaW5nLCBJc0FkZD86IGJvb2xlYW4pIHtcbiAgICAgICAgY29uc3Qge05hbWUsIEVtYWlsLCBFbnRyeUlkLCBXZWJzaXRlLCBDaXR5LCBQaG9uZU51bWJlcn0gPSBvYmo7XG4gICAgICAgIGlmICghRW1haWwgfHwgKEVtYWlsICYmIEVtYWlsLmxlbmd0aCA9PT0gMCkpIHtcbiAgICAgICAgICAgIHRocm93IHtcbiAgICAgICAgICAgICAgICBTdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzdGF0dXM6IDQwMyxcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnRW1haWwgaXMgcmVxdWlyZWQnXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIGlmIChOYW1lICYmIE5hbWUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgQ29udGVzdGFudC5OYW1lID0gTmFtZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoV2Vic2l0ZSAmJiBXZWJzaXRlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIENvbnRlc3RhbnQuV2Vic2l0ZSA9IFdlYnNpdGU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKENpdHkpIHtcbiAgICAgICAgICAgIENvbnRlc3RhbnQuQ2l0eSA9IENpdHk7XG4gICAgICAgIH1cbiAgICAgICAgQ29udGVzdGFudCA9IGF3YWl0IHRoaXMuVGFnSWZEdXBsaWNhdGUocGFyc2VJbnQoU3RyaW5nKEVudHJ5SWQpKSwgRW1haWwsIFBob25lTnVtYmVyLCBDb250ZXN0YW50LCBJc0FkZCk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuTWFwQ29udGVzdGFudFJlZ2lzdHJhdGlvbih7XG4gICAgICAgICAgICBDb250ZXN0YW50LCB1c2VyQWdlbnRcbiAgICAgICAgfSk7XG4gICAgICAgIENvbnRlc3RhbnQgPSByZXN1bHQuQ29udGVzdGFudDtcbiAgICAgICAgcmV0dXJuIENvbnRlc3RhbnQ7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIFRhZ0lmRHVwbGljYXRlKEVudHJ5SWQ6IG51bWJlciwgRW1haWw6IHN0cmluZywgUGhvbmVOdW1iZXI6IHN0cmluZywgQ29udGVzdGFudDogQ29udGVzdGFudERvY3VtZW50LCBJc0FkZD86IGJvb2xlYW4pIHtcbiAgICAgICAgaWYgKEVudHJ5SWQgJiYgRW50cnlJZCA+IDApIHtcbiAgICAgICAgICAgIC8vIEVudHJ5IGlkIHNob3VsZCBiZSB1bmlxdWVcbiAgICAgICAgICAgIGNvbnN0IHF1ZXJ5ID0ge1xuICAgICAgICAgICAgICAgIEVudHJ5SWQ6IEVudHJ5SWRcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjb25zdCBtYXRjaGVkQ29udGVzdGFudCA9IGF3YWl0IEFydGlzdFNlcnZpY2UuZmluZER1cGxpY2F0ZShxdWVyeSwgQ29udGVzdGFudCk7XG4gICAgICAgICAgICBpZiAobWF0Y2hlZENvbnRlc3RhbnQgJiYgIUlzQWRkKSB7XG4gICAgICAgICAgICAgICAgQ29udGVzdGFudCA9IGF3YWl0IHRoaXMuX3NhdmVNYXRjaGVkQ29udGVzdGFudChtYXRjaGVkQ29udGVzdGFudCwgQ29udGVzdGFudCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG1hdGNoZWRDb250ZXN0YW50ICYmIElzQWRkKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6IDQwMyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYER1cGxpY2F0ZSBjb250ZXN0YW50ICR7bWF0Y2hlZENvbnRlc3RhbnQuTmFtZX0gKCR7bWF0Y2hlZENvbnRlc3RhbnQuRW50cnlJZH0pIGZvdW5kIHdpdGggc2FtZSBFbnRyeSBJZCAke0VudHJ5SWR9YFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIUNvbnRlc3RhbnQuSXNEdXBsaWNhdGUpIHtcbiAgICAgICAgICAgICAgICBDb250ZXN0YW50LkVudHJ5SWQgPSBFbnRyeUlkO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChFbWFpbCAmJiBFbWFpbC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBFbWFpbCBzaG91bGQgYmUgdW5pcXVlXG4gICAgICAgICAgICBjb25zdCBxdWVyeSA9IHtcbiAgICAgICAgICAgICAgICBFbWFpbDogRW1haWxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjb25zdCBtYXRjaGVkQ29udGVzdGFudCA9IGF3YWl0IEFydGlzdFNlcnZpY2UuZmluZER1cGxpY2F0ZShxdWVyeSwgQ29udGVzdGFudCk7XG4gICAgICAgICAgICBpZiAobWF0Y2hlZENvbnRlc3RhbnQgJiYgIUlzQWRkKSB7XG4gICAgICAgICAgICAgICAgQ29udGVzdGFudCA9IGF3YWl0IHRoaXMuX3NhdmVNYXRjaGVkQ29udGVzdGFudChtYXRjaGVkQ29udGVzdGFudCwgQ29udGVzdGFudCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKG1hdGNoZWRDb250ZXN0YW50ICYmIElzQWRkKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cge1xuICAgICAgICAgICAgICAgICAgICBzdGF0dXM6IDQwMyxcbiAgICAgICAgICAgICAgICAgICAgbWVzc2FnZTogYER1cGxpY2F0ZSBjb250ZXN0YW50ICR7bWF0Y2hlZENvbnRlc3RhbnQuTmFtZX0gKCR7bWF0Y2hlZENvbnRlc3RhbnQuRW50cnlJZH0pIGZvdW5kIHdpdGggc2FtZSBFbWFpbCAke0VtYWlsfWBcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFDb250ZXN0YW50LklzRHVwbGljYXRlKSB7XG4gICAgICAgICAgICAgICAgQ29udGVzdGFudC5FbWFpbCA9IEVtYWlsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChQaG9uZU51bWJlciAmJiBQaG9uZU51bWJlci5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAvLyBQaG9uZU51bWJlciBzaG91bGQgYmUgdW5pcXVlXG4gICAgICAgICAgICBjb25zdCBxdWVyeSA9IHtcbiAgICAgICAgICAgICAgICBQaG9uZU51bWJlcjogUGhvbmVOdW1iZXIsXG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgY29uc3QgbWF0Y2hlZENvbnRlc3RhbnQgPSBhd2FpdCBBcnRpc3RTZXJ2aWNlLmZpbmREdXBsaWNhdGUocXVlcnksIENvbnRlc3RhbnQpO1xuICAgICAgICAgICAgaWYgKG1hdGNoZWRDb250ZXN0YW50ICYmICFJc0FkZCkge1xuICAgICAgICAgICAgICAgIENvbnRlc3RhbnQgPSBhd2FpdCB0aGlzLl9zYXZlTWF0Y2hlZENvbnRlc3RhbnQobWF0Y2hlZENvbnRlc3RhbnQsIENvbnRlc3RhbnQpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChtYXRjaGVkQ29udGVzdGFudCAmJiBJc0FkZCkge1xuICAgICAgICAgICAgICAgIHRocm93IHtcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiA0MDMsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBEdXBsaWNhdGUgY29udGVzdGFudCAke21hdGNoZWRDb250ZXN0YW50Lk5hbWV9ICgke21hdGNoZWRDb250ZXN0YW50LkVudHJ5SWR9KSBmb3VuZCB3aXRoIHNhbWUgUGhvbmUgbnVtYmVyICR7UGhvbmVOdW1iZXJ9YFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIUNvbnRlc3RhbnQuSXNEdXBsaWNhdGUpIHtcbiAgICAgICAgICAgICAgICBDb250ZXN0YW50LlBob25lTnVtYmVyID0gUGhvbmVOdW1iZXI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIENvbnRlc3RhbnQ7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdGF0aWMgYXN5bmMgZmluZER1cGxpY2F0ZShxdWVyeTogeyBFbnRyeUlkPzogbnVtYmVyOyBJc0R1cGxpY2F0ZT86IHsgJGluOiBhbnlbXX07IF9pZD86IGFueTsgRW1haWw/OiBzdHJpbmc7IFBob25lTnVtYmVyPzogc3RyaW5nOyB9LCBDb250ZXN0YW50OiBDb250ZXN0YW50RG9jdW1lbnQpIHtcbiAgICAgICAgcXVlcnkuSXNEdXBsaWNhdGUgPSB7JGluOiBbbnVsbCwgZmFsc2VdfTtcbiAgICAgICAgcXVlcnkuX2lkID0ge307XG4gICAgICAgIGlmIChDb250ZXN0YW50Ll9pZCkge1xuICAgICAgICAgICAgcXVlcnkuX2lkID0geyRuZTogQ29udGVzdGFudC5faWR9O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBDb250ZXN0YW50TW9kZWwuZmluZE9uZShxdWVyeSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBfc2F2ZU1hdGNoZWRDb250ZXN0YW50KG1hdGNoZWRDb250ZXN0YW50OiBDb250ZXN0YW50RG9jdW1lbnQsIENvbnRlc3RhbnQ6IENvbnRlc3RhbnREb2N1bWVudCkge1xuICAgICAgICBDb250ZXN0YW50LklzRHVwbGljYXRlID0gdHJ1ZTtcbiAgICAgICAgbWF0Y2hlZENvbnRlc3RhbnQuQ2hpbGRDb250ZXN0YW50cyA9IG1hdGNoZWRDb250ZXN0YW50LkNoaWxkQ29udGVzdGFudHMgfHwgW107XG4gICAgICAgIGlmIChtYXRjaGVkQ29udGVzdGFudC5DaGlsZENvbnRlc3RhbnRzLmluZGV4T2YoQ29udGVzdGFudC5faWQpID09PSAtMSkge1xuICAgICAgICAgICAgbWF0Y2hlZENvbnRlc3RhbnQuQ2hpbGRDb250ZXN0YW50cy5wdXNoKENvbnRlc3RhbnQuX2lkKTtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBtYXRjaGVkQ29udGVzdGFudC5zYXZlKCk7XG4gICAgICAgIGF3YWl0IHRoaXMuUmVwbGFjZUNvbnRlc3RhbnRJbkV2ZW50cyhtYXRjaGVkQ29udGVzdGFudC5faWQsIENvbnRlc3RhbnQuX2lkKTtcbiAgICAgICAgcmV0dXJuIENvbnRlc3RhbnQ7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIE1hcENvbnRlc3RhbnRSZWdpc3RyYXRpb24ob2JqOiB7XG4gICAgICAgIENvbnRlc3RhbnQ6IENvbnRlc3RhbnREb2N1bWVudDtcbiAgICAgICAgdXNlckFnZW50OiBzdHJpbmc7XG4gICAgfSkge1xuICAgICAgICBsZXQge0NvbnRlc3RhbnR9ID0gb2JqO1xuICAgICAgICBjb25zdCB7dXNlckFnZW50fSA9IG9iajtcbiAgICAgICAgaWYgKCFDb250ZXN0YW50LlBob25lTnVtYmVyIHx8IENvbnRlc3RhbnQuSXNEdXBsaWNhdGUpIHtcbiAgICAgICAgICAgIGF3YWl0IENvbnRlc3RhbnQuc2F2ZSgpO1xuICAgICAgICAgICAgcmV0dXJuIHtyZWdpc3RyYXRpb246IGZhbHNlLCBDb250ZXN0YW50fTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgcmVnaXN0cmF0aW9uID0gYXdhaXQgUmVnaXN0cmF0aW9uTW9kZWwuZmluZE9uZSh7UGhvbmVOdW1iZXI6IENvbnRlc3RhbnQuUGhvbmVOdW1iZXJ9KVxuICAgICAgICAgICAgLnBvcHVsYXRlKCdBcnRpc3QnKTtcbiAgICAgICAgaWYgKHJlZ2lzdHJhdGlvbiAmJiByZWdpc3RyYXRpb24uQXJ0aXN0XG4gICAgICAgICAgICAmJiByZWdpc3RyYXRpb24uQXJ0aXN0Ll9pZC50b1N0cmluZygpICE9PSBDb250ZXN0YW50Ll9pZC50b1N0cmluZygpXG4gICAgICAgICkge1xuICAgICAgICAgICAgdGhyb3cge1xuICAgICAgICAgICAgICAgIFN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHN0YXR1czogNDAzLFxuICAgICAgICAgICAgICAgIGNvZGU6ICdQSE9ORV9JTl9VU0UnLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBUaGlzIHBob25lIG51bWJlciBpcyBhbHJlYWR5IHJlZ2lzdGVyZWQgd2l0aCAke3JlZ2lzdHJhdGlvbi5BcnRpc3QuTmFtZX1cbiAgICAgICAgICAgICAgICBFbnRyeSBpZDogJHtyZWdpc3RyYXRpb24uQXJ0aXN0UHJvZmlsZSAmJiByZWdpc3RyYXRpb24uQXJ0aXN0UHJvZmlsZS5FbnRyeUlkfWAsXG4gICAgICAgICAgICAgICAgY29udGVzdGFudElkOiByZWdpc3RyYXRpb24uQXJ0aXN0Ll9pZFxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXJlZ2lzdHJhdGlvbikge1xuICAgICAgICAgICAgY29uc3QgcmVnaXN0cmF0aW9uTW9kZWwgPSBhd2FpdCBuZXcgUmVnaXN0ZXJWb3RlclYyKENvbnRlc3RhbnQuUGhvbmVOdW1iZXIsIHVzZXJBZ2VudCwgbnVsbCxcbiAgICAgICAgICAgICAgICBudWxsLCBudWxsLCBmYWxzZSkuUmVnaXN0ZXIoKTtcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbk1vZGVsLkFydGlzdCA9IENvbnRlc3RhbnQuX2lkO1xuICAgICAgICAgICAgcmVnaXN0cmF0aW9uID0gYXdhaXQgcmVnaXN0cmF0aW9uTW9kZWwuc2F2ZSgpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghcmVnaXN0cmF0aW9uLkFydGlzdCkge1xuICAgICAgICAgICAgcmVnaXN0cmF0aW9uLkFydGlzdCA9IENvbnRlc3RhbnQuX2lkO1xuICAgICAgICB9XG4gICAgICAgIHJlZ2lzdHJhdGlvbiA9IHRoaXMuQWRkUmVnUHJvZmlsZUlmRG9lc05vdEV4aXN0KHJlZ2lzdHJhdGlvbik7XG4gICAgICAgIENvbnRlc3RhbnQgPSBhd2FpdCB0aGlzLkFkZENvbnRlc3RhbnRQcm9maWxlSWZEb2VzTm90RXhpc3QocmVnaXN0cmF0aW9uLCBDb250ZXN0YW50KTtcbiAgICAgICAgYXdhaXQgcmVnaXN0cmF0aW9uLnNhdmUoKTtcbiAgICAgICAgaWYgKCFDb250ZXN0YW50LklzRHVwbGljYXRlKSB7XG4gICAgICAgICAgICBDb250ZXN0YW50LlJlZ2lzdHJhdGlvbiA9IHJlZ2lzdHJhdGlvbjtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBDb250ZXN0YW50LnNhdmUoKTtcbiAgICAgICAgcmV0dXJuIHtDb250ZXN0YW50LCByZWdpc3RyYXRpb259O1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBBZGRDb250ZXN0YW50UHJvZmlsZUlmRG9lc05vdEV4aXN0KHJlZ2lzdHJhdGlvbjogUmVnaXN0cmF0aW9uRG9jdW1lbnQsIENvbnRlc3RhbnQ6IENvbnRlc3RhbnREb2N1bWVudCkge1xuICAgICAgICBpZiAoIUNvbnRlc3RhbnQuRW1haWwpIHtcbiAgICAgICAgICAgIENvbnRlc3RhbnQuRW1haWwgPSByZWdpc3RyYXRpb24uRW1haWw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFDb250ZXN0YW50LkVudHJ5SWQgJiYgcmVnaXN0cmF0aW9uLkFydGlzdFByb2ZpbGUgJiYgcmVnaXN0cmF0aW9uLkFydGlzdFByb2ZpbGUuRW50cnlJZCkge1xuICAgICAgICAgICAgQ29udGVzdGFudC5FbnRyeUlkID0gcGFyc2VJbnQocmVnaXN0cmF0aW9uLkFydGlzdFByb2ZpbGUgJiYgcmVnaXN0cmF0aW9uLkFydGlzdFByb2ZpbGUuRW50cnlJZCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFDb250ZXN0YW50LkNpdHkgJiYgcmVnaXN0cmF0aW9uLkFydGlzdFByb2ZpbGUgJiYgcmVnaXN0cmF0aW9uLkFydGlzdFByb2ZpbGUuQ2l0eSkge1xuICAgICAgICAgICAgQ29udGVzdGFudC5DaXR5VGV4dCA9IHJlZ2lzdHJhdGlvbi5BcnRpc3RQcm9maWxlICYmIHJlZ2lzdHJhdGlvbi5BcnRpc3RQcm9maWxlLkNpdHk7XG4gICAgICAgICAgICBDb250ZXN0YW50LkNpdHkgPSBhd2FpdCBDaXR5TW9kZWwuZmluZE9uZSh7J05hbWUnOiBDb250ZXN0YW50Lk5hbWV9KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIUNvbnRlc3RhbnQuV2Vic2l0ZSAmJiByZWdpc3RyYXRpb24uQXJ0aXN0UHJvZmlsZSAmJiByZWdpc3RyYXRpb24uQXJ0aXN0UHJvZmlsZS5XZWJzaXRlKSB7XG4gICAgICAgICAgICBDb250ZXN0YW50LldlYnNpdGUgPSByZWdpc3RyYXRpb24uQXJ0aXN0UHJvZmlsZSAmJiByZWdpc3RyYXRpb24uQXJ0aXN0UHJvZmlsZS5XZWJzaXRlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghQ29udGVzdGFudC5OYW1lICYmIHJlZ2lzdHJhdGlvbi5BcnRpc3RQcm9maWxlICYmIHJlZ2lzdHJhdGlvbi5BcnRpc3RQcm9maWxlLk5hbWUpIHtcbiAgICAgICAgICAgIENvbnRlc3RhbnQuTmFtZSA9IHJlZ2lzdHJhdGlvbi5BcnRpc3RQcm9maWxlICYmIHJlZ2lzdHJhdGlvbi5BcnRpc3RQcm9maWxlLk5hbWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIENvbnRlc3RhbnQ7XG4gICAgfVxuXG4gICAgcHVibGljIEFkZFJlZ1Byb2ZpbGVJZkRvZXNOb3RFeGlzdChyZWdpc3RyYXRpb246IFJlZ2lzdHJhdGlvbkRvY3VtZW50KSB7XG4gICAgICAgIHJlZ2lzdHJhdGlvbi5BcnRpc3RQcm9maWxlLlByb2Nlc3NlZCA9IHRydWU7XG4gICAgICAgIGlmIChyZWdpc3RyYXRpb24uQXJ0aXN0Lk5hbWUgJiYgKCFyZWdpc3RyYXRpb24uQXJ0aXN0UHJvZmlsZS5OYW1lIHx8IHJlZ2lzdHJhdGlvbi5BcnRpc3RQcm9maWxlLk5hbWUgIT0gcmVnaXN0cmF0aW9uLkFydGlzdC5OYW1lKSkge1xuICAgICAgICAgICAgcmVnaXN0cmF0aW9uLkFydGlzdFByb2ZpbGUuTmFtZSA9IHJlZ2lzdHJhdGlvbi5BcnRpc3QuTmFtZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVnaXN0cmF0aW9uLkFydGlzdC5FbWFpbCAmJiAoIXJlZ2lzdHJhdGlvbi5BcnRpc3RQcm9maWxlLk5hbWUgfHwgcmVnaXN0cmF0aW9uLkFydGlzdFByb2ZpbGUuRW1haWwgIT0gcmVnaXN0cmF0aW9uLkFydGlzdC5FbWFpbCkpIHtcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi5BcnRpc3RQcm9maWxlLkVtYWlsID0gcmVnaXN0cmF0aW9uLkFydGlzdC5FbWFpbDtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVnaXN0cmF0aW9uLkFydGlzdC5DaXR5VGV4dCAmJiAoIXJlZ2lzdHJhdGlvbi5BcnRpc3RQcm9maWxlLkNpdHkgfHwgcmVnaXN0cmF0aW9uLkFydGlzdFByb2ZpbGUuQ2l0eSAhPSByZWdpc3RyYXRpb24uQXJ0aXN0LkNpdHlUZXh0KSkge1xuICAgICAgICAgICAgcmVnaXN0cmF0aW9uLkFydGlzdFByb2ZpbGUuQ2l0eSA9IHJlZ2lzdHJhdGlvbi5BcnRpc3QuQ2l0eVRleHQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJlZ2lzdHJhdGlvbi5BcnRpc3QuV2Vic2l0ZSAmJiAoIXJlZ2lzdHJhdGlvbi5BcnRpc3RQcm9maWxlLldlYnNpdGUgfHwgcmVnaXN0cmF0aW9uLkFydGlzdFByb2ZpbGUuV2Vic2l0ZSAhPSByZWdpc3RyYXRpb24uQXJ0aXN0LldlYnNpdGUpKSB7XG4gICAgICAgICAgICByZWdpc3RyYXRpb24uQXJ0aXN0UHJvZmlsZS5XZWJzaXRlID0gcmVnaXN0cmF0aW9uLkFydGlzdC5XZWJzaXRlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChyZWdpc3RyYXRpb24uQXJ0aXN0LlBob25lTnVtYmVyICYmICghcmVnaXN0cmF0aW9uLkFydGlzdFByb2ZpbGUuUGhvbmVOdW1iZXIgfHwgcmVnaXN0cmF0aW9uLkFydGlzdFByb2ZpbGUuUGhvbmVOdW1iZXIgIT0gcmVnaXN0cmF0aW9uLkFydGlzdC5QaG9uZU51bWJlcikpIHtcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi5BcnRpc3RQcm9maWxlLlBob25lTnVtYmVyID0gcmVnaXN0cmF0aW9uLkFydGlzdC5QaG9uZU51bWJlcjtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVnaXN0cmF0aW9uLkFydGlzdC5FbnRyeUlkICYmICghcmVnaXN0cmF0aW9uLkFydGlzdFByb2ZpbGUuRW50cnlJZCB8fCBwYXJzZUludChyZWdpc3RyYXRpb24uQXJ0aXN0UHJvZmlsZS5FbnRyeUlkKSAhPSByZWdpc3RyYXRpb24uQXJ0aXN0LkVudHJ5SWQpKSB7XG4gICAgICAgICAgICByZWdpc3RyYXRpb24uQXJ0aXN0UHJvZmlsZS5FbnRyeUlkID0gYCR7cmVnaXN0cmF0aW9uLkFydGlzdC5FbnRyeUlkfWA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlZ2lzdHJhdGlvbjtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgUmVwbGFjZUNvbnRlc3RhbnRJbkV2ZW50cyhyZXBsYWNlbWVudDogYW55LCBzZWFyY2g6IGFueSkge1xuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICAgICAgICBFdmVudE1vZGVsLnVwZGF0ZU1hbnkoe30sIHtcbiAgICAgICAgICAgICAgICAgICAgJHNldDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ1JvdW5kcy4kW10uQ29udGVzdGFudHMuJFtjb250ZXN0YW50XS5EZXRhaWwnOiByZXBsYWNlbWVudFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGFycmF5RmlsdGVyczogW1xuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjb250ZXN0YW50LkRldGFpbCc6IHNlYXJjaFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBFdmVudE1vZGVsLnVwZGF0ZU1hbnkoe30sIHtcbiAgICAgICAgICAgICAgICAgICAgJHNldDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgJ0NvbnRlc3RhbnRzLiRbY29udGVzdGFudF0nOiByZXBsYWNlbWVudFxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGFycmF5RmlsdGVyczogW1xuICAgICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdjb250ZXN0YW50Jzogc2VhcmNoXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICBdKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0QXJ0aXN0UHJvZmlsZShjb250ZXN0YW50SWQ6IGFueSkge1xuICAgICAgICBjb25zdCBwcm9taXNlczogYW55W10gPSBbXG4gICAgICAgICAgICBFdmVudE1vZGVsLmZpbmQoe1xuICAgICAgICAgICAgICAgICdDb250ZXN0YW50cyc6IGNvbnRlc3RhbnRJZCxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLnNlbGVjdChbJ05hbWUnLCAnUm91bmRzJywgJ0NvbnRlc3RhbnRzJywgJ0NvdW50cnknLCAnRXZlbnRTdGFydERhdGVUaW1lJ10pXG4gICAgICAgICAgICAgICAgLnBvcHVsYXRlKCdSb3VuZHMuQ29udGVzdGFudHMuRGV0YWlsJylcbiAgICAgICAgICAgICAgICAucG9wdWxhdGUoJ0NvdW50cnknKSxcbiAgICAgICAgICAgIENvbnRlc3RhbnRNb2RlbC5maW5kQnlJZChjb250ZXN0YW50SWQpLnNlbGVjdChbJ05hbWUnLCAnQ2l0eVRleHQnLCAnRW50cnlJZCcsICdGb2xsb3dlcnNDb3VudCcsICdTY29yZSddKSxcbiAgICAgICAgXTtcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcbiAgICAgICAgY29uc3QgZXZlbnRzID0gcmVzdWx0c1swXTtcbiAgICAgICAgY29uc3QgY29udGVzdGFudCA9IHJlc3VsdHNbMV07XG4gICAgICAgIGxldCB3cFByb2ZpbGU6IHtcbiAgICAgICAgICAgIGJpbzogc3RyaW5nO1xuICAgICAgICAgICAgaW5zdGFncmFtOiBzdHJpbmc7XG4gICAgICAgICAgICBpbWFnZXM6IHN0cmluZ1tdO1xuICAgICAgICAgICAgd2Vic2l0ZTogc3RyaW5nO1xuICAgICAgICAgICAgYWRtaW5CaW86IHN0cmluZztcbiAgICAgICAgICAgIGFkbWluTm90ZXM6IHN0cmluZztcbiAgICAgICAgfSA9IHtcbiAgICAgICAgICAgIGJpbzogJycsXG4gICAgICAgICAgICBpbnN0YWdyYW06ICcnLFxuICAgICAgICAgICAgaW1hZ2VzOiBbXSxcbiAgICAgICAgICAgIHdlYnNpdGU6ICcnLFxuICAgICAgICAgICAgYWRtaW5CaW86ICcnLFxuICAgICAgICAgICAgYWRtaW5Ob3RlczogJydcbiAgICAgICAgfTtcbiAgICAgICAgbGV0IHdvb1Byb2R1Y3RzOiBXb29Qcm9kdWN0W10gPSBbXTtcbiAgICAgICAgaWYgKGNvbnRlc3RhbnQuRW50cnlJZCkge1xuICAgICAgICAgICAgd3BQcm9maWxlID0gYXdhaXQgQXJ0aXN0U2VydmljZS5fZmV0Y2hCaW9Gcm9tV3AoY29udGVzdGFudC5FbnRyeUlkKTtcbiAgICAgICAgICAgIHdvb1Byb2R1Y3RzID0gYXdhaXQgdGhpcy5mZXRjaFdvb0NvbW1lcmNlUHJvZHVjdHMoY29udGVzdGFudC5FbnRyeUlkKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWNvbnRlc3RhbnQpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgSW52YWxpZCBjb250ZXN0YW50IElkIHBhc3NlZCAke2NvbnRlc3RhbnRJZH1gO1xuICAgICAgICAgICAgbG9nZ2VyLmVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgdGhyb3cge1xuICAgICAgICAgICAgICAgIFN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHN0YXR1czogNDA0LFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2VcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhcnRpc3RFdmVudHMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBldmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50RG9jID0gZXZlbnRzW2ldO1xuICAgICAgICAgICAgY29uc3QgdG90YWxSb3VuZHMgPSBldmVudERvYy5Sb3VuZHMubGVuZ3RoO1xuICAgICAgICAgICAgY29uc3Qgcm91bmRXaXNlSW1hZ2VzID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRvdGFsUm91bmRzOyBqKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhcnRpc3RzSW5Sb3VuZCA9IGV2ZW50RG9jLlJvdW5kc1tqXS5Db250ZXN0YW50cztcbiAgICAgICAgICAgICAgICBjb25zdCBhcnRpc3RzSW1hZ2VzID0gYXJ0aXN0V2lzZUltYWdlcyhhcnRpc3RzSW5Sb3VuZCwgbnVsbCwgY29udGVzdGFudElkKTtcbiAgICAgICAgICAgICAgICBjb25zdCByZXNwb25zZTogUm91bmRBcnRpc3RzSW50ZXJmYWNlID0ge1xuICAgICAgICAgICAgICAgICAgICBFdmVudElkOiBldmVudERvYy5pZCxcbiAgICAgICAgICAgICAgICAgICAgRUlEOiBldmVudERvYy5FSUQsXG4gICAgICAgICAgICAgICAgICAgIFJvdW5kTnVtYmVyOiBldmVudERvYy5Sb3VuZHNbal0uUm91bmROdW1iZXIsXG4gICAgICAgICAgICAgICAgICAgIEFydGlzdHM6IGFydGlzdHNJbWFnZXMuYXJ0aXN0cyxcbiAgICAgICAgICAgICAgICAgICAgSXNDdXJyZW50Um91bmQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICBIYXNPcGVuUm91bmQ6ICFldmVudERvYy5Sb3VuZHNbal0uSXNGaW5pc2hlZCxcbiAgICAgICAgICAgICAgICAgICAgSGFzSW1hZ2VzOiBhcnRpc3RzSW1hZ2VzLmhhc0ltYWdlcyxcbiAgICAgICAgICAgICAgICAgICAgRW5hYmxlQXVjdGlvbjogZmFsc2VcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHJvdW5kV2lzZUltYWdlcy5wdXNoKHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFydGlzdEV2ZW50cy5wdXNoKHtcbiAgICAgICAgICAgICAgICBFdmVudElkOiBldmVudERvYy5pZCxcbiAgICAgICAgICAgICAgICBFSUQ6IGV2ZW50RG9jLkVJRCxcbiAgICAgICAgICAgICAgICBDb3VudHJ5OiBldmVudERvYy5Db3VudHJ5LFxuICAgICAgICAgICAgICAgIE5hbWU6IGV2ZW50RG9jLk5hbWUsXG4gICAgICAgICAgICAgICAgcm91bmRXaXNlSW1hZ2VzOiByb3VuZFdpc2VJbWFnZXMsXG4gICAgICAgICAgICAgICAgRXZlbnRTdGFydERhdGVUaW1lOiBldmVudERvYy5FdmVudFN0YXJ0RGF0ZVRpbWUgfHwgJzIwMTgtMDEtMDFUMDA6MDA6MDAuMDAwKzAwOjAwJ1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKC9cXGQvLnRlc3QoY29udGVzdGFudC5DaXR5VGV4dCkpIHtcbiAgICAgICAgICAgIGNvbnRlc3RhbnQuQ2l0eVRleHQgPSAnJztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHQ6IEFydGlzdFByb2ZpbGVEVE8gPSB7XG4gICAgICAgICAgICBOYW1lOiBjb250ZXN0YW50Lk5hbWUsXG4gICAgICAgICAgICBQYXJzZWROYW1lOiBBcnRpc3RTZXJ2aWNlLl9wYXJzZU5hbWUoY29udGVzdGFudC5OYW1lKSxcbiAgICAgICAgICAgIENpdHlUZXh0OiBjb250ZXN0YW50LkNpdHlUZXh0LFxuICAgICAgICAgICAgLy8gRW50cnlJZDogY29udGVzdGFudC5FbnRyeUlkLFxuICAgICAgICAgICAgQXJ0aXN0SW5FdmVudHM6IGFydGlzdEV2ZW50cyxcbiAgICAgICAgICAgIElzRm9sbG93aW5nOiBmYWxzZSxcbiAgICAgICAgICAgIEJpbzogJycsXG4gICAgICAgICAgICBJbnN0YWdyYW06ICcnLFxuICAgICAgICAgICAgSW1hZ2VzOiBbXSxcbiAgICAgICAgICAgIFdlYnNpdGU6ICcnLFxuICAgICAgICAgICAgQWRtaW5CaW86ICcnLFxuICAgICAgICAgICAgQWRtaW5Ob3RlczogJycsXG4gICAgICAgICAgICBGb2xsb3dlcnNDb3VudDogY29udGVzdGFudC5Gb2xsb3dlcnNDb3VudCxcbiAgICAgICAgICAgIFNjb3JlOiBjb250ZXN0YW50LlNjb3JlLFxuICAgICAgICAgICAgV29vUHJvZHVjdHM6IHdvb1Byb2R1Y3RzXG4gICAgICAgIH07XG4gICAgICAgIGlmICh3cFByb2ZpbGUpIHtcbiAgICAgICAgICAgIHJlc3VsdC5CaW8gPSB3cFByb2ZpbGUuYmlvIHx8ICcnO1xuICAgICAgICAgICAgcmVzdWx0Lkluc3RhZ3JhbSA9IHdwUHJvZmlsZS5pbnN0YWdyYW0gfHwgJyc7XG4gICAgICAgICAgICByZXN1bHQuSW1hZ2VzID0gQXJyYXkuaXNBcnJheSh3cFByb2ZpbGUuaW1hZ2VzKSAmJiB3cFByb2ZpbGUuaW1hZ2VzIHx8IFtdO1xuICAgICAgICAgICAgcmVzdWx0LldlYnNpdGUgPSB3cFByb2ZpbGUud2Vic2l0ZSB8fCAnJztcbiAgICAgICAgICAgIHJlc3VsdC5BZG1pbkJpbyA9IHdwUHJvZmlsZS5hZG1pbkJpbyB8fCAnJztcbiAgICAgICAgICAgIHJlc3VsdC5BZG1pbk5vdGVzID0gd3BQcm9maWxlLmFkbWluTm90ZXMgfHwgJyc7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgY2FjaGVkQXJ0aXN0UHJvZmlsZShjYWNoZVNldDogYW55LCBjYWNoZUdldDogYW55LCBjb250ZXN0YW50SWQ6IGFueSwgcmVnSWQ6IGFueSwgcGhvbmVOdW1iZXI6IHN0cmluZykge1xuICAgICAgICBjb25zdCBjYWNoZUtleSA9IGBhcnRpc3QtcHJvZmlsZS0ke2NvbnRlc3RhbnRJZH0tMWA7XG4gICAgICAgIGNvbnN0IGFydGlzdFByb2ZpbGVKc29uID0gYXdhaXQgY2FjaGVHZXQoY2FjaGVLZXkpO1xuICAgICAgICBsZXQgYXJ0aXN0UHJvZmlsZTogQXJ0aXN0UHJvZmlsZURUTztcbiAgICAgICAgaWYgKCFhcnRpc3RQcm9maWxlSnNvbikge1xuICAgICAgICAgICAgbG9nZ2VyLmluZm8oYGFydGlzdCBwcm9maWxlIG5vdCBmb3VuZCBpbiBjYWNoZWApO1xuICAgICAgICAgICAgYXJ0aXN0UHJvZmlsZSA9IGF3YWl0IHRoaXMuZ2V0QXJ0aXN0UHJvZmlsZShjb250ZXN0YW50SWQpO1xuICAgICAgICAgICAgYXdhaXQgY2FjaGVTZXQoY2FjaGVLZXksIEpTT04uc3RyaW5naWZ5KGFydGlzdFByb2ZpbGUpLCAnRVgnLCA4NjQwMDApOyAvLyAxMCBkYXlcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBzYXZlZCBhcnRpc3QgcHJvZmlsZSBmcm9tIGNhY2hlYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyhgc2VydmluZyBhcnRpc3QgcHJvZmlsZSBmcm9tIGNhY2hlYCk7XG4gICAgICAgICAgICBhcnRpc3RQcm9maWxlID0gSlNPTi5wYXJzZShhcnRpc3RQcm9maWxlSnNvbik7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnRpc3RQcm9maWxlLkFydGlzdEluRXZlbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAocGhvbmVOdW1iZXIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZWdpc3RyYXRpb25Mb2cgPSBhd2FpdCBSZWdpc3RyYXRpb25Mb2dNb2RlbC5maW5kT25lKHtcbiAgICAgICAgICAgICAgICAgICAgUGhvbmVOdW1iZXI6IHBob25lTnVtYmVyLFxuICAgICAgICAgICAgICAgICAgICBFdmVudElkOiBhcnRpc3RQcm9maWxlLkFydGlzdEluRXZlbnRzW2ldLkV2ZW50SWRcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAocmVnaXN0cmF0aW9uTG9nKSB7XG4gICAgICAgICAgICAgICAgICAgIGFydGlzdFByb2ZpbGUuQXJ0aXN0SW5FdmVudHNbaV0uVXNlclZvdGVIYXNoID0gcmVnaXN0cmF0aW9uTG9nLlZvdGVVcmwgJiYgcmVnaXN0cmF0aW9uTG9nLlZvdGVVcmwucmVwbGFjZSgnL3YvJywgJycpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBhcnRpc3RQcm9maWxlLklzRm9sbG93aW5nID0gYXdhaXQgdGhpcy5pc0ZvbGxvd2luZ0FydGlzdFByb2ZpbGUocmVnSWQsIGNvbnRlc3RhbnRJZCk7XG4gICAgICAgIHJldHVybiBhcnRpc3RQcm9maWxlO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBpc0ZvbGxvd2luZ0FydGlzdFByb2ZpbGUocmVnSWQ6IHN0cmluZywgY29udGVzdGFudElkOiBhbnkpIHtcbiAgICAgICAgY29uc3QgZm9sbG93aW5nUmVzdWx0ID0gYXdhaXQgQ29udGVzdGFudE1vZGVsLmFnZ3JlZ2F0ZSgpLm1hdGNoKHtcbiAgICAgICAgICAgIF9pZDogbW9uZ29vc2UuVHlwZXMuT2JqZWN0SWQoY29udGVzdGFudElkKVxuICAgICAgICB9KS5wcm9qZWN0KHtcbiAgICAgICAgICAgIGluZGV4OiB7ICRpbmRleE9mQXJyYXk6IFsgJyRGb2xsb3dlcnMnLCBtb25nb29zZS5UeXBlcy5PYmplY3RJZChyZWdJZCkgXSB9LFxuICAgICAgICB9KS5leGVjKCk7XG4gICAgICAgIHJldHVybiBmb2xsb3dpbmdSZXN1bHRbMF0gJiYgZm9sbG93aW5nUmVzdWx0WzBdLmluZGV4ID49IDA7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdGF0aWMgYXN5bmMgX2ZldGNoQmlvRnJvbVdwKGVudHJ5SWQ6IG51bWJlcikge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgYXJVcmwgPSBgaHR0cHM6Ly9hcnRiYXR0bGUuY29tL3dwLWpzb24vZ3Jhdml0eXZpZXcvdjEvdmlld3MvMjA3NjEwL2VudHJpZXMvJHtlbnRyeUlkfS5qc29uYDtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBEb3dubG9hZGluZyBBcnRpc3QgcHJvZmlsZSAke2FyVXJsfWApO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZmV0Y2goYXJVcmwsIHtcbiAgICAgICAgICAgICAgICBtZXRob2Q6ICdnZXQnLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICAgaG9zdDogJ2FydGJhdHRsZS5jb20nLFxuICAgICAgICAgICAgICAgICAgICAndXNlci1hZ2VudCc6ICdNb3ppbGxhLzUuMCAoTWFjaW50b3NoOyBJbnRlbCBNYWMgT1MgWCAxMF8xNV8zKSBBcHBsZVdlYktpdC82MDUuMS4xNSAoS0hUTUwsIGxpa2UgR2Vja28pIFZlcnNpb24vMTMuMC41IFNhZmFyaS82MDUuMS4xNScsXG4gICAgICAgICAgICAgICAgICAgICdhY2NlcHQtbGFuZ3VhZ2UnOiAnZW4tdXMnLFxuICAgICAgICAgICAgICAgICAgICBhY2NlcHQ6ICd0ZXh0L2h0bWwsYXBwbGljYXRpb24veGh0bWwreG1sLGFwcGxpY2F0aW9uL3htbDtxPTAuOSwqLyo7cT0wLjgnXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoIXJlc3VsdC5vaykge1xuICAgICAgICAgICAgICAgIGxvZ2dlci5lcnJvcihgdXJsIHJlc3VsdCAke3Jlc3VsdC5zdGF0dXN9ICR7YXdhaXQgcmVzdWx0LnRleHQoKX1gKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc3QgYm9keSA9IEpTT04ucGFyc2UoYXdhaXQgcmVzdWx0LnRleHQoKSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgYmlvOiBib2R5WzZdLFxuICAgICAgICAgICAgICAgICAgICBpbnN0YWdyYW06IGJvZHlbMTddLFxuICAgICAgICAgICAgICAgICAgICBpbWFnZXM6IFtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRPRE8gb3B0aW1pemUgaW1hZ2VzIGluIG91ciBlbmRcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IEFydGlzdFNlcnZpY2UuX2NhY2hlSW1hZ2UoYm9keVsyOF0ucmVwbGFjZSgvXFx8OlxcfC9nLCAnJykpLFxuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgQXJ0aXN0U2VydmljZS5fY2FjaGVJbWFnZShib2R5WzI5XS5yZXBsYWNlKC9cXHw6XFx8L2csICcnKSksXG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBBcnRpc3RTZXJ2aWNlLl9jYWNoZUltYWdlKGJvZHlbMzBdLnJlcGxhY2UoL1xcfDpcXHwvZywgJycpKVxuICAgICAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgICAgICB3ZWJzaXRlOiBib2R5WzcyXSxcbiAgICAgICAgICAgICAgICAgICAgYWRtaW5CaW86IGJvZHlbOTVdLFxuICAgICAgICAgICAgICAgICAgICBhZG1pbk5vdGVzOiBib2R5Wzk2XVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc3RhdGljIGFzeW5jIF9jYWNoZUltYWdlKGV4dGVybmFsVXJsOiBzdHJpbmcpIHtcbiAgICAgICAgaWYgKHBhcnNlSW50KHByb2Nlc3MuZW52LkZJTEVfU0VSVkVSKSAhPT0gMSkge1xuICAgICAgICAgICAgcmV0dXJuIGV4dGVybmFsVXJsO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBhcnNlZFVybCA9IHVybC5wYXJzZShleHRlcm5hbFVybCk7XG4gICAgICAgIGNvbnN0IGJhc2VOYW1lID0gcGF0aC5iYXNlbmFtZShwYXJzZWRVcmwucGF0aCk7XG4gICAgICAgIGNvbnN0IGV4dGVuc2lvbiA9IHBhdGguZXh0bmFtZShiYXNlTmFtZSk7XG4gICAgICAgIGNvbnN0IGRpciA9IHBhdGgucmVzb2x2ZShgJHtfX2Rpcm5hbWV9Ly4uL3B1YmxpYy91cGxvYWRzLyR7cGFyc2VkVXJsLnBhdGgucmVwbGFjZShiYXNlTmFtZSwgJycpfWApO1xuICAgICAgICBjb25zdCBuZXdGaWxlUGF0aCA9IGAke2Rpcn0vY2FjaGVkLSR7YmFzZU5hbWUucmVwbGFjZShleHRlbnNpb24sICcuanBnJyl9YDtcbiAgICAgICAgbGV0IGZpbGVFeGlzdHMgPSBmYWxzZTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGF3YWl0IGZzLnN0YXQobmV3RmlsZVBhdGgpO1xuICAgICAgICAgICAgZmlsZUV4aXN0cyA9IHRydWU7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHt9XG4gICAgICAgIGNvbnN0IGNhY2hlZFVybCA9IGAke3Byb2Nlc3MuZW52Lk1FRElBX1NJVEVfVVJMfSR7bmV3RmlsZVBhdGgucmVwbGFjZShwYXRoLnJlc29sdmUoYCR7X19kaXJuYW1lfS8uLi9wdWJsaWMvYCksICcnKX1gO1xuICAgICAgICBpZiAoZmlsZUV4aXN0cykge1xuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFVybDtcbiAgICAgICAgfVxuICAgICAgICBsb2dnZXIuaW5mbyhgZG93bmxvYWRpbmcgZXh0ZXJuYWwgaW1hZ2UgJHtleHRlcm5hbFVybH1gKTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZmV0Y2goZXh0ZXJuYWxVcmwsIHtcbiAgICAgICAgICAgIG1ldGhvZDogJ2dldCcsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICAgaG9zdDogJ2FydGJhdHRsZS5jb20nLFxuICAgICAgICAgICAgICAgICd1c2VyLWFnZW50JzogJ01vemlsbGEvNS4wIChNYWNpbnRvc2g7IEludGVsIE1hYyBPUyBYIDEwXzE1XzMpIEFwcGxlV2ViS2l0LzYwNS4xLjE1IChLSFRNTCwgbGlrZSBHZWNrbykgVmVyc2lvbi8xMy4wLjUgU2FmYXJpLzYwNS4xLjE1JyxcbiAgICAgICAgICAgICAgICAnYWNjZXB0LWxhbmd1YWdlJzogJ2VuLXVzJyxcbiAgICAgICAgICAgICAgICBhY2NlcHQ6ICd0ZXh0L2h0bWwsYXBwbGljYXRpb24veGh0bWwreG1sLGFwcGxpY2F0aW9uL3htbDtxPTAuOSwqLyo7cT0wLjgnXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIXJlc3VsdC5vaykge1xuICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGBpbWFnZSBjYWNoZSBmYWlsZWQgJHtyZXN1bHQuc3RhdHVzfSAke2F3YWl0IHJlc3VsdC50ZXh0KCl9YCk7XG4gICAgICAgICAgICByZXR1cm4gZXh0ZXJuYWxVcmw7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgaW1nQnVmZmVyID0gYXdhaXQgcmVzdWx0LmJ1ZmZlcigpO1xuICAgICAgICBhd2FpdCBmcy5ta2RpcnAoZGlyKTtcbiAgICAgICAgY29uc3QgcmVzaXplUmVzdWx0ID0gYXdhaXQgc2hhcnAoaW1nQnVmZmVyKS5yb3RhdGUoKS5yZXNpemUoMTIwMCkuanBlZyh7XG4gICAgICAgICAgICBxdWFsaXR5OiA3NSxcbiAgICAgICAgICAgIGNocm9tYVN1YnNhbXBsaW5nOiAnNDo0OjQnLFxuICAgICAgICAgICAgLy8gdHJlbGxpc1F1YW50aXNhdGlvbjogdHJ1ZSxcbiAgICAgICAgfSkudG9GaWxlKG5ld0ZpbGVQYXRoKTtcbiAgICAgICAgbG9nZ2VyLmluZm8oYGNhY2hlZCBBQiBpbWFnZSBvZiBBcnRpc3QgJHtKU09OLnN0cmluZ2lmeShyZXNpemVSZXN1bHQsIG51bGwsIDEpfSAke2NhY2hlZFVybH1gKTtcbiAgICAgICAgcmV0dXJuIGNhY2hlZFVybDtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN0YXRpYyBfcGFyc2VOYW1lKG5hbWU6IHN0cmluZykge1xuICAgICAgICBjb25zdCBuYW1lcyA9IG5hbWUudHJpbSgpLnNwbGl0KCcgJyk7XG4gICAgICAgIGxldCBmaXJzdE5hbWUgPSAnJztcbiAgICAgICAgbGV0IGxhc3ROYW1lID0gJyc7XG4gICAgICAgIC8vIHRvIGhpZ2hsaWdodCBmaXJzdCBuYW1lXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmFtZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpICE9PSAobmFtZXMubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgICAgICAgICBpZiAoaSA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgZmlyc3ROYW1lICs9ICcgJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKG5hbWVzW2ldLnRyaW0oKSAhPT0gJycpIHtcbiAgICAgICAgICAgICAgICAgICAgZmlyc3ROYW1lICs9IG5hbWVzW2ldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGFzdE5hbWUgPSAnICcgKyBuYW1lc1tpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZmlyc3ROYW1lOiBmaXJzdE5hbWUsXG4gICAgICAgICAgICBsYXN0TmFtZTogbGFzdE5hbWVcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGZldGNoV29vQ29tbWVyY2VQcm9kdWN0cyhlbnRyeUlkOiBudW1iZXIpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHRlcm1JZCA9IGF3YWl0IHRoaXMuZ2V0QXR0cmlidXRlVGVybUlkQnlFbnRyeUlkKGVudHJ5SWQpO1xuICAgICAgICAgICAgaWYgKCF0ZXJtSWQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fZ2V0UHJvZHVjdHNCeVRlcm1JZCh0ZXJtSWQpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBpZiAoZSAmJiBlLmRhdGEpIHtcbiAgICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoZSAmJiBlLmRhdGEpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsb2dnZXIuZXJyb3IoZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIF9nZXRQcm9kdWN0c0J5VGVybUlkKHRlcm1JZDogc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9tYWtlR2V0UHJvZHVjdHNBcGlDYWxsKHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZV90ZXJtOiB0ZXJtSWQsXG4gICAgICAgICAgICBhdHRyaWJ1dGU6ICdwYV9haSdcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBfZ2V0V29vUHJvZHVjdEJ5SWQocHJvZHVjdElkOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLl93b29Db21tZXJjZUFwaS5nZXQoYHByb2R1Y3RzLyR7cHJvZHVjdElkfWApO1xuICAgICAgICBpZiAocmVzcG9uc2UgJiYgcmVzcG9uc2Uuc3RhdHVzID09PSAyMDAgJiYgcmVzcG9uc2UuZGF0YSkge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmRhdGE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoYHVuYWJsZSB0byBmaW5kIHByb2R1Y3QgYnkgJHtwcm9kdWN0SWR9ICR7cmVzcG9uc2Uuc3RhdHVzfSAke3Jlc3BvbnNlLmRhdGF9YCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIF9tYWtlR2V0UHJvZHVjdHNBcGlDYWxsKHBhcmFtczogYW55KSB7XG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5fd29vQ29tbWVyY2VBcGkuZ2V0KGBwcm9kdWN0c2AsIHBhcmFtcyk7XG4gICAgICAgIGlmIChyZXNwb25zZSAmJiByZXNwb25zZS5zdGF0dXMgPT09IDIwMCAmJiBBcnJheS5pc0FycmF5KHJlc3BvbnNlLmRhdGEpKSB7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbygnd29vIGNvbW1lcmNlIHByb2R1Y3QgY2FsbCcgKyBKU09OLnN0cmluZ2lmeShyZXNwb25zZS5kYXRhLCBudWxsLCAxKSk7XG4gICAgICAgICAgICBjb25zdCB3b29Qcm9kdWN0cyA9IHJlc3BvbnNlLmRhdGE7XG4gICAgICAgICAgICBjb25zdCBhcnRpc3RQcm9kdWN0cyA9IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB3b29Qcm9kdWN0cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGFydGlzdFByb2R1Y3RzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogd29vUHJvZHVjdHNbaV0uZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgICAgIHBlcm1hbGluazogd29vUHJvZHVjdHNbaV0ucGVybWFsaW5rLFxuICAgICAgICAgICAgICAgICAgICBuYW1lOiB3b29Qcm9kdWN0c1tpXS5uYW1lLFxuICAgICAgICAgICAgICAgICAgICBwdXJjaGFzYWJsZTogd29vUHJvZHVjdHNbaV0ucHVyY2hhc2FibGUsXG4gICAgICAgICAgICAgICAgICAgIGltYWdlczogd29vUHJvZHVjdHNbaV0uaW1hZ2VzLFxuICAgICAgICAgICAgICAgICAgICBwcmljZTogYCQke3dvb1Byb2R1Y3RzW2ldLnByaWNlfWBcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBhcnRpc3RQcm9kdWN0cztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZ2dlci5lcnJvcihgdW5hYmxlIHRvIGZpbmQgcHJvZHVjdCBmb3IgdGhlIGdpdmVuICR7cGFyYW1zfSwgcmVzcG9uc2UgJHtyZXNwb25zZS5zdGF0dXN9ICR7cmVzcG9uc2UuZGF0YX1gKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIEZvbGxvdyhjb250ZXN0YW50SWQ6IHN0cmluZywgdXNlcklkOiBhbnksIElzRm9sbG93aW5nOiBib29sZWFuKSB7XG4gICAgICAgIGlmICghdXNlcklkKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gYHVzZXIgSWQgaXMgcmVxdWlyZWRgO1xuICAgICAgICAgICAgbG9nZ2VyLmVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgdGhyb3coe1xuICAgICAgICAgICAgICAgIFN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHN0YXR1czogNDAzLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmICghY29udGVzdGFudElkKSB7XG4gICAgICAgICAgICBjb25zdCBtZXNzYWdlID0gYGNvbnRlc3RhbnQgSWQgaXMgcmVxdWlyZWRgO1xuICAgICAgICAgICAgbG9nZ2VyLmVycm9yKG1lc3NhZ2UpO1xuICAgICAgICAgICAgdGhyb3coe1xuICAgICAgICAgICAgICAgIFN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHN0YXR1czogNDAzLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG1lc3NhZ2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNvbnRlc3RhbnQgPSBhd2FpdCBDb250ZXN0YW50TW9kZWwuZmluZEJ5SWQoY29udGVzdGFudElkKTtcbiAgICAgICAgaWYgKCFjb250ZXN0YW50SWQpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgSW52YWxpZCBjb250ZXN0YW50IElkLmA7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICB0aHJvdyh7XG4gICAgICAgICAgICAgICAgU3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgc3RhdHVzOiA0MDQsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCEoSXNGb2xsb3dpbmcgPT09IHRydWUgfHwgSXNGb2xsb3dpbmcgPT09IGZhbHNlKSkge1xuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGBJcyBGb2xsb3dpbmcgbXVzdCBiZSBib29sZWFuLmA7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IobWVzc2FnZSk7XG4gICAgICAgICAgICB0aHJvdyh7XG4gICAgICAgICAgICAgICAgU3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgc3RhdHVzOiA0MDQsXG4gICAgICAgICAgICAgICAgbWVzc2FnZTogbWVzc2FnZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY29udGVzdGFudEluZGV4ID0gY29udGVzdGFudC5Gb2xsb3dlcnMuaW5kZXhPZih1c2VySWQudG9TdHJpbmcoKSk7XG4gICAgICAgIGlmIChJc0ZvbGxvd2luZyAmJiAtMSA9PT0gY29udGVzdGFudEluZGV4KSB7XG4gICAgICAgICAgICBjb250ZXN0YW50LkZvbGxvd2Vycy5wdXNoKHVzZXJJZCk7XG4gICAgICAgIH0gZWxzZSBpZiAoIUlzRm9sbG93aW5nICYmIGNvbnRlc3RhbnRJbmRleCA+IC0xKSB7XG4gICAgICAgICAgICBjb250ZXN0YW50LkZvbGxvd2Vycy5zcGxpY2UoY29udGVzdGFudEluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgICBjb250ZXN0YW50LkZvbGxvd2Vyc0NvdW50ID0gY29udGVzdGFudC5Gb2xsb3dlcnNDb3VudCArIDE7XG4gICAgICAgIGNvbnRlc3RhbnQuU2NvcmUgPSBjb250ZXN0YW50LlZvdGVzQ291bnQgKyBjb250ZXN0YW50LkZvbGxvd2Vyc0NvdW50O1xuICAgICAgICBhd2FpdCBjb250ZXN0YW50LnNhdmUoKTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgTGlzdChoYXNoOiBzdHJpbmcsIGNhY2hlU2V0OiBhbnksIGNhY2hlR2V0OiBhbnkpIHtcbiAgICAgICAgY29uc3QgcHJvY2Vzc2VkQ29udGVzdGFudElkczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgY29uc3QgY29udGVzdGFudExpc3Q6IEFydGlzdExpc3REVE9bXSA9IFtdO1xuICAgICAgICBjb25zdCBjYWNoZUtleSA9ICdhcnRpc3QtbGlzdCc7XG4gICAgICAgIGNvbnN0IGNhY2hlZExpc3QgPSBhd2FpdCBjYWNoZUdldChjYWNoZUtleSk7XG4gICAgICAgIGxldCBjb250ZXN0YW50SW5SZWNlbnRFdmVudHM7XG4gICAgICAgIGlmIChjYWNoZWRMaXN0KSB7XG4gICAgICAgICAgICBjb250ZXN0YW50SW5SZWNlbnRFdmVudHMgPSBKU09OLnBhcnNlKGNhY2hlZExpc3QpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29udGVzdGFudEluUmVjZW50RXZlbnRzID0gYXdhaXQgQXJ0aXN0U2VydmljZS5fZ2V0QXJ0aXN0SW5SZWNlbnRFdmVudHMoKTtcbiAgICAgICAgICAgIGF3YWl0IGNhY2hlU2V0KGNhY2hlS2V5LCBKU09OLnN0cmluZ2lmeShjb250ZXN0YW50SW5SZWNlbnRFdmVudHMpLCAnRVgnLCA5MDApO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29udGVzdGFudEluUmVjZW50RXZlbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBjb250ZXN0YW50ID0gY29udGVzdGFudEluUmVjZW50RXZlbnRzW2ldO1xuICAgICAgICAgICAgaWYgKGNvbnRlc3RhbnQuY29udGVzdGFudERldGFpbFswXSkge1xuICAgICAgICAgICAgICAgIGxldCBhcnRJbmRleCA9IHByb2Nlc3NlZENvbnRlc3RhbnRJZHMuaW5kZXhPZihjb250ZXN0YW50LmNvbnRlc3RhbnREZXRhaWxbMF0uX2lkLnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgICAgIGlmIChhcnRJbmRleCA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXJyTGVuID0gcHJvY2Vzc2VkQ29udGVzdGFudElkcy5wdXNoKGNvbnRlc3RhbnQuY29udGVzdGFudERldGFpbFswXS5faWQudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgICAgIGFydEluZGV4ID0gYXJyTGVuIC0gMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKCFjb250ZXN0YW50TGlzdFthcnRJbmRleF0pIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGVzdGFudExpc3RbYXJ0SW5kZXhdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgX2lkOiBjb250ZXN0YW50LmNvbnRlc3RhbnREZXRhaWxbMF0uX2lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgTGluazogYC9hci8ke2NvbnRlc3RhbnQuY29udGVzdGFudERldGFpbFswXS5faWR9LyR7aGFzaCB8fCAnJ31gLFxuICAgICAgICAgICAgICAgICAgICAgICAgTmFtZTogY29udGVzdGFudC5jb250ZXN0YW50RGV0YWlsWzBdLk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICBJbWFnZXM6IGNvbnRlc3RhbnQuUm91bmRzLkNvbnRlc3RhbnRzLkltYWdlc1xuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRlc3RhbnRMaXN0W2FydEluZGV4XS5JbWFnZXMgPSBjb250ZXN0YW50TGlzdFthcnRJbmRleF0uSW1hZ2VzLmNvbmNhdChjb250ZXN0YW50LlJvdW5kcy5Db250ZXN0YW50cy5JbWFnZXMpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29udGVzdGFudExpc3Q7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdGF0aWMgYXN5bmMgX2dldEFydGlzdEluUmVjZW50RXZlbnRzKCkge1xuICAgICAgICByZXR1cm4gRXZlbnRNb2RlbC5hZ2dyZWdhdGUoKVxuICAgICAgICAgICAgLnNvcnQoe1xuICAgICAgICAgICAgICAgIF9pZDogLTFcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAubGltaXQoMylcbiAgICAgICAgICAgIC51bndpbmQoe1xuICAgICAgICAgICAgICAgIHBhdGg6ICckUm91bmRzJyxcbiAgICAgICAgICAgICAgICAvLyBpbmNsdWRlQXJyYXlJbmRleDogJ3JvdW5kSW5kZXgnLFxuICAgICAgICAgICAgICAgIHByZXNlcnZlTnVsbEFuZEVtcHR5QXJyYXlzOiBmYWxzZVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC51bndpbmQoe1xuICAgICAgICAgICAgICAgIHBhdGg6ICckUm91bmRzLkNvbnRlc3RhbnRzJyxcbiAgICAgICAgICAgICAgICAvLyBpbmNsdWRlQXJyYXlJbmRleDogJ2NvbnRlc3RhbnRJbmRleCcsXG4gICAgICAgICAgICAgICAgcHJlc2VydmVOdWxsQW5kRW1wdHlBcnJheXM6IGZhbHNlXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLm1hdGNoKHtcbiAgICAgICAgICAgICAgICAnUm91bmRzLkNvbnRlc3RhbnRzLkVuYWJsZWQnOiB0cnVlXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmxvb2t1cCh7XG4gICAgICAgICAgICAgICAgZnJvbTogJ2NvbnRlc3RhbnRzJyxcbiAgICAgICAgICAgICAgICBsb2NhbEZpZWxkOiAnUm91bmRzLkNvbnRlc3RhbnRzLkRldGFpbCcsXG4gICAgICAgICAgICAgICAgZm9yZWlnbkZpZWxkOiAnX2lkJyxcbiAgICAgICAgICAgICAgICBhczogJ2NvbnRlc3RhbnREZXRhaWwnXG4gICAgICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0QXJ0aXN0UGFnZURhdGEodXNlcklkOiBhbnksIGhhc2g6IHN0cmluZywgY2FjaGVTZXQ6IGFueSwgY2FjaGVHZXQ6IGFueSkge1xuICAgICAgICBjb25zdCBwcm9taXNlczogYW55ID0gW1xuICAgICAgICAgICAgdGhpcy5fdG9wQXJ0aXN0c0J5Rm9sbG93ZXJzQW5kVm90ZXMoaGFzaCwgY2FjaGVTZXQsIGNhY2hlR2V0KSxcbiAgICAgICAgXTtcbiAgICAgICAgaWYgKHVzZXJJZCkge1xuICAgICAgICAgICAgcHJvbWlzZXMucHVzaCh0aGlzLl95b3VyQXJ0aXN0cyh1c2VySWQsIGhhc2gpKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHRzOiBhbnlbXSA9IGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcbiAgICAgICAgcmVzdWx0c1swXSA9IHRoaXMuX3JhbmRvbVNvcnQocmVzdWx0c1swXSk7XG4gICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBfeW91ckFydGlzdHModXNlcklkOiBhbnksIGhhc2g6IHN0cmluZykge1xuICAgICAgICBjb25zdCBwcm9taXNlcyA9IFtcbiAgICAgICAgICAgIHRoaXMuX3VzZXJzRm9sbG93aW5ncyh1c2VySWQsIGhhc2gpLFxuICAgICAgICAgICAgdGhpcy5fdXNlcnNWb3Rlcyh1c2VySWQsIGhhc2gpXG4gICAgICAgIF07XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG4gICAgICAgIGNvbnN0IGNvbnRlc3RhbnRMaXN0MTogQXJ0aXN0TGlzdFYyW10gPSByZXN1bHRzWzBdO1xuICAgICAgICBjb25zdCBjb250ZXN0YW50TGlzdDI6IEFydGlzdExpc3RWMltdID0gcmVzdWx0c1sxXTtcbiAgICAgICAgY29uc3QgcHJvY2Vzc2VkQ29udGVzdGFudHMgPSBbXTtcbiAgICAgICAgY29uc3QgdW5pcXVlQ29udGVzdGFudExpc3Q6IEFydGlzdExpc3RWMltdID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29udGVzdGFudExpc3QxLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAocHJvY2Vzc2VkQ29udGVzdGFudHMuaW5kZXhPZihjb250ZXN0YW50TGlzdDFbaV0uX2lkLnRvU3RyaW5nKCkpID09PSAtMSApIHtcbiAgICAgICAgICAgICAgICBwcm9jZXNzZWRDb250ZXN0YW50cy5wdXNoKGNvbnRlc3RhbnRMaXN0MVtpXS5faWQudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgdW5pcXVlQ29udGVzdGFudExpc3QucHVzaChjb250ZXN0YW50TGlzdDFbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29udGVzdGFudExpc3QyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAocHJvY2Vzc2VkQ29udGVzdGFudHMuaW5kZXhPZihjb250ZXN0YW50TGlzdDJbaV0uX2lkLnRvU3RyaW5nKCkpID09PSAtMSApIHtcbiAgICAgICAgICAgICAgICBwcm9jZXNzZWRDb250ZXN0YW50cy5wdXNoKGNvbnRlc3RhbnRMaXN0MltpXS5faWQudG9TdHJpbmcoKSk7XG4gICAgICAgICAgICAgICAgdW5pcXVlQ29udGVzdGFudExpc3QucHVzaChjb250ZXN0YW50TGlzdDJbaV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB1bmlxdWVDb250ZXN0YW50TGlzdDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIF90b3BBcnRpc3RzQnlGb2xsb3dlcnNBbmRWb3RlcyhoYXNoOiBzdHJpbmcsIGNhY2hlU2V0OiBhbnksIGNhY2hlR2V0OiBhbnkpIHtcbiAgICAgICAgY29uc3QgY2FjaGVLZXkgPSAnX3RvcEFydGlzdHNCeUZvbGxvd2Vyc0FuZFZvdGVzMSc7XG4gICAgICAgIGNvbnN0IGNhY2hlZExpc3QgPSBhd2FpdCBjYWNoZUdldChjYWNoZUtleSk7XG4gICAgICAgIGlmIChjYWNoZWRMaXN0KSB7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyhgc2VydmluZyB0b3AgYXJ0aXN0IGJ5IGNhY2hlYCk7XG4gICAgICAgICAgICByZXR1cm4gSlNPTi5wYXJzZShjYWNoZWRMaXN0KTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjb250ZXN0YW50czogQ29udGVzdGFudERUT1tdID0gYXdhaXQgQ29udGVzdGFudE1vZGVsLmZpbmQoKVxuICAgICAgICAgICAgLnNvcnQoe1xuICAgICAgICAgICAgICAgIFNjb3JlOiAtMVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5saW1pdCgyMDApO1xuICAgICAgICBjb25zdCBjb250ZXN0YW50TGlzdDogQXJ0aXN0TGlzdFYyW10gPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb250ZXN0YW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29udGVzdGFudExpc3QucHVzaCh7XG4gICAgICAgICAgICAgICAgX2lkOiBjb250ZXN0YW50c1tpXS5faWQsXG4gICAgICAgICAgICAgICAgTmFtZTogY29udGVzdGFudHNbaV0uTmFtZSxcbiAgICAgICAgICAgICAgICBGb2xsb3dlcnNDb3VudDogY29udGVzdGFudHNbaV0uRm9sbG93ZXJzQ291bnQsXG4gICAgICAgICAgICAgICAgTGluazogYC9hci8ke2NvbnRlc3RhbnRzW2ldLl9pZH0vJHtoYXNoIHx8ICcnfWAsXG4gICAgICAgICAgICAgICAgSW1hZ2VzOiBbXSxcbiAgICAgICAgICAgICAgICBWb3Rlc0NvdW50OiBjb250ZXN0YW50c1tpXS5Wb3Rlc0NvdW50LFxuICAgICAgICAgICAgICAgIFNjb3JlOiBjb250ZXN0YW50c1tpXS5TY29yZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgY2FjaGVTZXQoY2FjaGVLZXksIEpTT04uc3RyaW5naWZ5KGNvbnRlc3RhbnRMaXN0KSwgJ0VYJywgMjQgKiA2MCAqIDYwKTtcbiAgICAgICAgLy8gc29ydCByYW5kb21cbiAgICAgICAgcmV0dXJuIGNvbnRlc3RhbnRMaXN0O1xuICAgIH1cblxuICAgIHByaXZhdGUgX3JhbmRvbVNvcnQoY29udGVzdGFudExpc3Q6IEFydGlzdExpc3RWMltdKSB7XG4gICAgICAgIHJldHVybiBjb250ZXN0YW50TGlzdC5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgICAgICByZXR1cm4gMC41IC0gTWF0aC5yYW5kb20oKTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBfdXNlcnNGb2xsb3dpbmdzKHVzZXJJZDogc3RyaW5nLCBoYXNoOiBzdHJpbmcpOiBQcm9taXNlPEFydGlzdExpc3RWMltdPiB7XG4gICAgICAgIGNvbnN0IGNvbnRlc3RhbnRzID0gYXdhaXQgQ29udGVzdGFudE1vZGVsLmZpbmQoe0ZvbGxvd2VyczogdXNlcklkfSkuc2VsZWN0KFsnX2lkJywgJ05hbWUnXSk7XG4gICAgICAgIGNvbnN0IGNvbnRlc3RhbnRMaXN0OiBBcnRpc3RMaXN0VjJbXSA9IFtdO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbnRlc3RhbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBjb250ZXN0YW50TGlzdC5wdXNoKHtcbiAgICAgICAgICAgICAgICBfaWQ6IGNvbnRlc3RhbnRzW2ldLl9pZCxcbiAgICAgICAgICAgICAgICBOYW1lOiBjb250ZXN0YW50c1tpXS5OYW1lLFxuICAgICAgICAgICAgICAgIEZvbGxvd2Vyc0NvdW50OiBjb250ZXN0YW50c1tpXS5Gb2xsb3dlcnNDb3VudCxcbiAgICAgICAgICAgICAgICBMaW5rOiBgL2FyLyR7Y29udGVzdGFudHNbaV0uX2lkfS8ke2hhc2ggfHwgJyd9YCxcbiAgICAgICAgICAgICAgICBJbWFnZXM6IFtdLFxuICAgICAgICAgICAgICAgIFZvdGVzQ291bnQ6IGNvbnRlc3RhbnRzW2ldLlZvdGVzQ291bnQsXG4gICAgICAgICAgICAgICAgU2NvcmU6IGNvbnRlc3RhbnRzW2ldLlNjb3JlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29udGVzdGFudExpc3Q7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBfdXNlcnNWb3Rlcyh1c2VySWQ6IHN0cmluZywgaGFzaDogc3RyaW5nKTogUHJvbWlzZTxBcnRpc3RMaXN0VjJbXT4ge1xuICAgICAgICBjb25zdCBjb250ZXN0YW50TGlzdDogQXJ0aXN0TGlzdFYyW10gPSBbXTtcbiAgICAgICAgY29uc3QgYWdnQ29udGVzdGFudHM6IHtcbiAgICAgICAgICAgIF9pZDogYW55O1xuICAgICAgICAgICAgQ29udGVzdGFudERhdGE6IENvbnRlc3RhbnREVE87XG4gICAgICAgICAgICBOYW1lOiBzdHJpbmc7XG4gICAgICAgIH1bXSA9IGF3YWl0IFZvdGluZ0xvZ01vZGVsLmFnZ3JlZ2F0ZSgpXG4gICAgICAgICAgICAubWF0Y2goe1xuICAgICAgICAgICAgICAgIFJlZ2lzdHJhdGlvbjogdXNlcklkXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmxvb2t1cCh7XG4gICAgICAgICAgICAgICAgZnJvbTogJ2NvbnRlc3RhbnRzJyxcbiAgICAgICAgICAgICAgICBsb2NhbEZpZWxkOiAnQ29udGVzdGFudCcsXG4gICAgICAgICAgICAgICAgZm9yZWlnbkZpZWxkOiAnX2lkJyxcbiAgICAgICAgICAgICAgICBhczogJ0NvbnRlc3RhbnREYXRhJ1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC51bndpbmQoe1xuICAgICAgICAgICAgICAgIHBhdGg6ICckQ29udGVzdGFudERhdGEnXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhZ2dDb250ZXN0YW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY29udGVzdGFudCA9IGFnZ0NvbnRlc3RhbnRzW2ldLkNvbnRlc3RhbnREYXRhO1xuICAgICAgICAgICAgaWYgKGNvbnRlc3RhbnQgJiYgY29udGVzdGFudC5faWQpIHtcbiAgICAgICAgICAgICAgICBjb250ZXN0YW50TGlzdC5wdXNoKHtcbiAgICAgICAgICAgICAgICAgICAgX2lkOiAgY29udGVzdGFudC5faWQsXG4gICAgICAgICAgICAgICAgICAgIE5hbWU6IGNvbnRlc3RhbnQuTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgRm9sbG93ZXJzQ291bnQ6IGNvbnRlc3RhbnQuRm9sbG93ZXJzQ291bnQsXG4gICAgICAgICAgICAgICAgICAgIExpbms6IGAvYXIvJHtjb250ZXN0YW50Ll9pZH0vJHtoYXNoIHx8ICcnfWAsXG4gICAgICAgICAgICAgICAgICAgIEltYWdlczogW10sXG4gICAgICAgICAgICAgICAgICAgIFZvdGVzQ291bnQ6IGNvbnRlc3RhbnQuVm90ZXNDb3VudCxcbiAgICAgICAgICAgICAgICAgICAgU2NvcmU6IGNvbnRlc3RhbnQuU2NvcmVcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGBhcnRpc3Qgbm90IHJlY29yZGVkIHByb3Blcmx5ICR7SlNPTi5zdHJpbmdpZnkoYWdnQ29udGVzdGFudHNbaV0sIG51bGwsIDEpfWApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb250ZXN0YW50TGlzdDtcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgc2VhcmNoQXJ0aXN0cyhzZWFyY2hUZXJtOiBzdHJpbmcsIGxpbWl0OiBudW1iZXIsIHBhZ2U6IG51bWJlciwgY2FjaGVTZXQ6IGFueSwgY2FjaGVHZXQ6IGFueSkge1xuICAgICAgICBpZiAoc2VhcmNoVGVybS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGNvbnN0IHRvcEFydGlzdHMgPSBhd2FpdCB0aGlzLl90b3BBcnRpc3RzQnlGb2xsb3dlcnNBbmRWb3Rlc0ZvckFkbWluKGNhY2hlU2V0LCBjYWNoZUdldCk7XG4gICAgICAgICAgICBjb25zdCByZXNwOiBEYXRhT3BlcmF0aW9uUmVzdWx0PHtcbiAgICAgICAgICAgICAgICBDb250ZXN0YW50czogQ29udGVzdGFudERUT1tdO1xuICAgICAgICAgICAgICAgIENvdW50OiBudW1iZXI7XG4gICAgICAgICAgICB9PiA9IHtcbiAgICAgICAgICAgICAgICBTdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgIERhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgQ29udGVzdGFudHM6IHRvcEFydGlzdHMsXG4gICAgICAgICAgICAgICAgICAgIENvdW50OiB0b3BBcnRpc3RzLmxlbmd0aFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICByZXR1cm4gcmVzcDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBvcjogYW55W10gPSBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgJHRleHQ6IHtcbiAgICAgICAgICAgICAgICAgICAgJHNlYXJjaDogc2VhcmNoVGVybSxcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIEVtYWlsOiBzZWFyY2hUZXJtXG4gICAgICAgICAgICB9XG4gICAgICAgIF07XG4gICAgICAgIGNvbnN0IGVudHJ5SWQgPSBwYXJzZUludChzZWFyY2hUZXJtKTtcbiAgICAgICAgaWYgKCFpc05hTihlbnRyeUlkKSkge1xuICAgICAgICAgICAgb3IucHVzaCh7XG4gICAgICAgICAgICAgICAgRW50cnlJZDogZW50cnlJZFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHF1ZXJ5OiB7XG4gICAgICAgICAgICBJc0R1cGxpY2F0ZT86IHtcbiAgICAgICAgICAgICAgICAkaW46IGFueVtdO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIEVudHJ5SWQ/OiB7JGV4aXN0czogYm9vbGVhbn07XG4gICAgICAgICAgICAkb3I/OiBhbnlbXTtcbiAgICAgICAgfSA9IHt9O1xuICAgICAgICBpZiAoc2VhcmNoVGVybS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBxdWVyeSA9IHtcbiAgICAgICAgICAgICAgICAkb3I6IG9yXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHF1ZXJ5LklzRHVwbGljYXRlID0geyRpbjogW251bGwsIGZhbHNlXX07XG4gICAgICAgIHF1ZXJ5LkVudHJ5SWQgPSB7JGV4aXN0czogdHJ1ZX07XG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChbQ29udGVzdGFudE1vZGVsLlxuICAgICAgICBmaW5kKHF1ZXJ5LCB7IHNjb3JlOiB7ICRtZXRhOiAndGV4dFNjb3JlJyB9IH0pXG4gICAgICAgICAgICAubGltaXQobGltaXQpXG4gICAgICAgICAgICAuc2tpcCgocGFnZSAtIDEpICogMTApXG4gICAgICAgICAgICAuc29ydCh7IHNjb3JlOiB7ICRtZXRhOiAndGV4dFNjb3JlJyB9IH0pXG4gICAgICAgICAgICAucG9wdWxhdGUoJ1JlZ2lzdHJhdGlvbicpXG4gICAgICAgICAgICAsXG4gICAgICAgICAgICBDb250ZXN0YW50TW9kZWwuY291bnREb2N1bWVudHMocXVlcnkpXG4gICAgICAgIF0pO1xuICAgICAgICBjb25zdCBjb250ZXN0YW50cyA9IHJlc3VsdHNbMF07XG4gICAgICAgIGNvbnN0IGNvdW50ID0gcmVzdWx0c1sxXTtcbiAgICAgICAgY29uc3QgcmVzcDogRGF0YU9wZXJhdGlvblJlc3VsdDx7XG4gICAgICAgICAgICBDb250ZXN0YW50czogQ29udGVzdGFudERUT1tdO1xuICAgICAgICAgICAgQ291bnQ6IG51bWJlcjtcbiAgICAgICAgfT4gPSB7XG4gICAgICAgICAgICBTdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgRGF0YToge1xuICAgICAgICAgICAgICAgIENvbnRlc3RhbnRzOiBjb250ZXN0YW50cyxcbiAgICAgICAgICAgICAgICBDb3VudDogY291bnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHJlc3A7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBfdG9wQXJ0aXN0c0J5Rm9sbG93ZXJzQW5kVm90ZXNGb3JBZG1pbihjYWNoZVNldDogYW55LCBjYWNoZUdldDogYW55KSB7XG4gICAgICAgIGNvbnN0IGNhY2hlS2V5ID0gJ190b3BBcnRpc3RzQnlGb2xsb3dlcnNBbmRWb3Rlc0ZvckFkbWluMSc7XG4gICAgICAgIGNvbnN0IGNhY2hlZExpc3QgPSBhd2FpdCBjYWNoZUdldChjYWNoZUtleSk7XG4gICAgICAgIGlmIChjYWNoZWRMaXN0KSB7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyhgc2VydmluZyB0b3AgYXJ0aXN0IGZvciBhZG1pbiBieSBjYWNoZWApO1xuICAgICAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoY2FjaGVkTGlzdCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY29udGVzdGFudHM6IENvbnRlc3RhbnREVE9bXSA9IGF3YWl0IENvbnRlc3RhbnRNb2RlbC5maW5kKClcbiAgICAgICAgICAgIC5wb3B1bGF0ZSgnUmVnaXN0cmF0aW9uJylcbiAgICAgICAgICAgIC5zb3J0KHtcbiAgICAgICAgICAgICAgICBTY29yZTogLTFcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAubGltaXQoMjAwKTtcbiAgICAgICAgYXdhaXQgY2FjaGVTZXQoY2FjaGVLZXksIEpTT04uc3RyaW5naWZ5KGNvbnRlc3RhbnRzKSwgJ0VYJywgNjAgKiA2MCk7XG4gICAgICAgIC8vIHNvcnQgcmFuZG9tXG4gICAgICAgIHJldHVybiBjb250ZXN0YW50cztcbiAgICB9XG5cbiAgICBwdWJsaWMgYXN5bmMgZ2V0QXR0cmlidXRlVGVybUlkQnlFbnRyeUlkKGVudHJ5SWQ6IG51bWJlcikge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLl93b29Db21tZXJjZUFwaS5nZXQoYHByb2R1Y3RzL2F0dHJpYnV0ZXMvMS90ZXJtc2AsIHtcbiAgICAgICAgICAgIHBlcl9wYWdlOiAxLFxuICAgICAgICAgICAgc2x1ZzogZW50cnlJZFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc29sZS5sb2coJ3Rlcm1zJywgcmVzdWx0LmRhdGEsIGBwcm9kdWN0cy9hdHRyaWJ1dGVzLzEvdGVybXM/c2x1Zz0ke2VudHJ5SWR9YCk7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KHJlc3VsdC5kYXRhKSAmJiByZXN1bHQuZGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICByZXR1cm4gcGFyc2VJbnQocmVzdWx0LmRhdGFbMF0ubmFtZSkgPT09IGVudHJ5SWQgPyByZXN1bHQuZGF0YVswXS5pZCA6IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBnZXRQcm9kdWN0cyhzZWFyY2hUZXJtOiBzdHJpbmcsIGxpbWl0OiBudW1iZXIsIHBhZ2U6IG51bWJlcikge1xuICAgICAgICBsZXQgcXVlcnkgPSB7fTtcbiAgICAgICAgaWYgKHNlYXJjaFRlcm0gJiYgc2VhcmNoVGVybS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBxdWVyeSA9IHtcbiAgICAgICAgICAgICAgICBQcm9kdWN0SWQ6IHNlYXJjaFRlcm1cbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgbG9nZ2VyLmluZm8oYGxpbWl0ICR7bGltaXR9YCk7XG4gICAgICAgIGxvZ2dlci5pbmZvKGAkeyhwYWdlIC0gMSkgKiBsaW1pdH1gKTtcbiAgICAgICAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKFtBcnRpc3RXb29Db21tZXJjZU1vZGVsLmZpbmQocXVlcnkpXG4gICAgICAgICAgICAubGltaXQobGltaXQpXG4gICAgICAgICAgICAucG9wdWxhdGUoJ0NvbnRlc3RhbnQnKVxuICAgICAgICAgICAgLnNraXAoKHBhZ2UgLSAxKSAqIGxpbWl0KVxuICAgICAgICAgICAgLFxuICAgICAgICAgICAgQXJ0aXN0V29vQ29tbWVyY2VNb2RlbC5jb3VudERvY3VtZW50cyhxdWVyeSlcbiAgICAgICAgXSk7XG4gICAgICAgIGNvbnN0IHByb2R1Y3RzID0gcmVzdWx0c1swXTtcbiAgICAgICAgY29uc3QgY291bnQgPSByZXN1bHRzWzFdO1xuICAgICAgICBjb25zdCByZXNwOiBEYXRhT3BlcmF0aW9uUmVzdWx0PHtcbiAgICAgICAgICAgIFByb2R1Y3RzOiBBcnRpc3RXb29Db21tZXJjZURUT1tdO1xuICAgICAgICAgICAgQ291bnQ6IG51bWJlcjtcbiAgICAgICAgfT4gPSB7XG4gICAgICAgICAgICBTdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgRGF0YToge1xuICAgICAgICAgICAgICAgIFByb2R1Y3RzOiBwcm9kdWN0cyxcbiAgICAgICAgICAgICAgICBDb3VudDogY291bnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHJlc3A7XG4gICAgfVxuXG4gICAgcHVibGljIGFzeW5jIHVwZGF0ZVByb2R1Y3QocGF5bG9hZDoge1xuICAgICAgICBQcm9kdWN0SWQ6IHN0cmluZztcbiAgICAgICAgQ29uZmlybWF0aW9uOiBzdHJpbmc7XG4gICAgICAgIENvbnRlc3RhbnRJZDogYW55O1xuICAgIH0sIHByb2R1Y3Q6IEFydGlzdFdvb0NvbW1lcmNlRG9jdW1lbnQsIGNhY2hlU2V0OiBhbnksIGNhY2hlR2V0OiBhbnkpIHtcbiAgICAgICAgbG9nZ2VyLmluZm8oJ3VwZGF0aW5nIHByb2R1Y3QgJyArIEpTT04uc3RyaW5naWZ5KHBheWxvYWQsIG51bGwsIDEpKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NhdmVQcm9kdWN0KHBheWxvYWQsIHByb2R1Y3QsIGNhY2hlU2V0LCBjYWNoZUdldCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBfc2F2ZVByb2R1Y3QocGF5bG9hZDoge1xuICAgICAgICBQcm9kdWN0SWQ6IHN0cmluZztcbiAgICAgICAgQ29uZmlybWF0aW9uOiBzdHJpbmc7XG4gICAgICAgIENvbnRlc3RhbnRJZDogYW55O1xuICAgIH0sIHByb2R1Y3Q6IEFydGlzdFdvb0NvbW1lcmNlRG9jdW1lbnQsIGNhY2hlU2V0OiBhbnksIGNhY2hlR2V0OiBhbnkpIHtcbiAgICAgICAgY29uc3QgY2FjaGVLZXkgPSBgYXJ0aXN0LXByb2R1Y3RzLSR7cGF5bG9hZC5Db250ZXN0YW50SWR9YDtcbiAgICAgICAgY29uc3QgY29udGVzdGFudCA9IGF3YWl0IHRoaXMuX2ZpbmRDb250ZXN0YW50T3JUaHJvdyhwYXlsb2FkLkNvbnRlc3RhbnRJZCk7XG4gICAgICAgIGNvbnN0IGFydGlzdFByb2R1Y3RKc29uID0gYXdhaXQgY2FjaGVHZXQoY2FjaGVLZXkpO1xuICAgICAgICBsZXQgYXJ0aXN0UHJvZHVjdDogQXJ0aXN0UHJvZHVjdENhY2hlRFRPO1xuICAgICAgICBpZiAoIWFydGlzdFByb2R1Y3RKc29uKSB7XG4gICAgICAgICAgICBhcnRpc3RQcm9kdWN0ID0gdGhpcy5fZ2V0UHJvZHVjdENhY2hlT2JqKGNvbnRlc3RhbnQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXJ0aXN0UHJvZHVjdCA9IEpTT04ucGFyc2UoYXJ0aXN0UHJvZHVjdEpzb24pO1xuICAgICAgICB9XG4gICAgICAgIHByb2R1Y3QuUHJvZHVjdElkID0gcGF5bG9hZC5Qcm9kdWN0SWQ7XG4gICAgICAgIHByb2R1Y3QuQ29uZmlybWF0aW9uID0gcGF5bG9hZC5Db25maXJtYXRpb247XG4gICAgICAgIHByb2R1Y3QuQ29udGVzdGFudCA9IGNvbnRlc3RhbnQuX2lkO1xuICAgICAgICAvLyBUT0RPIGNhbGwgV1MsIHNhdmUgb3V0cHV0IGluIG1vbmdvICYgY2FsY3VsYXRlIGNhY2hlXG4gICAgICAgIGxldCB3b29Qcm9kdWN0O1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgd29vUHJvZHVjdCA9IGF3YWl0IHRoaXMuX2dldFdvb1Byb2R1Y3RCeUlkKHByb2R1Y3QuUHJvZHVjdElkKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgbG9nZ2VyLmVycm9yKGB1bmFibGUgdG8gZmluZCBwcm9kdWN0IGJ5ICR7cHJvZHVjdC5Qcm9kdWN0SWR9YCk7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoZSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHdvb1Byb2R1Y3QpIHtcbiAgICAgICAgICAgIGxvZ2dlci5pbmZvKGBzYXZpbmcgd29vIHByb2R1Y3QgaW5mb2AgKyBKU09OLnN0cmluZ2lmeSh3b29Qcm9kdWN0LCBudWxsLCAxKSk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhKU09OLnN0cmluZ2lmeSh3b29Qcm9kdWN0LCBudWxsLCAxKSk7XG4gICAgICAgICAgICBwcm9kdWN0LkRlc2NyaXB0aW9uID0gd29vUHJvZHVjdC5kZXNjcmlwdGlvbjtcbiAgICAgICAgICAgIHByb2R1Y3QuUGVybWFsaW5rID0gd29vUHJvZHVjdC5wZXJtYWxpbms7XG4gICAgICAgICAgICBwcm9kdWN0Lk5hbWUgPSB3b29Qcm9kdWN0Lm5hbWU7XG4gICAgICAgICAgICBwcm9kdWN0LlB1cmNoYXNhYmxlID0gd29vUHJvZHVjdC5wdXJjaGFzYWJsZSA9PT0gdHJ1ZTtcbiAgICAgICAgICAgIHByb2R1Y3QuSW1hZ2VzID0gd29vUHJvZHVjdC5pbWFnZXM7XG4gICAgICAgICAgICBwcm9kdWN0LlByaWNlID0gYCQke3dvb1Byb2R1Y3QucHJpY2V9YDtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzYXZlZFByb2R1Y3QgPSBhd2FpdCBwcm9kdWN0LnNhdmUoKTtcbiAgICAgICAgYXJ0aXN0UHJvZHVjdC5Qcm9kdWN0c1tzYXZlZFByb2R1Y3QuX2lkXSA9IHByb2R1Y3Q7IC8vIHB1c2hpbmcgaW50byBjYWNoZVxuICAgICAgICBpZiAoY29udGVzdGFudC5Xb29Qcm9kdWN0cy5pbmRleE9mKHNhdmVkUHJvZHVjdC5faWQpID09PSAtMSkge1xuICAgICAgICAgICAgY29udGVzdGFudC5Xb29Qcm9kdWN0cy5wdXNoKHNhdmVkUHJvZHVjdCk7XG4gICAgICAgICAgICBhd2FpdCBjb250ZXN0YW50LnNhdmUoKTtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBjYWNoZVNldChjYWNoZUtleSwgSlNPTi5zdHJpbmdpZnkoYXJ0aXN0UHJvZHVjdCkpO1xuICAgICAgICBjb25zdCByZXNwOiBEYXRhT3BlcmF0aW9uUmVzdWx0PHtcbiAgICAgICAgICAgIFByb2R1Y3Q6IEFydGlzdFdvb0NvbW1lcmNlRFRPO1xuICAgICAgICB9PiA9IHtcbiAgICAgICAgICAgIFN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICBEYXRhOiB7XG4gICAgICAgICAgICAgICAgUHJvZHVjdDogc2F2ZWRQcm9kdWN0LFxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHJldHVybiByZXNwO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgX2ZpbmRDb250ZXN0YW50T3JUaHJvdyhjb250ZXN0YW50SWQ6IGFueSkge1xuICAgICAgICBjb25zdCBjb250ZXN0YW50ID0gYXdhaXQgQ29udGVzdGFudE1vZGVsLmZpbmRCeUlkKGNvbnRlc3RhbnRJZCk7XG4gICAgICAgIGlmICghY29udGVzdGFudCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb250ZXN0YW50IG5vdCBmb3VuZCcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb250ZXN0YW50O1xuICAgIH1cbiAgICBwdWJsaWMgYXN5bmMgYWRkUHJvZHVjdChwYXlsb2FkOiB7XG4gICAgICAgIFByb2R1Y3RJZDogc3RyaW5nO1xuICAgICAgICBDb25maXJtYXRpb246IHN0cmluZztcbiAgICAgICAgQ29udGVzdGFudElkOiBhbnk7XG4gICAgfSwgY2FjaGVTZXQ6IGFueSwgY2FjaGVHZXQ6IGFueSkge1xuICAgICAgICBsb2dnZXIuaW5mbygnYWRkaW5nIHByb2R1Y3QgJyArIEpTT04uc3RyaW5naWZ5KHBheWxvYWQsIG51bGwsIDEpKTtcbiAgICAgICAgY29uc3QgcHJvZHVjdCA9IG5ldyBBcnRpc3RXb29Db21tZXJjZU1vZGVsKCk7XG4gICAgICAgIHJldHVybiB0aGlzLl9zYXZlUHJvZHVjdChwYXlsb2FkLCBwcm9kdWN0LCBjYWNoZVNldCwgY2FjaGVHZXQpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyByZW1vdmVQcm9kdWN0KHByb2R1Y3RJZDogYW55LCBjYWNoZVNldDogYW55LCBjYWNoZUdldDogYW55KSB7XG4gICAgICAgIGNvbnN0IHByb2R1Y3QgPSBhd2FpdCBBcnRpc3RXb29Db21tZXJjZU1vZGVsLmZpbmRCeUlkKHtfaWQ6IHByb2R1Y3RJZH0pLnBvcHVsYXRlKCdDb250ZXN0YW50Jyk7XG4gICAgICAgIGlmICghcHJvZHVjdCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHByb2R1Y3QgaWQnKTtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBBcnRpc3RXb29Db21tZXJjZU1vZGVsLmRlbGV0ZU9uZSh7X2lkOiBwcm9kdWN0SWR9KTtcbiAgICAgICAgY29uc3QgY2FjaGVLZXkgPSBgYXJ0aXN0LXByb2R1Y3RzLSR7cHJvZHVjdC5Db250ZXN0YW50Ll9pZH1gO1xuICAgICAgICBjb25zdCBhcnRpc3RQcm9kdWN0SnNvbiA9IGF3YWl0IGNhY2hlR2V0KGNhY2hlS2V5KTtcbiAgICAgICAgbGV0IGFydGlzdFByb2R1Y3Q6IEFydGlzdFByb2R1Y3RDYWNoZURUTztcbiAgICAgICAgaWYgKCFhcnRpc3RQcm9kdWN0SnNvbikge1xuICAgICAgICAgICAgYXJ0aXN0UHJvZHVjdCA9IHRoaXMuX2dldFByb2R1Y3RDYWNoZU9iaihwcm9kdWN0LkNvbnRlc3RhbnQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXJ0aXN0UHJvZHVjdCA9IEpTT04ucGFyc2UoYXJ0aXN0UHJvZHVjdEpzb24pO1xuICAgICAgICAgICAgZGVsZXRlIGFydGlzdFByb2R1Y3QuUHJvZHVjdHNbcHJvZHVjdElkXTtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBjYWNoZVNldChjYWNoZUtleSwgSlNPTi5zdHJpbmdpZnkoYXJ0aXN0UHJvZHVjdCkpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyB1cGRhdGVQcm9kdWN0Q2FjaGUocHJvZHVjdElkOiBzdHJpbmcsIGNhY2hlU2V0OiBhbnksIGNhY2hlR2V0OiBhbnkpIHtcbiAgICAgICAgbGV0IGFydGlzdFByb2R1Y3Q6IEFydGlzdFByb2R1Y3RDYWNoZURUTztcbiAgICAgICAgY29uc3QgcHJvZHVjdCA9IGF3YWl0IEFydGlzdFdvb0NvbW1lcmNlTW9kZWwuZmluZEJ5SWQoe19pZDogcHJvZHVjdElkfSkucG9wdWxhdGUoJ0NvbnRlc3RhbnQnKTtcbiAgICAgICAgaWYgKHByb2R1Y3QpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlc3RhbnQgPSBwcm9kdWN0LkNvbnRlc3RhbnQ7XG4gICAgICAgICAgICBjb25zdCBjYWNoZUtleSA9IGBhcnRpc3QtcHJvZHVjdHMtJHtjb250ZXN0YW50Ll9pZH1gO1xuICAgICAgICAgICAgY29uc3QgYXJ0aXN0UHJvZHVjdEpzb24gPSBhd2FpdCBjYWNoZUdldChjYWNoZUtleSk7XG4gICAgICAgICAgICBpZiAoIWFydGlzdFByb2R1Y3RKc29uKSB7XG4gICAgICAgICAgICAgICAgYXJ0aXN0UHJvZHVjdCA9IHRoaXMuX2dldFByb2R1Y3RDYWNoZU9iaihjb250ZXN0YW50KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYXJ0aXN0UHJvZHVjdCA9IEpTT04ucGFyc2UoYXJ0aXN0UHJvZHVjdEpzb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYXJ0aXN0UHJvZHVjdC5Qcm9kdWN0c1twcm9kdWN0Ll9pZF0gPSBwcm9kdWN0OyAvLyBwdXNoaW5nIGludG8gY2FjaGVcbiAgICAgICAgICAgIGF3YWl0IGNhY2hlU2V0KGNhY2hlS2V5LCBKU09OLnN0cmluZ2lmeShhcnRpc3RQcm9kdWN0KSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfZ2V0UHJvZHVjdENhY2hlT2JqKGNvbnRlc3RhbnQ6IENvbnRlc3RhbnREVE8pOiBBcnRpc3RQcm9kdWN0Q2FjaGVEVE8ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgX2lkOiBjb250ZXN0YW50Ll9pZCxcbiAgICAgICAgICAgIE5hbWU6IGNvbnRlc3RhbnQuTmFtZSxcbiAgICAgICAgICAgIFByb2R1Y3RzOiB7fVxuICAgICAgICB9O1xuICAgIH1cbn1cbiJdfQ==
