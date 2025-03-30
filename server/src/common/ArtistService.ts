import logger from '../config/logger';
import ContestantModel, { ContestantDocument } from '../models/Contestant';
import RegistrationModel, { RegistrationDocument } from '../models/Registration';
import { RegisterVoterV2 } from './RegisterVoterV2';
import { CityDTO } from '../../../shared/CityDTO';

import CityModel from '../models/City';
import EventModel from '../models/Event';
import artistWiseImages from './ArtistWiseImages';
import { RoundArtistsInterface } from '../../../shared/ArtistImageDTO';
// @ts-ignore
import { ArtistProfileDTO, WooProduct } from '../../../shared/ArtistProfileDTO';
import * as mongoose from 'mongoose';
import { ArtistListDTO, ArtistListV2 } from '../../../shared/ArtistListDTO';
import RegistrationLogModel from '../models/RegistrationLog';
import VotingLogModel from '../models/VotingLog';
import ContestantDTO from '../../../shared/ContestantDTO';
import { DataOperationResult } from '../../../shared/OperationResult';
import * as url from 'url';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as sharp from 'sharp';
import ArtistWooCommerceModel, { ArtistWooCommerceDocument } from '../models/ArtistWooCommerce';
import { ArtistProductCacheDTO, ArtistWooCommerceDTO } from '../../../shared/ArtistWooCommerceDTO';
const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
const fetch = require('node-fetch');
interface ContestantPayload {
    Name: string;
    EntryId: number;
    Website: string;
    City: CityDTO;
    PhoneNumber: string;
    Email: string;
}

export class ArtistService {
    private _wooCommerceApi = new WooCommerceRestApi({
        url: 'https://artbattle.com',
        consumerKey: 'ck_529bf7ac7628d895d342e9fb4c7ab4138c6c957b',
        consumerSecret: 'cs_6b46cce2efd6fddeb8a38b587536feb90cb751a5',
        version: 'wc/v3'
    });

    public async Update(contestantId: any, obj: ContestantPayload, userAgent: string) {
        if (!contestantId) {
            const message = `contestant Id is required`;
            logger.error(message);
            throw {
                Success: false,
                status: 403,
                message: message
            };
        }
        const Contestant = await ContestantModel.findById(contestantId);
        if (!Contestant) {
            const message = `Invalid contestant Id passed ${contestantId}`;
            logger.error(message);
            throw {
                Success: false,
                status: 404,
                message: message
            };
        }
        return this.Save(Contestant, obj, userAgent);
    }

    public async Add(obj: ContestantPayload, userAgent: string) {
        return this.Save(new ContestantModel(), obj, userAgent, true);
    }

