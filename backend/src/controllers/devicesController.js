import crypto from 'crypto';
import { Device } from '../models/Device.js';

export const getDevices = async (req, res, next) => {
  try {
    const devices = await Device.find().populate({
      path: 'activeSessionId',
      populate: {
        path: 'courseId',
        select: 'code name'
      }
    }).sort({ name: 1 });

    // Auto-update device status based on last seen time
    // Consider device offline if not seen in last 15 minutes
    const OFFLINE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
    const now = new Date();
    
    console.log(`🔍 Device status check at ${now.toISOString()} (threshold: ${OFFLINE_THRESHOLD_MS}ms = ${OFFLINE_THRESHOLD_MS/60000} minutes)`);
    
    const updatedDevices = await Promise.all(
      devices.map(async (device) => {
        if (device.lastSeenAt) {
          const timeSinceLastSeen = now - new Date(device.lastSeenAt);
          const minutesSinceLastSeen = Math.round(timeSinceLastSeen / 60000);
          const shouldBeOffline = timeSinceLastSeen > OFFLINE_THRESHOLD_MS;
          
          console.log(`📱 Device "${device.name}": status=${device.status}, lastSeen=${device.lastSeenAt.toISOString()}, minutesAgo=${minutesSinceLastSeen}, shouldBeOffline=${shouldBeOffline}`);
          
          if (shouldBeOffline && device.status === 'online') {
            console.log(`❌ Marking device "${device.name}" offline after ${minutesSinceLastSeen} minutes`);
            device.status = 'offline';
            // Clear active session when going offline
            device.activeSessionId = null;
            await device.save();
          }
        } else if (device.status === 'online') {
          // Device has no lastSeenAt but is marked online - mark as offline
          console.log(`❌ Device "${device.name}" has no lastSeenAt but is online - marking offline`);
          device.status = 'offline';
          device.activeSessionId = null;
          await device.save();
        }

        // Add session end time calculation if device has active session
        let sessionEndTime = null;
        let minutesUntilSessionEnd = null;
        
        if (device.activeSessionId && device.status === 'online') {
          const session = device.activeSessionId;
          if (session && session.date && session.endTime) {
            // Calculate session end time in IST
            const sessionEndIso = `${session.date}T${session.endTime}:00.000Z`;
            const sessionEnd = new Date(sessionEndIso);
            
            // Add IST offset (+5:30)
            const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
            const sessionEndIST = new Date(sessionEnd.getTime() + IST_OFFSET_MS);
            
            sessionEndTime = sessionEndIST;
            minutesUntilSessionEnd = Math.max(0, Math.round((sessionEndIST.getTime() - now.getTime()) / 60000));
          }
        }

        return {
          ...device.toObject(),
          sessionEndTime,
          minutesUntilSessionEnd
        };
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
    const { force } = req.query;
    const deviceId = req.params.id;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Check if there are related records
    const scanCount = await (await import('../models/Scan.js')).Scan.countDocuments({ deviceId });

    const hasRelatedData = scanCount > 0;

    // If there's related data and force is not specified, return conflict
    if (hasRelatedData && force !== 'true') {
      return res.status(409).json({
        success: false,
        message: 'Device has related data',
        relatedData: {
          scanRecords: scanCount
        },
        requiresForceDelete: true
      });
    }

    // If force delete is requested, delete all related data
    if (force === 'true') {
      const { Scan } = await import('../models/Scan.js');

      await Promise.all([
        // Delete scan records
        Scan.deleteMany({ deviceId })
      ]);
    }

    // Delete the device
    await Device.findByIdAndDelete(deviceId);

    res.json({
      success: true,
      message: force === 'true' ? 'Device and all related data deleted' : 'Device deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Debug endpoint to manually test device status
export const debugDeviceStatus = async (req, res, next) => {
  try {
    const { action } = req.params; // 'online' or 'offline' or 'status'
    
    const device = await Device.findOne().sort({ updatedAt: -1 }); // Get most recent device
    
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'No devices found'
      });
    }
    
    const now = new Date();
    
    if (action === 'online') {
      device.status = 'online';
      device.lastSeenAt = now;
      await device.save();
      
      const expireTime = new Date(now.getTime() + 15 * 60 * 1000);
      
      return res.json({
        success: true,
        message: `Device "${device.name}" marked online`,
        data: {
          device: device.name,
          status: device.status,
          lastSeenAt: device.lastSeenAt,
          shouldExpireAt: expireTime,
          minutesUntilExpire: 15
        }
      });
    }
    
    if (action === 'offline') {
      device.status = 'offline';
      await device.save();
      
      return res.json({
        success: true,
        message: `Device "${device.name}" marked offline`,
        data: {
          device: device.name,
          status: device.status,
          lastSeenAt: device.lastSeenAt
        }
      });
    }
    
    // Default: return status
    const timeSinceLastSeen = device.lastSeenAt ? now - new Date(device.lastSeenAt) : null;
    const minutesSinceLastSeen = timeSinceLastSeen ? Math.round(timeSinceLastSeen / 60000) : null;
    
    res.json({
      success: true,
      data: {
        device: device.name,
        status: device.status,
        lastSeenAt: device.lastSeenAt,
        minutesSinceLastSeen,
        shouldBeOfflineAfter15Min: timeSinceLastSeen ? timeSinceLastSeen > (15 * 60 * 1000) : null,
        currentTime: now
      }
    });
  } catch (error) {
    next(error);
  }
};
