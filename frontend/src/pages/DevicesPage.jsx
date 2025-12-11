import { useEffect, useState, memo, useCallback } from 'react';
import { Smartphone, Plus, RefreshCw, Eye, EyeOff, Copy, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';

const getRelativeTime = (date) => {
  if (!date) return 'Never';
  
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
};

// Memoized Device Card Component - only re-renders when device data changes
const DeviceCard = memo(({ device, onRotateKey, showApiKey, onToggleApiKey, copiedId, onCopy }) => {
  return (
    <div 
      className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow"
    >
      {/* Header with Status */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            device.status === 'online'
              ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
              : 'bg-slate-300 dark:bg-slate-700'
          }`}>
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <h5 className="font-semibold text-slate-900 dark:text-white text-lg">{device.name}</h5>
            {device.location && (
              <p className="text-sm text-slate-600 dark:text-slate-400">📍 {device.location}</p>
            )}
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
          device.status === 'online'
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            device.status === 'online' 
              ? 'bg-green-500 animate-pulse' 
              : 'bg-slate-400'
          }`} />
          <span className="text-xs font-medium capitalize">{device.status || 'offline'}</span>
        </div>
      </div>

      {/* Device ID */}
      <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1 block">
          Device ID
        </label>
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono text-slate-900 dark:text-white flex-1 truncate">
            {device._id}
          </code>
          <button
            onClick={() => onCopy(device._id, `id-${device._id}`)}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
            title="Copy Device ID"
          >
            {copiedId === `id-${device._id}` ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4 text-slate-500" />
            )}
          </button>
        </div>
      </div>

      {/* API Key */}
      <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1 block">
          API Key
        </label>
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono text-slate-900 dark:text-white flex-1 truncate">
            {showApiKey ? device.apiKey : '••••••••••••••••••••••••'}
          </code>
          <button
            onClick={() => onToggleApiKey(device._id)}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
            title={showApiKey ? "Hide API Key" : "Show API Key"}
          >
            {showApiKey ? (
              <EyeOff className="w-4 h-4 text-slate-500" />
            ) : (
              <Eye className="w-4 h-4 text-slate-500" />
            )}
          </button>
          <button
            onClick={() => onCopy(device.apiKey, `key-${device._id}`)}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
            title="Copy API Key"
          >
            {copiedId === `key-${device._id}` ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4 text-slate-500" />
            )}
          </button>
        </div>
      </div>

      {/* Last Seen */}
      <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1 block">
          Last Seen
        </label>
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-900 dark:text-white">
            {getRelativeTime(device.lastSeenAt)}
          </p>
          {device.lastSeenAt && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {new Date(device.lastSeenAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={() => onRotateKey(device._id)}
          className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
          title="Rotate API Key"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Rotate API Key</span>
        </button>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if these specific fields change
  const isEqual = (
    prevProps.device._id === nextProps.device._id &&
    prevProps.device.status === nextProps.device.status &&
    prevProps.device.lastSeenAt === nextProps.device.lastSeenAt &&
    prevProps.device.name === nextProps.device.name &&
    prevProps.device.location === nextProps.device.location &&
    prevProps.device.apiKey === nextProps.device.apiKey &&
    prevProps.showApiKey === nextProps.showApiKey &&
    prevProps.copiedId === nextProps.copiedId
  );
  return isEqual;
});

DeviceCard.displayName = 'DeviceCard';

export const DevicesPage = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showApiKey, setShowApiKey] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [newDevice, setNewDevice] = useState({ name: '', location: '' });
  const [addingDevice, setAddingDevice] = useState(false);

  const loadDevices = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (!loading) {
        // Don't show loading on auto-refresh
        return;
      } else {
        setLoading(true);
      }
      
      const response = await apiClient.get('/api/devices');
      const data = response?.data || response;
      const newDevices = Array.isArray(data) ? data : [];
      
      // Smart update: only update state if data actually changed
      setDevices(prevDevices => {
        // If lengths differ, definitely update
        if (prevDevices.length !== newDevices.length) {
          setLastUpdate(new Date());
          return newDevices;
        }
        
        // Check if any device data changed
        let hasChanges = false;
        const updatedDevices = prevDevices.map(prevDevice => {
          const newDevice = newDevices.find(d => d._id === prevDevice._id);
          if (!newDevice) {
            hasChanges = true;
            return prevDevice;
          }
          
          // Check if this specific device changed
          const deviceChanged = (
            prevDevice.status !== newDevice.status ||
            prevDevice.lastSeenAt !== newDevice.lastSeenAt ||
            prevDevice.name !== newDevice.name ||
            prevDevice.location !== newDevice.location ||
            prevDevice.apiKey !== newDevice.apiKey
          );
          
          if (deviceChanged) {
            hasChanges = true;
            return newDevice; // Return new device object only if changed
          }
          
          return prevDevice; // Keep same reference if unchanged
        });
        
        if (hasChanges) {
          setLastUpdate(new Date());
          return updatedDevices;
        }
        
        // No changes at all, return same array reference
        return prevDevices;
      });
    } catch (error) {
      console.error('Error loading devices:', error);
      setDevices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading]);

  useEffect(() => {
    loadDevices();
    
    // Auto-refresh every 10 seconds to show real-time status
    const interval = setInterval(() => {
      loadDevices();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [loadDevices]);

  const handleAddDevice = async (e) => {
    e.preventDefault();
    try {
      setAddingDevice(true);
      await apiClient.post('/api/devices', newDevice);
      setShowAddModal(false);
      setNewDevice({ name: '', location: '' });
      await loadDevices();
    } catch (error) {
      alert('Error adding device: ' + error.message);
    } finally {
      setAddingDevice(false);
    }
  };

  const handleRotateKey = useCallback(async (id) => {
    if (!confirm('Are you sure you want to rotate the API key? The old key will stop working.')) return;
    
    try {
      await apiClient.post(`/api/devices/${id}/rotate-key`);
      alert('API key rotated successfully!');
      await loadDevices();
    } catch (error) {
      alert('Error rotating key: ' + error.message);
    }
  }, [loadDevices]);

  const toggleApiKeyVisibility = useCallback((id) => {
    setShowApiKey(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const copyToClipboard = useCallback((text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" className="text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">Devices</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Manage your scanning devices
            {lastUpdate && (
              <span className="ml-2 text-slate-500">
                • Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadDevices(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all font-medium disabled:opacity-50"
            title="Refresh devices"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Add Device</span>
          </button>
        </div>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {devices.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12 text-center">
            <Smartphone className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400 mb-4">No devices registered yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Your First Device
            </button>
          </div>
        ) : (
          devices.map((device) => (
            <DeviceCard
              key={device._id}
              device={device}
              onRotateKey={handleRotateKey}
              showApiKey={showApiKey[device._id]}
              onToggleApiKey={toggleApiKeyVisibility}
              copiedId={copiedId}
              onCopy={copyToClipboard}
            />
          ))
        )}
      </div>

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Add New Device</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Register a new scanning device</p>
            </div>
            <form onSubmit={handleAddDevice} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Device Name *
                </label>
                <input
                  type="text"
                  required
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                  placeholder="e.g., ESP32 Scanner 1"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={newDevice.location}
                  onChange={(e) => setNewDevice({ ...newDevice, location: e.target.value })}
                  placeholder="e.g., Main Entrance"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={addingDevice}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingDevice}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {addingDevice && <LoadingSpinner size="sm" className="text-white" />}
                  {addingDevice ? 'Adding...' : 'Add Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
