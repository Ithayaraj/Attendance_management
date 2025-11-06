import { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';

export const useSessionAttendance = (sessionId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAttendance = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await apiClient.get(`/api/sessions/${sessionId}/attendance`);
        setData(response.data);
        setError(null);
      } catch (err) {
        setError(err.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [sessionId]);

  const refetch = async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      const response = await apiClient.get(`/api/sessions/${sessionId}/attendance`);
      setData(response.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch };
};
