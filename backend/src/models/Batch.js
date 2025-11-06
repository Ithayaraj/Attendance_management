import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema({
  startYear: {
    type: Number,
    required: true,
    min: 1900,
    max: 3000,
    unique: true
  },
  name: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

export const Batch = mongoose.model('Batch', batchSchema);



