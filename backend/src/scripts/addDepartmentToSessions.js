import mongoose from 'mongoose';
import { ClassSession } from '../models/ClassSession.js';
import { Course } from '../models/Course.js';
import dotenv from 'dotenv';

dotenv.config();

const addDepartmentToSessions = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all sessions without department field
    const sessions = await ClassSession.find({ 
      $or: [
        { department: { $exists: false } },
        { department: null },
        { department: '' }
      ]
    }).populate('courseId');

    console.log(`Found ${sessions.length} sessions without department`);

    let updated = 0;
    let failed = 0;

    for (const session of sessions) {
      try {
        if (!session.courseId) {
          console.log(`Session ${session._id} has no courseId, skipping`);
          failed++;
          continue;
        }

        // Get the course to find the department
        let course = session.courseId;
        if (typeof session.courseId === 'string') {
          course = await Course.findById(session.courseId);
        }

        if (!course || !course.department) {
          console.log(`Session ${session._id} course ${course?._id} has no department, skipping`);
          failed++;
          continue;
        }

        // Update the session with department
        session.department = course.department;
        await session.save();
        
        updated++;
        console.log(`Updated session ${session._id} with department: ${course.department}`);
      } catch (error) {
        console.error(`Error updating session ${session._id}:`, error.message);
        failed++;
      }
    }

    console.log('\n=== Migration Complete ===');
    console.log(`Total sessions processed: ${sessions.length}`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Failed: ${failed}`);

    await mongoose.connection.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

addDepartmentToSessions();
