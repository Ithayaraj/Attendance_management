import { useEffect, useState } from 'react';
import { Settings, Smartphone, Plus, Trash2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const SettingsPage = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showApiKey, setShowApiKey] = useState({});
  const [newDevice, setNewDevice] = useState({ name: '', location: '' });
  const [addingDevice, setAddingDevice] = useState(false);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/devices');
      // Handle different response formats
      const data = response?.data || response;
      setDevices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading devices:', error);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

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

  const handleToggleDevice = async (id, currentStatus) => {
    try {
      await apiClient.patch(`/api/devices/${id}`, { isActive: !currentStatus });
      await loadDevices();
    } catch (error) {
      alert('Error updating device: ' + error.message);
    }
  };

  const handleRotateKey = async (id) => {
    if (!confirm('Are you sure you want to rotate the API key? The old key will stop working.')) return;
    
    try {
      await apiClient.post(`/api/devices/${id}/rotate-key`);
      alert('API key rotated successfully!');
      await loadDevices();
    } catch (error) {
      alert('Error rotating key: ' + error.message);
    }
  };

  const toggleApiKeyVisibility = (id) => {
    setShowApiKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" className="text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">Settings</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Manage devices and system settings</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Device
        </button>
      </div>

      {/* Devices Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-cyan-600" />
            Registered Devices
          </h4>
        </div>
        <div className="p-6">
          {devices.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8">No devices registered</p>
          ) : (
            <div className="space-y-4">
              {devices.map((device) => (
                <div key={device._id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h5 className="font-semibold text-slate-900 dark:text-white">{device.name}</h5>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          device.isActive 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                          {device.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {device.location && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">📍 {device.location}</p>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {showApiKey[device._id] ? device.apiKey : '••••••••••••••••'}
                        </p>
                        <button
                          onClick={() => toggleApiKeyVisibility(device._id)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        >
                          {showApiKey[device._id] ? (
                            <EyeOff className="w-4 h-4 text-slate-500" />
                          ) : (
                            <Eye className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                        <button
                          onClick={() => copyToClipboard(device.apiKey)}
                          className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
                        >
                          Copy
                        </button>
                      </div>
                      {device.lastUsed && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Last used: {new Date(device.lastUsed).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => handleToggleDevice(device._id, device.isActive)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        device.isActive
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      }`}
                    >
                      {device.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleRotateKey(device._id)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Rotate Key
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Add New Device</h3>
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
