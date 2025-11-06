import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { useAuth } from '../hooks/useAuth';

export const CoursesPage = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', department: '', credits: 3 });
  const [filterYear, setFilterYear] = useState(''); // '' means All

  useEffect(() => { load(); }, []);

  const getYearSemesterFromCode = (code) => {
    if (!code || typeof code !== 'string') return null;
    const match = code.match(/^[A-Za-z]+(\d)(\d)/);
    if (!match) return null;
    return { year: Number(match[1]), semester: Number(match[2]) };
  };

  const getCreditsFromCode = (code) => {
    if (!code || typeof code !== 'string') return 3;
    const match = code.match(/(\d)(?!.*\d)/); // last digit in the string
    return match ? Number(match[1]) : 3;
  };

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/api/courses');
      setCourses(res.data || []);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ code: '', name: '', department: '', credits: 3 });
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ code: c.code, name: c.name, department: c.department || '', credits: c.credits || 3 });
    setShowModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        code: form.code,
        name: form.name,
        department: form.department,
        instructorId: user?.id
      };
      if (editing) {
        await apiClient.put(`/api/courses/${editing._id}`, payload);
      } else {
        await apiClient.post('/api/courses', payload);
      }
      setShowModal(false);
      await load();
    } catch (e) {
      alert(e.message || 'Save failed');
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this course?')) return;
    try {
      await apiClient.delete(`/api/courses/${id}`);
      await load();
    } catch (e) {
      alert(e.message || 'Delete failed');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Courses</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">Create and manage courses</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 dark:text-slate-400">Year</label>
            <select
              value={filterYear}
              onChange={(e)=>setFilterYear(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm dark:bg-slate-800 dark:text-white"
            >
              <option value="">All</option>
              {[1,2,3,4].map(y => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium">
          <Plus className="w-5 h-5" /> New Course
        </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Year</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Semester</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Credits</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500">Loading...</td></tr>
              ) : courses.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500">No courses</td></tr>
              ) : (
                (filterYear ? courses.filter(c => getYearSemesterFromCode(c.code)?.year === Number(filterYear)) : courses).map(c => (
                  <tr key={c._id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{c.code}</td>
                    <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{c.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{c.department || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{getYearSemesterFromCode(c.code)?.year ?? '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{getYearSemesterFromCode(c.code)?.semester ?? '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{getCreditsFromCode(c.code)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(c)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Edit"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => remove(c._id)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-xl w-full overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{editing ? 'Edit Course' : 'New Course'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={save} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Code</label>
                  <input type="text" required value={form.code} onChange={(e)=>setForm({...form, code:e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                  <input type="text" required value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <select
                    required
                    value={form.department}
                    onChange={(e)=>setForm({...form, department:e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="" disabled>Select Department</option>
                    <option value="Technological Studies">Technological Studies</option>
                    <option value="Applied Science">Applied Science</option>
                    <option value="Business Studies">Business Studies</option>
                  </select>
                </div>
                {/* Semester field removed; derived from code, not entered manually */}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursesPage;


