import { useState, useEffect, useCallback } from 'react';

const WS_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('http', 'ws') + '/ws'
  : 'ws://localhost:5000/ws';

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

            if (data.type === 'scan.ingested' || data.type === 'scan.duplicate') {
              setLastScan({ ...data.payload, type: data.type });
              setEvents((prev) => [data, ...prev].slice(0, 50));
            } else if (data.type === 'scan.error') {
              // Handle scan errors for notifications
              setLastScan({ ...data.payload, type: data.type });
              setEvents((prev) => [data, ...prev].slice(0, 50));
            } else if (data.type === 'attendance.updated') {
              setEvents((prev) => [data, ...prev].slice(0, 50));
            } else if (data.type === 'session.status') {
              setSessionStatus(data.payload);
            }
          } catch (error) {
            console.error('WebSocket message error:', error);
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
