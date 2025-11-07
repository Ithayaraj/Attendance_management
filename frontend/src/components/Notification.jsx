import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react';

export const Notification = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show immediately
    setIsVisible(true);
    
    // Auto-close after duration
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(), 300); // Wait for fade out
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

  return (
    <div
      className="min-w-[320px] max-w-md"
      style={{ 
        transform: isVisible ? 'translateX(0)' : 'translateX(calc(100% + 1rem))',
        opacity: isVisible ? 1 : 0,
        transition: 'all 0.3s ease-in-out',
        willChange: 'transform, opacity'
      }}
    >
      <div
        className={`${getBgColor()} rounded-lg shadow-lg border p-4 flex items-start gap-3`}
      >
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          {notification.title && (
            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
              {notification.title}
            </p>
          )}
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {notification.message}
          </p>
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
  console.log('NotificationContainer render - notifications count:', notifications.length, notifications);
  
  if (notifications.length === 0) {
    return null;
  }
  
  return (
    <div 
      className="fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none"
      style={{ 
        maxWidth: '400px',
        width: 'calc(100% - 2rem)',
      }}
    >
      {notifications.map((notification, index) => (
        <div 
          key={notification.id} 
          className="pointer-events-auto mb-2"
        >
          <Notification
            notification={notification}
            onClose={() => {
              console.log('Removing notification:', notification.id);
              onRemove(notification.id);
            }}
          />
        </div>
      ))}
    </div>
  );
};

