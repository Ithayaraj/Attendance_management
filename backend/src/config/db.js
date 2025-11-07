import mongoose from 'mongoose';

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 3000; // 3 seconds

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// For serverless: simpler connection without complex retry logic
export const connectDB = async () => {
  try {
    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      console.log(`✅ MongoDB Already Connected: ${mongoose.connection.host}`);
      return mongoose.connection;
    }

    // Validate MONGODB_URI is set
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables. Please check your .env file.');
    }

    // If already connecting, wait for it
    if (mongoose.connection.readyState === 2) {
      // Wait for connection with timeout
      await Promise.race([
        new Promise((resolve) => {
          mongoose.connection.once('connected', resolve);
          mongoose.connection.once('error', resolve);
        }),
        new Promise((resolve) => setTimeout(resolve, 5000)) // 5 second timeout
      ]);
      
      if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
      }
    }

    // Connect with serverless-optimized settings
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Reduced timeout for serverless
      socketTimeoutMS: 45000,
      // Critical: Disable buffering to prevent timeout errors
      bufferCommands: false,
      bufferMaxEntries: 0,
      // Optimize for serverless
      maxPoolSize: 1,
      minPoolSize: 1,
      // Auto-reconnect settings
      autoIndex: true,
      // Additional options for reliability
      connectTimeoutMS: 10000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`\n❌ MongoDB Connection Error:`);
    console.error(`   ${error.message}\n`);
    
    // Provide helpful error messages
    if (error.message.includes('IP') || error.message.includes('whitelist')) {
      console.error('📝 Network Access Issue:');
      console.error('   1. Go to MongoDB Atlas: https://cloud.mongodb.com/');
      console.error('   2. Navigate to Network Access (Security > Network Access)');
      console.error('   3. Click "Add IP Address"');
      console.error('   4. Add "0.0.0.0/0" to allow all IPs (or add Vercel IPs)');
      console.error('   5. Wait 1-2 minutes for changes to take effect\n');
    } else if (error.message.includes('authentication')) {
      console.error('📝 Authentication Issue: Check your MongoDB username and password in MONGODB_URI\n');
    }
    
    throw error; // Re-throw for middleware to handle
  }
};
