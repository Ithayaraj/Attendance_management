import mongoose from 'mongoose';
import { Student } from '../models/Student.js';
import { ClassSession } from '../models/ClassSession.js';
import { Course } from '../models/Course.js';
import { Device } from '../models/Device.js';
import dotenv from 'dotenv';

dotenv.config();

// Copy of the normalize functions from attendanceService.js
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

const simulateScan = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('='.repeat(70));
        console.log('SIMULATING SCAN: ICTS student trying to scan');
        console.log('='.repeat(70));
        console.log('');

        // Parameters
        const registrationNo = '2019/ICTS/20';
        const deviceApiKey = 'esp32-dev-key';

        // Step 1: Find device
        const device = await Device.findOne({ apiKey: deviceApiKey });
        console.log('Device:', device?.name);
        console.log('Device locked to session:', device?.activeSessionId?.toString() || 'NONE');
        console.log('');

        // Step 2: Find student
        const student = await Student.findOne({ registrationNo });
        console.log('Student:', student?.name);
        console.log('Student registrationNo:', registrationNo);
        console.log('Student department stored:', student?.department);

        const studentDeptCode = extractDeptFromRegNo(registrationNo);
        console.log('Student dept code (from regNo):', studentDeptCode);

        const studentYear = student?.year;
        const studentSemester = student?.semester;
        console.log('Student Y' + studentYear + 'S' + studentSemester);
        console.log('');

        // Step 3: Get today's date
        const now = new Date();
        const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();
        const today = localIso.split('T')[0];
        console.log('Today:', today);
        console.log('');

        // Step 4: Check device lock
        console.log('=== DEVICE LOCK CHECK ===');
        if (device?.activeSessionId) {
            const lockedSession = await ClassSession.findById(device.activeSessionId).populate('courseId');
            console.log('Device locked to:', lockedSession?.courseId?.code);
            console.log('Locked session dept:', lockedSession?.department);

            const sessionDeptCode = normalizeDepartment(lockedSession?.department);
            console.log('Locked session dept code:', sessionDeptCode);

            const deptMatch = sessionDeptCode === studentDeptCode;
            console.log('Dept match?', deptMatch);

            if (!deptMatch) {
                console.log('');
                console.log('>>> SHOULD THROW ERROR: Dept mismatch!');
            }
        } else {
            console.log('No device lock, will do dynamic discovery');
        }
        console.log('');

        // Step 5: Dynamic session discovery
        console.log('=== DYNAMIC SESSION DISCOVERY ===');
        const allSessions = await ClassSession.find({
            date: today,
            year: studentYear,
            semester: studentSemester,
            status: { $in: ['live', 'scheduled', 'completed'] }
        }).populate('courseId');

        console.log('Sessions for Y' + studentYear + 'S' + studentSemester + ' today:', allSessions.length);

        for (const s of allSessions) {
            const sDeptCode = normalizeDepartment(s.department);
            const matches = sDeptCode === studentDeptCode;
            console.log('');
            console.log('  Session:', s.courseId?.code);
            console.log('  Session dept:', s.department, '->', sDeptCode);
            console.log('  Status:', s.status);
            console.log('  Matches student dept?', matches);
        }

        // Filter to matching sessions
        const activeSessions = allSessions.filter(s => {
            const sDeptCode = normalizeDepartment(s.department);
            return sDeptCode === studentDeptCode;
        });

        console.log('');
        console.log('Filtered to', activeSessions.length, 'matching sessions');

        if (activeSessions.length === 0) {
            console.log('');
            console.log('>>> SHOULD THROW ERROR: No matching session for', studentDeptCode);
        } else {
            console.log('');
            console.log('Would allow attendance to:', activeSessions[0]?.courseId?.code);
        }

        await mongoose.connection.close();
        console.log('');
        console.log('Done');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

simulateScan();
