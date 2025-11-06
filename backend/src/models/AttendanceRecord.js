import mongoose from 'mongoose';

const attendanceRecordSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassSession',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'late', 'absent'],
    default: 'absent'
  },
  checkInAt: {
    type: Date
  },
  sourceScanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scan'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

attendanceRecordSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });
attendanceRecordSchema.index({ studentId: 1, createdAt: -1 });

export const AttendanceRecord = mongoose.model('AttendanceRecord', attendanceRecordSchema);
