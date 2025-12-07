import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema({
  startYear: {
    type: Number,
    required: true,
    min: 1900,
    max: 3000
  },
  name: {
    type: String,
    trim: true
  },
  faculty: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    required: true,
    trim: true
  },
  currentYear: {
    type: Number,
    required: true,
    min: 1,
    max: 4,
    default: 1
  },
  currentSemester: {
    type: Number,
    required: true,
    min: 1,
    max: 2,
    default: 1
  }
}, {
  timestamps: true
});

// No unique constraints - allows complete duplicates
// Each entry represents a separate batch configuration

export const Batch = mongoose.model('Batch', batchSchema);



