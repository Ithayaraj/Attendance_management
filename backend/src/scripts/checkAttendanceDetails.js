import mongoose from 'mongoose';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { ClassSession } from '../models/ClassSession.js';
import { Student } from '../models/Student.js';
import { Course } from '../models/Course.js';
import { Scan } from '../models/Scan.js';
import dotenv from 'dotenv';

dotenv.config();

const checkAttendanceDetails = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        console.log('');

        // Find the BIO session
        const bioSession = await ClassSession.findOne({
            'courseId': { $exists: true }
        }).populate('courseId').where('courseId.code').equals('BIO4212');

        // Alternative: find by session ID directly
        const session = await ClassSession.findById('693b03b18400bf54233a9793').populate('courseId');

        if (!session) {
            console.log('BIO4212 session not found');
            return;
        }

        console.log('=== BIO4212 SESSION ===');
        console.log('Session ID:', session._id.toString());
        console.log('Course:', session.courseId?.code);
        console.log('Department:', session.department);
        console.log('');

        // Get all attendance records for this session with timestamps
        const records = await AttendanceRecord.find({
            sessionId: session._id
        }).populate('studentId').sort({ createdAt: -1 });

        console.log('=== ATTENDANCE RECORDS ===');
        console.log('Total:', records.length);

        for (const record of records) {
            console.log('');
            console.log('Record ID:', record._id.toString());
            console.log('Student:', record.studentId?.name);
            console.log('RegNo:', record.studentId?.registrationNo);
            console.log('Status:', record.status);
            console.log('Check-in:', record.checkInAt);
            console.log('Created at:', record.createdAt);
            console.log('Updated at:', record.updatedAt);
        }

        // Also check scans
        console.log('');
        console.log('=== SCANS FOR THIS SESSION ===');
        const scans = await Scan.find({
            sessionId: session._id
        }).sort({ scannedAt: -1 });

        console.log('Total scans:', scans.length);
        for (const scan of scans) {
            console.log('');
            console.log('Scan ID:', scan._id.toString());
            console.log('Barcode:', scan.barcode);
            console.log('Scanned at:', scan.scannedAt);
            console.log('Created at:', scan.createdAt);
        }

        await mongoose.connection.close();
        console.log('');
        console.log('Done');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkAttendanceDetails();