    public async Save(Contestant: ContestantDocument, obj: ContestantPayload, userAgent: string, IsAdd?: boolean) {
        const {Name, Email, EntryId, Website, City, PhoneNumber} = obj;
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

    public async TagIfDuplicate(EntryId: number, Email: string, PhoneNumber: string, Contestant: ContestantDocument, IsAdd?: boolean) {
        if (EntryId && EntryId > 0) {
            // Entry id should be unique
            const query = {
                EntryId: EntryId
            };
            const matchedContestant = await ArtistService.findDuplicate(query, Contestant);
            if (matchedContestant && !IsAdd) {
                Contestant = await this._saveMatchedContestant(matchedContestant, Contestant);
            } else if (matchedContestant && IsAdd) {
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
            } else if (matchedContestant && IsAdd) {
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
            } else if (matchedContestant && IsAdd) {
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

    private static async findDuplicate(query: { EntryId?: number; IsDuplicate?: { $in: any[]}; _id?: any; Email?: string; PhoneNumber?: string; }, Contestant: ContestantDocument) {
        query.IsDuplicate = {$in: [null, false]};
        query._id = {};
        if (Contestant._id) {
            query._id = {$ne: Contestant._id};
        }
        return ContestantModel.findOne(query);
    }

    private async _saveMatchedContestant(matchedContestant: ContestantDocument, Contestant: ContestantDocument) {
        Contestant.IsDuplicate = true;
        matchedContestant.ChildContestants = matchedContestant.ChildContestants || [];
        if (matchedContestant.ChildContestants.indexOf(Contestant._id) === -1) {
            matchedContestant.ChildContestants.push(Contestant._id);
        }
        await matchedContestant.save();
        await this.ReplaceContestantInEvents(matchedContestant._id, Contestant._id);
        return Contestant;
    }

    public async MapContestantRegistration(obj: {
        Contestant: ContestantDocument;
        userAgent: string;
    }) {
        let {Contestant} = obj;
        const {userAgent} = obj;
        if (!Contestant.PhoneNumber || Contestant.IsDuplicate) {
            await Contestant.save();
            return {registration: false, Contestant};
        }
        let registration = await RegistrationModel.findOne({PhoneNumber: Contestant.PhoneNumber})
            .populate('Artist');
        if (registration && registration.Artist
            && registration.Artist._id.toString() !== Contestant._id.toString()
        ) {
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
            const registrationModel = await new RegisterVoterV2(Contestant.PhoneNumber, userAgent, null,
                null, null, false).Register();
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
        return {Contestant, registration};
    }

    public async AddContestantProfileIfDoesNotExist(registration: RegistrationDocument, Contestant: ContestantDocument) {
        if (!Contestant.Email) {
            Contestant.Email = registration.Email;
        }
        if (!Contestant.EntryId && registration.ArtistProfile && registration.ArtistProfile.EntryId) {
            Contestant.EntryId = parseInt(registration.ArtistProfile && registration.ArtistProfile.EntryId);
        }
        if (!Contestant.City && registration.ArtistProfile && registration.ArtistProfile.City) {
            Contestant.CityText = registration.ArtistProfile && registration.ArtistProfile.City;
            Contestant.City = await CityModel.findOne({'Name': Contestant.Name});
        }
        if (!Contestant.Website && registration.ArtistProfile && registration.ArtistProfile.Website) {
            Contestant.Website = registration.ArtistProfile && registration.ArtistProfile.Website;
        }
        if (!Contestant.Name && registration.ArtistProfile && registration.ArtistProfile.Name) {
            Contestant.Name = registration.ArtistProfile && registration.ArtistProfile.Name;
        }
        return Contestant;
    }

    public AddRegProfileIfDoesNotExist(registration: RegistrationDocument) {
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

    public async ReplaceContestantInEvents(replacement: any, search: any) {
        await Promise.all([
            EventModel.updateMany({}, {
                    $set: {
                        'Rounds.$[].Contestants.$[contestant].Detail': replacement
                    }
                },
                {
                    arrayFilters: [
                        {
                            'contestant.Detail': search
                        }
                    ]
                }),
            EventModel.updateMany({}, {
                    $set: {
                        'Contestants.$[contestant]': replacement
                    }
                },
                {
                    arrayFilters: [
                        {
                            'contestant': search
                        }
                    ]
                })
        ]);
    }

    public async getArtistProfile(contestantId: any) {
        const promises: any[] = [
            EventModel.find({
                'Contestants': contestantId,
            })
                .select(['Name', 'Rounds', 'Contestants', 'Country', 'EventStartDateTime'])
                .populate('Rounds.Contestants.Detail')
                .populate('Country'),
            ContestantModel.findById(contestantId).select(['Name', 'CityText', 'EntryId', 'FollowersCount', 'Score']),
        ];
        const results = await Promise.all(promises);
        const events = results[0];
        const contestant = results[1];
        let wpProfile: {
            bio: string;
            instagram: string;
            images: string[];
            website: string;
            adminBio: string;
            adminNotes: string;
        } = {
            bio: '',
            instagram: '',
            images: [],
            website: '',
            adminBio: '',
            adminNotes: ''
        };
        let wooProducts: WooProduct[] = [];
        if (contestant.EntryId) {
            wpProfile = await ArtistService._fetchBioFromWp(contestant.EntryId);
            wooProducts = await this.fetchWooCommerceProducts(contestant.EntryId);
        }
        if (!contestant) {
            const message = `Invalid contestant Id passed ${contestantId}`;
            logger.error(message);
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
                const artistsImages = artistWiseImages(artistsInRound, null, contestantId);
                const response: RoundArtistsInterface = {
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
        const result: ArtistProfileDTO = {
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

    public async cachedArtistProfile(cacheSet: any, cacheGet: any, contestantId: any, regId: any, phoneNumber: string) {
        const cacheKey = `artist-profile-${contestantId}-1`;
        const artistProfileJson = await cacheGet(cacheKey);
        let artistProfile: ArtistProfileDTO;
        if (!artistProfileJson) {
            logger.info(`artist profile not found in cache`);
            artistProfile = await this.getArtistProfile(contestantId);
            await cacheSet(cacheKey, JSON.stringify(artistProfile), 'EX', 864000); // 10 day
            logger.info(`saved artist profile from cache`);
        } else {
            logger.info(`serving artist profile from cache`);
            artistProfile = JSON.parse(artistProfileJson);
        }
        for (let i = 0; i < artistProfile.ArtistInEvents.length; i++) {
            if (phoneNumber) {
                const registrationLog = await RegistrationLogModel.findOne({
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

    public async isFollowingArtistProfile(regId: string, contestantId: any) {
        const followingResult = await ContestantModel.aggregate().match({
            _id: mongoose.Types.ObjectId(contestantId)
        }).project({
            index: { $indexOfArray: [ '$Followers', mongoose.Types.ObjectId(regId) ] },
        }).exec();
        return followingResult[0] && followingResult[0].index >= 0;
    }

    private static async _fetchBioFromWp(entryId: number) {
        try {
            const arUrl = `https://artbattle.com/wp-json/gravityview/v1/views/207610/entries/${entryId}.json`;
            logger.info(`Downloading Artist profile ${arUrl}`);
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
                logger.error(`url result ${result.status} ${await result.text()}`);
            } else {
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
        } catch (e) {
            logger.error(e);
        }
    }

    private static async _cacheImage(externalUrl: string) {
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
        } catch (e) {}
        const cachedUrl = `${process.env.MEDIA_SITE_URL}${newFilePath.replace(path.resolve(`${__dirname}/../public/`), '')}`;
        if (fileExists) {
            return cachedUrl;
        }
        logger.info(`downloading external image ${externalUrl}`);
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
            logger.error(`image cache failed ${result.status} ${await result.text()}`);
            return externalUrl;
        }
        const imgBuffer = await result.buffer();
        await fs.mkdirp(dir);
        const resizeResult = await sharp(imgBuffer).rotate().resize(1200).jpeg({
            quality: 75,
            chromaSubsampling: '4:4:4',
            // trellisQuantisation: true,
        }).toFile(newFilePath);
        logger.info(`cached AB image of Artist ${JSON.stringify(resizeResult, null, 1)} ${cachedUrl}`);
        return cachedUrl;
    }

    private static _parseName(name: string) {
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
            } else {
                lastName = ' ' + names[i];
            }
        }
        return {
            firstName: firstName,
            lastName: lastName
        };
    }

    private async fetchWooCommerceProducts(entryId: number) {
        try {
            const termId = await this.getAttributeTermIdByEntryId(entryId);
            if (!termId) {
                return [];
            }
            return this._getProductsByTermId(termId);
        } catch (e) {
            if (e && e.data) {
                logger.error(e && e.data);
            } else {
                logger.error(e);
            }
        }
    }

    private async _getProductsByTermId(termId: string) {
        return this._makeGetProductsApiCall({
            attribute_term: termId,
            attribute: 'pa_ai'
        });
    }

    private async _getWooProductById(productId: string) {
        const response = await this._wooCommerceApi.get(`products/${productId}`);
        if (response && response.status === 200 && response.data) {
            return response.data;
        } else {
            logger.error(`unable to find product by ${productId} ${response.status} ${response.data}`);
        }
    }

    private async _makeGetProductsApiCall(params: any) {
        const response = await this._wooCommerceApi.get(`products`, params);
        if (response && response.status === 200 && Array.isArray(response.data)) {
            logger.info('woo commerce product call' + JSON.stringify(response.data, null, 1));
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
        } else {
            logger.error(`unable to find product for the given ${params}, response ${response.status} ${response.data}`);
        }
        return [];
    }

    public async Follow(contestantId: string, userId: any, IsFollowing: boolean) {
        if (!userId) {
            const message = `user Id is required`;
            logger.error(message);
            throw({
                Success: false,
                status: 403,
                message: message
            });
        }
        if (!contestantId) {
            const message = `contestant Id is required`;
            logger.error(message);
            throw({
                Success: false,
                status: 403,
                message: message
            });
        }
        const contestant = await ContestantModel.findById(contestantId);
        if (!contestantId) {
            const message = `Invalid contestant Id.`;
            logger.error(message);
            throw({
                Success: false,
                status: 404,
                message: message
            });
        }
        if (!(IsFollowing === true || IsFollowing === false)) {
            const message = `Is Following must be boolean.`;
            logger.error(message);
            throw({
                Success: false,
                status: 404,
                message: message
            });
        }
        const contestantIndex = contestant.Followers.indexOf(userId.toString());
        if (IsFollowing && -1 === contestantIndex) {
            contestant.Followers.push(userId);
        } else if (!IsFollowing && contestantIndex > -1) {
            contestant.Followers.splice(contestantIndex, 1);
        }
        contestant.FollowersCount = contestant.FollowersCount + 1;
        contestant.Score = contestant.VotesCount + contestant.FollowersCount;
        await contestant.save();
    }

    public async List(hash: string, cacheSet: any, cacheGet: any) {
        const processedContestantIds: string[] = [];
        const contestantList: ArtistListDTO[] = [];
        const cacheKey = 'artist-list';
        const cachedList = await cacheGet(cacheKey);
        let contestantInRecentEvents;
        if (cachedList) {
            contestantInRecentEvents = JSON.parse(cachedList);
        } else {
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
                } else {
                    contestantList[artIndex].Images = contestantList[artIndex].Images.concat(contestant.Rounds.Contestants.Images);
                }
            }
        }
        return contestantList;
    }

    private static async _getArtistInRecentEvents() {
        return EventModel.aggregate()
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

    public async getArtistPageData(userId: any, hash: string, cacheSet: any, cacheGet: any) {
        const promises: any = [
            this._topArtistsByFollowersAndVotes(hash, cacheSet, cacheGet),
        ];
        if (userId) {
            promises.push(this._yourArtists(userId, hash));
        }
        const results: any[] = await Promise.all(promises);
        results[0] = this._randomSort(results[0]);
        return results;
    }

    public async _yourArtists(userId: any, hash: string) {
        const promises = [
            this._usersFollowings(userId, hash),
            this._usersVotes(userId, hash)
        ];
        const results = await Promise.all(promises);
        const contestantList1: ArtistListV2[] = results[0];
        const contestantList2: ArtistListV2[] = results[1];
        const processedContestants = [];
        const uniqueContestantList: ArtistListV2[] = [];
        for (let i = 0; i < contestantList1.length; i++) {
            if (processedContestants.indexOf(contestantList1[i]._id.toString()) === -1 ) {
                processedContestants.push(contestantList1[i]._id.toString());
                uniqueContestantList.push(contestantList1[i]);
            }
        }
        for (let i = 0; i < contestantList2.length; i++) {
            if (processedContestants.indexOf(contestantList2[i]._id.toString()) === -1 ) {
                processedContestants.push(contestantList2[i]._id.toString());
                uniqueContestantList.push(contestantList2[i]);
            }
        }
        return uniqueContestantList;
    }

    private async _topArtistsByFollowersAndVotes(hash: string, cacheSet: any, cacheGet: any) {
        const cacheKey = '_topArtistsByFollowersAndVotes1';
        const cachedList = await cacheGet(cacheKey);
        if (cachedList) {
            logger.info(`serving top artist by cache`);
            return JSON.parse(cachedList);
        }
        const contestants: ContestantDTO[] = await ContestantModel.find()
            .sort({
                Score: -1
            })
            .limit(200);
        const contestantList: ArtistListV2[] = [];
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

    private _randomSort(contestantList: ArtistListV2[]) {
        return contestantList.sort((a, b) => {
            return 0.5 - Math.random();
        });
    }

    private async _usersFollowings(userId: string, hash: string): Promise<ArtistListV2[]> {
        const contestants = await ContestantModel.find({Followers: userId}).select(['_id', 'Name']);
        const contestantList: ArtistListV2[] = [];
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

    private async _usersVotes(userId: string, hash: string): Promise<ArtistListV2[]> {
        const contestantList: ArtistListV2[] = [];
        const aggContestants: {
            _id: any;
            ContestantData: ContestantDTO;
            Name: string;
        }[] = await VotingLogModel.aggregate()
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
                    _id:  contestant._id,
                    Name: contestant.Name,
                    FollowersCount: contestant.FollowersCount,
                    Link: `/ar/${contestant._id}/${hash || ''}`,
                    Images: [],
                    VotesCount: contestant.VotesCount,
                    Score: contestant.Score
                });
            } else {
                logger.error(`artist not recorded properly ${JSON.stringify(aggContestants[i], null, 1)}`);
            }
        }
        return contestantList;
    }

    public async searchArtists(searchTerm: string, limit: number, page: number, cacheSet: any, cacheGet: any) {
        if (searchTerm.length === 0) {
            const topArtists = await this._topArtistsByFollowersAndVotesForAdmin(cacheSet, cacheGet);
            const resp: DataOperationResult<{
                Contestants: ContestantDTO[];
                Count: number;
            }> = {
                Success: true,
                Data: {
                    Contestants: topArtists,
                    Count: topArtists.length
                }
            };
            return resp;
        }
        const or: any[] = [
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
        let query: {
            IsDuplicate?: {
                $in: any[];
            };
            EntryId?: {$exists: boolean};
            $or?: any[];
        } = {};
        if (searchTerm.length > 0) {
            query = {
                $or: or
            };
        }
        query.IsDuplicate = {$in: [null, false]};
        query.EntryId = {$exists: true};
        const results = await Promise.all([ContestantModel.
        find(query, { score: { $meta: 'textScore' } })
            .limit(limit)
            .skip((page - 1) * 10)
            .sort({ score: { $meta: 'textScore' } })
            .populate('Registration')
            ,
            ContestantModel.countDocuments(query)
        ]);
        const contestants = results[0];
        const count = results[1];
        const resp: DataOperationResult<{
            Contestants: ContestantDTO[];
            Count: number;
        }> = {
            Success: true,
            Data: {
                Contestants: contestants,
                Count: count
            }
        };
        return resp;
    }

    private async _topArtistsByFollowersAndVotesForAdmin(cacheSet: any, cacheGet: any) {
        const cacheKey = '_topArtistsByFollowersAndVotesForAdmin1';
        const cachedList = await cacheGet(cacheKey);
        if (cachedList) {
            logger.info(`serving top artist for admin by cache`);
            return JSON.parse(cachedList);
        }
        const contestants: ContestantDTO[] = await ContestantModel.find()
            .populate('Registration')
            .sort({
                Score: -1
            })
            .limit(200);
        await cacheSet(cacheKey, JSON.stringify(contestants), 'EX', 60 * 60);
        // sort random
        return contestants;
    }

    public async getAttributeTermIdByEntryId(entryId: number) {
        const result = await this._wooCommerceApi.get(`products/attributes/1/terms`, {
            per_page: 1,
            slug: entryId
        });
        console.log('terms', result.data, `products/attributes/1/terms?slug=${entryId}`);
        if (Array.isArray(result.data) && result.data.length > 0) {
            return parseInt(result.data[0].name) === entryId ? result.data[0].id : undefined;
        }
    }

    public async getProducts(searchTerm: string, limit: number, page: number) {
        let query = {};
        if (searchTerm && searchTerm.length > 0) {
            query = {
                ProductId: searchTerm
            };
        }
        logger.info(`limit ${limit}`);
        logger.info(`${(page - 1) * limit}`);
        const results = await Promise.all([ArtistWooCommerceModel.find(query)
            .limit(limit)
            .populate('Contestant')
            .skip((page - 1) * limit)
            ,
            ArtistWooCommerceModel.countDocuments(query)
        ]);
        const products = results[0];
        const count = results[1];
        const resp: DataOperationResult<{
            Products: ArtistWooCommerceDTO[];
            Count: number;
        }> = {
            Success: true,
            Data: {
                Products: products,
                Count: count
            }
        };
        return resp;
    }

    public async updateProduct(payload: {
        ProductId: string;
        Confirmation: string;
        ContestantId: any;
    }, product: ArtistWooCommerceDocument, cacheSet: any, cacheGet: any) {
        logger.info('updating product ' + JSON.stringify(payload, null, 1));
        return this._saveProduct(payload, product, cacheSet, cacheGet);
    }

    private async _saveProduct(payload: {
        ProductId: string;
        Confirmation: string;
        ContestantId: any;
    }, product: ArtistWooCommerceDocument, cacheSet: any, cacheGet: any) {
        const cacheKey = `artist-products-${payload.ContestantId}`;
        const contestant = await this._findContestantOrThrow(payload.ContestantId);
        const artistProductJson = await cacheGet(cacheKey);
        let artistProduct: ArtistProductCacheDTO;
        if (!artistProductJson) {
            artistProduct = this._getProductCacheObj(contestant);
        } else {
            artistProduct = JSON.parse(artistProductJson);
        }
        product.ProductId = payload.ProductId;
        product.Confirmation = payload.Confirmation;
        product.Contestant = contestant._id;
        // TODO call WS, save output in mongo & calculate cache
        let wooProduct;
        try {
            wooProduct = await this._getWooProductById(product.ProductId);
        } catch (e) {
            logger.error(`unable to find product by ${product.ProductId}`);
            logger.error(e);
        }
        if (wooProduct) {
            logger.info(`saving woo product info` + JSON.stringify(wooProduct, null, 1));
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
        const resp: DataOperationResult<{
            Product: ArtistWooCommerceDTO;
        }> = {
            Success: true,
            Data: {
                Product: savedProduct,
            }
        };

        return resp;
    }

    private async _findContestantOrThrow(contestantId: any) {
        const contestant = await ContestantModel.findById(contestantId);
        if (!contestant) {
            throw new Error('Contestant not found');
        }
        return contestant;
    }
    public async addProduct(payload: {
        ProductId: string;
        Confirmation: string;
        ContestantId: any;
    }, cacheSet: any, cacheGet: any) {
        logger.info('adding product ' + JSON.stringify(payload, null, 1));
        const product = new ArtistWooCommerceModel();
        return this._saveProduct(payload, product, cacheSet, cacheGet);
    }

    public async removeProduct(productId: any, cacheSet: any, cacheGet: any) {
        const product = await ArtistWooCommerceModel.findById({_id: productId}).populate('Contestant');
        if (!product) {
            throw new Error('Invalid product id');
        }
        await ArtistWooCommerceModel.deleteOne({_id: productId});
        const cacheKey = `artist-products-${product.Contestant._id}`;
        const artistProductJson = await cacheGet(cacheKey);
        let artistProduct: ArtistProductCacheDTO;
        if (!artistProductJson) {
            artistProduct = this._getProductCacheObj(product.Contestant);
        } else {
            artistProduct = JSON.parse(artistProductJson);
            delete artistProduct.Products[productId];
        }
        await cacheSet(cacheKey, JSON.stringify(artistProduct));
    }

    public async updateProductCache(productId: string, cacheSet: any, cacheGet: any) {
        let artistProduct: ArtistProductCacheDTO;
        const product = await ArtistWooCommerceModel.findById({_id: productId}).populate('Contestant');
        if (product) {
            const contestant = product.Contestant;
            const cacheKey = `artist-products-${contestant._id}`;
            const artistProductJson = await cacheGet(cacheKey);
            if (!artistProductJson) {
                artistProduct = this._getProductCacheObj(contestant);
            } else {
                artistProduct = JSON.parse(artistProductJson);
            }
            artistProduct.Products[product._id] = product; // pushing into cache
            await cacheSet(cacheKey, JSON.stringify(artistProduct));
        }
    }

    _getProductCacheObj(contestant: ContestantDTO): ArtistProductCacheDTO {
        return {
            _id: contestant._id,
            Name: contestant.Name,
            Products: {}
        };
    }
}
