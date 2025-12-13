import mongoose from 'mongoose';
import { ClassSession } from './src/models/ClassSession.js';
import { Course } from './src/models/Course.js';
import { config } from './src/config/env.js';

async function testCurrentSessions() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB');

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    console.log(`\n📅 Today: ${today}`);
    console.log(`📅 Yesterday: ${yesterdayStr}`);
    console.log(`⏰ Current time: ${new Date().toISOString()}\n`);

    const sessions = await ClassSession.find({
      date: { $in: [today, yesterdayStr] },
      status: { $in: ['live', 'scheduled'] }
    }).populate('courseId');

    console.log(`Found ${sessions.length} sessions:\n`);

    sessions.forEach(s => {
      console.log(`Session: ${s.courseId?.code || 'NO CODE'}`);
      console.log(`  ID: ${s._id}`);
      console.log(`  Date: ${s.date}`);
      console.log(`  Time: ${s.startTime} - ${s.endTime}`);
      console.log(`  Status: ${s.status}`);
      console.log(`  Department: ${s.department || 'MISSING'}`);
      console.log(`  Year: ${s.year || 'MISSING'}`);
      console.log(`  Semester: ${s.semester || 'MISSING'}`);
      console.log(`  CourseId populated: ${s.courseId ? 'YES' : 'NO'}`);
      if (s.courseId) {
        console.log(`  Course Department: ${s.courseId.department || 'MISSING'}`);
      }
      console.log('');
    });

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testCurrentSessions();
