import { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      setUser(JSON.parse(userData));
    }

    setLoading(false);

    // Listen for auth logout events (from API client on 401)
    const handleLogout = () => {
      setUser(null);
    };

    window.addEventListener('auth:logout', handleLogout);

    return () => {
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, []);

  const login = async (email, password) => {
    try {
      setLoginLoading(true);
      const response = await apiClient.post('/api/auth/login', { email, password });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      setUser(response.data.user);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');

    try {
      setLogoutLoading(true);
      if (refreshToken) {
        try {
        await apiClient.post('/api/auth/logout', { refreshToken });
        } catch (error) {
          // Ignore logout API errors, still clear local storage
          console.error('Logout API error:', error);
        }
      }
    } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
      setLogoutLoading(false);
      // Dispatch logout event for other components
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  };

  const refreshToken = async () => {
    try {
      const refToken = localStorage.getItem('refreshToken');

      if (!refToken) {
        throw new Error('No refresh token');
      }

      const response = await apiClient.post('/api/auth/refresh', {
        refreshToken: refToken,
      });

      localStorage.setItem('token', response.data.token);

      return true;
    } catch (error) {
      logout();
      return false;
    }
  };

  return { user, loading, login, logout, refreshToken, loginLoading, logoutLoading };
};
