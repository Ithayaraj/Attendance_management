import { Batch } from '../models/Batch.js';

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
    
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
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


