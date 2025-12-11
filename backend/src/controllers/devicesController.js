import crypto from 'crypto';
import { Device } from '../models/Device.js';

export const getDevices = async (req, res, next) => {
  try {
    const devices = await Device.find().sort({ name: 1 });

    // Auto-update device status based on last seen time
    // Consider device offline if not seen in last 2 minutes
    const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
    const now = new Date();
    
    const updatedDevices = await Promise.all(
      devices.map(async (device) => {
        if (device.lastSeenAt) {
          const timeSinceLastSeen = now - new Date(device.lastSeenAt);
          const shouldBeOffline = timeSinceLastSeen > OFFLINE_THRESHOLD_MS;
          
          if (shouldBeOffline && device.status === 'online') {
            device.status = 'offline';
            await device.save();
          }
        }
        return device;
      })
    );

    res.json({
      success: true,
      data: updatedDevices
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

export const deleteDevice = async (req, res, next) => {
  try {
    const device = await Device.findByIdAndDelete(req.params.id);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    res.json({
      success: true,
      message: 'Device deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
