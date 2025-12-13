import { useState, useEffect, useRef } from 'react';
import { Smartphone, Wifi, WifiOff, ChevronUp, ChevronDown, Clock, BookOpen } from 'lucide-react';
import { useDeviceStatus } from '../hooks/useDeviceStatus';

export const FloatingDeviceStatus = () => {
  const { isConnected, onlineCount, totalCount, loading, devices, lastUpdate } = useDeviceStatus();
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isExpanded]);

  if (loading) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse"></div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Checking devices...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div 
        ref={containerRef}
        className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
      >
        {/* Main Status Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex flex-col gap-1 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors w-full"
        >
          {/* Primary Status Line */}
          <div className="flex items-center gap-2 w-full">
            <div className={`w-2 h-2 rounded-full ${
              isConnected 
                ? 'bg-green-500 animate-pulse' 
                : 'bg-red-500'
            }`}></div>
            
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-600 dark:text-red-400" />
              )}
              <span className={`text-sm font-medium ${
                isConnected 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {isConnected ? `${onlineCount} Scanner${onlineCount !== 1 ? 's' : ''}` : 'No Scanners'}
              </span>
            </div>

            {totalCount > 0 && (
              <div className="ml-auto">
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                ) : (
                  <ChevronUp className="w-3 h-3 text-slate-400" />
                )}
              </div>
            )}
          </div>

          {/* Active Sessions Summary */}
          {isConnected && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 w-full">
              <BookOpen className="w-3 h-3" />
              <span>
                {(() => {
                  const activeSessions = devices.filter(d => d.status === 'online' && d.activeSessionId);
                  if (activeSessions.length === 0) return 'Ready to scan';
                  if (activeSessions.length === 1) {
                    const session = activeSessions[0];
                    return `Scanning: ${session.activeSessionId?.courseId?.code || 'Session'}`;
                  }
                  return `${activeSessions.length} active sessions`;
                })()}
              </span>
            </div>
          )}
        </button>

        {/* Expanded Device List */}
        {isExpanded && totalCount > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-700 max-h-80 overflow-y-auto">
            <div className="p-2 space-y-2">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2 space-y-1"
                >
                  {/* Device Name and Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Smartphone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-700 dark:text-slate-300 truncate text-xs font-medium">
                        {device.name || `Device ${device.id}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        device.status === 'online' 
                          ? 'bg-green-500 animate-pulse' 
                          : 'bg-red-500'
                      }`}></div>
                      <span className={`text-xs font-medium ${
                        device.status === 'online'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {device.status === 'online' ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>

                  {/* Active Session Info */}
                  {device.status === 'online' && device.activeSessionId && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3 text-blue-500" />
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          {device.activeSessionId.courseId?.code || 'Active Session'}
                        </span>
                      </div>
                      
                      {device.minutesUntilSessionEnd !== null && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            {device.minutesUntilSessionEnd > 0 
                              ? `Ends in ${device.minutesUntilSessionEnd}m`
                              : 'Session ended'
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Location */}
                  {device.location && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      📍 {device.location}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Last Update Time */}
            {lastUpdate && (
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-600">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Updated: {lastUpdate.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
        )}

        {/* No Devices Message */}
        {isExpanded && totalCount === 0 && (
          <div className="border-t border-slate-200 dark:border-slate-700 p-3">
            <div className="text-center">
              <Smartphone className="w-6 h-6 text-slate-400 mx-auto mb-1" />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No devices registered
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};