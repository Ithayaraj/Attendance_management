import mongoose from 'mongoose';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { ClassSession } from '../models/ClassSession.js';
import { Student } from '../models/Student.js';
import { Course } from '../models/Course.js';
import dotenv from 'dotenv';

dotenv.config();

const checkAllAttendance = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        console.log('');

        // Find ALL live sessions
        const liveSessions = await ClassSession.find({
            status: 'live'
        }).populate('courseId');

        console.log('=== ALL LIVE SESSIONS ===');
        console.log('Count:', liveSessions.length);

        for (const session of liveSessions) {
            console.log('');
            console.log('---');
            console.log('Course:', session.courseId?.code);
            console.log('Session ID:', session._id.toString());
            console.log('Department:', session.department);
            console.log('Date:', session.date);
            console.log('Time:', session.startTime, '-', session.endTime);
            console.log('Year:', session.year, 'Semester:', session.semester);

            // Get attendance records for this session
            const records = await AttendanceRecord.find({
                sessionId: session._id
            }).populate('studentId');

            console.log('Attendance records:', records.length);
            for (const record of records) {
                const regNo = record.studentId?.registrationNo || 'Unknown';
                const name = record.studentId?.name || 'Unknown';
                console.log(`  - ${name} (${regNo}) - ${record.status}`);
            }
        }

        await mongoose.connection.close();
        console.log('');
        console.log('Done');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkAllAttendance();
