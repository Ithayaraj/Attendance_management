import { connectDB } from './src/config/db.js';
import { Device } from './src/models/Device.js';

const test15MinTimeout = async () => {
  try {
    await connectDB();
    
    console.log('🧪 Testing 15-minute device timeout...\n');
    
    // Find or create a test device
    let device = await Device.findOne({ name: 'Test Device' });
    if (!device) {
      device = await Device.create({
        name: 'Test Device',
        location: 'Test Lab',
        apiKey: 'test-key-' + Date.now(),
        status: 'offline'
      });
      console.log('✅ Created test device');
    }
    
    // Mark device as online
    const now = new Date();
    device.status = 'online';
    device.lastSeenAt = now;
    await device.save();
    
    console.log(`📱 Device "${device.name}" marked ONLINE at: ${now.toISOString()}`);
    console.log(`⏰ Should stay online until: ${new Date(now.getTime() + 15*60*1000).toISOString()}`);
    console.log(`📊 Current status: ${device.status}`);
    
    // Test the timeout logic
    const OFFLINE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
    
    // Simulate different time scenarios
    const testTimes = [
      { minutes: 1, description: '1 minute later' },
      { minutes: 5, description: '5 minutes later' },
      { minutes: 10, description: '10 minutes later' },
      { minutes: 14, description: '14 minutes later' },
      { minutes: 15, description: '15 minutes later' },
      { minutes: 16, description: '16 minutes later' }
    ];
    
    console.log('\n🔍 Testing timeout logic:');
    console.log('========================');
    
    for (const test of testTimes) {
      const testTime = new Date(now.getTime() + test.minutes * 60 * 1000);
      const timeSinceLastSeen = testTime - new Date(device.lastSeenAt);
      const shouldBeOffline = timeSinceLastSeen > OFFLINE_THRESHOLD_MS;
      
      console.log(`${test.description}: ${shouldBeOffline ? '❌ OFFLINE' : '✅ ONLINE'} (${test.minutes} min < 15 min threshold)`);
    }
    
    console.log('\n📋 Summary:');
    console.log('- Device should stay ONLINE for exactly 15 minutes');
    console.log('- After 15 minutes, it should be marked OFFLINE');
    console.log('- Current threshold: 15 minutes (900,000 milliseconds)');
    
    console.log('\n🔧 To test manually:');
    console.log('1. Restart your backend server');
    console.log('2. Scan with ESP32 (device will be marked online)');
    console.log('3. Wait 15 minutes');
    console.log('4. Check device status (should be offline)');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

test15MinTimeout();