import mongoose from 'mongoose';
import { AttendanceRecord } from '../models/AttendanceRecord.js';
import { ClassSession } from '../models/ClassSession.js';
import { Student } from '../models/Student.js';
import { Course } from '../models/Course.js';
import { Scan } from '../models/Scan.js';
import dotenv from 'dotenv';

dotenv.config();

// Copy of normalize function
const extractDeptFromRegNo = (registrationNo) => {
    if (!registrationNo) return null;
    const parts = registrationNo.split('/');
    if (parts.length >= 2) {
        return parts[1].toUpperCase().trim();
    }
    return null;
};

const normalizeDepartment = (dept) => {
    if (!dept) return '';
    const d = dept.toLowerCase().trim();

    if (d.includes('ict') || d.includes('information') || d.includes('communication') || d.includes('technological')) {
        return 'ICTS';
    }
    if (d.includes('bio') || d === 'bio') {
        return 'BIO';
    }

    return d.replace(/[^a-z]/g, '').substring(0, 4).toUpperCase() || d.toUpperCase();
};

const cleanupInvalidAttendance = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        console.log('');

        // Find all live sessions
        const liveSessions = await ClassSession.find({
            status: 'live'
        }).populate('courseId');

        console.log('=== CLEANING UP INVALID ATTENDANCE RECORDS ===');
        console.log('Live sessions:', liveSessions.length);

        let totalDeleted = 0;

        for (const session of liveSessions) {
            console.log('');
            console.log('Checking session:', session.courseId?.code);
            const sessionDeptCode = normalizeDepartment(session.department);
            console.log('Session dept code:', sessionDeptCode);

            // Get attendance records for this session
            const records = await AttendanceRecord.find({
                sessionId: session._id
            }).populate('studentId');

            for (const record of records) {
                const studentRegNo = record.studentId?.registrationNo;
                const studentDeptCode = extractDeptFromRegNo(studentRegNo);

                if (studentDeptCode && sessionDeptCode && studentDeptCode !== sessionDeptCode) {
                    console.log('');
                    console.log('  INVALID RECORD FOUND!');
                    console.log('    Student:', record.studentId?.name, '(' + studentRegNo + ')');
                    console.log('    Student dept:', studentDeptCode);
                    console.log('    Session dept:', sessionDeptCode);
                    console.log('    Deleting...');

                    // Delete the attendance record
                    await AttendanceRecord.deleteOne({ _id: record._id });

                    // Also delete associated scans
                    const deletedScans = await Scan.deleteMany({
                        sessionId: session._id,
                        barcode: studentRegNo
                    });

                    console.log('    Deleted attendance record');
                    console.log('    Deleted', deletedScans.deletedCount, 'scan(s)');
                    totalDeleted++;
                }
            }
        }

        console.log('');
        console.log('=== CLEANUP COMPLETE ===');
        console.log('Total invalid records deleted:', totalDeleted);

        await mongoose.connection.close();
        console.log('Done');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

cleanupInvalidAttendance();
