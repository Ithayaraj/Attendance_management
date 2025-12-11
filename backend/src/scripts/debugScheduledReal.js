import mongoose from 'mongoose';
import { ClassSession } from '../models/ClassSession.js';
import { Device } from '../models/Device.js';
import dotenv from 'dotenv';
import { processScan } from '../services/attendanceService.js';

dotenv.config();

const debugReal = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected.');

        // 0. Unlock Device
        await Device.updateMany({ apiKey: 'esp32-dev-key' }, { $unset: { activeSessionId: 1 } });

        // 1. Find existing Live Session to Hide
        const liveSession = await ClassSession.findOne({
            status: 'live',
            'courseId': { $exists: true }
        }).populate('courseId');

        if (liveSession) {
            console.log(`Hiding Live Session: ${liveSession._id} (${liveSession.courseId.code})`);
            await ClassSession.findByIdAndUpdate(liveSession._id, { status: 'closed' });
        } else {
            console.log('No Live Session found to hide.');
        }

        // 2. Create Scheduled Session (Future Today)
        const now = new Date();
        const IST_OFFSET = 5.5 * 60 * 60 * 1000;
        const istNow = new Date(now.getTime() + IST_OFFSET);

        // Time: Now + 2 hours
        const startObj = new Date(istNow.getTime() + 120 * 60000);
        const endObj = new Date(istNow.getTime() + 180 * 60000);

        const dateStr = startObj.toISOString().split('T')[0];
        const startTime = startObj.toISOString().split('T')[1].substring(0, 5);
        const endTime = endObj.toISOString().split('T')[1].substring(0, 5);

        // Use the SAME course/dept/batch as the live session (or TICT4214 if found)
        const courseId = liveSession?.courseId._id;
        const dept = liveSession?.department;
        const year = liveSession?.year;
        const sem = liveSession?.semester;

        if (!courseId) throw new Error('Need a base session to copy details from');

        console.log(`Creating Scheduled Session: ${dateStr} ${startTime}-${endTime}`);
        const scheduledSession = await ClassSession.create({
            courseId, department: dept, year, semester: sem,
            date: dateStr, startTime, endTime, room: 'TEST',
            status: 'scheduled'
        });

        // 3. Scan
        console.log('Scanning...');
        try {
            const res = await processScan('esp32-dev-key', '2019/ICTS/20', new Date().toISOString());
            console.log('✅ Scan Success!');
            console.log('Msg:', res.message);
            console.log('Session:', res.session.courseCode);
            console.log('Status:', res.attendanceRecord.status);
        } catch (e) {
            console.error('❌ Scan Failed:', e.message);
        }

        // 4. Cleanup/Restore
        await ClassSession.findByIdAndDelete(scheduledSession._id);
        if (liveSession) {
            console.log('Restoring Live Session');
            await ClassSession.findByIdAndUpdate(liveSession._id, { status: 'live' });
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

debugReal();
