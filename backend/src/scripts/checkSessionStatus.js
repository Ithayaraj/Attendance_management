/**
 * Diagnostic Script: Check Session Status
 * 
 * Run this to diagnose "No active session" errors
 * Usage: node src/scripts/checkSessionStatus.js
 */

import mongoose from 'mongoose';
import { ClassSession } from '../models/ClassSession.js';
import { Student } from '../models/Student.js';
import { Course } from '../models/Course.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function checkSessionStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get today's date in YYYY-MM-DD format (local time)
    const now = new Date();
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();
    const today = localIso.split('T')[0];
    
    console.log('========================================');
    console.log('📅 TODAY\'S DATE:', today);
    console.log('========================================\n');

    // Check all sessions for today
    const todaySessions = await ClassSession.find({ date: today })
      .populate('courseId')
      .sort({ startTime: 1 });

    if (todaySessions.length === 0) {
      console.log('❌ NO SESSIONS FOUND FOR TODAY');
      console.log('   Create a session in the web app first!\n');
      
      // Show recent sessions
      const recentSessions = await ClassSession.find()
        .populate('courseId')
        .sort({ date: -1 })
        .limit(5);
      
      if (recentSessions.length > 0) {
        console.log('📋 Recent sessions:');
        recentSessions.forEach(s => {
          console.log(`   ${s.date} - ${s.courseId.code} (Y${s.year}S${s.semester}) - ${s.status}`);
        });
      }
    } else {
      console.log(`✅ FOUND ${todaySessions.length} SESSION(S) FOR TODAY:\n`);
      
      todaySessions.forEach((session, index) => {
        console.log(`Session ${index + 1}:`);
        console.log(`  Course: ${session.courseId.code} - ${session.courseId.name}`);
        console.log(`  Batch: Year ${session.year}, Semester ${session.semester}`);
        console.log(`  Time: ${session.startTime} - ${session.endTime}`);
        console.log(`  Room: ${session.room || 'N/A'}`);
        console.log(`  Status: ${session.status} ${session.status === 'live' ? '🟢' : session.status === 'scheduled' ? '🟡' : '⚫'}`);
        console.log('');
      });

      // Check for live sessions
      const liveSessions = todaySessions.filter(s => s.status === 'live');
      
      if (liveSessions.length === 0) {
        console.log('⚠️  WARNING: No sessions are LIVE');
        console.log('   Set a session to "Live" status in the web app!\n');
      } else {
        console.log(`✅ ${liveSessions.length} LIVE SESSION(S):\n`);
        liveSessions.forEach(s => {
          console.log(`  🟢 ${s.courseId.code} (Y${s.year}S${s.semester})`);
        });
        console.log('');
      }

      // Check for multiple live sessions per batch
      const batchGroups = {};
      liveSessions.forEach(s => {
        const key = `Y${s.year}S${s.semester}`;
        if (!batchGroups[key]) batchGroups[key] = [];
        batchGroups[key].push(s.courseId.code);
      });

      Object.entries(batchGroups).forEach(([batch, courses]) => {
        if (courses.length > 1) {
          console.log(`⚠️  WARNING: Multiple live sessions for ${batch}:`);
          console.log(`   ${courses.join(', ')}`);
          console.log('   Only one session should be live per batch!\n');
        }
      });
    }

    // Check students
    console.log('========================================');
    console.log('👥 STUDENT CHECK');
    console.log('========================================\n');

    const students = await Student.find().limit(5);
    
    if (students.length === 0) {
      console.log('❌ NO STUDENTS FOUND');
      console.log('   Add students in the web app first!\n');
    } else {
      console.log(`✅ Found ${await Student.countDocuments()} students\n`);
      console.log('Sample students:');
      students.forEach(s => {
        console.log(`  ${s.registrationNo} - ${s.name} (Y${s.year}S${s.semester})`);
      });
      console.log('');
    }

    // Test scan simulation
    console.log('========================================');
    console.log('🧪 SCAN SIMULATION');
    console.log('========================================\n');

    if (students.length > 0 && todaySessions.length > 0) {
      const testStudent = students[0];
      const matchingSessions = todaySessions.filter(
        s => s.year === testStudent.year && 
             s.semester === testStudent.semester &&
             s.status === 'live'
      );

      console.log(`Test Student: ${testStudent.name} (${testStudent.registrationNo})`);
      console.log(`Student Batch: Y${testStudent.year}S${testStudent.semester}\n`);

      if (matchingSessions.length === 0) {
        console.log('❌ SCAN WOULD FAIL: No live session for this student\'s batch');
        
        const studentBatchSessions = todaySessions.filter(
          s => s.year === testStudent.year && s.semester === testStudent.semester
        );
        
        if (studentBatchSessions.length > 0) {
          console.log(`   Found ${studentBatchSessions.length} session(s) for Y${testStudent.year}S${testStudent.semester}, but status is:`);
          studentBatchSessions.forEach(s => {
            console.log(`   - ${s.courseId.code}: ${s.status} (needs to be "live")`);
          });
        } else {
          console.log(`   No sessions found for Y${testStudent.year}S${testStudent.semester} today`);
        }
      } else {
        console.log('✅ SCAN WOULD SUCCEED');
        console.log(`   Session: ${matchingSessions[0].courseId.code}`);
        console.log(`   Time: ${matchingSessions[0].startTime} - ${matchingSessions[0].endTime}`);
      }
    }

    console.log('\n========================================');
    console.log('✅ DIAGNOSTIC COMPLETE');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkSessionStatus();
