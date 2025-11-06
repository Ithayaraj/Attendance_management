import { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';

export const useStudents = (search = '', page = 1, limit = 50) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(
          `/api/students?search=${search}&page=${page}&limit=${limit}`
        );
        setData(response.data);
        setError(null);
      } catch (err) {
        setError(err.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [search, page, limit]);

  const refetch = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(
        `/api/students?search=${search}&page=${page}&limit=${limit}`
      );
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
