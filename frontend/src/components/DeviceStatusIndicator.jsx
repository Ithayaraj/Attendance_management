import { Smartphone, Wifi, WifiOff } from 'lucide-react';
import { useDeviceStatus } from '../hooks/useDeviceStatus';

export const DeviceStatusIndicator = ({ className = '' }) => {
  const { isConnected, onlineCount, totalCount, loading } = useDeviceStatus();

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Checking...
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${
        isConnected 
          ? 'bg-green-500 animate-pulse' 
          : 'bg-red-500'
      }`}></div>
      <div className="flex items-center gap-1.5">
        {isConnected ? (
          <Wifi className="w-3 h-3 text-green-600 dark:text-green-400" />
        ) : (
          <WifiOff className="w-3 h-3 text-red-600 dark:text-red-400" />
        )}
        <span className={`text-xs font-medium ${
          isConnected 
            ? 'text-green-600 dark:text-green-400' 
            : 'text-red-600 dark:text-red-400'
        }`}>
          {isConnected ? `Connected (${onlineCount}/${totalCount})` : 'Disconnected'}
        </span>
      </div>
    </div>
  );
};

// Compact version for mobile/small spaces
export const DeviceStatusBadge = ({ className = '' }) => {
  const { isConnected, onlineCount } = useDeviceStatus();

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
      isConnected 
        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    } ${className}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${
        isConnected 
          ? 'bg-green-500 animate-pulse' 
          : 'bg-red-500'
      }`}></div>
      <span>
        {isConnected ? `${onlineCount} Online` : 'Offline'}
      </span>
    </div>
  );
};