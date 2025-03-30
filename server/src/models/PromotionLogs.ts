import * as mongoose from 'mongoose';

import PromotionLogsDTO from '../../../shared/PromotionLogsDTO';


export interface PromotionLogDocument extends PromotionLogsDTO, mongoose.Document {
}

export const PromotionLogschema: mongoose.Schema = new mongoose.Schema({
   event: {type: String},
   lots: {type: String},
   registration: {type: String},
   phone: {type: String},
   notifySMS: {type: Boolean},
   notifyiOS: {type: Boolean},
   notifyAndroid: {type: Boolean},
   message: {type: String}
   }, { timestamps: true });



const PromotionLogModel = mongoose.model<PromotionLogDocument>('PromotionLogs', PromotionLogschema);
export default PromotionLogModel;