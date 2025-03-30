import { Request, Response, NextFunction } from 'express';
// @ts-ignore
import { formatToTimeZone, parseFromTimeZone } from 'date-fns-timezone';
// @ts-ignore
import { differenceInMilliseconds, distanceInWordsStrict } from 'date-fns';

import { default as EventModel, EventDocument } from '../models/Event';
import { DataOperationResult, OperationResult } from '../../../shared/OperationResult';
import { EventList, EventsInterface } from '../../../shared/EventListResponseDTO';

import postToSlack from '../common/Slack';

import { default as EventPhoneNumberModel } from '../models/EventPhoneNumber';


export const getEventPhoneNumber = async (req: Request, res: Response, next: NextFunction) => {
   const query: {
      status: any;
   } = {
      status: 1,
   };

   const promises = [];
   const promise1 = EventPhoneNumberModel.find(query).select([
      '_id',
      'phone',
      'label',
      'type',
      'location',
      'status'
   ])
      .sort({
         'EventStartDateTime': -1
      }).exec();

   promises.push(promise1);
   const results = await Promise.all(promises);
   const activeEventsPhoneNumber = results[0];


   res.json(activeEventsPhoneNumber);
};

export const getEvents = async (req: Request, res: Response, next: NextFunction) => {

   const PhoneNumber = false;

   const eventId = req.query.eventName;
   const query: {
      ShowInApp: boolean;
      Name?: any;
   } = {
      ShowInApp: true,
   };
   if (eventId && eventId.length > 0) {
      query.Name = new RegExp(eventId);
   }
   const promises = [];
   const promise1 = EventModel.find(query).select([
      '_id',
      'EID',
      'Name',
      'CurrentRound',
      'Country',
      'Rounds',
      'EventStartDateTime',
      'TicketLink',
      'Venue',
      'Price',
      'Description',
      'EventEndDateTime',
      'TimeZoneICANN',
   ])
      .populate('Country')
      .populate('Rounds.Contestants.Votes')
      .sort({
         'EventStartDateTime': -1
      }).exec();

   promises.push(promise1);

   // past event list
   const results = await Promise.all(promises);
   const activeEvents = results[0];

   const activeEventsList: EventsInterface[] = [];

   for (let i = 0; i < activeEvents.length; i++) {
      const event = activeEvents[i];
      const currentRound = event.CurrentRound;
      const currentRoundNumber = currentRound && currentRound.RoundNumber;
      let numVotes = 0;
      let roundText = '';
      let roundColor = '';
      let statusTextColor = '#FFF';
      const totalRounds = event.Rounds.length;
      let hasOpenRound = false;
      for (let j = 0; j < totalRounds; j++) {
         const Round = event.Rounds[j];
         if (!Round.IsFinished) {
            hasOpenRound = true;
         }
         const contestants = Round.Contestants;
         for (let k = 0; k < contestants.length; k++) {
            numVotes += contestants[k].Votes.length;
         }
      }

      if (currentRoundNumber) {
         roundText = `LIVE`;
         roundColor = '#D14B19';
      } else {
         if (hasOpenRound) {
            const eventDate = new Date(event.EventStartDateTime);
            const differenceInMs = differenceInMilliseconds(eventDate, new Date());
            const distanceInWord = distanceInWordsStrict(eventDate, new Date());
            if (differenceInMs > 0) {
               roundText = `In ${distanceInWord}`;
               roundColor = '#1975D1';
               roundText = roundText.replace('days', 'd');
               roundText = roundText.replace('seconds', 's');
               roundText = roundText.replace('hours', 'h');
               roundText = roundText.replace('minutes', 'm');
               roundText = roundText.replace('months', 'mo');
               roundText = roundText.replace('years', 'y');
            } else {
               roundText = `Starting soon`;
               roundColor = '#1975D1';
            }
         } else {
            roundText = 'FINAL';
            roundColor = '#FFF';
            statusTextColor = '#000';
         }
      }
      const eventObj = {
         id: event._id,
         EID: event.EID || '',
         title: event.Name,
         flag: event.Country ? `${process.env.SITE_URL}/images/countries/4x3/${event.Country.country_image}` : '',
         flagPng: event.Country ? `${process.env.SITE_URL}/images/countries/4x3_png/${event.Country.country_image.replace('svg', 'png')}` : '',
         statusText: roundText,
         statusColor: roundColor,
         statusTextColor: statusTextColor,
         eventId: event.id,
         openVoting: false,
         openStatus: false,
         TicketLink: event.TicketLink || '',
         Venue: event.Venue || '',
         Price: event.Price || '',
         Description: event.Description,
         DataTimeRange: formatToTimeZone(new Date(event.EventStartDateTime), 'MMMMDo-hmmaz', { timeZone: event.TimeZoneICANN || 'America/Toronto' }),
         Votes: numVotes,
         EventNo: i + 1,
         StreamUrl: event.VideoStream || event.LiveStream
      };
      activeEventsList.push(eventObj);
   }

   const eventList: EventList[] = [
      {
         label: 'ACTIVE EVENTS',
         items: activeEventsList,
         topPlayerUrl: ''
      }
   ];

   const result: DataOperationResult<EventList[]> = {
      'Success': true,
      Data: eventList
   };

   res.json(activeEventsList);
};

