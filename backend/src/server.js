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

  // Only start server once
  if (!serverStarted) {
    serverStarted = true;
    server.listen(config.port, () => {
      console.log(`\n🚀 Server running on port ${config.port}`);
      console.log(`   Environment: ${config.nodeEnv}`);
      console.log(`   WebSocket available at ws://localhost:${config.port}/ws\n`);
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
