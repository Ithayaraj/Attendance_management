import mongoose from 'mongoose';
import { Device } from '../models/Device.js';
import dotenv from 'dotenv';

dotenv.config();

const clearDeviceLocks = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find all devices with active session locks
        const lockedDevices = await Device.find({ activeSessionId: { $ne: null } });
        console.log(`Found ${lockedDevices.length} devices with active session locks`);

        for (const device of lockedDevices) {
            console.log(`  - Device: ${device.name} (${device._id})`);
            console.log(`    Session ID: ${device.activeSessionId}`);
        }

        // Clear all device locks
        const result = await Device.updateMany(
            { activeSessionId: { $ne: null } },
            { $unset: { activeSessionId: "" } }
        );

        console.log(`\nCleared ${result.modifiedCount} device lock(s)`);

        await mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

clearDeviceLocks();
