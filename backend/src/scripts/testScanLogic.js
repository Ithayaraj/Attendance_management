import mongoose from 'mongoose';
import { Student } from '../models/Student.js';
import { ClassSession } from '../models/ClassSession.js';
import { Course } from '../models/Course.js';
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
    if (d.includes('physical') || d.includes('physics')) {
        return 'PHYS';
    }
    if (d.includes('business') || d.includes('economics')) {
        return 'BUS';
    }

    return d.replace(/[^a-z]/g, '').substring(0, 4).toUpperCase() || d.toUpperCase();
};

const testScanLogic = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('='.repeat(60));
        console.log('TEST: ICTS Student scanning for BIO session');
        console.log('='.repeat(60));

        const registrationNo = '2019/ICTS/05';

        // Find student
        const student = await Student.findOne({ registrationNo });
        console.log('Student:', student.name, '(' + registrationNo + ')');

        // Extract dept code
        const studentDeptCode = extractDeptFromRegNo(registrationNo);
        console.log('Student Dept Code:', studentDeptCode);

        const studentYear = Number(student.year);
        const studentSemester = Number(student.semester);
        console.log('Student Y' + studentYear + 'S' + studentSemester);

        // Get today's date
        const today = new Date();
        const localIso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString();
        const todayStr = localIso.split('T')[0];
        console.log('Today:', todayStr);

        console.log('-'.repeat(60));

        // Find all sessions for this year/semester
        const allSessions = await ClassSession.find({
            date: todayStr,
            year: studentYear,
            semester: studentSemester,
            status: 'live'
        }).populate('courseId');

        console.log('Live sessions for Y4S2 today:', allSessions.length);

        let matchCount = 0;
        for (const s of allSessions) {
            const sessionDeptCode = normalizeDepartment(s.department);
            const matches = sessionDeptCode === studentDeptCode;
            if (matches) matchCount++;

            console.log('');
            console.log('  Session:', s.courseId?.code);
            console.log('  Session Dept Raw:', s.department);
            console.log('  Session Dept Code:', sessionDeptCode);
            console.log('  Comparison:', studentDeptCode, '===', sessionDeptCode, '?', matches);
        }

        console.log('-'.repeat(60));
        console.log('');

        if (matchCount === 0) {
            console.log('RESULT: NO MATCHING SESSION');
            console.log('The ICTS student should be REJECTED!');
        } else {
            console.log('RESULT: FOUND', matchCount, 'MATCHING SESSION(S)');
            console.log('BUG - The ICTS student would be ALLOWED!');
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

testScanLogic();
