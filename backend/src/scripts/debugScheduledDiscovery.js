import mongoose from 'mongoose';
import { ClassSession } from '../models/ClassSession.js';
import { Student } from '../models/Student.js';
import { Course } from '../models/Course.js';
import { Device } from '../models/Device.js';
import dotenv from 'dotenv';
import { processScan } from '../services/attendanceService.js';

dotenv.config();

const debugDiscovery = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        // 0. Unlock Device
        await Device.updateMany({ apiKey: 'esp32-dev-key' }, { $unset: { activeSessionId: 1 } });
        console.log('Device unlocked.');

        // 1. Create Test Artifacts
        const course = await Course.create({
            code: 'DEBUG101',
            name: 'Debug Course',
            department: 'Department of Debugging', // Normalizes to 'BUG'? No, check normalization.
            // normalize: d.replace... -> DEBU (4 chars)
            year: 1,
            semester: 1
        });

        const student = await Student.create({
            name: 'Debug Student',
            registrationNo: '2025/DEBU/01',
            email: 'debug@test.com',
            department: 'Department of Debugging',
            year: 1,
            semester: 1
        });

        // 2. Create Scheduled Session (Next 30 mins)
        const now = new Date(); // UTC
        const IST_OFFSET = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + IST_OFFSET);

        // Start: +30m, End: +90m
        const startObj = new Date(istNow.getTime() + 30 * 60000);
        const endObj = new Date(istNow.getTime() + 90 * 60000);

        const dateStr = startObj.toISOString().split('T')[0];
        const startTime = startObj.toISOString().split('T')[1].substring(0, 5);
        const endTime = endObj.toISOString().split('T')[1].substring(0, 5);

        console.log(`Creating SCHEDULED session: ${dateStr} ${startTime}-${endTime}`);

        const session = await ClassSession.create({
            courseId: course._id,
            department: 'Department of Debugging',
            year: 1,
            semester: 1,
            date: dateStr,
            startTime: startTime,
            endTime: endTime,
            room: 'DEBUG-LAB',
            status: 'scheduled'
        });

        // 3. Scan
        console.log('Scanning...');
        try {
            const result = await processScan('esp32-dev-key', '2025/DEBU/01', new Date().toISOString());
            console.log('✅ Scan Success! Session Found.');
            console.log('Msg:', result.message);
            console.log('CheckIn Status:', result.attendanceRecord.status);
        } catch (e) {
            console.error('❌ Scan Failed:', e.message);
        }

        // 4. Cleanup
        await Course.findByIdAndDelete(course._id);
        await Student.findByIdAndDelete(student._id);
        await ClassSession.findByIdAndDelete(session._id);

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

debugDiscovery();
