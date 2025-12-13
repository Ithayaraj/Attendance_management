import { Batch } from '../models/Batch.js';
import { Student } from '../models/Student.js';

export const listBatches = async (req, res, next) => {
  try {
    const batches = await Batch.find({}).sort({ startYear: -1 });
    res.json(batches);
  } catch (error) {
    next(error);
  }
};

export const createBatch = async (req, res, next) => {
  try {
    const { startYear, name, faculty, department, currentYear, currentSemester } = req.body || {};
    
    if (!startYear) {
      return res.status(400).json({ success: false, message: 'startYear is required' });
    }
    if (!faculty) {
      return res.status(400).json({ success: false, message: 'faculty is required' });
    }
    if (!department) {
      return res.status(400).json({ success: false, message: 'department is required' });
    }
    
    const batch = await Batch.create({ 
      startYear, 
      name: name || `${startYear} Batch`,
      faculty,
      department,
      currentYear: currentYear || 1,
      currentSemester: currentSemester || 1
    });
    
    res.status(201).json(batch);
  } catch (error) {
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'This department with the same current year and semester already exists for this batch' 
      });
    }
    next(error);
  }
};

export const deleteBatch = async (req, res, next) => {
  try {
    const { force } = req.query;
    const batchId = req.params.id;

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    // Check if there are related records for this batch (department + year + semester)
    const batchCriteria = {
      department: batch.department,
      year: batch.currentYear,
      semester: batch.currentSemester
    };

    const [studentCount, courseCount, sessionCount] = await Promise.all([
      Student.countDocuments(batchCriteria),
      (await import('../models/Course.js')).Course.countDocuments(batchCriteria),
      (await import('../models/ClassSession.js')).ClassSession.countDocuments(batchCriteria)
    ]);

    // Also count enrollments, attendance records, and scans
    let enrollmentCount = 0;
    let attendanceCount = 0;
    let scanCount = 0;

    if (studentCount > 0 || courseCount > 0 || sessionCount > 0) {
      const students = await Student.find(batchCriteria, '_id');
      const studentIds = students.map(s => s._id);
      
      const courses = await (await import('../models/Course.js')).Course.find(batchCriteria, '_id');
      const courseIds = courses.map(c => c._id);
      
      const sessions = await (await import('../models/ClassSession.js')).ClassSession.find(batchCriteria, '_id');
      const sessionIds = sessions.map(s => s._id);

      [enrollmentCount, attendanceCount, scanCount] = await Promise.all([
        studentIds.length > 0 || courseIds.length > 0 ? 
          (await import('../models/Enrollment.js')).Enrollment.countDocuments({
            $or: [
              ...(studentIds.length > 0 ? [{ studentId: { $in: studentIds } }] : []),
              ...(courseIds.length > 0 ? [{ courseId: { $in: courseIds } }] : [])
            ]
          }) : 0,
        sessionIds.length > 0 || studentIds.length > 0 ? 
          (await import('../models/AttendanceRecord.js')).AttendanceRecord.countDocuments({
            $or: [
              ...(sessionIds.length > 0 ? [{ sessionId: { $in: sessionIds } }] : []),
              ...(studentIds.length > 0 ? [{ studentId: { $in: studentIds } }] : [])
            ]
          }) : 0,
        sessionIds.length > 0 || courseIds.length > 0 ? 
          (await import('../models/Scan.js')).Scan.countDocuments({
            $or: [
              ...(sessionIds.length > 0 ? [{ sessionId: { $in: sessionIds } }] : []),
              ...(courseIds.length > 0 ? [{ courseId: { $in: courseIds } }] : [])
            ]
          }) : 0
      ]);
    }

    const hasRelatedData = studentCount > 0 || courseCount > 0 || sessionCount > 0 || 
                          enrollmentCount > 0 || attendanceCount > 0 || scanCount > 0;

    // If there's related data and force is not specified, return conflict
    if (hasRelatedData && force !== 'true') {
      return res.status(409).json({
        success: false,
        message: 'Batch has related data',
        relatedData: {
          students: studentCount,
          courses: courseCount,
          sessions: sessionCount,
          enrollments: enrollmentCount,
          attendanceRecords: attendanceCount,
          scanRecords: scanCount
        },
        batchInfo: {
          department: batch.department,
          year: batch.currentYear,
          semester: batch.currentSemester
        },
        requiresForceDelete: true
      });
    }

    // If force delete is requested, delete all related data
    if (force === 'true') {
      const { Course } = await import('../models/Course.js');
      const { ClassSession } = await import('../models/ClassSession.js');
      const { Enrollment } = await import('../models/Enrollment.js');
      const { AttendanceRecord } = await import('../models/AttendanceRecord.js');
      const { Scan } = await import('../models/Scan.js');
      const { Device } = await import('../models/Device.js');

      // Get all IDs for cascade deletion
      const students = await Student.find(batchCriteria, '_id');
      const studentIds = students.map(s => s._id);
      
      const courses = await Course.find(batchCriteria, '_id');
      const courseIds = courses.map(c => c._id);
      
      const sessions = await ClassSession.find(batchCriteria, '_id');
      const sessionIds = sessions.map(s => s._id);

      // Delete all related data
      await Promise.all([
        // Delete students
        Student.deleteMany(batchCriteria),
        // Delete courses
        Course.deleteMany(batchCriteria),
        // Delete sessions
        ClassSession.deleteMany(batchCriteria),
        // Delete enrollments
        studentIds.length > 0 || courseIds.length > 0 ? 
          Enrollment.deleteMany({
            $or: [
              ...(studentIds.length > 0 ? [{ studentId: { $in: studentIds } }] : []),
              ...(courseIds.length > 0 ? [{ courseId: { $in: courseIds } }] : [])
            ]
          }) : Promise.resolve(),
        // Delete attendance records
        sessionIds.length > 0 || studentIds.length > 0 ? 
          AttendanceRecord.deleteMany({
            $or: [
              ...(sessionIds.length > 0 ? [{ sessionId: { $in: sessionIds } }] : []),
              ...(studentIds.length > 0 ? [{ studentId: { $in: studentIds } }] : [])
            ]
          }) : Promise.resolve(),
        // Delete scan records
        sessionIds.length > 0 || courseIds.length > 0 ? 
          Scan.deleteMany({
            $or: [
              ...(sessionIds.length > 0 ? [{ sessionId: { $in: sessionIds } }] : []),
              ...(courseIds.length > 0 ? [{ courseId: { $in: courseIds } }] : [])
            ]
          }) : Promise.resolve(),
        // Clear device references
        sessionIds.length > 0 ? 
          Device.updateMany(
            { activeSessionId: { $in: sessionIds } },
            { $unset: { activeSessionId: 1 } }
          ) : Promise.resolve()
      ]);
    }

    // Delete the batch
    await Batch.findByIdAndDelete(batchId);

    res.json({
      success: true,
      message: force === 'true' ? 'Batch and all related data deleted' : 'Batch deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

export const getBatchRelations = async (req, res, next) => {
  try {
    const batchId = req.params.id;

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    // Check if there are related records for this batch (department + year + semester)
    const batchCriteria = {
      department: batch.department,
      year: batch.currentYear,
      semester: batch.currentSemester
    };

    const [studentCount, courseCount, sessionCount] = await Promise.all([
      Student.countDocuments(batchCriteria),
      (await import('../models/Course.js')).Course.countDocuments(batchCriteria),
      (await import('../models/ClassSession.js')).ClassSession.countDocuments(batchCriteria)
    ]);

    // Also count enrollments, attendance records, and scans
    let enrollmentCount = 0;
    let attendanceCount = 0;
    let scanCount = 0;

    if (studentCount > 0 || courseCount > 0 || sessionCount > 0) {
      const students = await Student.find(batchCriteria, '_id');
      const studentIds = students.map(s => s._id);
      
      const courses = await (await import('../models/Course.js')).Course.find(batchCriteria, '_id');
      const courseIds = courses.map(c => c._id);
      
      const sessions = await (await import('../models/ClassSession.js')).ClassSession.find(batchCriteria, '_id');
      const sessionIds = sessions.map(s => s._id);

      [enrollmentCount, attendanceCount, scanCount] = await Promise.all([
        studentIds.length > 0 || courseIds.length > 0 ? 
          (await import('../models/Enrollment.js')).Enrollment.countDocuments({
            $or: [
              ...(studentIds.length > 0 ? [{ studentId: { $in: studentIds } }] : []),
              ...(courseIds.length > 0 ? [{ courseId: { $in: courseIds } }] : [])
            ]
          }) : 0,
        sessionIds.length > 0 || studentIds.length > 0 ? 
          (await import('../models/AttendanceRecord.js')).AttendanceRecord.countDocuments({
            $or: [
              ...(sessionIds.length > 0 ? [{ sessionId: { $in: sessionIds } }] : []),
              ...(studentIds.length > 0 ? [{ studentId: { $in: studentIds } }] : [])
            ]
          }) : 0,
        sessionIds.length > 0 || courseIds.length > 0 ? 
          (await import('../models/Scan.js')).Scan.countDocuments({
            $or: [
              ...(sessionIds.length > 0 ? [{ sessionId: { $in: sessionIds } }] : []),
              ...(courseIds.length > 0 ? [{ courseId: { $in: courseIds } }] : [])
            ]
          }) : 0
      ]);
    }

    const hasRelatedData = studentCount > 0 || courseCount > 0 || sessionCount > 0 || 
                          enrollmentCount > 0 || attendanceCount > 0 || scanCount > 0;

    res.json({
      success: true,
      data: {
        hasRelatedData,
        relatedData: {
          students: studentCount,
          courses: courseCount,
          sessions: sessionCount,
          enrollments: enrollmentCount,
          attendanceRecords: attendanceCount,
          scanRecords: scanCount
        },
        batchInfo: {
          department: batch.department,
          year: batch.currentYear,
          semester: batch.currentSemester
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startYear, name, faculty, department, currentYear, currentSemester } = req.body || {};
    
    // Get the old batch data before updating
    const oldBatch = await Batch.findById(id);
    if (!oldBatch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }
    
    const updateData = {};
    if (startYear !== undefined) updateData.startYear = startYear;
    if (name !== undefined) updateData.name = name;
    if (faculty !== undefined) updateData.faculty = faculty;
    if (department !== undefined) updateData.department = department;
    if (currentYear !== undefined) updateData.currentYear = currentYear;
    if (currentSemester !== undefined) updateData.currentSemester = currentSemester;
    
    const updated = await Batch.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    // If year or semester changed, update all students in this batch
    const yearChanged = currentYear !== undefined && currentYear !== oldBatch.currentYear;
    const semesterChanged = currentSemester !== undefined && currentSemester !== oldBatch.currentSemester;
    
    console.log('=== Batch Update Check ===');
    console.log('Old Batch:', {
      department: oldBatch.department,
      year: oldBatch.currentYear,
      semester: oldBatch.currentSemester
    });
    console.log('New Values:', {
      year: currentYear,
      semester: currentSemester
    });
    console.log('Changes:', {
      yearChanged,
      semesterChanged
    });
    
    if (yearChanged || semesterChanged) {
      // Build student update data
      const studentUpdateData = {};
      if (yearChanged) studentUpdateData.year = currentYear;
      if (semesterChanged) studentUpdateData.semester = currentSemester;
      
      console.log('Student Update Data:', studentUpdateData);
      
      // First, count how many students match
      const matchingStudents = await Student.countDocuments({
        department: oldBatch.department,
        year: oldBatch.currentYear,
        semester: oldBatch.currentSemester
      });
      
      console.log(`Found ${matchingStudents} student(s) matching criteria`);
      
      // Update all students matching the old batch criteria
      const result = await Student.updateMany(
        {
          department: oldBatch.department,
          year: oldBatch.currentYear,
          semester: oldBatch.currentSemester
        },
        { $set: studentUpdateData }
      );
      
      console.log(`✅ Batch updated: ${oldBatch.department} Y${oldBatch.currentYear}S${oldBatch.currentSemester} → Y${updated.currentYear}S${updated.currentSemester}`);
      console.log(`📚 Updated ${result.modifiedCount} student(s)`);
      console.log(`   Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
      
      // Return batch with student update info
      return res.json({
        ...updated.toObject(),
        studentsUpdated: result.modifiedCount,
        studentsMatched: result.matchedCount
      });
    } else {
      console.log('No year/semester changes detected, skipping student updates');
    }
    
    res.json(updated);
  } catch (error) {
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'This department with the same current year and semester already exists for this batch' 
      });
    }
    next(error);
  }
};


