import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';

// Cache connection promise to avoid multiple connection attempts
let connectionPromise = null;

export const ensureDBConnection = async (req, res, next) => {
  try {
    // If already connected, proceed immediately
    if (mongoose.connection.readyState === 1) {
      return next();
    }

    // If connecting, wait for existing connection attempt
    if (mongoose.connection.readyState === 2 && connectionPromise) {
      try {
        await connectionPromise;
        if (mongoose.connection.readyState === 1) {
          return next();
        }
      } catch (err) {
        // Connection failed, will retry below
        connectionPromise = null;
      }
    }

    // Start new connection if not already connecting or connection failed
    if (!connectionPromise) {
      connectionPromise = connectDB();
    }

    // Wait for connection with timeout
    await Promise.race([
      connectionPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 8 seconds')), 8000)
      )
    ]);

    connectionPromise = null; // Reset after successful connection
    
    // Double-check connection is ready
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database connection not ready');
    }

    next();
  } catch (error) {
    console.error('Database connection error in middleware:', error);
    connectionPromise = null; // Reset on error
    
    // Provide helpful error message
    let errorMessage = 'Database connection failed';
    if (error.message.includes('timeout')) {
      errorMessage = 'Database connection timeout. Please check MongoDB Atlas network access and connection string.';
    } else if (error.message.includes('MONGODB_URI')) {
      errorMessage = 'MongoDB URI not configured. Please set MONGODB_URI environment variable.';
    }
    
    return res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


