import { NextFunction, Request, Response } from 'express';
import * as fs from 'fs';
import EventModel from '../models/Event';
import RoundDTO from '../../../shared/RoundDTO';
import logger from '../config/logger';
/**
 * GET /api/vr/static
 * Static content for the VR
 */
export let staticContent = (req: Request, res: Response) => {
  res.setHeader('content-type', 'application/json');
  fs.createReadStream(`vrStatic.json`).pipe(res);
};

export let loadRoundInEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eventNo = req.params.eventPageNo;
    const roundPageNo = req.params.roundPageNo;
    const event = await EventModel.findOne({
      ShowInApp: true
      /*'EventStartTime' : {
          '$gt': new Date()
      }*/
    }).select([
       'EID',
      '_id',
      'Name',
      'Rounds'
    ])
        .populate('Rounds.Contestants.Detail')
        .limit(1)
        .skip(eventNo - 1)
        .sort({
          'EventStartDateTime' : -1
        });
    if (!event) {
      next({
        status: 400,
        message: 'event not found',
        code: 'event_not_found'
      });
      return ;
    }
    let selectedRoundObj: RoundDTO;
    let nextRoundNo: number = -1;
    for (let i = 0; i < event.Rounds.length; i++) {
      if (event.Rounds[i].RoundNumber === parseInt(roundPageNo)) {
        selectedRoundObj = event.Rounds[i];
      }
      if (selectedRoundObj && (event.Rounds[i].RoundNumber > selectedRoundObj.RoundNumber)) {
        nextRoundNo = event.Rounds[i].RoundNumber;
        break;
      }
    }
    if (!selectedRoundObj) {
      next({
        status: 400,
        message: 'round number not found',
        code: 'round_not_found'
      });
      return ;
    }
    const Easels = [];
    for (let i = 0; i < selectedRoundObj.Contestants.length; i++) {
      const contestant =  selectedRoundObj.Contestants[i];
      if (contestant.Enabled && contestant.EaselNumber > 0) {
        Easels.push({
          Name: contestant.Detail.Name,
          EaselNumber: contestant.EaselNumber,
          Images: contestant.Images,
          CoverImage: contestant.Images[contestant.Images.length - 1]
        });
      }
    }
    const response = {
      '_id': event._id,
      'EID': event.EID,
      'EventName': event.Name,
      'Round': selectedRoundObj.RoundNumber,
      'Easels': Easels,
      'NextRoundNo': nextRoundNo
    };
    res.json(response);
  } catch (e) {
    next(e);
  }
};

export const Vote = async (req: Request, res: Response, next: NextFunction) => {
  logger.info('body', req.body);
  logger.info('event', req.params.eventId);
  logger.info('user', req.params.userId);
  logger.info('round', req.params.round);
  logger.info('easel', req.params.easel);
  res.json({
    Success: true,
    Message: 'Acknowledged'
  });
};