import * as mongoose from 'mongoose';

import CodeDto from '../../../shared/CodeDto';

export interface CodeDocument extends CodeDto, mongoose.Document {
}

export const CodeSchema: mongoose.Schema = new mongoose.Schema({
    code: String,
    value: String,
    used: String,
    time: String,
    phone: String,
    event: String
});

const CodeModel = mongoose.model<CodeDocument>('Code', CodeSchema);
export default CodeModel;