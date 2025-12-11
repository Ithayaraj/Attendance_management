import mongoose from 'mongoose';
import { Student } from '../models/Student.js';
import { ClassSession } from '../models/ClassSession.js';
import { Course } from '../models/Course.js';
import dotenv from 'dotenv';

dotenv.config();

const debugData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        console.log('');

        // Get today's date
        const today = new Date();
        const localIso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString();
        const todayStr = localIso.split('T')[0];
        console.log('Today (local):', todayStr);
        console.log('');

        // Find all live sessions
        console.log('=== ALL LIVE SESSIONS ===');
        const liveSessions = await ClassSession.find({
            status: 'live'
        }).populate('courseId');

        console.log('Total live sessions:', liveSessions.length);
        for (const session of liveSessions) {
            console.log('');
            console.log('Course Code:', session.courseId?.code);
            console.log('Course Name:', session.courseId?.name);
            console.log('Session Date:', session.date);
            console.log('Session Department:', JSON.stringify(session.department));
            console.log('Session Year:', session.year);
            console.log('Session Semester:', session.semester);
            console.log('Course Department:', JSON.stringify(session.courseId?.department));
        }

        console.log('');
        console.log('=== ICTS STUDENTS (sample) ===');
        const ictsStudents = await Student.find({
            registrationNo: { $regex: /ICTS/i }
        }).limit(3);

        for (const student of ictsStudents) {
            console.log('');
            console.log('Name:', student.name);
            console.log('RegNo:', student.registrationNo);
            console.log('Department:', JSON.stringify(student.department));
            console.log('Year:', student.year, 'Semester:', student.semester);
        }

        console.log('');
        console.log('=== BIO STUDENTS (sample) ===');
        const bioStudents = await Student.find({
            registrationNo: { $regex: /BIO/i }
        }).limit(3);

        for (const student of bioStudents) {
            console.log('');
            console.log('Name:', student.name);
            console.log('RegNo:', student.registrationNo);
            console.log('Department:', JSON.stringify(student.department));
            console.log('Year:', student.year, 'Semester:', student.semester);
        }

        await mongoose.connection.close();
        console.log('');
        console.log('Done');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

debugData();
