"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentStatusSchema = void 0;
const mongoose = require("mongoose");
exports.PaymentStatusSchema = new mongoose.Schema({
    _id: String,
    status: String,
    active: { type: Boolean, index: true }
});
const PaymentStatusModel = mongoose.model('PaymentStatus', exports.PaymentStatusSchema);
exports.default = PaymentStatusModel;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1vZGVscy9QYXltZW50U3RhdHVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFDQUFxQztBQU94QixRQUFBLG1CQUFtQixHQUFvQixJQUFJLFFBQVEsQ0FBQyxNQUFNLENBQUM7SUFDcEUsR0FBRyxFQUFFLE1BQU07SUFDWCxNQUFNLEVBQUUsTUFBTTtJQUNkLE1BQU0sRUFBRSxFQUFDLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBQztDQUN2QyxDQUFDLENBQUM7QUFFSCxNQUFNLGtCQUFrQixHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQXdCLGVBQWUsRUFBRSwyQkFBbUIsQ0FBQyxDQUFDO0FBQ3ZHLGtCQUFlLGtCQUFrQixDQUFDIiwiZmlsZSI6Im1vZGVscy9QYXltZW50U3RhdHVzLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgbW9uZ29vc2UgZnJvbSAnbW9uZ29vc2UnO1xuXG5pbXBvcnQgUGF5bWVudFN0YXR1c0RUTyBmcm9tICcuLi8uLi8uLi9zaGFyZWQvUGF5bWVudFN0YXR1c0RUTyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGF5bWVudFN0YXR1c0RvY3VtZW50IGV4dGVuZHMgUGF5bWVudFN0YXR1c0RUTywgbW9uZ29vc2UuRG9jdW1lbnQge1xufVxuXG5leHBvcnQgY29uc3QgUGF5bWVudFN0YXR1c1NjaGVtYTogbW9uZ29vc2UuU2NoZW1hID0gbmV3IG1vbmdvb3NlLlNjaGVtYSh7XG4gICAgX2lkOiBTdHJpbmcsXG4gICAgc3RhdHVzOiBTdHJpbmcsXG4gICAgYWN0aXZlOiB7dHlwZTogQm9vbGVhbiwgaW5kZXg6IHRydWV9XG59KTtcblxuY29uc3QgUGF5bWVudFN0YXR1c01vZGVsID0gbW9uZ29vc2UubW9kZWw8UGF5bWVudFN0YXR1c0RvY3VtZW50PignUGF5bWVudFN0YXR1cycsIFBheW1lbnRTdGF0dXNTY2hlbWEpO1xuZXhwb3J0IGRlZmF1bHQgUGF5bWVudFN0YXR1c01vZGVsOyJdfQ==
