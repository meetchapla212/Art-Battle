"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bootstrap_1 = require("./bootstrap");
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
const Registration_1 = require("../models/Registration");
const Contestant_1 = require("../models/Contestant");
const Event_1 = require("../models/Event");
async function start() {
    return processArtists();
}
async function processArtists() {
    await Promise.all([cleanRegistrations(), cleanContestants()]);
}
async function cleanContestants() {
    const contestants = await Contestant_1.default.find({
        $or: [
            {
                EntryId: {
                    $exists: true
                }
            },
            {
                Email: {
                    $exists: true
                }
            },
            {
                PhoneNumber: {
                    $exists: true
                }
            },
            {
                Registration: {
                    $exists: true
                }
            }
        ]
    });
    console.log('contestants.length', contestants.length);
    for (let i = 0; i < contestants.length; i++) {
        const contestant = contestants[i];
        const event = await Event_1.default.findOne({ Contestants: { $in: [contestant._id] } });
        if (!event) {
            console.log('removing contestant');
            await contestant.remove();
            console.log('removed contestant');
        }
        else {
            console.error(`skipping deletion of ${contestant._id} ${contestant.Name} because it exists in ${event.Name} ${event._id}`);
        }
    }
}
async function cleanRegistrations() {
    const registrations = await Registration_1.default.find({
        $or: [
            {
                ArtistProfile: {
                    $exists: true
                }
            },
            {
                IsArtist: true
            }
        ]
    });
    console.log('registrations.length', registrations.length);
    for (let i = 0; i < registrations.length; i++) {
        const registration = registrations[i];
        if (registration.ArtistProfile) {
            registration.ArtistProfile = undefined;
        }
        registration.IsArtist = false;
        console.log('de-linking registration', registration._id);
        await registration.save();
    }
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,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YSxHQUFHLE1BQU0sc0JBQWlCLENBQUMsSUFBSSxDQUFDO1FBQy9DLEdBQUcsRUFBRTtZQUNEO2dCQUNJLGFBQWEsRUFBRTtvQkFDWCxPQUFPLEVBQUUsSUFBSTtpQkFDaEI7YUFDSjtZQUNEO2dCQUNJLFFBQVEsRUFBRSxJQUFJO2FBQ2pCO1NBQ0o7S0FDSixDQUFDLENBQUM7SUFDSCxPQUFPLENBQUMsR0FBRyxDQUFDLHNCQUFzQixFQUFFLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMxRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUMzQyxNQUFNLFlBQVksR0FBRyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdEMsSUFBSSxZQUFZLENBQUMsYUFBYSxFQUFFO1lBQzVCLFlBQVksQ0FBQyxhQUFhLEdBQUcsU0FBUyxDQUFDO1NBQzFDO1FBQ0QsWUFBWSxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUM7UUFDOUIsT0FBTyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsRUFBRSxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDekQsTUFBTSxZQUFZLENBQUMsSUFBSSxFQUFFLENBQUM7S0FDN0I7QUFDTCxDQUFDIiwiZmlsZSI6InNjcmlwdHMvY2xlYW5BcnRpc3RzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGxvYWRBcHAgZnJvbSAnLi9ib290c3RyYXAnO1xubGV0IG1vbmdvb3NlOiB0eXBlb2YgaW1wb3J0KCdtb25nb29zZScpO1xubG9hZEFwcCgpLnRoZW4oKG9iaikgPT4ge1xuICAgIG1vbmdvb3NlID0gb2JqLm1vbmdvb3NlO1xuICAgIHJldHVybiBzdGFydCgpO1xufSkudGhlbigoKSA9PiB7XG4gICAgY29uc29sZS5sb2coJ2RvbmUnKTtcbiAgICByZXR1cm4gbW9uZ29vc2UuY29ubmVjdGlvbi5jbG9zZSgpO1xufSkuY2F0Y2goZSA9PiB7XG4gICAgY29uc29sZS5lcnJvcihlKTtcbiAgICBpZiAobW9uZ29vc2UuY29ubmVjdGlvbikge1xuICAgICAgICByZXR1cm4gbW9uZ29vc2UuY29ubmVjdGlvbi5jbG9zZSgpO1xuICAgIH1cbn0pLnRoZW4oKCkgPT4ge1xuICAgIGNvbnNvbGUubG9nKCdjbG9zZWQgZGIgY29ubicpO1xufSk7XG4vLyBAdHMtaWdub3JlXG5pbXBvcnQgZ290ID0gcmVxdWlyZSgnZ290Jyk7XG5pbXBvcnQgUmVnaXN0cmF0aW9uTW9kZWwgZnJvbSAnLi4vbW9kZWxzL1JlZ2lzdHJhdGlvbic7XG5pbXBvcnQgQ29udGVzdGFudE1vZGVsIGZyb20gJy4uL21vZGVscy9Db250ZXN0YW50JztcbmltcG9ydCBFdmVudE1vZGVsIGZyb20gJy4uL21vZGVscy9FdmVudCc7XG5cbmFzeW5jIGZ1bmN0aW9uIHN0YXJ0KCkge1xuICAgIHJldHVybiBwcm9jZXNzQXJ0aXN0cygpO1xufVxuXG5hc3luYyBmdW5jdGlvbiBwcm9jZXNzQXJ0aXN0cygpIHtcbiAgICBhd2FpdCBQcm9taXNlLmFsbChbY2xlYW5SZWdpc3RyYXRpb25zKCksIGNsZWFuQ29udGVzdGFudHMoKV0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBjbGVhbkNvbnRlc3RhbnRzKCkge1xuICAgIGNvbnN0IGNvbnRlc3RhbnRzID0gYXdhaXQgQ29udGVzdGFudE1vZGVsLmZpbmQoe1xuICAgICAgICAkb3I6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBFbnRyeUlkOiB7XG4gICAgICAgICAgICAgICAgICAgICRleGlzdHM6IHRydWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIEVtYWlsOiB7XG4gICAgICAgICAgICAgICAgICAgICRleGlzdHM6IHRydWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIFBob25lTnVtYmVyOiB7XG4gICAgICAgICAgICAgICAgICAgICRleGlzdHM6IHRydWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIFJlZ2lzdHJhdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAkZXhpc3RzOiB0cnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICBdXG4gICAgfSk7XG4gICAgY29uc29sZS5sb2coJ2NvbnRlc3RhbnRzLmxlbmd0aCcsIGNvbnRlc3RhbnRzLmxlbmd0aCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb250ZXN0YW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBjb250ZXN0YW50ID0gY29udGVzdGFudHNbaV07XG4gICAgICAgIGNvbnN0IGV2ZW50ID0gYXdhaXQgRXZlbnRNb2RlbC5maW5kT25lKHtDb250ZXN0YW50czogeyRpbjogW2NvbnRlc3RhbnQuX2lkXX19KTtcbiAgICAgICAgaWYgKCFldmVudCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ3JlbW92aW5nIGNvbnRlc3RhbnQnKTtcbiAgICAgICAgICAgIGF3YWl0IGNvbnRlc3RhbnQucmVtb3ZlKCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygncmVtb3ZlZCBjb250ZXN0YW50Jyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBza2lwcGluZyBkZWxldGlvbiBvZiAke2NvbnRlc3RhbnQuX2lkfSAke2NvbnRlc3RhbnQuTmFtZX0gYmVjYXVzZSBpdCBleGlzdHMgaW4gJHtldmVudC5OYW1lfSAke2V2ZW50Ll9pZH1gKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2xlYW5SZWdpc3RyYXRpb25zKCkge1xuICAgIGNvbnN0IHJlZ2lzdHJhdGlvbnMgPSBhd2FpdCBSZWdpc3RyYXRpb25Nb2RlbC5maW5kKHtcbiAgICAgICAgJG9yOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgQXJ0aXN0UHJvZmlsZToge1xuICAgICAgICAgICAgICAgICAgICAkZXhpc3RzOiB0cnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBJc0FydGlzdDogdHJ1ZVxuICAgICAgICAgICAgfVxuICAgICAgICBdXG4gICAgfSk7XG4gICAgY29uc29sZS5sb2coJ3JlZ2lzdHJhdGlvbnMubGVuZ3RoJywgcmVnaXN0cmF0aW9ucy5sZW5ndGgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVnaXN0cmF0aW9ucy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCByZWdpc3RyYXRpb24gPSByZWdpc3RyYXRpb25zW2ldO1xuICAgICAgICBpZiAocmVnaXN0cmF0aW9uLkFydGlzdFByb2ZpbGUpIHtcbiAgICAgICAgICAgIHJlZ2lzdHJhdGlvbi5BcnRpc3RQcm9maWxlID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIHJlZ2lzdHJhdGlvbi5Jc0FydGlzdCA9IGZhbHNlO1xuICAgICAgICBjb25zb2xlLmxvZygnZGUtbGlua2luZyByZWdpc3RyYXRpb24nLCByZWdpc3RyYXRpb24uX2lkKTtcbiAgICAgICAgYXdhaXQgcmVnaXN0cmF0aW9uLnNhdmUoKTtcbiAgICB9XG59Il19
