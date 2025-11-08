import { useEffect, useState, useRef } from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';

const CACHE_KEY = 'batches_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const BatchesPage = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState('');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);
  const [editYear, setEditYear] = useState('');
  const [editName, setEditName] = useState('');
  const hasLoadedRef = useRef(false);

  const load = async (useCache = true) => {
    // Check cache first
    if (useCache && !hasLoadedRef.current) {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          
          if (age < CACHE_DURATION) {
            setBatches(data || []);
            hasLoadedRef.current = true;
            setLoading(false);
            
            // Refresh in background if data is older than 1 minute
            if (age > 60 * 1000) {
              load(false);
            }
            return;
          }
        } catch (e) {
          console.error('Cache parse error:', e);
        }
      }
    }

    try {
      setLoading(true);
      const res = await apiClient.get('/api/batches');
      const batchesData = res || [];
      setBatches(batchesData);
      
      // Cache the data
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        data: batchesData,
        timestamp: Date.now()
      }));
      hasLoadedRef.current = true;
    } catch (e) {
      alert(e.message || 'Failed to load batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      if (!year) return alert('Enter start year');
      await apiClient.post('/api/batches', { startYear: Number(year), name: name || undefined });
      alert('Batch created successfully');
      setYear(''); setName('');
      sessionStorage.removeItem(CACHE_KEY); // Clear cache
      await load(false);
    } catch (e) {
      alert(e.message || 'Create failed');
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this batch?')) return;
    try {
      await apiClient.delete(`/api/batches/${id}`);
      sessionStorage.removeItem(CACHE_KEY); // Clear cache
      await load(false);
    } catch (e) {
      alert(e.message || 'Delete failed');
    }
  };

  const openEdit = (b) => {
    setEditing(b);
    setEditYear(String(b.startYear || ''));
    setEditName(b.name || '');
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.put(`/api/batches/${editing._id}`, { startYear: Number(editYear), name: editName || undefined });
      alert('Batch updated successfully');
      setEditing(null);
      setEditYear('');
      setEditName('');
      sessionStorage.removeItem(CACHE_KEY); // Clear cache
      await load(false);
    } catch (e) {
      alert(e.message || 'Update failed');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">Batches</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Create and manage student batches</p>
        </div>
      </div>

      <form onSubmit={create} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-3 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Year</label>
          <input type="number" required value={year} onChange={(e)=>setYear(e.target.value)} className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white text-xs sm:text-sm" placeholder="e.g. 2019" />
        </div>
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name (optional)</label>
          <input type="text" value={name} onChange={(e)=>setName(e.target.value)} className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white text-xs sm:text-sm" placeholder="e.g. 2019 Batch" />
        </div>
        <div className="flex items-end">
          <button type="submit" className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium text-xs sm:text-sm"><Plus className="w-4 h-4 sm:w-5 sm:h-5"/>Create</button>
        </div>
      </form>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Start Year</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="3" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <LoadingSpinner size="lg" className="text-cyan-600" />
                      <span className="text-slate-500 dark:text-slate-400">Loading batches...</span>
                    </div>
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr><td colSpan="3" className="px-6 py-12 text-center text-slate-500">No batches</td></tr>
              ) : (
                batches.map(b => (
                  <tr key={b._id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{b.startYear}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{b.name || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1">
                      <button onClick={()=>openEdit(b)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Edit"><Edit className="w-4 h-4"/></button>
                      <button onClick={()=>remove(b._id)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Delete"><Trash2 className="w-4 h-4"/></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-xl w-full overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Batch</h3>
              <button onClick={()=>setEditing(null)} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={saveEdit} className="p-4 sm:p-5 space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Year</label>
                  <input type="number" required value={editYear} onChange={(e)=>setEditYear(e.target.value)} className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white text-xs sm:text-sm" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                  <input type="text" value={editName} onChange={(e)=>setEditName(e.target.value)} className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white text-xs sm:text-sm" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={()=>setEditing(null)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchesPage;


