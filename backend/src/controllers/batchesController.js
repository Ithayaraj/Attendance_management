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
    const { id } = req.params;
    await Batch.findByIdAndDelete(id);
    res.json({ success: true });
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


