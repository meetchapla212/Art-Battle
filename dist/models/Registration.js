"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistrationSchema = void 0;
const mongoose = require("mongoose");
const ArtistApps_1 = require("./ArtistApps");
exports.RegistrationSchema = new mongoose.Schema({
    FirstName: String,
    LastName: String,
    NickName: String,
    Email: { type: String, unique: true, sparse: true, index: true },
    PhoneNumber: { type: String, unique: true, sparse: true, index: true },
    Hash: { type: String, unique: true, sparse: true, index: true },
    DisplayPhone: { type: String },
    RegionCode: { type: String },
    VerificationCode: { type: Number },
    VerificationCodeExp: { type: Date },
    SelfRegistered: { type: Boolean },
    DeviceTokens: { type: Array },
    Preferences: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Preference' }],
    ArtBattleNews: { type: Boolean },
    NotificationEmails: { type: Boolean },
    LoyaltyOffers: { type: Boolean },
    AndroidDeviceTokens: { type: Array },
    ArtistProfile: ArtistApps_1.artistAppsSchema,
    IsArtist: Boolean,
    MessageBlocked: { type: Number },
    lastPromoSentAt: Date,
    Location: {
        type: {
            type: String,
            enum: 'Point',
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        }
    },
    Artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Contestant' },
    RegisteredAt: { type: String, index: true }
});
exports.RegistrationSchema.index({ Location: '2dsphere' });
const RegistrationModel = mongoose.model('Registration', exports.RegistrationSchema);
exports.default = RegistrationModel;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1vZGVscy9SZWdpc3RyYXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUNBQXFDO0FBSXJDLDZDQUFnRDtBQU1uQyxRQUFBLGtCQUFrQixHQUFvQixJQUFJLFFBQVEsQ0FBQyxNQUFNLENBQUM7SUFDbkUsU0FBUyxFQUFFLE1BQU07SUFDakIsUUFBUSxFQUFFLE1BQU07SUFDaEIsUUFBUSxFQUFFLE1BQU07SUFDaEIsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRTtJQUNoRSxXQUFXLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO0lBQ3RFLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7SUFDL0QsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBQztJQUM3QixVQUFVLEVBQUUsRUFBQyxJQUFJLEVBQUUsTUFBTSxFQUFDO0lBQzFCLGdCQUFnQixFQUFFLEVBQUMsSUFBSSxFQUFFLE1BQU0sRUFBQztJQUNoQyxtQkFBbUIsRUFBRSxFQUFDLElBQUksRUFBRSxJQUFJLEVBQUM7SUFDakMsY0FBYyxFQUFFLEVBQUMsSUFBSSxFQUFFLE9BQU8sRUFBQztJQUMvQixZQUFZLEVBQUUsRUFBQyxJQUFJLEVBQUUsS0FBSyxFQUFDO0lBQzNCLFdBQVcsRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUUsWUFBWSxFQUFDLENBQUM7SUFDekUsYUFBYSxFQUFFLEVBQUMsSUFBSSxFQUFFLE9BQU8sRUFBQztJQUM5QixrQkFBa0IsRUFBRSxFQUFDLElBQUksRUFBRSxPQUFPLEVBQUM7SUFDbkMsYUFBYSxFQUFFLEVBQUMsSUFBSSxFQUFFLE9BQU8sRUFBQztJQUM5QixtQkFBbUIsRUFBRSxFQUFDLElBQUksRUFBRSxLQUFLLEVBQUM7SUFDbEMsYUFBYSxFQUFFLDZCQUFnQjtJQUMvQixRQUFRLEVBQUUsT0FBTztJQUNqQixjQUFjLEVBQUUsRUFBQyxJQUFJLEVBQUUsTUFBTSxFQUFDO0lBQzlCLGVBQWUsRUFBRSxJQUFJO0lBQ3JCLFFBQVEsRUFBRTtRQUNOLElBQUksRUFBRTtZQUNGLElBQUksRUFBRSxNQUFNO1lBQ1osSUFBSSxFQUFFLE9BQU87WUFDYixPQUFPLEVBQUUsT0FBTztTQUNuQjtRQUNELFdBQVcsRUFBRTtZQUNULElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQztZQUNkLE9BQU8sRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDbEI7S0FDSjtJQUNELE1BQU0sRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFLFlBQVksRUFBQztJQUNsRSxZQUFZLEVBQUUsRUFBQyxJQUFJLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUM7Q0FDNUMsQ0FBQyxDQUFDO0FBQ0gsMEJBQWtCLENBQUMsS0FBSyxDQUFDLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxDQUFDLENBQUM7QUFDbkQsTUFBTSxpQkFBaUIsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUF1QixjQUFjLEVBQUUsMEJBQWtCLENBQUMsQ0FBQztBQUNuRyxrQkFBZSxpQkFBaUIsQ0FBQyIsImZpbGUiOiJtb2RlbHMvUmVnaXN0cmF0aW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgbW9uZ29vc2UgZnJvbSAnbW9uZ29vc2UnO1xuXG5pbXBvcnQgUmVnaXN0cmF0aW9uRFRPIGZyb20gJy4uLy4uLy4uL3NoYXJlZC9SZWdpc3RyYXRpb25EVE8nO1xuaW1wb3J0IEFydGlzdEFwcHNEVE8gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL0FydGlzdEFwcHNEVE8nO1xuaW1wb3J0IHsgYXJ0aXN0QXBwc1NjaGVtYSB9IGZyb20gJy4vQXJ0aXN0QXBwcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVnaXN0cmF0aW9uRG9jdW1lbnQgZXh0ZW5kcyBSZWdpc3RyYXRpb25EVE8sIG1vbmdvb3NlLkRvY3VtZW50IHtcbiAgICBNZXNzYWdlQmxvY2tlZDogbnVtYmVyO1xufVxuXG5leHBvcnQgY29uc3QgUmVnaXN0cmF0aW9uU2NoZW1hOiBtb25nb29zZS5TY2hlbWEgPSBuZXcgbW9uZ29vc2UuU2NoZW1hKHtcbiAgICBGaXJzdE5hbWU6IFN0cmluZyxcbiAgICBMYXN0TmFtZTogU3RyaW5nLFxuICAgIE5pY2tOYW1lOiBTdHJpbmcsXG4gICAgRW1haWw6IHsgdHlwZTogU3RyaW5nLCB1bmlxdWU6IHRydWUsIHNwYXJzZTogdHJ1ZSwgaW5kZXg6IHRydWUgfSxcbiAgICBQaG9uZU51bWJlcjogeyB0eXBlOiBTdHJpbmcsIHVuaXF1ZTogdHJ1ZSwgc3BhcnNlOiB0cnVlLCBpbmRleDogdHJ1ZSB9LFxuICAgIEhhc2g6IHsgdHlwZTogU3RyaW5nLCB1bmlxdWU6IHRydWUsIHNwYXJzZTogdHJ1ZSwgaW5kZXg6IHRydWUgfSxcbiAgICBEaXNwbGF5UGhvbmU6IHsgdHlwZTogU3RyaW5nfSxcbiAgICBSZWdpb25Db2RlOiB7dHlwZTogU3RyaW5nfSxcbiAgICBWZXJpZmljYXRpb25Db2RlOiB7dHlwZTogTnVtYmVyfSxcbiAgICBWZXJpZmljYXRpb25Db2RlRXhwOiB7dHlwZTogRGF0ZX0sXG4gICAgU2VsZlJlZ2lzdGVyZWQ6IHt0eXBlOiBCb29sZWFufSxcbiAgICBEZXZpY2VUb2tlbnM6IHt0eXBlOiBBcnJheX0sXG4gICAgUHJlZmVyZW5jZXM6IFt7IHR5cGU6IG1vbmdvb3NlLlNjaGVtYS5UeXBlcy5PYmplY3RJZCwgcmVmOiAnUHJlZmVyZW5jZSd9XSxcbiAgICBBcnRCYXR0bGVOZXdzOiB7dHlwZTogQm9vbGVhbn0sXG4gICAgTm90aWZpY2F0aW9uRW1haWxzOiB7dHlwZTogQm9vbGVhbn0sXG4gICAgTG95YWx0eU9mZmVyczoge3R5cGU6IEJvb2xlYW59LFxuICAgIEFuZHJvaWREZXZpY2VUb2tlbnM6IHt0eXBlOiBBcnJheX0sXG4gICAgQXJ0aXN0UHJvZmlsZTogYXJ0aXN0QXBwc1NjaGVtYSxcbiAgICBJc0FydGlzdDogQm9vbGVhbixcbiAgICBNZXNzYWdlQmxvY2tlZDoge3R5cGU6IE51bWJlcn0sXG4gICAgbGFzdFByb21vU2VudEF0OiBEYXRlLFxuICAgIExvY2F0aW9uOiB7XG4gICAgICAgIHR5cGU6IHtcbiAgICAgICAgICAgIHR5cGU6IFN0cmluZyxcbiAgICAgICAgICAgIGVudW06ICdQb2ludCcsXG4gICAgICAgICAgICBkZWZhdWx0OiAnUG9pbnQnXG4gICAgICAgIH0sXG4gICAgICAgIGNvb3JkaW5hdGVzOiB7XG4gICAgICAgICAgICB0eXBlOiBbTnVtYmVyXSxcbiAgICAgICAgICAgIGRlZmF1bHQ6IFswLCAwXVxuICAgICAgICB9XG4gICAgfSxcbiAgICBBcnRpc3Q6IHsgdHlwZTogbW9uZ29vc2UuU2NoZW1hLlR5cGVzLk9iamVjdElkLCByZWY6ICdDb250ZXN0YW50J30sXG4gICAgUmVnaXN0ZXJlZEF0OiB7dHlwZTogU3RyaW5nLCBpbmRleDogdHJ1ZX1cbn0pO1xuUmVnaXN0cmF0aW9uU2NoZW1hLmluZGV4KHsgTG9jYXRpb246ICcyZHNwaGVyZScgfSk7XG5jb25zdCBSZWdpc3RyYXRpb25Nb2RlbCA9IG1vbmdvb3NlLm1vZGVsPFJlZ2lzdHJhdGlvbkRvY3VtZW50PignUmVnaXN0cmF0aW9uJywgUmVnaXN0cmF0aW9uU2NoZW1hKTtcbmV4cG9ydCBkZWZhdWx0IFJlZ2lzdHJhdGlvbk1vZGVsOyJdfQ==
