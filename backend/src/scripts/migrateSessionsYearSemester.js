import mongoose from 'mongoose';
import { ClassSession } from '../models/ClassSession.js';
import { Course } from '../models/Course.js';
import dotenv from 'dotenv';

dotenv.config();

// Helper function to derive year from course code
const deriveYearFromCode = (code) => {
  if (!code || typeof code !== 'string') return null;
  const match = code.match(/^[A-Za-z]+(\d)(\d)/);
  if (!match) return null;
  return parseInt(match[1], 10);
};

// Helper function to derive semester from course code
const deriveSemesterFromCode = (code) => {
  if (!code || typeof code !== 'string') return null;
  const match = code.match(/^[A-Za-z]+(\d)(\d)/);
  if (!match) return null;
  return parseInt(match[2], 10);
};

async function migrateSessions() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully\n');

    // Find all sessions without year or semester
    const sessionsWithoutBatch = await ClassSession.find({
      $or: [
        { year: { $exists: false } },
        { semester: { $exists: false } },
        { year: null },
        { semester: null }
      ]
    }).populate('courseId');

    console.log(`Found ${sessionsWithoutBatch.length} sessions without year/semester\n`);

    if (sessionsWithoutBatch.length === 0) {
      console.log('✅ All sessions already have year and semester!');
      process.exit(0);
    }

    let updated = 0;
    let failed = 0;
    const errors = [];

    for (const session of sessionsWithoutBatch) {
      try {
        if (!session.courseId) {
          console.log(`❌ Session ${session._id}: Course not found`);
          failed++;
          errors.push(`Session ${session._id}: Course not found`);
          continue;
        }

        const course = session.courseId;
        let year = course.year;
        let semester = course.semester;

        // If course doesn't have year/semester, try to derive from code
        if (year === null || year === undefined || semester === null || semester === undefined) {
          const derivedYear = deriveYearFromCode(course.code);
          const derivedSemester = deriveSemesterFromCode(course.code);

          if (derivedYear !== null && derivedSemester !== null &&
              derivedYear >= 1 && derivedYear <= 4 &&
              derivedSemester >= 1 && derivedSemester <= 2) {
            year = derivedYear;
            semester = derivedSemester;

            // Update the course too
            course.year = year;
            course.semester = semester;
            await course.save();
            console.log(`📚 Updated course ${course.code} with Y${year}S${semester}`);
          } else {
            console.log(`❌ Session ${session._id}: Cannot derive year/semester from course code "${course.code}"`);
            failed++;
            errors.push(`Session ${session._id}: Cannot derive from "${course.code}"`);
            continue;
          }
        }

        // Update session
        session.year = year;
        session.semester = semester;
        await session.save();

        console.log(`✅ Updated session ${session._id} (${course.code}) → Y${year}S${semester}`);
        updated++;
      } catch (error) {
        console.log(`❌ Error updating session ${session._id}:`, error.message);
        failed++;
        errors.push(`Session ${session._id}: ${error.message}`);
      }
    }

    console.log('\n=== Migration Summary ===');
    console.log(`✅ Successfully updated: ${updated}`);
    console.log(`❌ Failed: ${failed}`);

    if (errors.length > 0) {
      console.log('\n=== Errors ===');
      errors.forEach(err => console.log(err));
    }

    console.log('\n✅ Migration completed!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateSessions();
