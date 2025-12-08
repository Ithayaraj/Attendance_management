import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const testConnection = async () => {
  console.log('🔍 Testing MongoDB Connection...\n');
  console.log('Connection String:', process.env.MONGODB_URI.replace(/:[^:@]+@/, ':****@'));
  
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 1,
      minPoolSize: 1,
      connectTimeoutMS: 10000,
    });
    
    console.log('\n✅ Connection Successful!');
    console.log(`   Host: ${conn.connection.host}`);
    console.log(`   Database: ${conn.connection.name}`);
    console.log(`   Ready State: ${conn.connection.readyState}`);
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection Failed!');
    console.error(`   Error Name: ${error.name}`);
    console.error(`   Error Message: ${error.message}`);
    
    if (error.reason) {
      console.error('\n📋 Detailed Error:');
      console.error(`   Type: ${error.reason.type}`);
      console.error(`   Servers:`, error.reason.servers.keys());
    }
    
    process.exit(1);
  }
};

testConnection();
