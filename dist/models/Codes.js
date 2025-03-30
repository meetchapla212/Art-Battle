"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeSchema = void 0;
const mongoose = require("mongoose");
exports.CodeSchema = new mongoose.Schema({
    code: String,
    value: String,
    used: String,
    time: String,
    phone: String,
    event: String
});
const CodeModel = mongoose.model('Code', exports.CodeSchema);
exports.default = CodeModel;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1vZGVscy9Db2Rlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxQ0FBcUM7QUFPeEIsUUFBQSxVQUFVLEdBQW9CLElBQUksUUFBUSxDQUFDLE1BQU0sQ0FBQztJQUMzRCxJQUFJLEVBQUUsTUFBTTtJQUNaLEtBQUssRUFBRSxNQUFNO0lBQ2IsSUFBSSxFQUFFLE1BQU07SUFDWixJQUFJLEVBQUUsTUFBTTtJQUNaLEtBQUssRUFBRSxNQUFNO0lBQ2IsS0FBSyxFQUFFLE1BQU07Q0FDaEIsQ0FBQyxDQUFDO0FBRUgsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBZSxNQUFNLEVBQUUsa0JBQVUsQ0FBQyxDQUFDO0FBQ25FLGtCQUFlLFNBQVMsQ0FBQyIsImZpbGUiOiJtb2RlbHMvQ29kZXMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBtb25nb29zZSBmcm9tICdtb25nb29zZSc7XG5cbmltcG9ydCBDb2RlRHRvIGZyb20gJy4uLy4uLy4uL3NoYXJlZC9Db2RlRHRvJztcblxuZXhwb3J0IGludGVyZmFjZSBDb2RlRG9jdW1lbnQgZXh0ZW5kcyBDb2RlRHRvLCBtb25nb29zZS5Eb2N1bWVudCB7XG59XG5cbmV4cG9ydCBjb25zdCBDb2RlU2NoZW1hOiBtb25nb29zZS5TY2hlbWEgPSBuZXcgbW9uZ29vc2UuU2NoZW1hKHtcbiAgICBjb2RlOiBTdHJpbmcsXG4gICAgdmFsdWU6IFN0cmluZyxcbiAgICB1c2VkOiBTdHJpbmcsXG4gICAgdGltZTogU3RyaW5nLFxuICAgIHBob25lOiBTdHJpbmcsXG4gICAgZXZlbnQ6IFN0cmluZ1xufSk7XG5cbmNvbnN0IENvZGVNb2RlbCA9IG1vbmdvb3NlLm1vZGVsPENvZGVEb2N1bWVudD4oJ0NvZGUnLCBDb2RlU2NoZW1hKTtcbmV4cG9ydCBkZWZhdWx0IENvZGVNb2RlbDsiXX0=
