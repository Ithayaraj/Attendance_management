import mongoose from 'mongoose';

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 3000; // 3 seconds

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const connectDB = async (retryCount = 0) => {
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

    // Disconnect if in a connecting state before retrying
    if (mongoose.connection.readyState === 2) {
      await mongoose.disconnect();
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`\n❌ MongoDB Connection Error (Attempt ${retryCount + 1}/${MAX_RETRIES}):`);
    console.error(`   ${error.message}\n`);
    
    // Provide helpful error messages based on error type (only on first attempt)
    if (retryCount === 0) {
      if (error.message.includes('IP') || error.message.includes('whitelist')) {
        console.error('📝 To fix this issue:');
        console.error('   1. Go to MongoDB Atlas: https://cloud.mongodb.com/');
        console.error('   2. Navigate to Network Access (Security > Network Access)');
        console.error('   3. Click "Add IP Address"');
        console.error('   4. Click "Add Current IP Address" or add "0.0.0.0/0" for development');
        console.error('   5. Wait 1-2 minutes for changes to take effect');
        console.error('   6. The server will automatically retry the connection\n');
      } else if (error.message.includes('authentication')) {
        console.error('📝 Check your MongoDB username and password in MONGODB_URI');
      } else if (error.message.includes('MONGODB_URI')) {
        console.error('📝 Create a .env file with MONGODB_URI=your_connection_string');
        process.exit(1); // Exit if URI is not set
      }
    }

    // Retry logic with exponential backoff
    if (retryCount < MAX_RETRIES - 1) {
      const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
      console.log(`⏳ Retrying connection in ${retryDelay / 1000} seconds...\n`);
      await delay(retryDelay);
      return connectDB(retryCount + 1);
    } else {
      console.error('💥 Max retry attempts reached. Server will continue to retry every 30 seconds...\n');
      // Continue retrying indefinitely but less frequently
      await delay(30000); // Wait 30 seconds
      return connectDB(0); // Reset retry count for infinite retries
    }
  }
};
