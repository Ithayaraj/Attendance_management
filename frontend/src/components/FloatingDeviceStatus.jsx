import { useState, useEffect, useRef } from 'react';
import { Smartphone, Wifi, WifiOff, ChevronUp, ChevronDown } from 'lucide-react';
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
          className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors w-full"
        >
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
              {isConnected ? `${onlineCount} Connected` : 'Disconnected'}
            </span>
          </div>

          {totalCount > 0 && (
            <div className="ml-1">
              {isExpanded ? (
                <ChevronDown className="w-3 h-3 text-slate-400" />
              ) : (
                <ChevronUp className="w-3 h-3 text-slate-400" />
              )}
            </div>
          )}
        </button>

        {/* Expanded Device List */}
        {isExpanded && totalCount > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto">
            <div className="p-2 space-y-1">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Smartphone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300 truncate">
                      {device.name || `Device ${device.id}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      device.status === 'online' 
                        ? 'bg-green-500' 
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