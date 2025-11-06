import mongoose from 'mongoose';

const classSessionSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  date: {
    type: String,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  room: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'live', 'closed'],
    default: 'scheduled'
  }
}, {
  timestamps: true
});

classSessionSchema.index({ courseId: 1, date: 1 });
classSessionSchema.index({ status: 1, date: 1 });

export const ClassSession = mongoose.model('ClassSession', classSessionSchema);
