import { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const showNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    const newNotification = {
      id,
      type: 'info',
      duration: 4000,
      ...notification,
    };

    console.log('=== showNotification called ===');
    console.log('New notification:', JSON.stringify(newNotification, null, 2));
    
    setNotifications((prev) => {
      const updated = [...prev, newNotification];
      console.log('=== Notification state updated ===');
      console.log('Previous count:', prev.length);
      console.log('New count:', updated.length);
      console.log('All notifications:', JSON.stringify(updated, null, 2));
      return updated;
    });
    
    console.log('Notification ID returned:', id);
    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const showSuccess = useCallback((message, title = 'Success') => {
    return showNotification({ type: 'success', message, title });
  }, [showNotification]);

  const showError = useCallback((message, title = 'Error') => {
    return showNotification({ type: 'error', message, title, duration: 5000 });
  }, [showNotification]);

  const showWarning = useCallback((message, title = 'Warning') => {
    return showNotification({ type: 'warning', message, title });
  }, [showNotification]);

  const showInfo = useCallback((message, title = 'Info') => {
    return showNotification({ type: 'info', message, title });
  }, [showNotification]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        showNotification,
        removeNotification,
        showSuccess,
        showError,
        showWarning,
        showInfo,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

