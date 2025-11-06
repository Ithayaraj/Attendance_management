import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'instructor'],
    required: true
  },
  passwordHash: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

userSchema.index({ email: 1 }, { unique: true });

export const User = mongoose.model('User', userSchema);
