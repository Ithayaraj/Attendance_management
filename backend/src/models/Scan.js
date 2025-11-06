import mongoose from 'mongoose';

const scanSchema = new mongoose.Schema({
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  barcode: {
    type: String,
    required: true,
    trim: true
  },
  scannedAt: {
    type: Date,
    required: true
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassSession'
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }
}, {
  timestamps: true
});

scanSchema.index({ barcode: 1 });
scanSchema.index({ scannedAt: -1 });
scanSchema.index({ sessionId: 1 });

export const Scan = mongoose.model('Scan', scanSchema);
