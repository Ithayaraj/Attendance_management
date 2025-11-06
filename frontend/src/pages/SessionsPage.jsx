import { useEffect, useState } from 'react';
import { Plus, RefreshCw, PlayCircle, XCircle, Edit, Trash2 } from 'lucide-react';
import { apiClient } from '../lib/apiClient';

export const SessionsPage = () => {
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(null);
  const roundToQuarter = (date) => {
    const d = new Date(date);
    const minutes = d.getMinutes();
    const quarters = Math.round(minutes / 15);
    const roundedMinutes = (quarters === 4 ? 0 : quarters * 15);
    if (quarters === 4) d.setHours(d.getHours() + 1);
    d.setMinutes(roundedMinutes, 0, 0);
    return d;
  };
  const toTimeString = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const addMinutesLocal = (timeStr, mins) => {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    d.setMinutes(d.getMinutes() + mins);
    return toTimeString(d);
  };
  const nowRounded = roundToQuarter(new Date());
  const startDefault = toTimeString(nowRounded);
  const endDefault = addMinutesLocal(startDefault, 60);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    startTime: startDefault,
    endTime: endDefault,
    room: 'LAB-1',
    goLive: false
  });

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      loadSessions(selectedCourseId);
    }
  }, [selectedCourseId]);

  const loadCourses = async () => {
    try {
      const res = await apiClient.get('/api/courses');
      const list = res.data || [];
      setCourses(list);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Failed to load courses');
    }
  };

  const loadSessions = async (courseId) => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/api/courses/${courseId}/sessions`);
      setSessions(res.data || []);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const createSession = async (e) => {
    e.preventDefault();
    if (!selectedCourseId) return alert('Select a course');
    setCreating(true);
    try {
      const payload = {
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room
      };
      const res = await apiClient.post(`/api/courses/${selectedCourseId}/sessions`, payload);
      const session = res.data;
      if (form.goLive && session?._id) {
        await apiClient.patch(`/api/sessions/${session._id}/status`, { status: 'live' });
      }
      setShowCreate(false);
      await loadSessions(selectedCourseId);
    } catch (e) {
      alert(e.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const setStatus = async (sessionId, status) => {
    try {
      await apiClient.patch(`/api/sessions/${sessionId}/status`, { status });
      await loadSessions(selectedCourseId);
    } catch (e) {
      alert(e.message || 'Failed to update status');
    }
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ date: s.date, startTime: s.startTime, endTime: s.endTime, room: s.room, goLive: false });
    setShowEdit(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      await apiClient.put(`/api/sessions/${editing._id}`, {
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room
      });
      setShowEdit(false);
      setEditing(null);
      await loadSessions(selectedCourseId);
    } catch (err) {
      alert(err.message || 'Update failed');
    }
  };

  const remove = async (s) => {
    if (!confirm('Delete this session?')) return;
    try {
      await apiClient.delete(`/api/sessions/${s._id}`);
      await loadSessions(selectedCourseId);
    } catch (err) {
      alert(err.message || 'Delete failed');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Sessions</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">Manage class sessions and go live</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedCourseId}
            onChange={(e)=>setSelectedCourseId(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-white"
          >
            <option value="" disabled>Select the course</option>
            {courses.map(c => (
              <option key={c._id} value={c._id}>{c.code} - {c.name}</option>
            ))}
          </select>
          <button onClick={()=>loadSessions(selectedCourseId)} disabled={!selectedCourseId} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={()=>setShowCreate(true)} disabled={!selectedCourseId} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus className="w-5 h-5" /> New Session
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        {!selectedCourseId ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            Select the course first
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Room</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {loading ? (
                  <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-500">Loading...</td></tr>
                ) : sessions.length === 0 ? (
                  <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-500">No sessions</td></tr>
                ) : (
                  sessions.map(s => (
                    <tr key={s._id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{s.date}</td>
                      <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{s.startTime} - {s.endTime}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{s.room}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${s.status === 'live' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : s.status === 'scheduled' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setStatus(s._id, 'live')} className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg" title="Set Live"><PlayCircle className="w-4 h-4" /></button>
                          <button onClick={() => setStatus(s._id, 'closed')} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Close"><XCircle className="w-4 h-4" /></button>
                          <button onClick={() => openEdit(s)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Edit"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => remove(s)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-xl w-full overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">New Session</h3>
              <button onClick={()=>setShowCreate(false)} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={createSession} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                  <input type="date" required value={form.date} onChange={(e)=>setForm({...form, date:e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Room</label>
                  <input type="text" required value={form.room} onChange={(e)=>setForm({...form, room:e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Time</label>
                  <input type="time" required value={form.startTime} onChange={(e)=>{
                    const value = e.target.value;
                    const [h, m] = value.split(':').map(Number);
                    const d = new Date();
                    d.setHours(h || 0, m || 0, 0, 0);
                    const rounded = roundToQuarter(d);
                    const start = toTimeString(rounded);
                    const end = addMinutesLocal(start, 60);
                    setForm({...form, startTime:start, endTime:end});
                  }} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Time</label>
                  <input type="time" required value={form.endTime} onChange={(e)=>setForm({...form, endTime:e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white" />
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.goLive} onChange={(e)=>setForm({...form, goLive:e.target.checked})} />
                <span className="text-sm text-slate-700 dark:text-slate-300">Set status to Live after create</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={()=>setShowCreate(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
                <button type="submit" disabled={creating} className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all">{creating ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-xl w-full overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Session</h3>
              <button onClick={()=>setShowEdit(false)} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={saveEdit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                  <input type="date" required value={form.date} onChange={(e)=>setForm({...form, date:e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Room</label>
                  <input type="text" required value={form.room} onChange={(e)=>setForm({...form, room:e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Time</label>
                  <input type="time" required value={form.startTime} onChange={(e)=>setForm({...form, startTime:e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Time</label>
                  <input type="time" required value={form.endTime} onChange={(e)=>setForm({...form, endTime:e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={()=>setShowEdit(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
                <button type="submit" disabled={creating} className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionsPage;


