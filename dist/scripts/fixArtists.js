"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bootstrap_1 = require("./bootstrap");
const ArtistApps_1 = require("../models/ArtistApps");
const google_libphonenumber_1 = require("google-libphonenumber");
const Registration_1 = require("../models/Registration");
const Contestant_1 = require("../models/Contestant");
const City_1 = require("../models/City");
const uniqueId = require('uniqid');
let mongoose;
bootstrap_1.default().then((obj) => {
    mongoose = obj.mongoose;
    return start();
}).then(() => {
    console.log('done');
    return mongoose.connection.close();
}).catch(e => {
    console.error(e);
    if (mongoose.connection) {
        return mongoose.connection.close();
    }
}).then(() => {
    console.log('closed db conn');
});
// @ts-ignore
const got = require("got");
async function start() {
    return processArtists();
}
async function processArtists() {
    const artists = await _findArtists(0, 100000);
    for (let i = 0; i < artists.length; i++) {
        let isValidPhone = false;
        const artistObj = artists[i].toObject();
        const newObj = {};
        Object.keys(artistObj).forEach((key) => {
            const value = artistObj[key];
            newObj[_trimAndReplace(key)] = _trimAndReplace('' + value);
        });
        const ip = _trimAndReplace(newObj['User IP']);
        const artist = artists[i];
        let userRegionCode;
        const entryDate = new Date(newObj['Entry Date']);
        // newObj.IpInfo = resBody;
        artist.Name = newObj['Your Name'];
        artist.Email = newObj['Email'];
        artist.City = newObj['Your location (City)'];
        artist.Website = newObj['Instagram or Website'];
        artist.PhoneNumber = newObj['Mobile Phone Number'];
        if (newObj['Entry Id']) {
            let entryId = newObj['Entry Id'].replace(/-/g, '');
            entryId = entryId.replace(/\+/g, '');
            entryId = entryId.replace(/ /g, '');
            entryId = entryId.replace(/\./g, '');
            artist.EntryId = entryId;
        }
        artist.EntryDate = entryDate instanceof Date && !isNaN(entryDate.getTime()) ? entryDate : new Date();
        artist.Processed = true;
        let linkArtist = false;
        if (!artist.IpInfo || !artist.IpInfo.ip) {
            artist.IpInfo = await _ipToCountry(ip);
            console.log('artist.IpInfo', artist.IpInfo);
        }
        if (artist.PhoneNumber && artist.PhoneNumber.startsWith('+')) {
            let parsedNumber;
            try {
                parsedNumber = google_libphonenumber_1.PhoneNumberUtil.getInstance().parse(artist.PhoneNumber);
                isValidPhone = true;
            }
            catch (e) {
                console.error('Invalid number', e);
            }
            if (parsedNumber && google_libphonenumber_1.PhoneNumberUtil.getInstance().isValidNumber(parsedNumber)) {
                artist.PhoneNumber = `+${parsedNumber.getCountryCode()}${parsedNumber.getNationalNumber()}`;
                userRegionCode = google_libphonenumber_1.PhoneNumberUtil.getInstance().getRegionCodeForNumber(parsedNumber);
                linkArtist = true;
                isValidPhone = true;
            }
            else {
                console.error('Invalid number error', artist.PhoneNumber);
                artist.PhoneNumber = undefined;
            }
            await artist.save();
        }
        else {
            let parsedNumber;
            try {
                parsedNumber = google_libphonenumber_1.PhoneNumberUtil.getInstance().parse(artist.PhoneNumber, artist.IpInfo && artist.IpInfo.country_code);
                isValidPhone = true;
            }
            catch (e) {
                console.error('Invalid number error', e);
            }
            if (artist.IpInfo && parsedNumber && google_libphonenumber_1.PhoneNumberUtil.getInstance().isValidNumberForRegion(parsedNumber, artist.IpInfo && artist.IpInfo.country_code)) {
                userRegionCode = google_libphonenumber_1.PhoneNumberUtil.getInstance().getRegionCodeForNumber(parsedNumber);
                console.log('phone no does not start with +');
                artist.PhoneNumber = `+${parsedNumber.getCountryCode()}${parsedNumber.getNationalNumber()}`;
                linkArtist = true;
            }
            else {
                console.error('invalid number', artist.PhoneNumber, artist['User IP']);
            }
            await artist.save();
        }
        if (!isValidPhone) {
            linkArtist = true;
            artist.PhoneNumber = undefined;
        }
        if (linkArtist && artist.Name && artist.Name.length > 0) {
            const artNameArr = artist.Name.split(' ');
            const reg = await Registration_1.default.findOne({ PhoneNumber: artist.PhoneNumber });
            if (reg) {
                let savedReg;
                if (artist.PhoneNumber) {
                    reg.IsArtist = true;
                    reg.ArtistProfile = artist;
                    if (!reg.Email) {
                        reg.Email = artist.Email;
                    }
                    if (!reg.FirstName) {
                        reg.FirstName = artNameArr[0];
                        reg.LastName = artNameArr[1];
                    }
                    savedReg = await reg.save();
                }
                await linkContestant(savedReg, artist);
            }
            else {
                let savedReg;
                if (artist.PhoneNumber) {
                    // Register new user
                    const registration = new Registration_1.default({
                        ArtistProfile: artist,
                        Email: artist.Email,
                        FirstName: artNameArr[0],
                        LastName: artNameArr[1],
                        PhoneNumber: artist.PhoneNumber,
                        Hash: uniqueId.time(),
                        DisplayPhone: `*******${artist.PhoneNumber.slice(-4)}`,
                        RegionCode: userRegionCode,
                        SelfRegistered: false,
                        DeviceTokens: [],
                        ArtBattleNews: false,
                        NotificationEmails: false,
                        LoyaltyOffers: false,
                        AndroidDeviceTokens: [],
                        IsArtist: true
                    });
                    savedReg = await registration.save();
                    console.log('registered new user', registration);
                }
                await linkContestant(savedReg, artist);
            }
        }
        else {
            await createContestant(artist);
        }
    }
    if (artists.length === 1000) {
        console.log('processing more 1000');
        return processArtists();
    }
}
async function _ipToCountry(ip) {
    if (ip) {
        let ipResult;
        // const ipResult = await got(`http://api.ipstack.com/${ip}?access_key=b5ce16e3859ce336d9553060031fa02a`);
        try {
            ipResult = await got(`https://freegeoip.app/json/${ip}`);
        }
        catch (e) {
            console.error('api error');
        }
        if (ipResult && ipResult.statusCode !== 200) {
            console.error('need a new key', ipResult.body);
        }
        else {
            return ipResult && JSON.parse(ipResult.body);
        }
    }
    else {
        console.error('no ip found');
    }
}
function _trimAndReplace(str) {
    if (str && typeof str === 'string') {
        str = str.replace(/"/g, '');
        str = str.replace(/'/g, '');
        return str.trim();
    }
    else {
        console.error(str);
    }
}
// 5dfb5d4682d07bcba040acea
async function _findArtists(offset = 0, length = 1000) {
    return ArtistApps_1.default.find({ Processed: { $in: [null, false] } }
    // {Email: 'meaghanckehoe@gmail.com'}
    // {'Entry Id': 84606}
    ).skip(offset).limit(length).exec();
}
async function linkContestant(reg, artist) {
    let contestant;
    if (reg) {
        console.log('contestant with matching registration found', reg._id);
        contestant = await Contestant_1.default.findOne({ Registration: reg._id });
    }
    console.log('entry', artist.EntryId, artist['Entry Id']);
    const entryId = parseInt(artist.EntryId);
    if (!isNaN(entryId) && entryId.toString().length !== artist.EntryId.length) {
        console.error('potential invalid entry id in', artist, entryId.toString().length, artist.EntryId.length);
    }
    console.log('entryId', entryId);
    const email = (reg && reg.Email) || artist.Email;
    if (!contestant && email && email.length > 0) {
        contestant = await Contestant_1.default.findOne({ Email: email, EntryId: entryId });
        console.log('contestant with matching email and entry found', !contestant);
    }
    if (!contestant && email && email.length > 0) {
        contestant = await Contestant_1.default.findOne({ Email: email });
        console.log('contestant with matching email found', email, !contestant);
    }
    if (!contestant && !isNaN(entryId)) {
        contestant = await Contestant_1.default.findOne({ EntryId: entryId });
        console.log('contestant with matching entryid found', entryId, !contestant);
    }
    if (!contestant && reg && reg.PhoneNumber.length > 0) {
        contestant = await Contestant_1.default.findOne({ PhoneNumber: reg.PhoneNumber });
        console.log('contestant with matching reg.PhoneNumber found', reg.PhoneNumber, !contestant);
    }
    if (!contestant) {
        console.log('creating contestant from scratch', artist);
        contestant = new Contestant_1.default();
        const names = [];
        if (reg && reg.FirstName) {
            names.push(reg.FirstName);
        }
        if (reg && reg.LastName) {
            names.push(reg.LastName);
        }
        contestant.Name = reg ? `${names.join(' ')}` : artist['Your Name'];
        contestant.Registration = reg && reg._id;
        const cityTextArr = [];
        if (artist) {
            if (artist.City) {
                cityTextArr.push(artist.City);
            }
            if (artist.IpInfo && artist.IpInfo.region_code) {
                cityTextArr.push(artist.IpInfo.region_code);
            }
            if (artist.IpInfo && artist.IpInfo.country_code) {
                cityTextArr.push(artist.IpInfo.country_code);
            }
        }
        contestant.CityText = `${cityTextArr.join(', ')}`;
        const email = ((reg && reg.Email) || artist.Email);
        contestant.Email = email && email.length > 0 ? email : undefined;
        contestant.Website = artist.Website || reg && reg.ArtistProfile && reg.ArtistProfile.Website;
        const entryId = parseInt((reg && reg.ArtistProfile && reg.ArtistProfile.EntryId) || artist.EntryId);
        if (!isNaN(entryId)) {
            contestant.EntryId = entryId;
        }
        contestant.PhoneNumber = artist.PhoneNumber || (reg && reg.PhoneNumber);
        contestant.City = await findOrCreateCity(artist.IpInfo);
        contestant.ChildContestants = [];
        contestant.IsDuplicate = false;
        const savedContestant = await contestant.save();
        contestant.Followers = [];
        if (reg) {
            reg.Artist = savedContestant;
            reg.IsArtist = true;
        }
    }
    else {
        console.log('updating contestant');
        if (!contestant.Name || contestant.Name.includes('undefined')) {
            contestant.Name = artist.Name;
        }
        if (!contestant.EntryId && !isNaN(entryId)) {
            contestant.EntryId = entryId;
        }
        if (!contestant.PhoneNumber) {
            contestant.PhoneNumber = artist.PhoneNumber;
        }
        if (!contestant.Email) {
            const email = ((reg && reg.Email) || artist.Email);
            contestant.Email = email && email.length > 0 ? email : undefined;
        }
        if (!contestant.Website) {
            contestant.Website = artist.Website;
        }
        if (!contestant.CityText || contestant.CityText.includes('undefined') || contestant.CityText.includes('null')) {
            const cityTextArr = [];
            if (artist) {
                if (artist.City) {
                    cityTextArr.push(artist.City);
                }
                if (artist.IpInfo && artist.IpInfo.region_code) {
                    cityTextArr.push(artist.IpInfo.region_code);
                }
                if (artist.IpInfo && artist.IpInfo.country_code) {
                    cityTextArr.push(artist.IpInfo.country_code);
                }
            }
            contestant.CityText = cityTextArr.join(', ');
        }
        let error = false;
        try {
            await contestant.save();
        }
        catch (e) {
            console.error(e);
            error = true;
        }
        if (reg) {
            if (!error) {
                reg.Artist = contestant;
                reg.IsArtist = true;
            }
        }
    }
    if (reg) {
        await reg.save();
    }
}
async function createContestant(artist) {
    const entryId = parseInt(artist.EntryId);
    const email = artist.Email;
    if (!artist.Email || isNaN(entryId) || artist.Email.length === 0) {
        return;
    }
    let contestant;
    contestant = await Contestant_1.default.findOne({ Email: email, EntryId: entryId });
    console.log('createContestant', 'not found by email and entry id', !contestant);
    if (!contestant) {
        contestant = await Contestant_1.default.findOne({ EntryId: entryId });
        console.log('createContestant', 'not found by entry id', !contestant);
    }
    if (!contestant) {
        contestant = await Contestant_1.default.findOne({ Email: email });
        console.log('createContestant', 'not found by email', !contestant);
    }
    if (!contestant) {
        contestant = new Contestant_1.default();
    }
    if (!contestant.Name) {
        contestant.Name = artist.Name;
    }
    if (!contestant.CityText) {
        const cityTextArr = [];
        if (artist.City) {
            cityTextArr.push(artist.City);
        }
        if (artist.IpInfo && artist.IpInfo.region_code) {
            cityTextArr.push(artist.IpInfo.region_code);
        }
        if (artist.IpInfo && artist.IpInfo.country_code) {
            cityTextArr.push(artist.IpInfo.country_code);
        }
        contestant.CityText = cityTextArr.join(', ');
    }
    if (!contestant.Email) {
        contestant.Email = artist.Email;
    }
    if (!contestant.Website) {
        contestant.Website = artist.Website;
    }
    if (!contestant.EntryId) {
        contestant.EntryId = entryId;
    }
    if (!contestant.City) {
        contestant.City = await findOrCreateCity(artist.IpInfo);
    }
    if (!Array.isArray(contestant.ChildContestants)) {
        contestant.ChildContestants = [];
    }
    if (!contestant.IsDuplicate) {
        contestant.IsDuplicate = false;
    }
    if (!Array.isArray(contestant.Followers)) {
        contestant.Followers = [];
    }
    await contestant.save();
}
async function findOrCreateCity(info) {
    if (!info) {
        return undefined;
    }
    const city = await City_1.default.findOne({
        Name: info.city,
        Country: info.country_name,
        Region: info.region_name
    });
    if (!city) {
        const cityModel = new City_1.default();
        cityModel.Name = info.city;
        cityModel.Country = info.country_name;
        cityModel.RegionCode = info.region_code;
        cityModel.Region = info.region_name;
        cityModel.CountryCode = info.country_code;
        await cityModel.save();
    }
    return city;
}
// mongoimport -d test -c artistapps --type csv --file ~/Downloads/1-register-as-an-art-battle-competitor-2019-12-16.csv  --headerline
//  db.artistapps.updateMany({}, {$set: {Processed: false}})

//# sourceMappingURL=data:application/json;charset=utf8;base64,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RUFBRSxJQUFJLENBQUMsV0FBVztLQUN6QixDQUFDLENBQUM7SUFDSCxJQUFJLENBQUMsSUFBSSxFQUFFO1FBQ1QsTUFBTSxTQUFTLEdBQUcsSUFBSSxjQUFTLEVBQUUsQ0FBQztRQUNsQyxTQUFTLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDM0IsU0FBUyxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO1FBQ3RDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUN4QyxTQUFTLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUM7UUFDcEMsU0FBUyxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO1FBQzFDLE1BQU0sU0FBUyxDQUFDLElBQUksRUFBRSxDQUFDO0tBQ3hCO0lBQ0QsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBQ0Qsc0lBQXNJO0FBQ3RJLDREQUE0RCIsImZpbGUiOiJzY3JpcHRzL2ZpeEFydGlzdHMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgbG9hZEFwcCBmcm9tICcuL2Jvb3RzdHJhcCc7XG5pbXBvcnQgQXJ0aXN0QXBwcywgeyBBcnRpc3RBcHBzRG9jdW1lbnQgfSBmcm9tICcuLi9tb2RlbHMvQXJ0aXN0QXBwcyc7XG5pbXBvcnQgeyBQaG9uZU51bWJlclV0aWwgfSBmcm9tICdnb29nbGUtbGlicGhvbmVudW1iZXInO1xuaW1wb3J0IFJlZ2lzdHJhdGlvbk1vZGVsLCB7IFJlZ2lzdHJhdGlvbkRvY3VtZW50IH0gZnJvbSAnLi4vbW9kZWxzL1JlZ2lzdHJhdGlvbic7XG5pbXBvcnQgQ29udGVzdGFudE1vZGVsIGZyb20gJy4uL21vZGVscy9Db250ZXN0YW50JztcbmltcG9ydCBDaXR5TW9kZWwgZnJvbSAnLi4vbW9kZWxzL0NpdHknO1xuaW1wb3J0IHsgSXBJbmZvIH0gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL0FydGlzdEFwcHNEVE8nO1xuXG5jb25zdCB1bmlxdWVJZCA9IHJlcXVpcmUoJ3VuaXFpZCcpO1xubGV0IG1vbmdvb3NlOiB0eXBlb2YgaW1wb3J0KCdtb25nb29zZScpO1xubG9hZEFwcCgpLnRoZW4oKG9iaikgPT4ge1xuICBtb25nb29zZSA9IG9iai5tb25nb29zZTtcbiAgcmV0dXJuIHN0YXJ0KCk7XG59KS50aGVuKCgpID0+IHtcbiAgY29uc29sZS5sb2coJ2RvbmUnKTtcbiAgcmV0dXJuIG1vbmdvb3NlLmNvbm5lY3Rpb24uY2xvc2UoKTtcbn0pLmNhdGNoKGUgPT4ge1xuICBjb25zb2xlLmVycm9yKGUpO1xuICBpZiAobW9uZ29vc2UuY29ubmVjdGlvbikge1xuICAgIHJldHVybiBtb25nb29zZS5jb25uZWN0aW9uLmNsb3NlKCk7XG4gIH1cbn0pLnRoZW4oKCkgPT4ge1xuICBjb25zb2xlLmxvZygnY2xvc2VkIGRiIGNvbm4nKTtcbn0pO1xuLy8gQHRzLWlnbm9yZVxuaW1wb3J0IGdvdCA9IHJlcXVpcmUoJ2dvdCcpO1xuXG5hc3luYyBmdW5jdGlvbiBzdGFydCgpIHtcbiAgcmV0dXJuIHByb2Nlc3NBcnRpc3RzKCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHByb2Nlc3NBcnRpc3RzKCk6IFByb21pc2U8YW55PiB7XG4gIGNvbnN0IGFydGlzdHMgPSBhd2FpdCBfZmluZEFydGlzdHMoMCwgMTAwMDAwKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnRpc3RzLmxlbmd0aDsgaSsrKSB7XG4gICAgbGV0IGlzVmFsaWRQaG9uZSA9IGZhbHNlO1xuICAgIGNvbnN0IGFydGlzdE9iaiA9IGFydGlzdHNbaV0udG9PYmplY3QoKTtcbiAgICBjb25zdCBuZXdPYmo6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG4gICAgT2JqZWN0LmtleXMoYXJ0aXN0T2JqKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gYXJ0aXN0T2JqW2tleV07XG4gICAgICBuZXdPYmpbX3RyaW1BbmRSZXBsYWNlKGtleSldID0gX3RyaW1BbmRSZXBsYWNlKCcnICsgdmFsdWUpO1xuICAgIH0pO1xuICAgIGNvbnN0IGlwID0gX3RyaW1BbmRSZXBsYWNlKG5ld09ialsnVXNlciBJUCddKTtcbiAgICBjb25zdCBhcnRpc3QgPSBhcnRpc3RzW2ldO1xuICAgIGxldCB1c2VyUmVnaW9uQ29kZTtcbiAgICBjb25zdCBlbnRyeURhdGUgPSBuZXcgRGF0ZShuZXdPYmpbJ0VudHJ5IERhdGUnXSk7XG4gICAgLy8gbmV3T2JqLklwSW5mbyA9IHJlc0JvZHk7XG4gICAgYXJ0aXN0Lk5hbWUgPSAgbmV3T2JqWydZb3VyIE5hbWUnXTtcbiAgICBhcnRpc3QuRW1haWwgPSBuZXdPYmpbJ0VtYWlsJ107XG4gICAgYXJ0aXN0LkNpdHkgPSBuZXdPYmpbJ1lvdXIgbG9jYXRpb24gKENpdHkpJ107XG4gICAgYXJ0aXN0LldlYnNpdGUgPSBuZXdPYmpbJ0luc3RhZ3JhbSBvciBXZWJzaXRlJ107XG4gICAgYXJ0aXN0LlBob25lTnVtYmVyID0gbmV3T2JqWydNb2JpbGUgUGhvbmUgTnVtYmVyJ107XG4gICAgaWYgKG5ld09ialsnRW50cnkgSWQnXSkge1xuICAgICAgIGxldCBlbnRyeUlkID0gbmV3T2JqWydFbnRyeSBJZCddLnJlcGxhY2UoLy0vZywgJycpO1xuICAgICAgZW50cnlJZCA9IGVudHJ5SWQucmVwbGFjZSgvXFwrL2csICcnKTtcbiAgICAgIGVudHJ5SWQgPSBlbnRyeUlkLnJlcGxhY2UoLyAvZywgJycpO1xuICAgICAgZW50cnlJZCA9IGVudHJ5SWQucmVwbGFjZSgvXFwuL2csICcnKTtcbiAgICAgIGFydGlzdC5FbnRyeUlkID0gZW50cnlJZDtcbiAgICB9XG4gICAgYXJ0aXN0LkVudHJ5RGF0ZSA9IGVudHJ5RGF0ZSBpbnN0YW5jZW9mIERhdGUgJiYgIWlzTmFOKGVudHJ5RGF0ZS5nZXRUaW1lKCkpID8gZW50cnlEYXRlIDogbmV3IERhdGUoKTtcblxuICAgIGFydGlzdC5Qcm9jZXNzZWQgPSB0cnVlO1xuICAgIGxldCBsaW5rQXJ0aXN0ID0gZmFsc2U7XG4gICAgaWYgKCFhcnRpc3QuSXBJbmZvIHx8ICFhcnRpc3QuSXBJbmZvLmlwKSB7XG4gICAgICBhcnRpc3QuSXBJbmZvID0gYXdhaXQgX2lwVG9Db3VudHJ5KGlwKTtcbiAgICAgIGNvbnNvbGUubG9nKCdhcnRpc3QuSXBJbmZvJywgYXJ0aXN0LklwSW5mbyk7XG4gICAgfVxuICAgIGlmIChhcnRpc3QuUGhvbmVOdW1iZXIgJiYgYXJ0aXN0LlBob25lTnVtYmVyLnN0YXJ0c1dpdGgoJysnKSkge1xuICAgICAgbGV0IHBhcnNlZE51bWJlcjtcbiAgICAgIHRyeSB7XG4gICAgICAgIHBhcnNlZE51bWJlciA9IFBob25lTnVtYmVyVXRpbC5nZXRJbnN0YW5jZSgpLnBhcnNlKGFydGlzdC5QaG9uZU51bWJlcik7XG4gICAgICAgIGlzVmFsaWRQaG9uZSA9IHRydWU7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ludmFsaWQgbnVtYmVyJywgZSk7XG4gICAgICB9XG4gICAgICBpZiAocGFyc2VkTnVtYmVyICYmIFBob25lTnVtYmVyVXRpbC5nZXRJbnN0YW5jZSgpLmlzVmFsaWROdW1iZXIocGFyc2VkTnVtYmVyKSkge1xuICAgICAgICBhcnRpc3QuUGhvbmVOdW1iZXIgPSBgKyR7cGFyc2VkTnVtYmVyLmdldENvdW50cnlDb2RlKCl9JHtwYXJzZWROdW1iZXIuZ2V0TmF0aW9uYWxOdW1iZXIoKX1gO1xuICAgICAgICB1c2VyUmVnaW9uQ29kZSA9IFBob25lTnVtYmVyVXRpbC5nZXRJbnN0YW5jZSgpLmdldFJlZ2lvbkNvZGVGb3JOdW1iZXIocGFyc2VkTnVtYmVyKTtcbiAgICAgICAgbGlua0FydGlzdCA9IHRydWU7XG4gICAgICAgIGlzVmFsaWRQaG9uZSA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdJbnZhbGlkIG51bWJlciBlcnJvcicsIGFydGlzdC5QaG9uZU51bWJlcik7XG4gICAgICAgIGFydGlzdC5QaG9uZU51bWJlciA9IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICAgIGF3YWl0IGFydGlzdC5zYXZlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBwYXJzZWROdW1iZXI7XG4gICAgICB0cnkge1xuICAgICAgICBwYXJzZWROdW1iZXIgPSBQaG9uZU51bWJlclV0aWwuZ2V0SW5zdGFuY2UoKS5wYXJzZShhcnRpc3QuUGhvbmVOdW1iZXIsIGFydGlzdC5JcEluZm8gJiYgYXJ0aXN0LklwSW5mby5jb3VudHJ5X2NvZGUpO1xuICAgICAgICBpc1ZhbGlkUGhvbmUgPSB0cnVlO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdJbnZhbGlkIG51bWJlciBlcnJvcicsIGUpO1xuICAgICAgfVxuICAgICAgaWYgKGFydGlzdC5JcEluZm8gJiYgcGFyc2VkTnVtYmVyICYmIFBob25lTnVtYmVyVXRpbC5nZXRJbnN0YW5jZSgpLmlzVmFsaWROdW1iZXJGb3JSZWdpb24ocGFyc2VkTnVtYmVyLCBhcnRpc3QuSXBJbmZvICYmIGFydGlzdC5JcEluZm8uY291bnRyeV9jb2RlKSkge1xuICAgICAgICB1c2VyUmVnaW9uQ29kZSA9IFBob25lTnVtYmVyVXRpbC5nZXRJbnN0YW5jZSgpLmdldFJlZ2lvbkNvZGVGb3JOdW1iZXIocGFyc2VkTnVtYmVyKTtcbiAgICAgICAgY29uc29sZS5sb2coJ3Bob25lIG5vIGRvZXMgbm90IHN0YXJ0IHdpdGggKycpO1xuICAgICAgICBhcnRpc3QuUGhvbmVOdW1iZXIgPSBgKyR7cGFyc2VkTnVtYmVyLmdldENvdW50cnlDb2RlKCl9JHtwYXJzZWROdW1iZXIuZ2V0TmF0aW9uYWxOdW1iZXIoKX1gO1xuICAgICAgICBsaW5rQXJ0aXN0ID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ2ludmFsaWQgbnVtYmVyJywgYXJ0aXN0LlBob25lTnVtYmVyLCBhcnRpc3RbJ1VzZXIgSVAnXSk7XG4gICAgICB9XG4gICAgICBhd2FpdCBhcnRpc3Quc2F2ZSgpO1xuICAgIH1cbiAgICBpZiAoIWlzVmFsaWRQaG9uZSkge1xuICAgICAgbGlua0FydGlzdCA9IHRydWU7XG4gICAgICBhcnRpc3QuUGhvbmVOdW1iZXIgPSB1bmRlZmluZWQ7XG4gICAgfVxuICAgIGlmIChsaW5rQXJ0aXN0ICYmIGFydGlzdC5OYW1lICYmIGFydGlzdC5OYW1lLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGFydE5hbWVBcnIgPSBhcnRpc3QuTmFtZS5zcGxpdCgnICcpO1xuICAgICAgY29uc3QgcmVnID0gYXdhaXQgUmVnaXN0cmF0aW9uTW9kZWwuZmluZE9uZSh7UGhvbmVOdW1iZXI6IGFydGlzdC5QaG9uZU51bWJlcn0pO1xuICAgICAgaWYgKHJlZykge1xuICAgICAgICBsZXQgc2F2ZWRSZWc7XG4gICAgICAgIGlmIChhcnRpc3QuUGhvbmVOdW1iZXIpIHtcbiAgICAgICAgICByZWcuSXNBcnRpc3QgPSB0cnVlO1xuICAgICAgICAgIHJlZy5BcnRpc3RQcm9maWxlID0gYXJ0aXN0O1xuICAgICAgICAgIGlmICghcmVnLkVtYWlsKSB7XG4gICAgICAgICAgICByZWcuRW1haWwgPSBhcnRpc3QuRW1haWw7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghcmVnLkZpcnN0TmFtZSkge1xuICAgICAgICAgICAgcmVnLkZpcnN0TmFtZSA9IGFydE5hbWVBcnJbMF07XG4gICAgICAgICAgICByZWcuTGFzdE5hbWUgPSBhcnROYW1lQXJyWzFdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzYXZlZFJlZyA9IGF3YWl0IHJlZy5zYXZlKCk7XG4gICAgICAgIH1cbiAgICAgICAgYXdhaXQgbGlua0NvbnRlc3RhbnQoc2F2ZWRSZWcsIGFydGlzdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgc2F2ZWRSZWc7XG4gICAgICAgIGlmIChhcnRpc3QuUGhvbmVOdW1iZXIpIHtcbiAgICAgICAgICAvLyBSZWdpc3RlciBuZXcgdXNlclxuICAgICAgICAgIGNvbnN0IHJlZ2lzdHJhdGlvbiA9IG5ldyBSZWdpc3RyYXRpb25Nb2RlbCh7XG4gICAgICAgICAgICBBcnRpc3RQcm9maWxlOiBhcnRpc3QsXG4gICAgICAgICAgICBFbWFpbDogYXJ0aXN0LkVtYWlsLFxuICAgICAgICAgICAgRmlyc3ROYW1lOiBhcnROYW1lQXJyWzBdLFxuICAgICAgICAgICAgTGFzdE5hbWU6IGFydE5hbWVBcnJbMV0sXG4gICAgICAgICAgICBQaG9uZU51bWJlcjogYXJ0aXN0LlBob25lTnVtYmVyLFxuICAgICAgICAgICAgSGFzaDogdW5pcXVlSWQudGltZSgpLFxuICAgICAgICAgICAgRGlzcGxheVBob25lOiBgKioqKioqKiR7YXJ0aXN0LlBob25lTnVtYmVyLnNsaWNlKC00KX1gLFxuICAgICAgICAgICAgUmVnaW9uQ29kZTogdXNlclJlZ2lvbkNvZGUsXG4gICAgICAgICAgICBTZWxmUmVnaXN0ZXJlZDogZmFsc2UsXG4gICAgICAgICAgICBEZXZpY2VUb2tlbnM6IFtdLFxuICAgICAgICAgICAgQXJ0QmF0dGxlTmV3czogZmFsc2UsXG4gICAgICAgICAgICBOb3RpZmljYXRpb25FbWFpbHM6IGZhbHNlLFxuICAgICAgICAgICAgTG95YWx0eU9mZmVyczogZmFsc2UsXG4gICAgICAgICAgICBBbmRyb2lkRGV2aWNlVG9rZW5zOiBbXSxcbiAgICAgICAgICAgIElzQXJ0aXN0OiB0cnVlXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgc2F2ZWRSZWcgPSBhd2FpdCByZWdpc3RyYXRpb24uc2F2ZSgpO1xuICAgICAgICAgIGNvbnNvbGUubG9nKCdyZWdpc3RlcmVkIG5ldyB1c2VyJywgcmVnaXN0cmF0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBhd2FpdCBsaW5rQ29udGVzdGFudChzYXZlZFJlZywgYXJ0aXN0KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgYXdhaXQgY3JlYXRlQ29udGVzdGFudChhcnRpc3QpO1xuICAgIH1cblxuICB9XG4gIGlmIChhcnRpc3RzLmxlbmd0aCA9PT0gMTAwMCkge1xuICAgIGNvbnNvbGUubG9nKCdwcm9jZXNzaW5nIG1vcmUgMTAwMCcpO1xuICAgIHJldHVybiBwcm9jZXNzQXJ0aXN0cygpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIF9pcFRvQ291bnRyeShpcDogc3RyaW5nKSB7XG4gIGlmIChpcCkge1xuICAgIGxldCBpcFJlc3VsdDtcbiAgICAvLyBjb25zdCBpcFJlc3VsdCA9IGF3YWl0IGdvdChgaHR0cDovL2FwaS5pcHN0YWNrLmNvbS8ke2lwfT9hY2Nlc3Nfa2V5PWI1Y2UxNmUzODU5Y2UzMzZkOTU1MzA2MDAzMWZhMDJhYCk7XG4gICAgdHJ5IHtcbiAgICAgIGlwUmVzdWx0ID0gYXdhaXQgZ290KGBodHRwczovL2ZyZWVnZW9pcC5hcHAvanNvbi8ke2lwfWApO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ2FwaSBlcnJvcicpO1xuICAgIH1cbiAgICBpZiAoaXBSZXN1bHQgJiYgaXBSZXN1bHQuc3RhdHVzQ29kZSAhPT0gMjAwKSB7XG4gICAgICBjb25zb2xlLmVycm9yKCduZWVkIGEgbmV3IGtleScsIGlwUmVzdWx0LmJvZHkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gaXBSZXN1bHQgJiYgSlNPTi5wYXJzZShpcFJlc3VsdC5ib2R5KTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgY29uc29sZS5lcnJvcignbm8gaXAgZm91bmQnKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBfdHJpbUFuZFJlcGxhY2Uoc3RyOiBzdHJpbmcpIHtcbiAgaWYgKHN0ciAmJiB0eXBlb2Ygc3RyID09PSAnc3RyaW5nJykge1xuICAgIHN0ciA9IHN0ci5yZXBsYWNlKC9cIi9nLCAnJyk7XG4gICAgc3RyID0gc3RyLnJlcGxhY2UoLycvZywgJycpO1xuICAgIHJldHVybiBzdHIudHJpbSgpO1xuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUuZXJyb3Ioc3RyKTtcbiAgfVxufVxuLy8gNWRmYjVkNDY4MmQwN2JjYmEwNDBhY2VhXG5hc3luYyBmdW5jdGlvbiBfZmluZEFydGlzdHMob2Zmc2V0ID0gMCwgbGVuZ3RoID0gMTAwMCkge1xuICByZXR1cm4gQXJ0aXN0QXBwcy5maW5kKFxuICAgICB7UHJvY2Vzc2VkOiB7JGluOiBbbnVsbCwgZmFsc2VdfX1cbiAgICAvLyB7RW1haWw6ICdtZWFnaGFuY2tlaG9lQGdtYWlsLmNvbSd9XG4gICAgICAvLyB7J0VudHJ5IElkJzogODQ2MDZ9XG4gICkuc2tpcChvZmZzZXQpLmxpbWl0KGxlbmd0aCkuZXhlYygpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBsaW5rQ29udGVzdGFudChyZWc6IFJlZ2lzdHJhdGlvbkRvY3VtZW50LCBhcnRpc3Q6IEFydGlzdEFwcHNEb2N1bWVudCkge1xuICBsZXQgY29udGVzdGFudDtcbiAgaWYgKHJlZykge1xuICAgIGNvbnNvbGUubG9nKCdjb250ZXN0YW50IHdpdGggbWF0Y2hpbmcgcmVnaXN0cmF0aW9uIGZvdW5kJywgcmVnLl9pZCk7XG4gICAgY29udGVzdGFudCA9IGF3YWl0IENvbnRlc3RhbnRNb2RlbC5maW5kT25lKHtSZWdpc3RyYXRpb246IHJlZy5faWR9KTtcbiAgfVxuICBjb25zb2xlLmxvZygnZW50cnknLCBhcnRpc3QuRW50cnlJZCwgYXJ0aXN0WydFbnRyeSBJZCddKTtcbiAgY29uc3QgZW50cnlJZCA9IHBhcnNlSW50KGFydGlzdC5FbnRyeUlkKTtcbiAgaWYgKCFpc05hTihlbnRyeUlkKSAmJiBlbnRyeUlkLnRvU3RyaW5nKCkubGVuZ3RoICE9PSBhcnRpc3QuRW50cnlJZC5sZW5ndGgpIHtcbiAgICBjb25zb2xlLmVycm9yKCdwb3RlbnRpYWwgaW52YWxpZCBlbnRyeSBpZCBpbicsIGFydGlzdCwgZW50cnlJZC50b1N0cmluZygpLmxlbmd0aCwgYXJ0aXN0LkVudHJ5SWQubGVuZ3RoKTtcbiAgfVxuICBjb25zb2xlLmxvZygnZW50cnlJZCcsIGVudHJ5SWQpO1xuICBjb25zdCBlbWFpbCA9IChyZWcgJiYgcmVnLkVtYWlsKSB8fCBhcnRpc3QuRW1haWw7XG4gIGlmICghY29udGVzdGFudCAmJiBlbWFpbCAmJiBlbWFpbC5sZW5ndGggPiAwKSB7XG4gICAgY29udGVzdGFudCA9IGF3YWl0IENvbnRlc3RhbnRNb2RlbC5maW5kT25lKHtFbWFpbDogZW1haWwsIEVudHJ5SWQ6IGVudHJ5SWR9KTtcbiAgICBjb25zb2xlLmxvZygnY29udGVzdGFudCB3aXRoIG1hdGNoaW5nIGVtYWlsIGFuZCBlbnRyeSBmb3VuZCcsICFjb250ZXN0YW50KTtcbiAgfVxuICBpZiAoIWNvbnRlc3RhbnQgJiYgZW1haWwgJiYgZW1haWwubGVuZ3RoID4gMCkge1xuICAgIGNvbnRlc3RhbnQgPSBhd2FpdCBDb250ZXN0YW50TW9kZWwuZmluZE9uZSh7RW1haWw6IGVtYWlsfSk7XG4gICAgY29uc29sZS5sb2coJ2NvbnRlc3RhbnQgd2l0aCBtYXRjaGluZyBlbWFpbCBmb3VuZCcsIGVtYWlsLCAhY29udGVzdGFudCk7XG4gIH1cbiAgaWYgKCFjb250ZXN0YW50ICYmICFpc05hTihlbnRyeUlkKSkge1xuICAgIGNvbnRlc3RhbnQgPSBhd2FpdCBDb250ZXN0YW50TW9kZWwuZmluZE9uZSh7RW50cnlJZDogZW50cnlJZH0pO1xuICAgIGNvbnNvbGUubG9nKCdjb250ZXN0YW50IHdpdGggbWF0Y2hpbmcgZW50cnlpZCBmb3VuZCcsIGVudHJ5SWQsICFjb250ZXN0YW50KTtcbiAgfVxuICBpZiAoIWNvbnRlc3RhbnQgJiYgcmVnICYmIHJlZy5QaG9uZU51bWJlci5sZW5ndGggPiAwKSB7XG4gICAgY29udGVzdGFudCA9IGF3YWl0IENvbnRlc3RhbnRNb2RlbC5maW5kT25lKHtQaG9uZU51bWJlcjogcmVnLlBob25lTnVtYmVyfSk7XG4gICAgY29uc29sZS5sb2coJ2NvbnRlc3RhbnQgd2l0aCBtYXRjaGluZyByZWcuUGhvbmVOdW1iZXIgZm91bmQnLCByZWcuUGhvbmVOdW1iZXIsICFjb250ZXN0YW50KTtcbiAgfVxuICBpZiAoIWNvbnRlc3RhbnQpIHtcbiAgICBjb25zb2xlLmxvZygnY3JlYXRpbmcgY29udGVzdGFudCBmcm9tIHNjcmF0Y2gnLCBhcnRpc3QpO1xuICAgIGNvbnRlc3RhbnQgPSBuZXcgQ29udGVzdGFudE1vZGVsKCk7XG4gICAgY29uc3QgbmFtZXMgPSBbXTtcbiAgICBpZiAocmVnICYmIHJlZy5GaXJzdE5hbWUpIHtcbiAgICAgIG5hbWVzLnB1c2gocmVnLkZpcnN0TmFtZSk7XG4gICAgfVxuICAgIGlmIChyZWcgJiYgcmVnLkxhc3ROYW1lKSB7XG4gICAgICBuYW1lcy5wdXNoKHJlZy5MYXN0TmFtZSk7XG4gICAgfVxuICAgIGNvbnRlc3RhbnQuTmFtZSA9IHJlZyA/IGAke25hbWVzLmpvaW4oJyAnKX1gIDogYXJ0aXN0WydZb3VyIE5hbWUnXTtcbiAgICBjb250ZXN0YW50LlJlZ2lzdHJhdGlvbiA9IHJlZyAmJiByZWcuX2lkO1xuICAgIGNvbnN0IGNpdHlUZXh0QXJyID0gW107XG4gICAgaWYgKGFydGlzdCkge1xuICAgICAgaWYgKGFydGlzdC5DaXR5KSB7XG4gICAgICAgIGNpdHlUZXh0QXJyLnB1c2goYXJ0aXN0LkNpdHkpO1xuICAgICAgfVxuICAgICAgaWYgKGFydGlzdC5JcEluZm8gJiYgYXJ0aXN0LklwSW5mby5yZWdpb25fY29kZSkge1xuICAgICAgICBjaXR5VGV4dEFyci5wdXNoKGFydGlzdC5JcEluZm8ucmVnaW9uX2NvZGUpO1xuICAgICAgfVxuICAgICAgaWYgKGFydGlzdC5JcEluZm8gJiYgYXJ0aXN0LklwSW5mby5jb3VudHJ5X2NvZGUpIHtcbiAgICAgICAgY2l0eVRleHRBcnIucHVzaChhcnRpc3QuSXBJbmZvLmNvdW50cnlfY29kZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnRlc3RhbnQuQ2l0eVRleHQgPSBgJHtjaXR5VGV4dEFyci5qb2luKCcsICcpfWA7XG4gICAgY29uc3QgZW1haWwgPSAoKHJlZyAmJiByZWcuRW1haWwpIHx8IGFydGlzdC5FbWFpbCk7XG4gICAgY29udGVzdGFudC5FbWFpbCA9IGVtYWlsICYmIGVtYWlsLmxlbmd0aCA+IDAgPyBlbWFpbCA6IHVuZGVmaW5lZDtcbiAgICBjb250ZXN0YW50LldlYnNpdGUgPSBhcnRpc3QuV2Vic2l0ZSB8fCByZWcgJiYgcmVnLkFydGlzdFByb2ZpbGUgJiYgcmVnLkFydGlzdFByb2ZpbGUuV2Vic2l0ZTtcbiAgICBjb25zdCBlbnRyeUlkID0gcGFyc2VJbnQoKHJlZyAmJiByZWcuQXJ0aXN0UHJvZmlsZSAmJiByZWcuQXJ0aXN0UHJvZmlsZS5FbnRyeUlkKSB8fCBhcnRpc3QuRW50cnlJZCk7XG4gICAgaWYgKCFpc05hTihlbnRyeUlkKSkge1xuICAgICAgY29udGVzdGFudC5FbnRyeUlkID0gZW50cnlJZDtcbiAgICB9XG4gICAgY29udGVzdGFudC5QaG9uZU51bWJlciA9ICBhcnRpc3QuUGhvbmVOdW1iZXIgfHwgKHJlZyAmJiByZWcuUGhvbmVOdW1iZXIpO1xuICAgIGNvbnRlc3RhbnQuQ2l0eSA9IGF3YWl0IGZpbmRPckNyZWF0ZUNpdHkoYXJ0aXN0LklwSW5mbyk7XG4gICAgY29udGVzdGFudC5DaGlsZENvbnRlc3RhbnRzID0gW107XG4gICAgY29udGVzdGFudC5Jc0R1cGxpY2F0ZSA9IGZhbHNlO1xuICAgIGNvbnN0IHNhdmVkQ29udGVzdGFudCA9IGF3YWl0IGNvbnRlc3RhbnQuc2F2ZSgpO1xuICAgIGNvbnRlc3RhbnQuRm9sbG93ZXJzID0gW107XG4gICAgaWYgKHJlZykge1xuICAgICAgcmVnLkFydGlzdCA9IHNhdmVkQ29udGVzdGFudDtcbiAgICAgIHJlZy5Jc0FydGlzdCA9IHRydWU7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGNvbnNvbGUubG9nKCd1cGRhdGluZyBjb250ZXN0YW50Jyk7XG4gICAgaWYgKCFjb250ZXN0YW50Lk5hbWUgfHwgY29udGVzdGFudC5OYW1lLmluY2x1ZGVzKCd1bmRlZmluZWQnKSkge1xuICAgICAgY29udGVzdGFudC5OYW1lID0gYXJ0aXN0Lk5hbWU7XG4gICAgfVxuICAgIGlmICghY29udGVzdGFudC5FbnRyeUlkICYmICFpc05hTihlbnRyeUlkKSkge1xuICAgICAgY29udGVzdGFudC5FbnRyeUlkID0gZW50cnlJZDtcbiAgICB9XG4gICAgaWYgKCFjb250ZXN0YW50LlBob25lTnVtYmVyKSB7XG4gICAgICBjb250ZXN0YW50LlBob25lTnVtYmVyID0gYXJ0aXN0LlBob25lTnVtYmVyO1xuICAgIH1cbiAgICBpZiAoIWNvbnRlc3RhbnQuRW1haWwpIHtcbiAgICAgIGNvbnN0IGVtYWlsID0gKChyZWcgJiYgcmVnLkVtYWlsKSB8fCBhcnRpc3QuRW1haWwpO1xuICAgICAgY29udGVzdGFudC5FbWFpbCA9IGVtYWlsICYmIGVtYWlsLmxlbmd0aCA+IDAgPyBlbWFpbCA6IHVuZGVmaW5lZDtcbiAgICB9XG4gICAgaWYgKCFjb250ZXN0YW50LldlYnNpdGUpIHtcbiAgICAgIGNvbnRlc3RhbnQuV2Vic2l0ZSA9IGFydGlzdC5XZWJzaXRlO1xuICAgIH1cbiAgICBpZiAoIWNvbnRlc3RhbnQuQ2l0eVRleHQgfHwgY29udGVzdGFudC5DaXR5VGV4dC5pbmNsdWRlcygndW5kZWZpbmVkJykgfHwgY29udGVzdGFudC5DaXR5VGV4dC5pbmNsdWRlcygnbnVsbCcpKSB7XG4gICAgICBjb25zdCBjaXR5VGV4dEFyciA9IFtdO1xuICAgICAgaWYgKGFydGlzdCkge1xuICAgICAgICBpZiAoYXJ0aXN0LkNpdHkpIHtcbiAgICAgICAgICBjaXR5VGV4dEFyci5wdXNoKGFydGlzdC5DaXR5KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYXJ0aXN0LklwSW5mbyAmJiBhcnRpc3QuSXBJbmZvLnJlZ2lvbl9jb2RlKSB7XG4gICAgICAgICAgY2l0eVRleHRBcnIucHVzaChhcnRpc3QuSXBJbmZvLnJlZ2lvbl9jb2RlKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYXJ0aXN0LklwSW5mbyAmJiBhcnRpc3QuSXBJbmZvLmNvdW50cnlfY29kZSkge1xuICAgICAgICAgIGNpdHlUZXh0QXJyLnB1c2goYXJ0aXN0LklwSW5mby5jb3VudHJ5X2NvZGUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb250ZXN0YW50LkNpdHlUZXh0ID0gY2l0eVRleHRBcnIuam9pbignLCAnKTtcbiAgICB9XG4gICAgbGV0IGVycm9yID0gZmFsc2U7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGNvbnRlc3RhbnQuc2F2ZSgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICBlcnJvciA9IHRydWU7XG4gICAgfVxuICAgIGlmIChyZWcpIHtcbiAgICAgIGlmICghZXJyb3IpIHtcbiAgICAgICAgcmVnLkFydGlzdCA9IGNvbnRlc3RhbnQ7XG4gICAgICAgIHJlZy5Jc0FydGlzdCA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGlmIChyZWcpIHtcbiAgICBhd2FpdCByZWcuc2F2ZSgpO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUNvbnRlc3RhbnQoYXJ0aXN0OiBBcnRpc3RBcHBzRG9jdW1lbnQpIHtcbiAgY29uc3QgZW50cnlJZCA9IHBhcnNlSW50KGFydGlzdC5FbnRyeUlkKTtcbiAgY29uc3QgZW1haWwgPSBhcnRpc3QuRW1haWw7XG4gIGlmICghYXJ0aXN0LkVtYWlsIHx8IGlzTmFOKGVudHJ5SWQpIHx8IGFydGlzdC5FbWFpbC5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4gO1xuICB9XG4gIGxldCBjb250ZXN0YW50O1xuICBjb250ZXN0YW50ID0gYXdhaXQgQ29udGVzdGFudE1vZGVsLmZpbmRPbmUoe0VtYWlsOiBlbWFpbCwgRW50cnlJZDogZW50cnlJZH0pO1xuICBjb25zb2xlLmxvZygnY3JlYXRlQ29udGVzdGFudCcsICdub3QgZm91bmQgYnkgZW1haWwgYW5kIGVudHJ5IGlkJywgIWNvbnRlc3RhbnQpO1xuICBpZiAoIWNvbnRlc3RhbnQpIHtcbiAgICBjb250ZXN0YW50ID0gYXdhaXQgQ29udGVzdGFudE1vZGVsLmZpbmRPbmUoe0VudHJ5SWQ6IGVudHJ5SWR9KTtcbiAgICBjb25zb2xlLmxvZygnY3JlYXRlQ29udGVzdGFudCcsICdub3QgZm91bmQgYnkgZW50cnkgaWQnLCAhY29udGVzdGFudCk7XG4gIH1cbiAgaWYgKCFjb250ZXN0YW50KSB7XG4gICAgY29udGVzdGFudCA9IGF3YWl0IENvbnRlc3RhbnRNb2RlbC5maW5kT25lKHtFbWFpbDogZW1haWx9KTtcbiAgICBjb25zb2xlLmxvZygnY3JlYXRlQ29udGVzdGFudCcsICdub3QgZm91bmQgYnkgZW1haWwnLCAhY29udGVzdGFudCk7XG4gIH1cbiAgaWYgKCFjb250ZXN0YW50KSB7XG4gICAgY29udGVzdGFudCA9IG5ldyBDb250ZXN0YW50TW9kZWwoKTtcbiAgfVxuICBpZiAoIWNvbnRlc3RhbnQuTmFtZSkge1xuICAgIGNvbnRlc3RhbnQuTmFtZSA9IGFydGlzdC5OYW1lO1xuICB9XG4gIGlmICghY29udGVzdGFudC5DaXR5VGV4dCkge1xuICAgIGNvbnN0IGNpdHlUZXh0QXJyID0gW107XG4gICAgaWYgKGFydGlzdC5DaXR5KSB7XG4gICAgICBjaXR5VGV4dEFyci5wdXNoKGFydGlzdC5DaXR5KTtcbiAgICB9XG4gICAgaWYgKGFydGlzdC5JcEluZm8gJiYgYXJ0aXN0LklwSW5mby5yZWdpb25fY29kZSkge1xuICAgICAgY2l0eVRleHRBcnIucHVzaChhcnRpc3QuSXBJbmZvLnJlZ2lvbl9jb2RlKTtcbiAgICB9XG4gICAgaWYgKGFydGlzdC5JcEluZm8gJiYgYXJ0aXN0LklwSW5mby5jb3VudHJ5X2NvZGUpIHtcbiAgICAgIGNpdHlUZXh0QXJyLnB1c2goYXJ0aXN0LklwSW5mby5jb3VudHJ5X2NvZGUpO1xuICAgIH1cbiAgICBjb250ZXN0YW50LkNpdHlUZXh0ID0gY2l0eVRleHRBcnIuam9pbignLCAnKTtcbiAgfVxuICBpZiAoIWNvbnRlc3RhbnQuRW1haWwpIHtcbiAgICBjb250ZXN0YW50LkVtYWlsID0gYXJ0aXN0LkVtYWlsO1xuICB9XG4gIGlmICghY29udGVzdGFudC5XZWJzaXRlKSB7XG4gICAgY29udGVzdGFudC5XZWJzaXRlID0gYXJ0aXN0LldlYnNpdGU7XG4gIH1cbiAgaWYgKCFjb250ZXN0YW50LkVudHJ5SWQpIHtcbiAgICBjb250ZXN0YW50LkVudHJ5SWQgPSBlbnRyeUlkO1xuICB9XG4gIGlmICghY29udGVzdGFudC5DaXR5KSB7XG4gICAgY29udGVzdGFudC5DaXR5ID0gYXdhaXQgZmluZE9yQ3JlYXRlQ2l0eShhcnRpc3QuSXBJbmZvKTtcbiAgfVxuICBpZiAoIUFycmF5LmlzQXJyYXkoY29udGVzdGFudC5DaGlsZENvbnRlc3RhbnRzKSkge1xuICAgIGNvbnRlc3RhbnQuQ2hpbGRDb250ZXN0YW50cyA9IFtdO1xuICB9XG4gIGlmICghY29udGVzdGFudC5Jc0R1cGxpY2F0ZSkge1xuICAgIGNvbnRlc3RhbnQuSXNEdXBsaWNhdGUgPSBmYWxzZTtcbiAgfVxuICBpZiAoIUFycmF5LmlzQXJyYXkoY29udGVzdGFudC5Gb2xsb3dlcnMpKSB7XG4gICAgY29udGVzdGFudC5Gb2xsb3dlcnMgPSBbXTtcbiAgfVxuICBhd2FpdCBjb250ZXN0YW50LnNhdmUoKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZmluZE9yQ3JlYXRlQ2l0eShpbmZvOiBJcEluZm8pIHtcbiAgaWYgKCFpbmZvKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuICBjb25zdCBjaXR5ID0gYXdhaXQgQ2l0eU1vZGVsLmZpbmRPbmUoe1xuICAgIE5hbWU6IGluZm8uY2l0eSxcbiAgICBDb3VudHJ5OiBpbmZvLmNvdW50cnlfbmFtZSxcbiAgICBSZWdpb246IGluZm8ucmVnaW9uX25hbWVcbiAgfSk7XG4gIGlmICghY2l0eSkge1xuICAgIGNvbnN0IGNpdHlNb2RlbCA9IG5ldyBDaXR5TW9kZWwoKTtcbiAgICBjaXR5TW9kZWwuTmFtZSA9IGluZm8uY2l0eTtcbiAgICBjaXR5TW9kZWwuQ291bnRyeSA9IGluZm8uY291bnRyeV9uYW1lO1xuICAgIGNpdHlNb2RlbC5SZWdpb25Db2RlID0gaW5mby5yZWdpb25fY29kZTtcbiAgICBjaXR5TW9kZWwuUmVnaW9uID0gaW5mby5yZWdpb25fbmFtZTtcbiAgICBjaXR5TW9kZWwuQ291bnRyeUNvZGUgPSBpbmZvLmNvdW50cnlfY29kZTtcbiAgICBhd2FpdCBjaXR5TW9kZWwuc2F2ZSgpO1xuICB9XG4gIHJldHVybiBjaXR5O1xufVxuLy8gbW9uZ29pbXBvcnQgLWQgdGVzdCAtYyBhcnRpc3RhcHBzIC0tdHlwZSBjc3YgLS1maWxlIH4vRG93bmxvYWRzLzEtcmVnaXN0ZXItYXMtYW4tYXJ0LWJhdHRsZS1jb21wZXRpdG9yLTIwMTktMTItMTYuY3N2ICAtLWhlYWRlcmxpbmVcbi8vICBkYi5hcnRpc3RhcHBzLnVwZGF0ZU1hbnkoe30sIHskc2V0OiB7UHJvY2Vzc2VkOiBmYWxzZX19KSJdfQ==
