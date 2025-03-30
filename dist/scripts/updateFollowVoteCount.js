"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bootstrap_1 = require("./bootstrap");
const VotingLog_1 = require("../models/VotingLog");
const Contestant_1 = require("../models/Contestant");
const Event_1 = require("../models/Event");
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
async function start() {
    await updateVoteCount();
    await updateFollowersCount();
}
async function updateVoteCount() {
    const votingLog = await VotingLog_1.default.find({
        Status: 'VOTE_ACCEPTED'
    });
    for (let i = 0; i < votingLog.length; i++) {
        const log = votingLog[i];
        if (log.Contestant) {
            const contestant = await Contestant_1.default.findById(log.Contestant);
            const initialVoteCount = contestant.VotesCount || 0;
            contestant.VotesCount = initialVoteCount + 1;
            await contestant.save();
        }
        else {
            const event = await Event_1.default.findById(log.EventId);
            for (let i = 0; i < event.Rounds.length; i++) {
                const round = event.Rounds[i];
                // @ts-ignore
                if (parseInt(round.RoundNumber) === parseInt(log.RoundNumber)) {
                    for (let j = 0; j < round.Contestants.length; j++) {
                        const contestant = round.Contestants[j];
                        // @ts-ignore
                        if (parseInt(contestant.EaselNumber) === parseInt(log.EaselNumber)) {
                            log.Contestant = contestant.Detail;
                            await log.save();
                            const contestantM = await Contestant_1.default.findById(contestant.Detail);
                            const initialVoteCount = contestantM.VotesCount || 0;
                            contestantM.VotesCount = initialVoteCount + 1;
                            await contestantM.save();
                            break;
                        }
                    }
                }
            }
        }
    }
}
async function updateFollowersCount() {
    const contestants = await Contestant_1.default.find();
    for (let i = 0; i < contestants.length; i++) {
        const contestant = contestants[i];
        contestant.FollowersCount = contestant.Followers && contestant.Followers.length || 0;
        contestant.Score = contestant.FollowersCount + contestant.VotesCount;
        await contestant.save();
    }
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNjcmlwdHMvdXBkYXRlRm9sbG93Vm90ZUNvdW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsMkNBQWtDO0FBQ2xDLG1EQUF3RTtBQUN4RSxxREFBbUQ7QUFDbkQsMkNBQXlDO0FBQ3pDLElBQUksUUFBbUMsQ0FBQztBQUN4QyxtQkFBTyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUU7SUFDbkIsUUFBUSxHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUM7SUFDeEIsT0FBTyxLQUFLLEVBQUUsQ0FBQztBQUNuQixDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFO0lBQ1QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNwQixPQUFPLFFBQVEsQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDdkMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFO0lBQ1QsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNqQixJQUFJLFFBQVEsQ0FBQyxVQUFVLEVBQUU7UUFDckIsT0FBTyxRQUFRLENBQUMsVUFBVSxDQUFDLEtBQUssRUFBRSxDQUFDO0tBQ3RDO0FBQ0wsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRTtJQUNULE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztBQUNsQyxDQUFDLENBQUMsQ0FBQztBQUVILEtBQUssVUFBVSxLQUFLO0lBQ2hCLE1BQU0sZUFBZSxFQUFFLENBQUM7SUFDeEIsTUFBTSxvQkFBb0IsRUFBRSxDQUFDO0FBQ2pDLENBQUM7QUFFRCxLQUFLLFVBQVUsZUFBZTtJQUMxQixNQUFNLFNBQVMsR0FBRyxNQUFNLG1CQUFjLENBQUMsSUFBSSxDQUFDO1FBQ3hDLE1BQU0sRUFBRSxlQUFlO0tBQzFCLENBQUMsQ0FBQztJQUNILEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1FBQ3ZDLE1BQU0sR0FBRyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN6QixJQUFJLEdBQUcsQ0FBQyxVQUFVLEVBQUU7WUFDaEIsTUFBTSxVQUFVLEdBQUcsTUFBTSxvQkFBZSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDbEUsTUFBTSxnQkFBZ0IsR0FBRyxVQUFVLENBQUMsVUFBVSxJQUFJLENBQUMsQ0FBQztZQUNwRCxVQUFVLENBQUMsVUFBVSxHQUFHLGdCQUFnQixHQUFHLENBQUMsQ0FBQztZQUM3QyxNQUFNLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztTQUMzQjthQUFNO1lBQ0gsTUFBTSxLQUFLLEdBQUcsTUFBTSxlQUFVLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNyRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQzFDLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzlCLGFBQWE7Z0JBQ2IsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxLQUFLLFFBQVEsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUU7b0JBQzNELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTt3QkFDL0MsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDeEMsYUFBYTt3QkFDYixJQUFJLFFBQVEsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLEtBQUssUUFBUSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRTs0QkFDaEUsR0FBRyxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDOzRCQUNuQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQzs0QkFDakIsTUFBTSxXQUFXLEdBQUcsTUFBTSxvQkFBZSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUM7NEJBQ3RFLE1BQU0sZ0JBQWdCLEdBQUcsV0FBVyxDQUFDLFVBQVUsSUFBSSxDQUFDLENBQUM7NEJBQ3JELFdBQVcsQ0FBQyxVQUFVLEdBQUcsZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDOzRCQUM5QyxNQUFNLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQzs0QkFDekIsTUFBTTt5QkFDVDtxQkFDSjtpQkFDSjthQUNKO1NBQ0o7S0FDSjtBQUNMLENBQUM7QUFFRCxLQUFLLFVBQVUsb0JBQW9CO0lBQy9CLE1BQU0sV0FBVyxHQUFHLE1BQU0sb0JBQWUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUNqRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUN6QyxNQUFNLFVBQVUsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEMsVUFBVSxDQUFDLGNBQWMsR0FBRyxVQUFVLENBQUMsU0FBUyxJQUFJLFVBQVUsQ0FBQyxTQUFTLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztRQUNyRixVQUFVLENBQUMsS0FBSyxHQUFHLFVBQVUsQ0FBQyxjQUFjLEdBQUcsVUFBVSxDQUFDLFVBQVUsQ0FBQztRQUNyRSxNQUFNLFVBQVUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztLQUMzQjtBQUNMLENBQUMiLCJmaWxlIjoic2NyaXB0cy91cGRhdGVGb2xsb3dWb3RlQ291bnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgbG9hZEFwcCBmcm9tICcuL2Jvb3RzdHJhcCc7XG5pbXBvcnQgVm90aW5nTG9nTW9kZWwsIHsgVm90aW5nTG9nRG9jdW1lbnQgfSBmcm9tICcuLi9tb2RlbHMvVm90aW5nTG9nJztcbmltcG9ydCBDb250ZXN0YW50TW9kZWwgZnJvbSAnLi4vbW9kZWxzL0NvbnRlc3RhbnQnO1xuaW1wb3J0IEV2ZW50TW9kZWwgZnJvbSAnLi4vbW9kZWxzL0V2ZW50JztcbmxldCBtb25nb29zZTogdHlwZW9mIGltcG9ydCgnbW9uZ29vc2UnKTtcbmxvYWRBcHAoKS50aGVuKChvYmopID0+IHtcbiAgICBtb25nb29zZSA9IG9iai5tb25nb29zZTtcbiAgICByZXR1cm4gc3RhcnQoKTtcbn0pLnRoZW4oKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdkb25lJyk7XG4gICAgcmV0dXJuIG1vbmdvb3NlLmNvbm5lY3Rpb24uY2xvc2UoKTtcbn0pLmNhdGNoKGUgPT57XG4gICAgY29uc29sZS5lcnJvcihlKTtcbiAgICBpZiAobW9uZ29vc2UuY29ubmVjdGlvbikge1xuICAgICAgICByZXR1cm4gbW9uZ29vc2UuY29ubmVjdGlvbi5jbG9zZSgpO1xuICAgIH1cbn0pLnRoZW4oKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdjbG9zZWQgZGIgY29ubicpO1xufSk7XG5cbmFzeW5jIGZ1bmN0aW9uIHN0YXJ0KCkge1xuICAgIGF3YWl0IHVwZGF0ZVZvdGVDb3VudCgpO1xuICAgIGF3YWl0IHVwZGF0ZUZvbGxvd2Vyc0NvdW50KCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHVwZGF0ZVZvdGVDb3VudCgpIHtcbiAgICBjb25zdCB2b3RpbmdMb2cgPSBhd2FpdCBWb3RpbmdMb2dNb2RlbC5maW5kKHtcbiAgICAgICAgU3RhdHVzOiAnVk9URV9BQ0NFUFRFRCdcbiAgICB9KTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZvdGluZ0xvZy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBsb2cgPSB2b3RpbmdMb2dbaV07XG4gICAgICAgIGlmIChsb2cuQ29udGVzdGFudCkge1xuICAgICAgICAgICAgY29uc3QgY29udGVzdGFudCA9IGF3YWl0IENvbnRlc3RhbnRNb2RlbC5maW5kQnlJZChsb2cuQ29udGVzdGFudCk7XG4gICAgICAgICAgICBjb25zdCBpbml0aWFsVm90ZUNvdW50ID0gY29udGVzdGFudC5Wb3Rlc0NvdW50IHx8IDA7XG4gICAgICAgICAgICBjb250ZXN0YW50LlZvdGVzQ291bnQgPSBpbml0aWFsVm90ZUNvdW50ICsgMTtcbiAgICAgICAgICAgIGF3YWl0IGNvbnRlc3RhbnQuc2F2ZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgZXZlbnQgPSBhd2FpdCBFdmVudE1vZGVsLmZpbmRCeUlkKGxvZy5FdmVudElkKTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXZlbnQuUm91bmRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgcm91bmQgPSBldmVudC5Sb3VuZHNbaV07XG4gICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICAgIGlmIChwYXJzZUludChyb3VuZC5Sb3VuZE51bWJlcikgPT09IHBhcnNlSW50KGxvZy5Sb3VuZE51bWJlcikpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCByb3VuZC5Db250ZXN0YW50cy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY29udGVzdGFudCA9IHJvdW5kLkNvbnRlc3RhbnRzW2pdO1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBhcnNlSW50KGNvbnRlc3RhbnQuRWFzZWxOdW1iZXIpID09PSBwYXJzZUludChsb2cuRWFzZWxOdW1iZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nLkNvbnRlc3RhbnQgPSBjb250ZXN0YW50LkRldGFpbDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBsb2cuc2F2ZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRlc3RhbnRNID0gYXdhaXQgQ29udGVzdGFudE1vZGVsLmZpbmRCeUlkKGNvbnRlc3RhbnQuRGV0YWlsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBpbml0aWFsVm90ZUNvdW50ID0gY29udGVzdGFudE0uVm90ZXNDb3VudCB8fCAwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlc3RhbnRNLlZvdGVzQ291bnQgPSBpbml0aWFsVm90ZUNvdW50ICsgMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBjb250ZXN0YW50TS5zYXZlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUZvbGxvd2Vyc0NvdW50KCkge1xuICAgIGNvbnN0IGNvbnRlc3RhbnRzID0gYXdhaXQgQ29udGVzdGFudE1vZGVsLmZpbmQoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvbnRlc3RhbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGNvbnRlc3RhbnQgPSBjb250ZXN0YW50c1tpXTtcbiAgICAgICAgY29udGVzdGFudC5Gb2xsb3dlcnNDb3VudCA9IGNvbnRlc3RhbnQuRm9sbG93ZXJzICYmIGNvbnRlc3RhbnQuRm9sbG93ZXJzLmxlbmd0aCB8fCAwO1xuICAgICAgICBjb250ZXN0YW50LlNjb3JlID0gY29udGVzdGFudC5Gb2xsb3dlcnNDb3VudCArIGNvbnRlc3RhbnQuVm90ZXNDb3VudDtcbiAgICAgICAgYXdhaXQgY29udGVzdGFudC5zYXZlKCk7XG4gICAgfVxufSJdfQ==
