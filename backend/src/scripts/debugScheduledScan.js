import mongoose from 'mongoose';
import { ClassSession } from '../models/ClassSession.js';
import { Student } from '../models/Student.js';
import { Course } from '../models/Course.js';
import dotenv from 'dotenv';
import { processScan } from '../services/attendanceService.js';

dotenv.config();

const simulateScheduledScan = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Find a Course (TICT4214)
        const course = await Course.findOne({ code: 'TICT4214' });
        if (!course) throw new Error('Course not found');

        // 2. Create a SCHEDULED session 30 mins from now
        const now = new Date();
        // Add 5.5h to simulate IST for calculating "local" times if needed, 
        // but the DB stores date strings.
        // Let's use the helpers I verified.

        // We want a session "Today" (Dec 12) at Time (Now + 30m).
        const IST_OFFSET = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + IST_OFFSET);

        // Determine Start/End times (HH:MM)
        const startObj = new Date(istNow.getTime() + 30 * 60000);
        const endObj = new Date(istNow.getTime() + 90 * 60000);

        const dateStr = startObj.toISOString().split('T')[0];
        const startTime = startObj.toISOString().split('T')[1].substring(0, 5);
        const endTime = endObj.toISOString().split('T')[1].substring(0, 5);

        console.log(`Creating test session: ${dateStr} ${startTime}-${endTime} (Scheduled)`);

        const session = await ClassSession.create({
            courseId: course._id,
            department: course.department,
            year: course.year,
            semester: course.semester,
            date: dateStr,
            startTime: startTime,
            endTime: endTime,
            room: 'TEST-LAB',
            status: 'scheduled'
        });

        console.log(`Session created: ${session._id}`);

        // 3. Scan a student (Ithayaraj)
        // 2019/ICTS/20
        const regNo = '2019/ICTS/20';
        console.log(`Scanning student: ${regNo}`);

        try {
            // Mock device key
            const result = await processScan('esp32-dev-key', regNo, new Date().toISOString());
            console.log('✅ Scan Success!');
            console.log('Message:', result.message);
            console.log('Session:', result.session.courseCode);
        } catch (err) {
            console.error('❌ Scan Failed:', err.message);
        }

        // Cleanup
        await ClassSession.findByIdAndDelete(session._id);
        console.log('Cleanup done');

    } catch (error) {
        console.error('Script Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

simulateScheduledScan();
