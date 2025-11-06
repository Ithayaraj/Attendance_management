import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { apiClient } from '../lib/apiClient';

export const BatchesPage = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState('');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);
  const [editYear, setEditYear] = useState('');
  const [editName, setEditName] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/batches');
      setBatches(res || []);
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
      await load();
    } catch (e) {
      alert(e.message || 'Create failed');
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this batch?')) return;
    try {
      await apiClient.delete(`/api/batches/${id}`);
      await load();
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
      await load();
    } catch (e) {
      alert(e.message || 'Update failed');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Batches</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">Create and manage student batches</p>
        </div>
      </div>

      <form onSubmit={create} className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Year</label>
          <input type="number" required value={year} onChange={(e)=>setYear(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white" placeholder="e.g. 2019" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name (optional)</label>
          <input type="text" value={name} onChange={(e)=>setName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white" placeholder="e.g. 2019 Batch" />
        </div>
        <div className="flex items-end">
          <button type="submit" className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"><Plus className="w-5 h-5"/>Create</button>
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
                <tr><td colSpan="3" className="px-6 py-12 text-center text-slate-500">Loading...</td></tr>
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
            <form onSubmit={saveEdit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Year</label>
                  <input type="number" required value={editYear} onChange={(e)=>setEditYear(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                  <input type="text" value={editName} onChange={(e)=>setEditName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white" />
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


