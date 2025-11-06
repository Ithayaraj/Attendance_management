import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { Student } from '../models/Student.js';
import { Course } from '../models/Course.js';
import { Enrollment } from '../models/Enrollment.js';
import { ClassSession } from '../models/ClassSession.js';
import { Device } from '../models/Device.js';
import { AttendanceRecord } from '../models/AttendanceRecord.js';

const departments = ['Computer Science', 'Engineering', 'Mathematics', 'Physics'];
const rooms = ['A101', 'A102', 'B201', 'B202', 'C301'];

const generateBarcode = () => {
  return 'BC' + Math.random().toString(36).substring(2, 12).toUpperCase();
};

const getRandomDate = (month, year) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = Math.floor(Math.random() * daysInMonth) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const seed = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB');

    await User.deleteMany({});
    await Student.deleteMany({});
    await Course.deleteMany({});
    await Enrollment.deleteMany({});
    await ClassSession.deleteMany({});
    await Device.deleteMany({});
    await AttendanceRecord.deleteMany({});

    console.log('Cleared existing data');

    const passwordHash = await bcrypt.hash('password123', 10);

    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@university.edu',
      role: 'admin',
      passwordHash
    });

    const instructor = await User.create({
      name: 'Prof. John Smith',
      email: 'instructor@university.edu',
      role: 'instructor',
      passwordHash
    });

    console.log('Created users');
    console.log('Admin: admin@university.edu / password123');
    console.log('Instructor: instructor@university.edu / password123');

    const deviceApiKey = crypto.randomBytes(32).toString('hex');
    const device = await Device.create({
      name: 'Main Entrance Scanner',
      location: 'Building A - Main Entrance',
      apiKey: deviceApiKey,
      status: 'online',
      lastSeenAt: new Date()
    });

    console.log('\nDevice API Key:', deviceApiKey);

    const courses = await Course.insertMany([
      {
        code: 'CS101',
        name: 'Introduction to Programming',
        department: 'Computer Science',
        instructorId: instructor._id,
        semester: 'Fall 2025'
      },
      {
        code: 'CS201',
        name: 'Data Structures',
        department: 'Computer Science',
        instructorId: instructor._id,
        semester: 'Fall 2025'
      },
      {
        code: 'MATH301',
        name: 'Linear Algebra',
        department: 'Mathematics',
        instructorId: instructor._id,
        semester: 'Fall 2025'
      }
    ]);

    console.log('Created courses');

    const students = [];
    const sampleRegistrations = [];

    for (let i = 1; i <= 80; i++) {
      const year = Math.floor(Math.random() * 4) + 1;
      const semester = Math.floor(Math.random() * 8) + 1;
      const student = {
        registrationNo: `UOV/2025/${String(i).padStart(4, '0')}`,
        name: `Student ${i}`,
        email: `student${i}@uov.ac.lk`,
        department: departments[Math.floor(Math.random() * departments.length)],
        year,
        semester,
        phone: `+94${String(Math.floor(Math.random() * 900000000 + 100000000))}`,
        address: `Vavuniya, Northern Province, Sri Lanka`
      };
      students.push(student);

      if (i <= 10) {
        sampleRegistrations.push({ registrationNo: student.registrationNo, name: student.name });
      }
    }

    const createdStudents = await Student.insertMany(students);
    console.log('Created 80 students');
    console.log('\nSample students:');
    sampleRegistrations.forEach(s => {
      console.log(`${s.registrationNo}: ${s.name}`);
    });

    const enrollments = [];
    for (const course of courses) {
      const numEnrolled = 25 + Math.floor(Math.random() * 10);
      const shuffled = [...createdStudents].sort(() => 0.5 - Math.random());

      for (let i = 0; i < numEnrolled; i++) {
        enrollments.push({
          courseId: course._id,
          studentId: shuffled[i]._id,
          status: 'active'
        });
      }
    }

    await Enrollment.insertMany(enrollments);
    console.log('Created enrollments');

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const sessions = [];
    for (const course of courses) {
      for (let i = 0; i < 12; i++) {
        const date = getRandomDate(currentMonth, currentYear);
        const startHour = 9 + Math.floor(Math.random() * 6);
        const startTime = `${String(startHour).padStart(2, '0')}:00`;
        const endTime = `${String(startHour + 1).padStart(2, '0')}:50`;

        sessions.push({
          courseId: course._id,
          date,
          startTime,
          endTime,
          room: rooms[Math.floor(Math.random() * rooms.length)],
          status: 'closed'
        });
      }
    }

    const createdSessions = await ClassSession.insertMany(sessions);
    console.log('Created class sessions');

    const attendanceRecords = [];
    for (const session of createdSessions) {
      const courseEnrollments = enrollments.filter(
        e => e.courseId.toString() === session.courseId.toString()
      );

      for (const enrollment of courseEnrollments) {
        const rand = Math.random();
        let status;

        if (rand < 0.65) {
          status = 'present';
        } else if (rand < 0.80) {
          status = 'late';
        } else {
          status = 'absent';
        }

        const record = {
          sessionId: session._id,
          studentId: enrollment.studentId,
          status
        };

        if (status !== 'absent') {
          const sessionDate = new Date(session.date + 'T' + session.startTime);
          if (status === 'late') {
            sessionDate.setMinutes(sessionDate.getMinutes() + 15);
          }
          record.checkInAt = sessionDate;
        }

        attendanceRecords.push(record);
      }
    }

    await AttendanceRecord.insertMany(attendanceRecords);
    console.log('Created attendance records');

    console.log('\nSeed completed successfully!');
    console.log('\nQuick start:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Access frontend: http://localhost:5173');
    console.log('3. Login with: admin@university.edu / password123');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
