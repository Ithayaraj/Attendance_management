import { Smartphone, Wifi, WifiOff, BookOpen, Clock } from 'lucide-react';
import { useDeviceStatus } from '../hooks/useDeviceStatus';

export const DeviceStatusIndicator = ({ className = '', showSessionInfo = false }) => {
  const { isConnected, onlineCount, totalCount, loading, devices } = useDeviceStatus();

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Checking scanners...
        </span>
      </div>
    );
  }

  const activeSessions = devices.filter(d => d.status === 'online' && d.activeSessionId);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {/* Primary Status */}
      <div className="flex items-center gap-2">
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
            {isConnected ? `${onlineCount} Scanner${onlineCount !== 1 ? 's' : ''}` : 'No Scanners'}
          </span>
        </div>
      </div>

      {/* Session Info */}
      {showSessionInfo && isConnected && (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 ml-4">
          {activeSessions.length > 0 ? (
            <>
              <BookOpen className="w-3 h-3" />
              <span>
                {activeSessions.length === 1 
                  ? `Scanning: ${activeSessions[0].activeSessionId?.courseId?.code || 'Session'}`
                  : `${activeSessions.length} active sessions`
                }
              </span>
            </>
          ) : (
            <>
              <Clock className="w-3 h-3" />
              <span>Ready to scan</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Compact version for mobile/small spaces
export const DeviceStatusBadge = ({ className = '', showSessionInfo = false }) => {
  const { isConnected, onlineCount, devices } = useDeviceStatus();

  const activeSessions = devices.filter(d => d.status === 'online' && d.activeSessionId);
  const hasActiveSessions = activeSessions.length > 0;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
      isConnected 
        ? hasActiveSessions
          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    } ${className}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${
        isConnected 
          ? hasActiveSessions
            ? 'bg-blue-500 animate-pulse'
            : 'bg-green-500 animate-pulse'
          : 'bg-red-500'
      }`}></div>
      <span>
        {isConnected 
          ? showSessionInfo && hasActiveSessions
            ? activeSessions.length === 1
              ? `Scanning ${activeSessions[0].activeSessionId?.courseId?.code || 'Session'}`
              : `${activeSessions.length} Sessions`
            : `${onlineCount} Online`
          : 'Offline'
        }
      </span>
    </div>
  );
};