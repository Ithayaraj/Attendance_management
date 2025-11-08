import { useState, useEffect, useCallback } from 'react';

// Construct WebSocket URL properly (ws:// for HTTP, wss:// for HTTPS)
const getWebSocketURL = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  if (apiUrl.startsWith('https://')) {
    return apiUrl.replace('https://', 'wss://') + '/ws';
  } else {
    return apiUrl.replace('http://', 'ws://') + '/ws';
  }
};

const WS_URL = getWebSocketURL();
console.log('WebSocket URL:', WS_URL);

export const useScanStream = () => {
  const [connected, setConnected] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const [events, setEvents] = useState([]);
  const [sessionStatus, setSessionStatus] = useState(null);

  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connect = () => {
      try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
          console.log('WebSocket connected');
          setConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('=== WebSocket message received ===');
            console.log('Raw data:', data);
            console.log('Data type:', data.type);
            console.log('Data payload:', data.payload);

            if (data.type === 'scan.ingested' || data.type === 'scan.duplicate') {
              console.log('Processing scan.ingested/duplicate - creating lastScan object');
              const scanData = { 
                ...data.payload, 
                type: data.type 
              };
              console.log('Setting lastScan with:', scanData);
              setLastScan(scanData);
              setEvents((prev) => [data, ...prev].slice(0, 50));
            } else if (data.type === 'scan.error') {
              // Handle scan errors for notifications
              console.log('Processing scan.error - creating lastScan object');
              const scanData = { 
                ...data.payload, 
                type: data.type 
              };
              console.log('Setting lastScan with:', scanData);
              setLastScan(scanData);
              setEvents((prev) => [data, ...prev].slice(0, 50));
            } else if (data.type === 'attendance.updated') {
              setEvents((prev) => [data, ...prev].slice(0, 50));
            } else if (data.type === 'session.status') {
              setSessionStatus(data.payload);
            } else if (data.type === 'connected') {
              // Handle connection confirmation message
              console.log('WebSocket connection confirmed:', data.payload?.message);
            } else {
              console.log('Unknown WebSocket message type:', data.type);
            }
          } catch (error) {
            console.error('WebSocket message error:', error);
            console.error('Event data:', event.data);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setConnected(false);

          reconnectTimeout = setTimeout(() => {
            console.log('Reconnecting...');
            connect();
          }, 3000);
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
      }
    };

    connect();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { connected, lastScan, events, clearEvents };
};
