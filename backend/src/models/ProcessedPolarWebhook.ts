import { Schema, model } from 'mongoose';

const ProcessedPolarWebhookSchema = new Schema(
  {
    _id: { type: String },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { versionKey: false },
);

export default model('ProcessedPolarWebhook', ProcessedPolarWebhookSchema);
