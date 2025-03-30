import loadApp from './bootstrap';
import ArtistApps, { ArtistAppsDocument } from '../models/ArtistApps';
import { PhoneNumberUtil } from 'google-libphonenumber';
import RegistrationModel, { RegistrationDocument } from '../models/Registration';
import ContestantModel from '../models/Contestant';
import CityModel from '../models/City';
import { IpInfo } from '../../../shared/ArtistAppsDTO';

const uniqueId = require('uniqid');
let mongoose: typeof import('mongoose');
loadApp().then((obj) => {
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
import got = require('got');

async function start() {
  return processArtists();
}

async function processArtists(): Promise<any> {
  const artists = await _findArtists(0, 100000);
  for (let i = 0; i < artists.length; i++) {
    let isValidPhone = false;
    const artistObj = artists[i].toObject();
    const newObj: {[key: string]: string} = {};
    Object.keys(artistObj).forEach((key) => {
      const value = artistObj[key];
      newObj[_trimAndReplace(key)] = _trimAndReplace('' + value);
    });
    const ip = _trimAndReplace(newObj['User IP']);
    const artist = artists[i];
    let userRegionCode;
    const entryDate = new Date(newObj['Entry Date']);
    // newObj.IpInfo = resBody;
    artist.Name =  newObj['Your Name'];
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
        parsedNumber = PhoneNumberUtil.getInstance().parse(artist.PhoneNumber);
        isValidPhone = true;
      } catch (e) {
        console.error('Invalid number', e);
      }
      if (parsedNumber && PhoneNumberUtil.getInstance().isValidNumber(parsedNumber)) {
        artist.PhoneNumber = `+${parsedNumber.getCountryCode()}${parsedNumber.getNationalNumber()}`;
        userRegionCode = PhoneNumberUtil.getInstance().getRegionCodeForNumber(parsedNumber);
        linkArtist = true;
        isValidPhone = true;
      } else {
        console.error('Invalid number error', artist.PhoneNumber);
        artist.PhoneNumber = undefined;
      }
      await artist.save();
    } else {
      let parsedNumber;
      try {
        parsedNumber = PhoneNumberUtil.getInstance().parse(artist.PhoneNumber, artist.IpInfo && artist.IpInfo.country_code);
        isValidPhone = true;
      } catch (e) {
        console.error('Invalid number error', e);
      }
      if (artist.IpInfo && parsedNumber && PhoneNumberUtil.getInstance().isValidNumberForRegion(parsedNumber, artist.IpInfo && artist.IpInfo.country_code)) {
        userRegionCode = PhoneNumberUtil.getInstance().getRegionCodeForNumber(parsedNumber);
        console.log('phone no does not start with +');
        artist.PhoneNumber = `+${parsedNumber.getCountryCode()}${parsedNumber.getNationalNumber()}`;
        linkArtist = true;
      } else {
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
      const reg = await RegistrationModel.findOne({PhoneNumber: artist.PhoneNumber});
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
      } else {
        let savedReg;
        if (artist.PhoneNumber) {
          // Register new user
          const registration = new RegistrationModel({
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
    } else {
      await createContestant(artist);
    }

  }
  if (artists.length === 1000) {
    console.log('processing more 1000');
    return processArtists();
  }
}

async function _ipToCountry(ip: string) {
  if (ip) {
    let ipResult;
    // const ipResult = await got(`http://api.ipstack.com/${ip}?access_key=b5ce16e3859ce336d9553060031fa02a`);
    try {
      ipResult = await got(`https://freegeoip.app/json/${ip}`);
    } catch (e) {
      console.error('api error');
    }
    if (ipResult && ipResult.statusCode !== 200) {
      console.error('need a new key', ipResult.body);
    } else {
      return ipResult && JSON.parse(ipResult.body);
    }
  } else {
    console.error('no ip found');
  }
}

function _trimAndReplace(str: string) {
  if (str && typeof str === 'string') {
    str = str.replace(/"/g, '');
    str = str.replace(/'/g, '');
    return str.trim();
  } else {
    console.error(str);
  }
}
// 5dfb5d4682d07bcba040acea
async function _findArtists(offset = 0, length = 1000) {
  return ArtistApps.find(
     {Processed: {$in: [null, false]}}
    // {Email: 'meaghanckehoe@gmail.com'}
      // {'Entry Id': 84606}
  ).skip(offset).limit(length).exec();
}

async function linkContestant(reg: RegistrationDocument, artist: ArtistAppsDocument) {
  let contestant;
  if (reg) {
    console.log('contestant with matching registration found', reg._id);
    contestant = await ContestantModel.findOne({Registration: reg._id});
  }
  console.log('entry', artist.EntryId, artist['Entry Id']);
  const entryId = parseInt(artist.EntryId);
  if (!isNaN(entryId) && entryId.toString().length !== artist.EntryId.length) {
    console.error('potential invalid entry id in', artist, entryId.toString().length, artist.EntryId.length);
  }
  console.log('entryId', entryId);
  const email = (reg && reg.Email) || artist.Email;
  if (!contestant && email && email.length > 0) {
    contestant = await ContestantModel.findOne({Email: email, EntryId: entryId});
    console.log('contestant with matching email and entry found', !contestant);
  }
  if (!contestant && email && email.length > 0) {
    contestant = await ContestantModel.findOne({Email: email});
    console.log('contestant with matching email found', email, !contestant);
  }
  if (!contestant && !isNaN(entryId)) {
    contestant = await ContestantModel.findOne({EntryId: entryId});
    console.log('contestant with matching entryid found', entryId, !contestant);
  }
  if (!contestant && reg && reg.PhoneNumber.length > 0) {
    contestant = await ContestantModel.findOne({PhoneNumber: reg.PhoneNumber});
    console.log('contestant with matching reg.PhoneNumber found', reg.PhoneNumber, !contestant);
  }
  if (!contestant) {
    console.log('creating contestant from scratch', artist);
    contestant = new ContestantModel();
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
    contestant.PhoneNumber =  artist.PhoneNumber || (reg && reg.PhoneNumber);
    contestant.City = await findOrCreateCity(artist.IpInfo);
    contestant.ChildContestants = [];
    contestant.IsDuplicate = false;
    const savedContestant = await contestant.save();
    contestant.Followers = [];
    if (reg) {
      reg.Artist = savedContestant;
      reg.IsArtist = true;
    }
  } else {
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
    } catch (e) {
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

async function createContestant(artist: ArtistAppsDocument) {
  const entryId = parseInt(artist.EntryId);
  const email = artist.Email;
  if (!artist.Email || isNaN(entryId) || artist.Email.length === 0) {
    return ;
  }
  let contestant;
  contestant = await ContestantModel.findOne({Email: email, EntryId: entryId});
  console.log('createContestant', 'not found by email and entry id', !contestant);
  if (!contestant) {
    contestant = await ContestantModel.findOne({EntryId: entryId});
    console.log('createContestant', 'not found by entry id', !contestant);
  }
  if (!contestant) {
    contestant = await ContestantModel.findOne({Email: email});
    console.log('createContestant', 'not found by email', !contestant);
  }
  if (!contestant) {
    contestant = new ContestantModel();
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

async function findOrCreateCity(info: IpInfo) {
  if (!info) {
    return undefined;
  }
  const city = await CityModel.findOne({
    Name: info.city,
    Country: info.country_name,
    Region: info.region_name
  });
  if (!city) {
    const cityModel = new CityModel();
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