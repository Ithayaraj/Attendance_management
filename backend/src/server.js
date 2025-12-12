import http from 'http';
import app from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import { initWebSocket } from './realtime/ws.js';
import { Student } from './models/Student.js';
import { Device } from './models/Device.js';
import crypto from 'crypto';

const server = http.createServer(app);

initWebSocket(server);

let serverStarted = false;

const initializeServer = async () => {
  try {
    await Student.syncIndexes();
    console.log('Student indexes synchronized');
  } catch (err) {
    console.error('Failed to sync Student indexes:', err);
  }

  // Ensure a default device exists (for ESP32 testing convenience)
  try {
    const key = process.env.DEFAULT_DEVICE_KEY || 'esp32-dev-key';
    let device = await Device.findOne({ apiKey: key });
    if (!device) {
      device = await Device.create({
        name: 'ESP32 Scanner',
        location: 'Lab',
        apiKey: key,
        status: 'offline'
      });
      console.log('Created default device for testing');
    }
    console.log('Default device apiKey:', key);
  } catch (err) {
    console.error('Failed ensuring default device:', err);
  }

  // Start periodic device status cleanup (every 5 minutes)
  setInterval(async () => {
    try {
      const OFFLINE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
      const now = new Date();
      
      console.log(`🔄 Periodic device cleanup at ${now.toISOString()} (15min threshold)`);
      
      const onlineDevices = await Device.find({ status: 'online' });
      console.log(`📱 Found ${onlineDevices.length} online devices to check`);
      
      for (const device of onlineDevices) {
        if (device.lastSeenAt) {
          const timeSinceLastSeen = now - new Date(device.lastSeenAt);
          const minutesSinceLastSeen = Math.round(timeSinceLastSeen / 60000);
          
          console.log(`📱 Checking device "${device.name}": ${minutesSinceLastSeen} minutes since last seen`);
          
          if (timeSinceLastSeen > OFFLINE_THRESHOLD_MS) {
            device.status = 'offline';
            await device.save();
            console.log(`❌ Device "${device.name}" marked offline (inactive for ${minutesSinceLastSeen} minutes)`);
          } else {
            console.log(`✅ Device "${device.name}" still online (${minutesSinceLastSeen} < 15 minutes)`);
          }
        } else {
          // Device has no lastSeenAt but is marked online - mark as offline
          console.log(`❌ Device "${device.name}" has no lastSeenAt but is online - marking offline`);
          device.status = 'offline';
          await device.save();
        }
      }
    } catch (error) {
      console.error('Error in device status cleanup:', error);
    }
  }, 5 * 60 * 1000); // Run every 5 minutes

  // Only start server once
  if (!serverStarted) {
    serverStarted = true;
    server.listen(config.port, () => {
      console.log(`\n🚀 Server running on port ${config.port}`);
      console.log(`   Environment: ${config.nodeEnv}`);
      console.log(`   WebSocket available at ws://localhost:${config.port}/ws\n`);
      console.log(`📱 Device status cleanup running every 5 minutes (15min timeout)\n`);
    });
  }
};

connectDB()
  .then(() => {
    return initializeServer();
  })
  .catch((err) => {
    console.error('Failed to initialize server:', err);
  });

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});
