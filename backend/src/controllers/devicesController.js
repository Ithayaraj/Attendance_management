import crypto from 'crypto';
import { Device } from '../models/Device.js';

export const getDevices = async (req, res, next) => {
  try {
    const devices = await Device.find().sort({ name: 1 });

    res.json({
      success: true,
      data: devices
    });
  } catch (error) {
    next(error);
  }
};

export const createDevice = async (req, res, next) => {
  try {
    const apiKey = crypto.randomBytes(32).toString('hex');

    const device = await Device.create({
      ...req.body,
      apiKey,
      status: 'offline'
    });

    res.status(201).json({
      success: true,
      data: device
    });
  } catch (error) {
    next(error);
  }
};

export const updateDevice = async (req, res, next) => {
  try {
    const { status, name, location } = req.body;

    const device = await Device.findByIdAndUpdate(
      req.params.id,
      { status, name, location },
      { new: true, runValidators: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    res.json({
      success: true,
      data: device
    });
  } catch (error) {
    next(error);
  }
};

export const rotateDeviceKey = async (req, res, next) => {
  try {
    const apiKey = crypto.randomBytes(32).toString('hex');

    const device = await Device.findByIdAndUpdate(
      req.params.id,
      { apiKey },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    res.json({
      success: true,
      data: {
        apiKey: device.apiKey
      }
    });
  } catch (error) {
    next(error);
  }
};
