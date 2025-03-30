"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uniqid = require('uniqid');
const Event_1 = require("../models/Event");
/* Forceful import */
const bootstrap_1 = require("./bootstrap");
const Contestant_1 = require("../models/Contestant");
console.log(typeof bootstrap_1.default, typeof Contestant_1.default);
/* Forceful import end */
const Registration_1 = require("../models/Registration");
const VotingLog_1 = require("../models/VotingLog");
const RegistrationLog_1 = require("../models/RegistrationLog");
const processedRegistrations = {};
function start() {
    return new Promise((resolve, reject) => {
        const eventStream = Event_1.default.find()
            .populate('Rounds.Contestants.Votes')
            .populate('Rounds.Contestants.Detail')
            .cursor();
        eventStream
            .on('data', updateEvent)
            .on('end', resolve)
            .on('error', reject);
    });
}
/**
 * @param doc
 * @return void
 */
async function updateEvent(doc) {
    console.log(`updating event ${doc._id}`);
    const processedEventRegistrations = [];
    // empty the registration vote factor for rebuilding
    doc.RegistrationsVoteFactor = [];
    let toSave = false;
    for (let i = 0; i < doc.Rounds.length; i++) {
        const round = doc.Rounds[i];
        console.log(`Processing ${round.RoundNumber} under ${doc._id}`);
        for (let j = 0; j < round.Contestants.length; j++) {
            const contestant = round.Contestants[j];
            console.log(`Processing Contestant ${contestant.Detail.Name} under ${doc._id} for ${round.RoundNumber}`);
            const contestantVotes = [];
            for (let k = 0; k < contestant.Votes.length; k++) {
                // @ts-ignore
                const registrationId = contestant.Votes[k].RegistrationId || contestant.Votes[k]._id;
                console.log(registrationId, 'reg');
                console.log(`Processing Votes of ${contestant.Detail.Name} under ${doc._id} for ${round.RoundNumber} by ${registrationId}`);
                const votingLogModel = new VotingLog_1.default();
                const registrationLogModel = new RegistrationLog_1.default();
                if (registrationId) {
                    // old type record, update VoterLogs
                    let registration = processedRegistrations[registrationId];
                    if (!registration) {
                        console.log(`Updating registration of ${registrationId} in db  under ${doc._id} for ${round.RoundNumber}`);
                        const registrationHash = uniqid.time();
                        const displayPhone = `*******${contestant.Votes[k].PhoneNumber.slice(-4)}`;
                        await Registration_1.default.update({ _id: registrationId }, {
                            '$set': {
                                Hash: registrationHash,
                                DisplayPhone: displayPhone
                            }
                        });
                        registration = {};
                        registration.Hash = registrationHash;
                        registration.DisplayPhone = displayPhone;
                        registration.PhoneNumber = contestant.Votes[k].PhoneNumber;
                        processedRegistrations[registrationId] = registration;
                    }
                    if (processedEventRegistrations.indexOf(registrationId) === -1) {
                        console.log(`Updating event registration of ${registrationId} in db found under ${doc._id} for ${round.RoundNumber}`);
                        registrationLogModel.PhoneNumber = processedRegistrations[registrationId].PhoneNumber;
                        // @ts-ignore
                        registrationLogModel.DisplayPhone = processedRegistrations[registrationId].DisplayPhone;
                        // registrationLogModel.Hash = registrationObj.Hash;
                        registrationLogModel.VoteFactor = 1; // For Old records it was 1
                        registrationLogModel.VoteFactorInfo = {
                            Type: 'static',
                            Value: '1'
                        };
                        registrationLogModel.PhoneNumberHash = processedRegistrations[registrationId].Hash;
                        registrationLogModel.AlreadyRegisteredForEvent = false;
                        registrationLogModel.EventId = doc._id;
                        // Update user info in Event node
                        doc.RegistrationsVoteFactor.push({
                            RegistrationId: registrationId,
                            VoteFactor: registrationLogModel.VoteFactor,
                            VoteFactorInfo: registrationLogModel.VoteFactorInfo,
                            PhoneNumber: registrationLogModel.PhoneNumber,
                            Hash: registrationLogModel.PhoneNumberHash,
                            VoteUrl: registrationLogModel.VoteUrl,
                            Email: registrationLogModel.Email,
                            RegionCode: ''
                        });
                        // Save registration log model
                        console.log(`Saving registration log`);
                        await registrationLogModel.save();
                        processedEventRegistrations.push(registrationId);
                    }
                    // update data in voterLogs
                    console.log(`Updating voting log of ${registrationId} in db found under ${doc._id} for ${round.RoundNumber} and artist ${contestant.EaselNumber}`);
                    votingLogModel.EaselNumber = contestant.EaselNumber;
                    votingLogModel.PhoneNumber = registration.PhoneNumber;
                    votingLogModel.EventName = doc.Name;
                    votingLogModel.RoundNumber = round.RoundNumber;
                    votingLogModel.ArtistName = contestant.Detail.Name;
                    votingLogModel.Status = 'VOTE_ACCEPTED';
                    votingLogModel.EventId = doc._id;
                    votingLogModel.PhoneHash = registration.Hash;
                    votingLogModel.DisplayPhone = registration.DisplayPhone;
                    votingLogModel.VoteFactor = registrationLogModel.VoteFactor;
                    votingLogModel.VoteFactorInfo = registrationLogModel.VoteFactorInfo;
                    console.log(`Saving voting log`);
                    await votingLogModel.save();
                    contestantVotes.push({
                        RegistrationId: registrationId,
                        VoteFactor: votingLogModel.VoteFactor,
                        PhoneNumber: votingLogModel.PhoneNumber,
                        VoteFactorInfo: votingLogModel.VoteFactorInfo,
                        Hash: registrationLogModel.PhoneNumberHash,
                        VoteUrl: registrationLogModel.VoteUrl,
                        RegionCode: '',
                        Email: ''
                    });
                    toSave = true;
                }
                else {
                    console.error('no registration id issue');
                }
            }
            doc.Rounds[i].Contestants[j].VotesDetail = contestantVotes;
        }
    }
    console.log(`saving ${doc._id}`);
    if (toSave) {
        await doc.save();
    }
}
// TODO update hash by reading data from reg table
start().then(() => {
    console.log('streaming done');
    // process.exit(0);
}).catch(e => {
    console.error(e);
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,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LENBQUMsV0FBVzt3QkFDdkMsY0FBYyxFQUFFLGNBQWMsQ0FBQyxjQUFjO3dCQUM3QyxJQUFJLEVBQUUsb0JBQW9CLENBQUMsZUFBZTt3QkFDMUMsT0FBTyxFQUFFLG9CQUFvQixDQUFDLE9BQU87d0JBQ3JDLFVBQVUsRUFBRSxFQUFFO3dCQUNkLEtBQUssRUFBRSxFQUFFO3FCQUNaLENBQUMsQ0FBQztvQkFDSCxNQUFNLEdBQUcsSUFBSSxDQUFDO2lCQUNqQjtxQkFDSTtvQkFDRCxPQUFPLENBQUMsS0FBSyxDQUFDLDBCQUEwQixDQUFDLENBQUM7aUJBQzdDO2FBQ0o7WUFDRCxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEdBQUcsZUFBZSxDQUFDO1NBQzlEO0tBQ0o7SUFDRCxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDakMsSUFBSSxNQUFNLEVBQUU7UUFDUixNQUFNLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQztLQUNwQjtBQUNMLENBQUM7QUFFRCxrREFBa0Q7QUFFbEQsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRTtJQUNkLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztJQUM5QixtQkFBbUI7QUFDdkIsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFO0lBQ1QsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNyQixDQUFDLENBQUMsQ0FBQyIsImZpbGUiOiJzY3JpcHRzL21pZ3JhdGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBPYmplY3RJRCB9IGZyb20gJ2Jzb24nO1xyXG5cclxuY29uc3QgdW5pcWlkID0gcmVxdWlyZSgndW5pcWlkJyk7XHJcbmltcG9ydCBFdmVudE1vZGVsIGZyb20gJy4uL21vZGVscy9FdmVudCc7XHJcbi8qIEZvcmNlZnVsIGltcG9ydCAqL1xyXG5pbXBvcnQgbW9uZ29vc2UgZnJvbSAnLi9ib290c3RyYXAnO1xyXG5pbXBvcnQgQ29udGVzdGFudE1vZGVsIGZyb20gJy4uL21vZGVscy9Db250ZXN0YW50JztcclxuY29uc29sZS5sb2codHlwZW9mIG1vbmdvb3NlLCB0eXBlb2YgQ29udGVzdGFudE1vZGVsKTtcclxuLyogRm9yY2VmdWwgaW1wb3J0IGVuZCAqL1xyXG5cclxuaW1wb3J0IFJlZ2lzdHJhdGlvbk1vZGVsICBmcm9tICcuLi9tb2RlbHMvUmVnaXN0cmF0aW9uJztcclxuaW1wb3J0IHsgRXZlbnREb2N1bWVudCB9IGZyb20gJy4uL21vZGVscy9FdmVudCc7XHJcbmltcG9ydCBWb3RpbmdMb2dNb2RlbCBmcm9tICcuLi9tb2RlbHMvVm90aW5nTG9nJztcclxuaW1wb3J0IFJlZ2lzdHJhdGlvbkxvZ01vZGVsIGZyb20gJy4uL21vZGVscy9SZWdpc3RyYXRpb25Mb2cnO1xyXG5cclxuY29uc3QgcHJvY2Vzc2VkUmVnaXN0cmF0aW9uczoge1trOiBzdHJpbmddOiBhbnkgfSA9IHt9O1xyXG5cclxuZnVuY3Rpb24gc3RhcnQoKSB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGV2ZW50U3RyZWFtID0gRXZlbnRNb2RlbC5maW5kKClcclxuICAgICAgICAgICAgLnBvcHVsYXRlKCdSb3VuZHMuQ29udGVzdGFudHMuVm90ZXMnKVxyXG4gICAgICAgICAgICAucG9wdWxhdGUoJ1JvdW5kcy5Db250ZXN0YW50cy5EZXRhaWwnKVxyXG4gICAgICAgICAgICAuY3Vyc29yKCk7XHJcbiAgICAgICAgZXZlbnRTdHJlYW1cclxuICAgICAgICAgICAgLm9uKCdkYXRhJywgdXBkYXRlRXZlbnQpXHJcbiAgICAgICAgICAgIC5vbignZW5kJywgcmVzb2x2ZSlcclxuICAgICAgICAgICAgLm9uKCdlcnJvcicsIHJlamVjdCk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEBwYXJhbSBkb2NcclxuICogQHJldHVybiB2b2lkXHJcbiAqL1xyXG5hc3luYyBmdW5jdGlvbiB1cGRhdGVFdmVudChkb2M6IEV2ZW50RG9jdW1lbnQpIHtcclxuICAgIGNvbnNvbGUubG9nKGB1cGRhdGluZyBldmVudCAke2RvYy5faWR9YCk7XHJcbiAgICBjb25zdCBwcm9jZXNzZWRFdmVudFJlZ2lzdHJhdGlvbnMgPSBbXTtcclxuICAgIC8vIGVtcHR5IHRoZSByZWdpc3RyYXRpb24gdm90ZSBmYWN0b3IgZm9yIHJlYnVpbGRpbmdcclxuICAgIGRvYy5SZWdpc3RyYXRpb25zVm90ZUZhY3RvciA9IFtdO1xyXG4gICAgbGV0IHRvU2F2ZSA9IGZhbHNlO1xyXG4gICAgZm9yICggbGV0IGkgPSAwOyBpIDwgZG9jLlJvdW5kcy5sZW5ndGg7IGkrKyApIHtcclxuICAgICAgICBjb25zdCByb3VuZCA9IGRvYy5Sb3VuZHNbaV07XHJcbiAgICAgICAgY29uc29sZS5sb2coYFByb2Nlc3NpbmcgJHtyb3VuZC5Sb3VuZE51bWJlcn0gdW5kZXIgJHtkb2MuX2lkfWApO1xyXG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgcm91bmQuQ29udGVzdGFudHMubGVuZ3RoOyBqKyspIHtcclxuICAgICAgICAgICAgY29uc3QgY29udGVzdGFudCA9IHJvdW5kLkNvbnRlc3RhbnRzW2pdO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgUHJvY2Vzc2luZyBDb250ZXN0YW50ICR7Y29udGVzdGFudC5EZXRhaWwuTmFtZX0gdW5kZXIgJHtkb2MuX2lkfSBmb3IgJHtyb3VuZC5Sb3VuZE51bWJlcn1gKTtcclxuICAgICAgICAgICAgY29uc3QgY29udGVzdGFudFZvdGVzID0gW107XHJcbiAgICAgICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgY29udGVzdGFudC5Wb3Rlcy5sZW5ndGg7IGsrKykge1xyXG4gICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVnaXN0cmF0aW9uSWQgPSBjb250ZXN0YW50LlZvdGVzW2tdLlJlZ2lzdHJhdGlvbklkIHx8IGNvbnRlc3RhbnQuVm90ZXNba10uX2lkO1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2cocmVnaXN0cmF0aW9uSWQsICdyZWcnKTtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBQcm9jZXNzaW5nIFZvdGVzIG9mICR7Y29udGVzdGFudC5EZXRhaWwuTmFtZX0gdW5kZXIgJHtkb2MuX2lkfSBmb3IgJHtyb3VuZC5Sb3VuZE51bWJlcn0gYnkgJHtyZWdpc3RyYXRpb25JZH1gKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHZvdGluZ0xvZ01vZGVsID0gbmV3IFZvdGluZ0xvZ01vZGVsKCk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCByZWdpc3RyYXRpb25Mb2dNb2RlbCA9IG5ldyBSZWdpc3RyYXRpb25Mb2dNb2RlbCgpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHJlZ2lzdHJhdGlvbklkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gb2xkIHR5cGUgcmVjb3JkLCB1cGRhdGUgVm90ZXJMb2dzXHJcbiAgICAgICAgICAgICAgICAgICAgbGV0IHJlZ2lzdHJhdGlvbiA9ICBwcm9jZXNzZWRSZWdpc3RyYXRpb25zW3JlZ2lzdHJhdGlvbklkXTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIXJlZ2lzdHJhdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgVXBkYXRpbmcgcmVnaXN0cmF0aW9uIG9mICR7cmVnaXN0cmF0aW9uSWR9IGluIGRiICB1bmRlciAke2RvYy5faWR9IGZvciAke3JvdW5kLlJvdW5kTnVtYmVyfWApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZWdpc3RyYXRpb25IYXNoID0gdW5pcWlkLnRpbWUoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZGlzcGxheVBob25lID0gYCoqKioqKioke2NvbnRlc3RhbnQuVm90ZXNba10uUGhvbmVOdW1iZXIuc2xpY2UoLTQpfWA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IFJlZ2lzdHJhdGlvbk1vZGVsLnVwZGF0ZSh7X2lkOiByZWdpc3RyYXRpb25JZH0sIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICckc2V0Jzoge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEhhc2ggOiByZWdpc3RyYXRpb25IYXNoLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIERpc3BsYXlQaG9uZTogZGlzcGxheVBob25lXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24gPSB7fTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVnaXN0cmF0aW9uLkhhc2ggPSByZWdpc3RyYXRpb25IYXNoO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24uRGlzcGxheVBob25lID0gZGlzcGxheVBob25lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZWdpc3RyYXRpb24uUGhvbmVOdW1iZXIgPSBjb250ZXN0YW50LlZvdGVzW2tdLlBob25lTnVtYmVyO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9jZXNzZWRSZWdpc3RyYXRpb25zW3JlZ2lzdHJhdGlvbklkXSA9IHJlZ2lzdHJhdGlvbjtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChwcm9jZXNzZWRFdmVudFJlZ2lzdHJhdGlvbnMuaW5kZXhPZihyZWdpc3RyYXRpb25JZCkgPT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBVcGRhdGluZyBldmVudCByZWdpc3RyYXRpb24gb2YgJHtyZWdpc3RyYXRpb25JZH0gaW4gZGIgZm91bmQgdW5kZXIgJHtkb2MuX2lkfSBmb3IgJHtyb3VuZC5Sb3VuZE51bWJlcn1gKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVnaXN0cmF0aW9uTG9nTW9kZWwuUGhvbmVOdW1iZXIgPSBwcm9jZXNzZWRSZWdpc3RyYXRpb25zW3JlZ2lzdHJhdGlvbklkXS5QaG9uZU51bWJlcjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZWdpc3RyYXRpb25Mb2dNb2RlbC5EaXNwbGF5UGhvbmUgPSBwcm9jZXNzZWRSZWdpc3RyYXRpb25zW3JlZ2lzdHJhdGlvbklkXS5EaXNwbGF5UGhvbmU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJlZ2lzdHJhdGlvbkxvZ01vZGVsLkhhc2ggPSByZWdpc3RyYXRpb25PYmouSGFzaDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVnaXN0cmF0aW9uTG9nTW9kZWwuVm90ZUZhY3RvciA9IDE7IC8vIEZvciBPbGQgcmVjb3JkcyBpdCB3YXMgMVxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZWdpc3RyYXRpb25Mb2dNb2RlbC5Wb3RlRmFjdG9ySW5mbyA9IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFR5cGU6ICdzdGF0aWMnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgVmFsdWU6ICcxJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZWdpc3RyYXRpb25Mb2dNb2RlbC5QaG9uZU51bWJlckhhc2ggPSBwcm9jZXNzZWRSZWdpc3RyYXRpb25zW3JlZ2lzdHJhdGlvbklkXS5IYXNoO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZWdpc3RyYXRpb25Mb2dNb2RlbC5BbHJlYWR5UmVnaXN0ZXJlZEZvckV2ZW50ID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlZ2lzdHJhdGlvbkxvZ01vZGVsLkV2ZW50SWQgPSBkb2MuX2lkO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVXBkYXRlIHVzZXIgaW5mbyBpbiBFdmVudCBub2RlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvYy5SZWdpc3RyYXRpb25zVm90ZUZhY3Rvci5wdXNoKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJlZ2lzdHJhdGlvbklkOiByZWdpc3RyYXRpb25JZCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFZvdGVGYWN0b3I6IHJlZ2lzdHJhdGlvbkxvZ01vZGVsLlZvdGVGYWN0b3IsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBWb3RlRmFjdG9ySW5mbzogcmVnaXN0cmF0aW9uTG9nTW9kZWwuVm90ZUZhY3RvckluZm8sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBQaG9uZU51bWJlcjogcmVnaXN0cmF0aW9uTG9nTW9kZWwuUGhvbmVOdW1iZXIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBIYXNoOiByZWdpc3RyYXRpb25Mb2dNb2RlbC5QaG9uZU51bWJlckhhc2gsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBWb3RlVXJsOiByZWdpc3RyYXRpb25Mb2dNb2RlbC5Wb3RlVXJsLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgRW1haWw6IHJlZ2lzdHJhdGlvbkxvZ01vZGVsLkVtYWlsLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgUmVnaW9uQ29kZTogJydcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTYXZlIHJlZ2lzdHJhdGlvbiBsb2cgbW9kZWxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFNhdmluZyByZWdpc3RyYXRpb24gbG9nYCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHJlZ2lzdHJhdGlvbkxvZ01vZGVsLnNhdmUoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvY2Vzc2VkRXZlbnRSZWdpc3RyYXRpb25zLnB1c2gocmVnaXN0cmF0aW9uSWQpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gdXBkYXRlIGRhdGEgaW4gdm90ZXJMb2dzXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFVwZGF0aW5nIHZvdGluZyBsb2cgb2YgJHtyZWdpc3RyYXRpb25JZH0gaW4gZGIgZm91bmQgdW5kZXIgJHtkb2MuX2lkfSBmb3IgJHtyb3VuZC5Sb3VuZE51bWJlcn0gYW5kIGFydGlzdCAke2NvbnRlc3RhbnQuRWFzZWxOdW1iZXJ9YCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdm90aW5nTG9nTW9kZWwuRWFzZWxOdW1iZXIgPSBjb250ZXN0YW50LkVhc2VsTnVtYmVyO1xyXG4gICAgICAgICAgICAgICAgICAgIHZvdGluZ0xvZ01vZGVsLlBob25lTnVtYmVyID0gcmVnaXN0cmF0aW9uLlBob25lTnVtYmVyO1xyXG4gICAgICAgICAgICAgICAgICAgIHZvdGluZ0xvZ01vZGVsLkV2ZW50TmFtZSA9IGRvYy5OYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgIHZvdGluZ0xvZ01vZGVsLlJvdW5kTnVtYmVyID0gcm91bmQuUm91bmROdW1iZXI7XHJcbiAgICAgICAgICAgICAgICAgICAgdm90aW5nTG9nTW9kZWwuQXJ0aXN0TmFtZSA9IGNvbnRlc3RhbnQuRGV0YWlsLk5hbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgdm90aW5nTG9nTW9kZWwuU3RhdHVzID0gJ1ZPVEVfQUNDRVBURUQnO1xyXG4gICAgICAgICAgICAgICAgICAgIHZvdGluZ0xvZ01vZGVsLkV2ZW50SWQgPSBkb2MuX2lkO1xyXG4gICAgICAgICAgICAgICAgICAgIHZvdGluZ0xvZ01vZGVsLlBob25lSGFzaCA9IHJlZ2lzdHJhdGlvbi5IYXNoO1xyXG4gICAgICAgICAgICAgICAgICAgIHZvdGluZ0xvZ01vZGVsLkRpc3BsYXlQaG9uZSA9IHJlZ2lzdHJhdGlvbi5EaXNwbGF5UGhvbmU7XHJcbiAgICAgICAgICAgICAgICAgICAgdm90aW5nTG9nTW9kZWwuVm90ZUZhY3RvciA9IHJlZ2lzdHJhdGlvbkxvZ01vZGVsLlZvdGVGYWN0b3I7XHJcbiAgICAgICAgICAgICAgICAgICAgdm90aW5nTG9nTW9kZWwuVm90ZUZhY3RvckluZm8gPSByZWdpc3RyYXRpb25Mb2dNb2RlbC5Wb3RlRmFjdG9ySW5mbztcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgU2F2aW5nIHZvdGluZyBsb2dgKTtcclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCB2b3RpbmdMb2dNb2RlbC5zYXZlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGVzdGFudFZvdGVzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBSZWdpc3RyYXRpb25JZDogcmVnaXN0cmF0aW9uSWQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFZvdGVGYWN0b3I6IHZvdGluZ0xvZ01vZGVsLlZvdGVGYWN0b3IsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFBob25lTnVtYmVyOiB2b3RpbmdMb2dNb2RlbC5QaG9uZU51bWJlcixcclxuICAgICAgICAgICAgICAgICAgICAgICAgVm90ZUZhY3RvckluZm86IHZvdGluZ0xvZ01vZGVsLlZvdGVGYWN0b3JJbmZvLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBIYXNoOiByZWdpc3RyYXRpb25Mb2dNb2RlbC5QaG9uZU51bWJlckhhc2gsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFZvdGVVcmw6IHJlZ2lzdHJhdGlvbkxvZ01vZGVsLlZvdGVVcmwsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFJlZ2lvbkNvZGU6ICcnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBFbWFpbDogJydcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICB0b1NhdmUgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignbm8gcmVnaXN0cmF0aW9uIGlkIGlzc3VlJyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZG9jLlJvdW5kc1tpXS5Db250ZXN0YW50c1tqXS5Wb3Rlc0RldGFpbCA9IGNvbnRlc3RhbnRWb3RlcztcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBjb25zb2xlLmxvZyhgc2F2aW5nICR7ZG9jLl9pZH1gKTtcclxuICAgIGlmICh0b1NhdmUpIHtcclxuICAgICAgICBhd2FpdCBkb2Muc2F2ZSgpO1xyXG4gICAgfVxyXG59XHJcblxyXG4vLyBUT0RPIHVwZGF0ZSBoYXNoIGJ5IHJlYWRpbmcgZGF0YSBmcm9tIHJlZyB0YWJsZVxyXG5cclxuc3RhcnQoKS50aGVuKCgpID0+IHtcclxuICAgIGNvbnNvbGUubG9nKCdzdHJlYW1pbmcgZG9uZScpO1xyXG4gICAgLy8gcHJvY2Vzcy5leGl0KDApO1xyXG59KS5jYXRjaChlID0+IHtcclxuICAgIGNvbnNvbGUuZXJyb3IoZSk7XHJcbn0pO1xyXG4iXX0=
