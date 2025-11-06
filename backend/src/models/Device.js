import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  apiKey: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['online', 'offline'],
    default: 'offline'
  },
  lastSeenAt: {
    type: Date
  }
}, {
  timestamps: true
});

deviceSchema.index({ apiKey: 1 }, { unique: true });

export const Device = mongoose.model('Device', deviceSchema);
