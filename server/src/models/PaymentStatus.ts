import * as mongoose from 'mongoose';

import PaymentStatusDTO from '../../../shared/PaymentStatusDTO';

export interface PaymentStatusDocument extends PaymentStatusDTO, mongoose.Document {
}

export const PaymentStatusSchema: mongoose.Schema = new mongoose.Schema({
    _id: String,
    status: String,
    active: {type: Boolean, index: true}
});

const PaymentStatusModel = mongoose.model<PaymentStatusDocument>('PaymentStatus', PaymentStatusSchema);
export default PaymentStatusModel;