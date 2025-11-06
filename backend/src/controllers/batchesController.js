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
    const { startYear, name } = req.body || {};
    if (!startYear) {
      return res.status(400).json({ success: false, message: 'startYear is required' });
    }
    const batch = await Batch.create({ startYear, name });
    res.status(201).json(batch);
  } catch (error) {
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
    const { startYear, name } = req.body || {};
    const updated = await Batch.findByIdAndUpdate(
      id,
      { ...(startYear !== undefined ? { startYear } : {}), ...(name !== undefined ? { name } : {}) },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Batch not found' });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};


