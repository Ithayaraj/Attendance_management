import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react';

export const Notification = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(true); // Start visible immediately

  useEffect(() => {
    console.log('=== Notification useEffect triggered ===');
    console.log('Notification ID:', notification.id);
    console.log('Notification data:', notification);
    // Ensure it's visible immediately
    setIsVisible(true);
    console.log('Notification visibility set to true');
    
    // Auto-close after duration
    const timer = setTimeout(() => {
      console.log('Auto-closing notification:', notification.id);
      setIsVisible(false);
      setTimeout(() => {
        console.log('Calling onClose for notification:', notification.id);
        onClose();
      }, 300); // Wait for fade out
    }, notification.duration || 5000);

    return () => {
      clearTimeout(timer);
    };
  }, [notification, onClose]);

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      default:
        return <Info className="w-5 h-5 text-cyan-600" />;
    }
  };

  const getBgColor = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800';
    }
  };

  console.log('=== Notification Component Render ===');
  console.log('isVisible:', isVisible);
  console.log('notification ID:', notification.id);
  console.log('notification title:', notification.title);
  console.log('notification message:', notification.message);
  console.log('notification type:', notification.type);
  
  if (!isVisible) {
    console.log('Notification is not visible, returning null');
    return null;
  }
  
  return (
    <div
      className="min-w-[320px] max-w-sm w-full"
      style={{ 
        transform: 'translateX(0)',
        opacity: 1,
        transition: 'all 0.3s ease-in-out',
        willChange: 'transform, opacity',
        pointerEvents: 'auto',
        display: 'block',
        visibility: 'visible',
        position: 'relative',
        zIndex: 100000,
        backgroundColor: 'transparent',
      }}
    >
      <div
        className={`${getBgColor()} rounded-lg shadow-xl border-2 p-4 flex items-start gap-3`}
        style={{
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          {notification.title && (
            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
              {notification.title}
            </p>
          )}
          {typeof notification.message === 'string' ? (
            <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {notification.message}
            </div>
          ) : (
            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {notification.message}
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(() => onClose(), 300);
          }}
          className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const NotificationContainer = ({ notifications, onRemove }) => {
  console.log('=== NotificationContainer render ===');
  console.log('Notifications count:', notifications.length);
  console.log('Notifications array:', JSON.stringify(notifications, null, 2));
  console.log('onRemove function:', typeof onRemove);
  
  if (notifications.length === 0) {
    console.log('No notifications to display - returning null');
    return null;
  }
  
  console.log('Rendering', notifications.length, 'notifications');
  
  const containerContent = (
    <div 
      className="fixed top-4 right-4 space-y-2 pointer-events-none"
      style={{ 
        maxWidth: '420px',
        width: 'calc(100vw - 2rem)',
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 99999,
        pointerEvents: 'none',
        backgroundColor: 'transparent',
      }}
    >
      {notifications.map((notification, index) => {
        console.log(`Rendering notification ${index + 1}/${notifications.length}:`, notification);
        return (
          <div 
            key={notification.id} 
            className="pointer-events-auto mb-2"
            style={{
              pointerEvents: 'auto',
            }}
          >
            <Notification
              notification={notification}
              onClose={() => {
                console.log('Removing notification:', notification.id);
                onRemove(notification.id);
              }}
            />
          </div>
        );
      })}
    </div>
  );
  
  // Use portal to render at document body level to avoid any parent container issues
  return typeof document !== 'undefined' 
    ? createPortal(containerContent, document.body)
    : containerContent;
};

