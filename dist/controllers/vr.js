"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Vote = exports.loadRoundInEvent = exports.staticContent = void 0;
const fs = require("fs");
const Event_1 = require("../models/Event");
const logger_1 = require("../config/logger");
/**
 * GET /api/vr/static
 * Static content for the VR
 */
exports.staticContent = (req, res) => {
    res.setHeader('content-type', 'application/json');
    fs.createReadStream(`vrStatic.json`).pipe(res);
};
exports.loadRoundInEvent = async (req, res, next) => {
    try {
        const eventNo = req.params.eventPageNo;
        const roundPageNo = req.params.roundPageNo;
        const event = await Event_1.default.findOne({
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
            'EventStartDateTime': -1
        });
        if (!event) {
            next({
                status: 400,
                message: 'event not found',
                code: 'event_not_found'
            });
            return;
        }
        let selectedRoundObj;
        let nextRoundNo = -1;
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
            return;
        }
        const Easels = [];
        for (let i = 0; i < selectedRoundObj.Contestants.length; i++) {
            const contestant = selectedRoundObj.Contestants[i];
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
    }
    catch (e) {
        next(e);
    }
};
exports.Vote = async (req, res, next) => {
    logger_1.default.info('body', req.body);
    logger_1.default.info('event', req.params.eventId);
    logger_1.default.info('user', req.params.userId);
    logger_1.default.info('round', req.params.round);
    logger_1.default.info('easel', req.params.easel);
    res.json({
        Success: true,
        Message: 'Acknowledged'
    });
};

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDdkMsR0FBRyxDQUFDLElBQUksQ0FBQztRQUNQLE9BQU8sRUFBRSxJQUFJO1FBQ2IsT0FBTyxFQUFFLGNBQWM7S0FDeEIsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDIiwiZmlsZSI6ImNvbnRyb2xsZXJzL3ZyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTmV4dEZ1bmN0aW9uLCBSZXF1ZXN0LCBSZXNwb25zZSB9IGZyb20gJ2V4cHJlc3MnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IEV2ZW50TW9kZWwgZnJvbSAnLi4vbW9kZWxzL0V2ZW50JztcbmltcG9ydCBSb3VuZERUTyBmcm9tICcuLi8uLi8uLi9zaGFyZWQvUm91bmREVE8nO1xuaW1wb3J0IGxvZ2dlciBmcm9tICcuLi9jb25maWcvbG9nZ2VyJztcbi8qKlxuICogR0VUIC9hcGkvdnIvc3RhdGljXG4gKiBTdGF0aWMgY29udGVudCBmb3IgdGhlIFZSXG4gKi9cbmV4cG9ydCBsZXQgc3RhdGljQ29udGVudCA9IChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UpID0+IHtcbiAgcmVzLnNldEhlYWRlcignY29udGVudC10eXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgZnMuY3JlYXRlUmVhZFN0cmVhbShgdnJTdGF0aWMuanNvbmApLnBpcGUocmVzKTtcbn07XG5cbmV4cG9ydCBsZXQgbG9hZFJvdW5kSW5FdmVudCA9IGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IGV2ZW50Tm8gPSByZXEucGFyYW1zLmV2ZW50UGFnZU5vO1xuICAgIGNvbnN0IHJvdW5kUGFnZU5vID0gcmVxLnBhcmFtcy5yb3VuZFBhZ2VObztcbiAgICBjb25zdCBldmVudCA9IGF3YWl0IEV2ZW50TW9kZWwuZmluZE9uZSh7XG4gICAgICBTaG93SW5BcHA6IHRydWVcbiAgICAgIC8qJ0V2ZW50U3RhcnRUaW1lJyA6IHtcbiAgICAgICAgICAnJGd0JzogbmV3IERhdGUoKVxuICAgICAgfSovXG4gICAgfSkuc2VsZWN0KFtcbiAgICAgICAnRUlEJyxcbiAgICAgICdfaWQnLFxuICAgICAgJ05hbWUnLFxuICAgICAgJ1JvdW5kcydcbiAgICBdKVxuICAgICAgICAucG9wdWxhdGUoJ1JvdW5kcy5Db250ZXN0YW50cy5EZXRhaWwnKVxuICAgICAgICAubGltaXQoMSlcbiAgICAgICAgLnNraXAoZXZlbnRObyAtIDEpXG4gICAgICAgIC5zb3J0KHtcbiAgICAgICAgICAnRXZlbnRTdGFydERhdGVUaW1lJyA6IC0xXG4gICAgICAgIH0pO1xuICAgIGlmICghZXZlbnQpIHtcbiAgICAgIG5leHQoe1xuICAgICAgICBzdGF0dXM6IDQwMCxcbiAgICAgICAgbWVzc2FnZTogJ2V2ZW50IG5vdCBmb3VuZCcsXG4gICAgICAgIGNvZGU6ICdldmVudF9ub3RfZm91bmQnXG4gICAgICB9KTtcbiAgICAgIHJldHVybiA7XG4gICAgfVxuICAgIGxldCBzZWxlY3RlZFJvdW5kT2JqOiBSb3VuZERUTztcbiAgICBsZXQgbmV4dFJvdW5kTm86IG51bWJlciA9IC0xO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXZlbnQuUm91bmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoZXZlbnQuUm91bmRzW2ldLlJvdW5kTnVtYmVyID09PSBwYXJzZUludChyb3VuZFBhZ2VObykpIHtcbiAgICAgICAgc2VsZWN0ZWRSb3VuZE9iaiA9IGV2ZW50LlJvdW5kc1tpXTtcbiAgICAgIH1cbiAgICAgIGlmIChzZWxlY3RlZFJvdW5kT2JqICYmIChldmVudC5Sb3VuZHNbaV0uUm91bmROdW1iZXIgPiBzZWxlY3RlZFJvdW5kT2JqLlJvdW5kTnVtYmVyKSkge1xuICAgICAgICBuZXh0Um91bmRObyA9IGV2ZW50LlJvdW5kc1tpXS5Sb3VuZE51bWJlcjtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghc2VsZWN0ZWRSb3VuZE9iaikge1xuICAgICAgbmV4dCh7XG4gICAgICAgIHN0YXR1czogNDAwLFxuICAgICAgICBtZXNzYWdlOiAncm91bmQgbnVtYmVyIG5vdCBmb3VuZCcsXG4gICAgICAgIGNvZGU6ICdyb3VuZF9ub3RfZm91bmQnXG4gICAgICB9KTtcbiAgICAgIHJldHVybiA7XG4gICAgfVxuICAgIGNvbnN0IEVhc2VscyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2VsZWN0ZWRSb3VuZE9iai5Db250ZXN0YW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgY29uc3QgY29udGVzdGFudCA9ICBzZWxlY3RlZFJvdW5kT2JqLkNvbnRlc3RhbnRzW2ldO1xuICAgICAgaWYgKGNvbnRlc3RhbnQuRW5hYmxlZCAmJiBjb250ZXN0YW50LkVhc2VsTnVtYmVyID4gMCkge1xuICAgICAgICBFYXNlbHMucHVzaCh7XG4gICAgICAgICAgTmFtZTogY29udGVzdGFudC5EZXRhaWwuTmFtZSxcbiAgICAgICAgICBFYXNlbE51bWJlcjogY29udGVzdGFudC5FYXNlbE51bWJlcixcbiAgICAgICAgICBJbWFnZXM6IGNvbnRlc3RhbnQuSW1hZ2VzLFxuICAgICAgICAgIENvdmVySW1hZ2U6IGNvbnRlc3RhbnQuSW1hZ2VzW2NvbnRlc3RhbnQuSW1hZ2VzLmxlbmd0aCAtIDFdXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCByZXNwb25zZSA9IHtcbiAgICAgICdfaWQnOiBldmVudC5faWQsXG4gICAgICAnRUlEJzogZXZlbnQuRUlELFxuICAgICAgJ0V2ZW50TmFtZSc6IGV2ZW50Lk5hbWUsXG4gICAgICAnUm91bmQnOiBzZWxlY3RlZFJvdW5kT2JqLlJvdW5kTnVtYmVyLFxuICAgICAgJ0Vhc2Vscyc6IEVhc2VscyxcbiAgICAgICdOZXh0Um91bmRObyc6IG5leHRSb3VuZE5vXG4gICAgfTtcbiAgICByZXMuanNvbihyZXNwb25zZSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBuZXh0KGUpO1xuICB9XG59O1xuXG5leHBvcnQgY29uc3QgVm90ZSA9IGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UsIG5leHQ6IE5leHRGdW5jdGlvbikgPT4ge1xuICBsb2dnZXIuaW5mbygnYm9keScsIHJlcS5ib2R5KTtcbiAgbG9nZ2VyLmluZm8oJ2V2ZW50JywgcmVxLnBhcmFtcy5ldmVudElkKTtcbiAgbG9nZ2VyLmluZm8oJ3VzZXInLCByZXEucGFyYW1zLnVzZXJJZCk7XG4gIGxvZ2dlci5pbmZvKCdyb3VuZCcsIHJlcS5wYXJhbXMucm91bmQpO1xuICBsb2dnZXIuaW5mbygnZWFzZWwnLCByZXEucGFyYW1zLmVhc2VsKTtcbiAgcmVzLmpzb24oe1xuICAgIFN1Y2Nlc3M6IHRydWUsXG4gICAgTWVzc2FnZTogJ0Fja25vd2xlZGdlZCdcbiAgfSk7XG59OyJdfQ==
