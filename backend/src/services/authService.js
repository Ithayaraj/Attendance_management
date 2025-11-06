import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';

export const loginUser = async (email, password) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);

  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    userId: user._id,
    token: refreshToken,
    expiresAt
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
};

export const refreshAccessToken = async (token) => {
  const decoded = verifyRefreshToken(token);

  if (!decoded) {
    throw new Error('Invalid refresh token');
  }

  const storedToken = await RefreshToken.findOne({
    token,
    userId: decoded.userId,
    expiresAt: { $gt: new Date() }
  });

  if (!storedToken) {
    throw new Error('Refresh token not found or expired');
  }

  const user = await User.findById(decoded.userId);

  if (!user) {
    throw new Error('User not found');
  }

  const accessToken = generateAccessToken(user._id, user.role);

  return { accessToken };
};

export const logoutUser = async (token) => {
  await RefreshToken.deleteOne({ token });
};
