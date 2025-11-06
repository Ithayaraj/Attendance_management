import { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';

export const useMonthlyAnalytics = (month) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/api/analytics/monthly?month=${month}`);
        setData(response.data);
        setError(null);
      } catch (err) {
        setError(err.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    if (month) {
      fetchAnalytics();
    }
  }, [month]);

  return { data, loading, error };
};
