import { useState, useRef, useCallback } from 'react';

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

export const useDataCache = () => {
  const cacheRef = useRef(new Map());

  const getCachedData = useCallback((key) => {
    const cached = cacheRef.current.get(key);
    if (!cached) return null;

    const now = Date.now();
    const age = now - cached.timestamp;

    // Return cached data if still fresh
    if (age < CACHE_DURATION) {
      return cached.data;
    }

    // Remove stale cache
    cacheRef.current.delete(key);
    return null;
  }, []);

  const setCachedData = useCallback((key, data) => {
    cacheRef.current.set(key, {
      data,
      timestamp: Date.now()
    });
  }, []);

  const clearCache = useCallback((key) => {
    if (key) {
      cacheRef.current.delete(key);
    } else {
      cacheRef.current.clear();
    }
  }, []);

  const isDataFresh = useCallback((key) => {
    const cached = cacheRef.current.get(key);
    if (!cached) return false;

    const now = Date.now();
    const age = now - cached.timestamp;
    return age < CACHE_DURATION;
  }, []);

  return {
    getCachedData,
    setCachedData,
    clearCache,
    isDataFresh
  };
};

