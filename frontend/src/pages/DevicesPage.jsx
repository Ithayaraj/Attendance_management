import { useEffect, useState, memo, useCallback } from 'react';
import { Smartphone, Plus, RefreshCw, Eye, EyeOff, Copy, CheckCircle2, Edit2, Trash2, MoreVertical, X } from 'lucide-react';
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
const DeviceCard = memo(({ device, onRotateKey, onEdit, onDelete, showApiKey, onToggleApiKey, copiedId, onCopy }) => {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div 
      className="bg-white dark:bg-slate-900/60 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 dark:border-slate-600/50 hover:border-cyan-500 dark:hover:border-cyan-400 hover:shadow-2xl p-3 sm:p-4 transition-all duration-300"
    >
      {/* Header with Status and Actions */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-10 sm:w-12 h-10 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
            device.status === 'online'
              ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
              : 'bg-slate-300 dark:bg-slate-700'
          }`}>
            <Smartphone className="w-5 sm:w-6 h-5 sm:h-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h5 className="font-semibold text-slate-900 dark:text-white text-base sm:text-lg truncate">{device.name}</h5>
            {device.location && (
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 truncate">📍 {device.location}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full ${
            device.status === 'online'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              device.status === 'online' 
                ? 'bg-green-500 animate-pulse' 
                : 'bg-slate-400'
            }`} />
            <span className="text-xs font-medium capitalize hidden sm:inline">{device.status || 'offline'}</span>
          </div>
          
          {/* Actions Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="More actions"
            >
              <MoreVertical className="w-4 h-4 text-slate-500" />
            </button>
            
            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-20">
                  <button
                    onClick={() => {
                      onEdit(device);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Device
                  </button>
                  <button
                    onClick={() => {
                      onDelete(device);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Device
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Device ID */}
      <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1 block">
          Device ID
        </label>
        <div className="flex items-center gap-2">
          <code className="text-xs sm:text-sm font-mono text-slate-900 dark:text-white flex-1 truncate">
            {device._id}
          </code>
          <button
            onClick={() => onCopy(device._id, `id-${device._id}`)}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors flex-shrink-0"
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
      <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1 block">
          API Key
        </label>
        <div className="flex items-center gap-2">
          <code className="text-xs sm:text-sm font-mono text-slate-900 dark:text-white flex-1 truncate">
            {showApiKey ? device.apiKey : '••••••••••••••••••••••••'}
          </code>
          <button
            onClick={() => onToggleApiKey(device._id)}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors flex-shrink-0"
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
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors flex-shrink-0"
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
      <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1 block">
          Last Seen
        </label>
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm text-slate-900 dark:text-white">
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
      <div className="flex items-center gap-2 pt-3 sm:pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={() => onRotateKey(device._id)}
          className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs sm:text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
          title="Rotate API Key"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Rotate API Key</span>
          <span className="sm:hidden">Rotate Key</span>
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
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showApiKey, setShowApiKey] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [newDevice, setNewDevice] = useState({ name: '', location: '' });
  const [editingDevice, setEditingDevice] = useState(null);
  const [deletingDevice, setDeletingDevice] = useState(null);
  const [addingDevice, setAddingDevice] = useState(false);
  const [updatingDevice, setUpdatingDevice] = useState(false);

  const loadDevices = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      
      const response = await apiClient.get('/api/devices');
      const data = response?.data || response;
      const newDevices = Array.isArray(data) ? data : [];
      
      setDevices(newDevices);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading devices:', error);
      setDevices([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices(true); // Initial load with loading spinner
    
    // Auto-refresh every 30 seconds to show real-time status (same as dashboard)
    const interval = setInterval(() => {
      loadDevices(false); // Silent refresh without loading spinner
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadDevices]);

  const handleAddDevice = async (e) => {
    e.preventDefault();
    try {
      setAddingDevice(true);
      await apiClient.post('/api/devices', newDevice);
      setShowAddModal(false);
      setNewDevice({ name: '', location: '' });
      await loadDevices(true);
    } catch (error) {
      alert('Error adding device: ' + error.message);
    } finally {
      setAddingDevice(false);
    }
  };

  const handleEditDevice = useCallback((device) => {
    setEditingDevice({ ...device });
    setShowEditModal(true);
  }, []);

  const handleUpdateDevice = async (e) => {
    e.preventDefault();
    try {
      setUpdatingDevice(true);
      await apiClient.put(`/api/devices/${editingDevice._id}`, {
        name: editingDevice.name,
        location: editingDevice.location
      });
      setShowEditModal(false);
      setEditingDevice(null);
      await loadDevices(true);
    } catch (error) {
      alert('Error updating device: ' + error.message);
    } finally {
      setUpdatingDevice(false);
    }
  };

  const handleDeleteDevice = useCallback((device) => {
    setDeletingDevice(device);
    setShowDeleteModal(true);
  }, []);

  const confirmDeleteDevice = async () => {
    try {
      await apiClient.delete(`/api/devices/${deletingDevice._id}`);
      setShowDeleteModal(false);
      setDeletingDevice(null);
      await loadDevices(true);
    } catch (error) {
      alert('Error deleting device: ' + error.message);
    }
  };

  const handleRotateKey = useCallback(async (id) => {
    if (!confirm('Are you sure you want to rotate the API key? The old key will stop working.')) return;
    
    try {
      await apiClient.post(`/api/devices/${id}/rotate-key`);
      alert('API key rotated successfully!');
      await loadDevices(true);
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
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
        <div className="min-w-0">
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
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
          >
            <Plus className="w-4 sm:w-5 h-4 sm:h-5" />
            <span className="hidden sm:inline">Add Device</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        {devices.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 sm:p-12 text-center">
            <Smartphone className="w-12 sm:w-16 h-12 sm:h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400 mb-4 text-sm sm:text-base">No devices registered yet</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm sm:text-base"
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
              onEdit={handleEditDevice}
              onDelete={handleDeleteDevice}
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
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">Add New Device</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">Register a new scanning device</p>
            </div>
            <form onSubmit={handleAddDevice} className="p-4 sm:p-6 space-y-4">
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
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-800 dark:text-white text-sm"
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
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-800 dark:text-white text-sm"
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={addingDevice}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingDevice}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {addingDevice && <LoadingSpinner size="sm" className="text-white" />}
                  {addingDevice ? 'Adding...' : 'Add Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Device Modal */}
      {showEditModal && editingDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">Edit Device</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">Update device information</p>
            </div>
            <form onSubmit={handleUpdateDevice} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Device Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingDevice.name}
                  onChange={(e) => setEditingDevice({ ...editingDevice, name: e.target.value })}
                  placeholder="e.g., ESP32 Scanner 1"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-800 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={editingDevice.location || ''}
                  onChange={(e) => setEditingDevice({ ...editingDevice, location: e.target.value })}
                  placeholder="e.g., Main Entrance"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 dark:bg-slate-800 dark:text-white text-sm"
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingDevice(null);
                  }}
                  disabled={updatingDevice}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingDevice}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {updatingDevice && <LoadingSpinner size="sm" className="text-white" />}
                  {updatingDevice ? 'Updating...' : 'Update Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Device Modal */}
      {showDeleteModal && deletingDevice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg sm:text-xl font-semibold text-red-600 dark:text-red-400">Delete Device</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">This action cannot be undone</p>
            </div>
            <div className="p-4 sm:p-6">
              <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
                Are you sure you want to delete <strong>"{deletingDevice.name}"</strong>? 
                This will permanently remove the device and all its data.
              </p>
              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeletingDevice(null);
                  }}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteDevice}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Device
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
