import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react';

export const Notification = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    setIsVisible(true);
    
    const duration = notification.duration || 5000;
    const interval = 50; // Update every 50ms
    const decrement = (interval / duration) * 100;
    
    // Progress bar animation
    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        const next = prev - decrement;
        return next <= 0 ? 0 : next;
      });
    }, interval);
    
    // Auto-close after duration
    const closeTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(), 300);
    }, duration);

    return () => {
      clearInterval(progressTimer);
      clearTimeout(closeTimer);
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

  const getProgressColor = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'warning':
        return 'bg-amber-500';
      default:
        return 'bg-cyan-500';
    }
  };
  
  if (!isVisible) return null;
  
  return (
    <div
      className={`min-w-[320px] max-w-md w-full transform transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
      }`}
    >
      <div
        className={`${getBgColor()} rounded-lg shadow-2xl border-2 overflow-hidden`}
      >
        <div className="p-4 flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            {notification.title && (
              <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                {notification.title}
              </p>
            )}
            {typeof notification.message === 'string' ? (
              <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line">
                {notification.message}
              </div>
            ) : (
              <div className="text-sm text-slate-700 dark:text-slate-300">
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
        {/* Progress Bar */}
        <div className="h-1 bg-slate-200 dark:bg-slate-700">
          <div
            className={`h-full ${getProgressColor()} transition-all duration-50 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export const NotificationContainer = ({ notifications, onRemove }) => {
  if (notifications.length === 0) return null;
  
  const containerContent = (
    <div 
      className="fixed top-4 right-4 space-y-3 pointer-events-none z-[99999]"
      style={{ 
        maxWidth: '420px',
        width: 'calc(100vw - 2rem)',
      }}
    >
      {notifications.map((notification) => (
        <div 
          key={notification.id} 
          className="pointer-events-auto"
        >
          <Notification
            notification={notification}
            onClose={() => onRemove(notification.id)}
          />
        </div>
      ))}
    </div>
  );
  
  return typeof document !== 'undefined' 
    ? createPortal(containerContent, document.body)
    : containerContent;
};

