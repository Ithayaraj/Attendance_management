import { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';

export const useDeviceStatus = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const loadDeviceStatus = async () => {
    try {
      const response = await apiClient.get('/api/devices');
      const data = response?.data?.data || response?.data || response;
      const deviceList = Array.isArray(data) ? data : [];
      
      setDevices(deviceList);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading device status:', error);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeviceStatus();
    
    // Check device status every 30 seconds
    const interval = setInterval(() => {
      loadDeviceStatus();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const onlineDevices = devices.filter(device => device.status === 'online');
  const isConnected = onlineDevices.length > 0;
  const onlineCount = onlineDevices.length;
  const totalCount = devices.length;

  return {
    devices,
    onlineDevices,
    isConnected,
    onlineCount,
    totalCount,
    loading,
    lastUpdate,
    refresh: loadDeviceStatus
  };
};