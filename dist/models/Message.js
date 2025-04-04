"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageSchema = void 0;
const mongoose = require("mongoose");
exports.MessageSchema = new mongoose.Schema({
    Message: String,
    ServerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ServerRegistration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
    ServerNumber: String,
    ServerNumberDoc: { type: mongoose.Schema.Types.ObjectId, ref: 'EventPhoneNumber' },
    ClientPhoneNumber: String,
    ClientRegistration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' },
    Status: { type: Number, index: true },
    Channel: String,
    CreatedAt: { type: Date, index: true }
}, { timestamps: true });
const PreferenceModel = mongoose.model('Message', exports.MessageSchema);
exports.default = PreferenceModel;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1vZGVscy9NZXNzYWdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFDQUFxQztBQU94QixRQUFBLGFBQWEsR0FBb0IsSUFBSSxRQUFRLENBQUMsTUFBTSxDQUFDO0lBQzlELE9BQU8sRUFBRSxNQUFNO0lBQ2YsVUFBVSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFDO0lBQ2hFLGtCQUFrQixFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUUsY0FBYyxFQUFDO0lBQ2hGLFlBQVksRUFBRSxNQUFNO0lBQ3BCLGVBQWUsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFLGtCQUFrQixFQUFDO0lBQ2pGLGlCQUFpQixFQUFFLE1BQU07SUFDekIsa0JBQWtCLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEdBQUcsRUFBRSxjQUFjLEVBQUM7SUFDaEYsTUFBTSxFQUFFLEVBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFDO0lBQ25DLE9BQU8sRUFBRSxNQUFNO0lBQ2YsU0FBUyxFQUFFLEVBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFDO0NBQ3ZDLEVBQUUsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztBQUV6QixNQUFNLGVBQWUsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFrQixTQUFTLEVBQUUscUJBQWEsQ0FBQyxDQUFDO0FBQ2xGLGtCQUFlLGVBQWUsQ0FBQyIsImZpbGUiOiJtb2RlbHMvTWVzc2FnZS5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIG1vbmdvb3NlIGZyb20gJ21vbmdvb3NlJztcblxuaW1wb3J0IE1lc3NhZ2VEVE8gZnJvbSAnLi4vLi4vLi4vc2hhcmVkL01lc3NhZ2VEVE8nO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1lc3NhZ2VEb2N1bWVudCBleHRlbmRzIE1lc3NhZ2VEVE8sIG1vbmdvb3NlLkRvY3VtZW50IHtcbn1cblxuZXhwb3J0IGNvbnN0IE1lc3NhZ2VTY2hlbWE6IG1vbmdvb3NlLlNjaGVtYSA9IG5ldyBtb25nb29zZS5TY2hlbWEoe1xuICAgIE1lc3NhZ2U6IFN0cmluZyxcbiAgICBTZXJ2ZXJVc2VyOiB7IHR5cGU6IG1vbmdvb3NlLlNjaGVtYS5UeXBlcy5PYmplY3RJZCwgcmVmOiAnVXNlcid9LFxuICAgIFNlcnZlclJlZ2lzdHJhdGlvbjogeyB0eXBlOiBtb25nb29zZS5TY2hlbWEuVHlwZXMuT2JqZWN0SWQsIHJlZjogJ1JlZ2lzdHJhdGlvbid9LFxuICAgIFNlcnZlck51bWJlcjogU3RyaW5nLFxuICAgIFNlcnZlck51bWJlckRvYzogeyB0eXBlOiBtb25nb29zZS5TY2hlbWEuVHlwZXMuT2JqZWN0SWQsIHJlZjogJ0V2ZW50UGhvbmVOdW1iZXInfSxcbiAgICBDbGllbnRQaG9uZU51bWJlcjogU3RyaW5nLFxuICAgIENsaWVudFJlZ2lzdHJhdGlvbjogeyB0eXBlOiBtb25nb29zZS5TY2hlbWEuVHlwZXMuT2JqZWN0SWQsIHJlZjogJ1JlZ2lzdHJhdGlvbid9LFxuICAgIFN0YXR1czoge3R5cGU6IE51bWJlciwgaW5kZXg6IHRydWV9LFxuICAgIENoYW5uZWw6IFN0cmluZyxcbiAgICBDcmVhdGVkQXQ6IHt0eXBlOiBEYXRlLCBpbmRleDogdHJ1ZX1cbn0sIHsgdGltZXN0YW1wczogdHJ1ZSB9KTtcblxuY29uc3QgUHJlZmVyZW5jZU1vZGVsID0gbW9uZ29vc2UubW9kZWw8TWVzc2FnZURvY3VtZW50PignTWVzc2FnZScsIE1lc3NhZ2VTY2hlbWEpO1xuZXhwb3J0IGRlZmF1bHQgUHJlZmVyZW5jZU1vZGVsOyJdfQ==
