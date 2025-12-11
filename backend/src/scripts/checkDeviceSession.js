import mongoose from 'mongoose';
import { ClassSession } from '../models/ClassSession.js';
import { Course } from '../models/Course.js';
import dotenv from 'dotenv';
dotenv.config();

const checkSession = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    const s = await ClassSession.findById('693afff741cc814c690be6cd').populate('courseId');
    console.log('Device was locked to:');
    console.log('  Course:', s?.courseId?.code);
    console.log('  Department:', s?.department);
    console.log('  Y' + s?.year + 'S' + s?.semester);
    console.log('  Status:', s?.status);
    await mongoose.connection.close();
};
checkSession();
