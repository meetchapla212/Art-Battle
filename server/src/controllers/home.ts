import { Request, Response } from 'express';
import EventPhoneNumberModel from '../models/EventPhoneNumber';
import CountryModel from '../models/Country';
import TimezoneModel from '../models/Timezone';
import { ShortUrlGenerator } from '../common/ShortUrlGenerator';
import logger from '../config/logger';
import CityModel from '../models/City';

/**
 * GET /
 * Home page.
 */
export let index = async (req: Request, res: Response) => {
  const results = await Promise.all([
    EventPhoneNumberModel.find({
      type: 'vote',
      status: 1
    }),
    CountryModel.find({}),
    TimezoneModel.find({}),
      CityModel.find({Name: {$nin: [null, '']} }).sort({Name: 1})
  ]);
  // logger.info('req.user', req.user);
  const phoneNumbers = results[0];
  const filteredPhoneNumbers = phoneNumbers.map((phoneNumber) => {
    return phoneNumber.toJSON();
  });
  res.render('home', {
    title: 'Home',
    phoneNumbersList: filteredPhoneNumbers,
    Countries: results[1],
    Timezones: results[2],
    Cities: results[3],
    user: req.user
  });
};

export let handleShortUrl = async (req: Request, res: Response) => {
  try {
    const shortUrlHash = req.params.ShortUrlHash;
    const shortUrlModel = await new ShortUrlGenerator().getOriginalUrl(shortUrlHash);
    if (shortUrlModel) {
      res.status(301).redirect(shortUrlModel.URL);
    } else {
      res.status(404);
      res.json({'Message': 'Invalid short URL'});
    }
  } catch (e) {
    res.status(500);
    logger.error(e);
    res.json({'Message': 'Internal Server Error'});
  }
};
