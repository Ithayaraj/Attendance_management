import { connectDB } from '../config/db.js';
import { Batch } from '../models/Batch.js';
import { Student } from '../models/Student.js';

async function testBatchUpdate() {
  try {
    await connectDB();
    console.log('✅ Connected to database');

    // Find a batch
    const batch = await Batch.findOne();
    if (!batch) {
      console.log('❌ No batch found');
      process.exit(1);
    }

    console.log('\n📋 Found Batch:');
    console.log(`   ID: ${batch._id}`);
    console.log(`   Department: ${batch.department}`);
    console.log(`   Year: ${batch.currentYear}`);
    console.log(`   Semester: ${batch.currentSemester}`);

    // Count students in this batch
    const studentCount = await Student.countDocuments({
      department: batch.department,
      year: batch.currentYear,
      semester: batch.currentSemester
    });

    console.log(`\n👥 Found ${studentCount} student(s) in this batch`);

    if (studentCount > 0) {
      // Show first student
      const student = await Student.findOne({
        department: batch.department,
        year: batch.currentYear,
        semester: batch.currentSemester
      });
      console.log('\n📝 Sample Student:');
      console.log(`   Name: ${student.name}`);
      console.log(`   Reg No: ${student.registrationNo}`);
      console.log(`   Year: ${student.year}`);
      console.log(`   Semester: ${student.semester}`);
    }

    console.log('\n✅ Test completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testBatchUpdate();
