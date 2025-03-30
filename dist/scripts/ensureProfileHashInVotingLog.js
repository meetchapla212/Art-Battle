"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bootstrap_1 = require("./bootstrap");
const Contestant_1 = require("../models/Contestant");
const logger_1 = require("../config/logger");
/* Forceful import */
logger_1.default.info(typeof bootstrap_1.default, typeof Contestant_1.default);
/* Forceful import end */
const Registration_1 = require("../models/Registration");
const VotingLog_1 = require("../models/VotingLog");
async function start() {
    const votingLogs = await VotingLog_1.default.find({ PhoneHash: { '$exists': false } }).sort({ _id: -1 });
    for (let i = 0; i < votingLogs.length; i++) {
        const registration = await Registration_1.default.findOne({
            PhoneNumber: votingLogs[i].PhoneNumber
        });
        if (registration) {
            votingLogs[i].PhoneHash = registration.Hash;
            votingLogs[i].DisplayPhone = `*******${registration.PhoneNumber.slice(-4)}`;
            await votingLogs[i].save();
        }
        else {
            logger_1.default.info(`No reg found for ${votingLogs[i].PhoneNumber}`);
        }
    }
}
start().then(() => {
    logger_1.default.info('fix done');
    process.exit(0);
}).catch(e => {
    logger_1.default.info(e);
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNjcmlwdHMvZW5zdXJlUHJvZmlsZUhhc2hJblZvdGluZ0xvZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDJDQUFtQztBQUVuQyxxREFBbUQ7QUFDbkQsNkNBQXNDO0FBSXRDLHFCQUFxQjtBQUNyQixnQkFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLG1CQUFRLEVBQUUsT0FBTyxvQkFBZSxDQUFDLENBQUM7QUFDckQseUJBQXlCO0FBRXpCLHlEQUF3RDtBQUN4RCxtREFBaUQ7QUFJakQsS0FBSyxVQUFVLEtBQUs7SUFDaEIsTUFBTSxVQUFVLEdBQUcsTUFBTSxtQkFBYyxDQUFDLElBQUksQ0FBQyxFQUFDLFNBQVMsRUFBRSxFQUFDLFNBQVMsRUFBRSxLQUFLLEVBQUMsRUFBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUM5RixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtRQUN4QyxNQUFNLFlBQVksR0FBRyxNQUFNLHNCQUFpQixDQUFDLE9BQU8sQ0FBQztZQUNqRCxXQUFXLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVc7U0FDekMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxZQUFZLEVBQUU7WUFDZCxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUM7WUFDNUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksR0FBRyxVQUFVLFlBQVksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUM1RSxNQUFNLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztTQUM5QjthQUFNO1lBQ0gsZ0JBQU0sQ0FBQyxJQUFJLENBQUMsb0JBQW9CLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1NBQ2hFO0tBQ0o7QUFDTCxDQUFDO0FBRUQsS0FBSyxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRTtJQUNkLGdCQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ3hCLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEIsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFO0lBQ1QsZ0JBQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbkIsQ0FBQyxDQUFDLENBQUMiLCJmaWxlIjoic2NyaXB0cy9lbnN1cmVQcm9maWxlSGFzaEluVm90aW5nTG9nLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IG1vbmdvb3NlIGZyb20gJy4vYm9vdHN0cmFwJztcbmltcG9ydCBFdmVudE1vZGVsLCB7IEV2ZW50RG9jdW1lbnQgfSBmcm9tICcuLi9tb2RlbHMvRXZlbnQnO1xuaW1wb3J0IENvbnRlc3RhbnRNb2RlbCBmcm9tICcuLi9tb2RlbHMvQ29udGVzdGFudCc7XG5pbXBvcnQgbG9nZ2VyIGZyb20gJy4uL2NvbmZpZy9sb2dnZXInO1xuXG5cblxuLyogRm9yY2VmdWwgaW1wb3J0ICovXG5sb2dnZXIuaW5mbyh0eXBlb2YgbW9uZ29vc2UsIHR5cGVvZiBDb250ZXN0YW50TW9kZWwpO1xuLyogRm9yY2VmdWwgaW1wb3J0IGVuZCAqL1xuXG5pbXBvcnQgUmVnaXN0cmF0aW9uTW9kZWwgIGZyb20gJy4uL21vZGVscy9SZWdpc3RyYXRpb24nO1xuaW1wb3J0IFZvdGluZ0xvZ01vZGVsIGZyb20gJy4uL21vZGVscy9Wb3RpbmdMb2cnO1xuaW1wb3J0IFBob25lTnVtYmVyID0gbGlicGhvbmVudW1iZXIuUGhvbmVOdW1iZXI7XG5cblxuYXN5bmMgZnVuY3Rpb24gc3RhcnQoKSB7XG4gICAgY29uc3Qgdm90aW5nTG9ncyA9IGF3YWl0IFZvdGluZ0xvZ01vZGVsLmZpbmQoe1Bob25lSGFzaDogeyckZXhpc3RzJzogZmFsc2V9fSkuc29ydCh7X2lkOiAtMX0pO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdm90aW5nTG9ncy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCByZWdpc3RyYXRpb24gPSBhd2FpdCBSZWdpc3RyYXRpb25Nb2RlbC5maW5kT25lKHtcbiAgICAgICAgICAgIFBob25lTnVtYmVyOiB2b3RpbmdMb2dzW2ldLlBob25lTnVtYmVyXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAocmVnaXN0cmF0aW9uKSB7XG4gICAgICAgICAgICB2b3RpbmdMb2dzW2ldLlBob25lSGFzaCA9IHJlZ2lzdHJhdGlvbi5IYXNoO1xuICAgICAgICAgICAgdm90aW5nTG9nc1tpXS5EaXNwbGF5UGhvbmUgPSBgKioqKioqKiR7cmVnaXN0cmF0aW9uLlBob25lTnVtYmVyLnNsaWNlKC00KX1gO1xuICAgICAgICAgICAgYXdhaXQgdm90aW5nTG9nc1tpXS5zYXZlKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2dnZXIuaW5mbyhgTm8gcmVnIGZvdW5kIGZvciAke3ZvdGluZ0xvZ3NbaV0uUGhvbmVOdW1iZXJ9YCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbnN0YXJ0KCkudGhlbigoKSA9PiB7XG4gICAgbG9nZ2VyLmluZm8oJ2ZpeCBkb25lJyk7XG4gICAgcHJvY2Vzcy5leGl0KDApO1xufSkuY2F0Y2goZSA9PiB7XG4gICAgbG9nZ2VyLmluZm8oZSk7XG59KTsiXX0=
