import mongoose from 'mongoose';
import { ClassSession } from '../models/ClassSession.js';
import { Course } from '../models/Course.js';
import dotenv from 'dotenv';

dotenv.config();

const checkAllSessions = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        console.log('');

        // Find ALL sessions for today
        const today = new Date();
        const localIso = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString();
        const todayStr = localIso.split('T')[0];

        console.log('Today:', todayStr);
        console.log('');

        // Find ALL sessions (not just live)
        const allSessions = await ClassSession.find({}).populate('courseId');

        console.log('=== ALL SESSIONS IN DATABASE ===');
        console.log('Total:', allSessions.length);
        console.log('');

        // Filter to Y4S2 sessions
        const y4s2Sessions = allSessions.filter(s => s.year === 4 && s.semester === 2);
        console.log('Y4S2 Sessions:', y4s2Sessions.length);

        for (const s of y4s2Sessions) {
            console.log('');
            console.log('---');
            console.log('Course:', s.courseId?.code, '-', s.courseId?.name);
            console.log('Session ID:', s._id.toString());
            console.log('Date:', s.date);
            console.log('Status:', s.status);
            console.log('Department:', s.department);
            console.log('Year/Sem:', s.year, '/', s.semester);
        }

        await mongoose.connection.close();
        console.log('');
        console.log('Done');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkAllSessions();
