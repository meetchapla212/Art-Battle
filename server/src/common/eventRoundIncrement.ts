import { default as EventModel, EventDocument } from '../models/Event';
import logger from '../config/logger';
import { default as User, UserDocument } from '../models/User';
import { DataOperationResult } from '../../../shared/OperationResult';
import { EventDTO } from '../../../shared/EventDTO';
import postToSlack from './Slack';
import { Request } from 'express';

export const EventIncrementRound = async function (req: Request, eventId: string, userId: string) {
    let event: EventDocument;

        event = await EventModel.findById(eventId);
        if (event.CurrentRound) { // if a round is running, complete it

            logger.info(`Closing round ${event.CurrentRound.RoundNumber}`);

            const currentRound = event.Rounds
                .find(r => r.RoundNumber == event.CurrentRound.RoundNumber);
            currentRound.IsFinished = true;
            // currentRound.Contestants = event.CurrentRound.Contestants;
            let totalVotes = 0;
            for (let i = 0; i < event.CurrentRound.Contestants.length; i++) {
                currentRound.Contestants[i].Enabled = event.CurrentRound.Contestants[i].Enabled;
                currentRound.Contestants[i].EaselNumber = event.CurrentRound.Contestants[i].EaselNumber;
                totalVotes += currentRound.Contestants[i].Votes.length;
            }

            event.CurrentRound = null;
            const user: UserDocument = await User.findById(userId);
            const message = `${event.Name}, Round ${currentRound.RoundNumber} is closed by ${user && user.email}, votes ${totalVotes}`;
            event.Logs.push({
                Message: message,
                CreatedDate: new Date()
            });
            const result = await event.save();
            const operationResult: DataOperationResult<EventDTO> = {
                Success: true,
                Data: result
            };
            // send message to slack channel
            postToSlack({
                'text': message
            }).catch(() => logger.info('close round slack call failed, message was ', message));

            return operationResult;
        }
        else {
            const availableRounds = event.Rounds.filter(r => !r.IsFinished);
            if (availableRounds.length > 0) { // if there are any rounds left, start the next one
                const nextRound = availableRounds.reduce((prev, cur) => {
                    return prev.RoundNumber < cur.RoundNumber ? prev : cur;
                });

                logger.info(`Starting round ${nextRound.RoundNumber}`);

                event.CurrentRound = nextRound;
                // After sending response send message to slack channel
                const user: UserDocument = await User.findById(userId);
                const message = `${event.Name}, Round ${nextRound.RoundNumber} is started by ${user && user.email}, registered: ${event.Registrations.length}`;
                event.Logs.push({
                    Message: message,
                    CreatedDate: new Date()
                });

                const result = await event.save();
                /*await EventModel.findOneAndUpdate({
                    _id: event._id
                }, event);

                const  result = await EventModel.findOne({
                    _id: event._id
                });*/
                const operationResult: DataOperationResult<EventDTO> = {
                    Success: true,
                    Data: result
                };

                postToSlack({
                    'text': message
                }).catch(() => logger.info('starting round slack call failed, message was ', message));
                const cacheKey = `app-event-list-`;
                const cacheDel = req.app.get('cacheDel');
                const cacheDelPromises = [];
                cacheDelPromises.push(cacheDel(`${cacheKey}${eventId}`));
                cacheDelPromises.push(cacheDel(cacheKey));
                await Promise.all(cacheDelPromises);
                return operationResult;
            }
            else { // loop if all rounds are finished.
                logger.info('Attempted to increment round on finished event. Looping rounds.');

                event.Rounds.forEach(r => r.IsFinished = false);
                event.CurrentRound = null;
                const user: UserDocument = await User.findById(userId);
                const message = `${event.Name} is finished but round is being started by ${user && user.email}`;
                event.Logs.push({
                    Message: message,
                    CreatedDate: new Date()
                });
                const result = await event.save();

                const operationResult: DataOperationResult<EventDTO> = {
                    Success: true,
                    Data: result
                };
                // After sending response send message to slack channel
                postToSlack({
                    'text': message
                }).catch(() => logger.info(' finish event, attempt to increment round call failed ', message));
                return operationResult;
                // logger.info('Attempted to increment round on finished event.');
                // const operationResult: OperationResult = {
                //     Success: false
                // };
                // res.json(operationResult);
            }
        }

};