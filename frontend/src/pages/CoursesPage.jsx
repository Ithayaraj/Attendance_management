import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CustomSelect } from '../components/CustomSelect';
import { useNotification } from '../contexts/NotificationContext';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY = 'courses_data';

export const CoursesPage = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', department: '', credits: 3 });
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [filterYear, setFilterYear] = useState(''); // '' means All
  const hasLoadedRef = useRef(false);

  // Faculty and Department structure
  const facultyStructure = {
    'Faculty of Applied Science': {
      departments: [
        { name: 'Department of Bio-science', code: 'BIO' },
        { name: 'Department of Physical Science', code: 'PS' }
      ]
    },
    'Faculty of Business Studies': {
      departments: [
        { name: 'Department of Business Economics', code: 'BE' },
        { name: 'Department of Human Resource Management', code: 'HRM' },
        { name: 'Department of Marketing Management', code: 'MM' },
        { name: 'Department of Management and Entrepreneurship', code: 'ME' },
        { name: 'Department of Project Management', code: 'PM' },
        { name: 'Department of Finance and Accountancy', code: 'FA' },
        { name: 'Department of Banking and Insurance', code: 'BI' }
      ]
    },
    'Faculty of Technological Studies': {
      departments: [
        { name: 'Department of Information and Communication Technology', code: 'ICTS' }
      ]
    }
  };

  const availableDepartments = useMemo(() => {
    if (!selectedFaculty || !facultyStructure[selectedFaculty]) return [];
    return facultyStructure[selectedFaculty].departments;
  }, [selectedFaculty]);

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

  const load = useCallback(async () => {
    // Don't load if filters are not selected
    if (!selectedFaculty || !selectedDepartment) {
      setCourses([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await apiClient.get('/api/courses');
      const coursesData = res.data || [];
      setCourses(coursesData);
      hasLoadedRef.current = true;
      
      // Cache the data with filter-specific key
      const cacheKey = `${CACHE_KEY}_${selectedFaculty}_${selectedDepartment}_${filterYear || 'all'}`;
      sessionStorage.setItem(cacheKey, JSON.stringify({
        data: coursesData,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error(e);
      showError(e.message || 'Failed to load courses', 'Error');
    } finally {
      setLoading(false);
    }
  }, [selectedFaculty, selectedDepartment, filterYear]);

  // Filter courses by faculty, department, and year
  const filteredCourses = useMemo(() => {
    let filtered = courses;

    // Filter by department if selected
    if (selectedDepartment) {
      filtered = filtered.filter(c => c.department === selectedDepartment);
    } else if (selectedFaculty) {
      // If only faculty is selected, filter by all departments in that faculty
      const deptNames = availableDepartments.map(d => d.name);
      filtered = filtered.filter(c => deptNames.includes(c.department));
    }

    // Filter by year if selected
    if (filterYear) {
      filtered = filtered.filter(c => {
        const yearInfo = getYearSemesterFromCode(c.code);
        return yearInfo?.year === Number(filterYear);
      });
    }

    return filtered;
  }, [courses, selectedFaculty, selectedDepartment, filterYear, availableDepartments]);

  // Only load courses when filters are selected
  useEffect(() => {
    // Don't load if filters are not selected
    if (!selectedFaculty || !selectedDepartment) {
      setCourses([]);
      setLoading(false);
      return;
    }

    // Check cache first
    const cacheKey = `${CACHE_KEY}_${selectedFaculty}_${selectedDepartment}_${filterYear || 'all'}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        
        if (age < CACHE_DURATION) {
          setCourses(data);
          setLoading(false);
          hasLoadedRef.current = true;
          
          // Refresh in background if older than 2 minutes
          if (age > 2 * 60 * 1000) {
            load();
          }
          return;
        }
      } catch (e) {
        console.error('Cache error:', e);
      }
    }
    
    // Load fresh data
    if (!hasLoadedRef.current) {
      load();
    }
  }, [selectedFaculty, selectedDepartment, filterYear, load]);

  const openCreate = () => {
    if (!selectedFaculty || !selectedDepartment || !filterYear) {
      showWarning('Please select Faculty, Department, and Year before creating a course');
      return;
    }
    setEditing(null);
    setForm({ code: '', name: '', department: selectedDepartment, credits: 3 });
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
      // Clear cache and reload
      const cacheKey = `${CACHE_KEY}_${selectedFaculty}_${selectedDepartment}_${filterYear || 'all'}`;
      sessionStorage.removeItem(cacheKey);
      hasLoadedRef.current = false;
      showSuccess(editing ? 'Course updated successfully!' : 'Course created successfully!');
      await load();
    } catch (e) {
      showError(e.message || 'Failed to save course', 'Save Failed');
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this course?')) return;
    try {
      await apiClient.delete(`/api/courses/${id}`);
      // Clear cache and reload
      const cacheKey = `${CACHE_KEY}_${selectedFaculty}_${selectedDepartment}_${filterYear || 'all'}`;
      sessionStorage.removeItem(cacheKey);
      hasLoadedRef.current = false;
      showSuccess('Course deleted successfully!');
      await load();
    } catch (e) {
      showError(e.message || 'Failed to delete course', 'Delete Failed');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">Courses</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Create and manage courses</p>
        </div>
        
        {/* Filter Section */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* Faculty Selection */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">Faculty</label>
              <CustomSelect
                value={selectedFaculty}
                onChange={(e) => {
                  setSelectedFaculty(e.target.value);
                  setSelectedDepartment('');
                }}
                placeholder="Select Faculty"
                options={[
                  { value: '', label: 'Select Faculty' },
                  { value: 'Faculty of Applied Science', label: 'Faculty of Applied Science' },
                  { value: 'Faculty of Business Studies', label: 'Faculty of Business Studies' },
                  { value: 'Faculty of Technological Studies', label: 'Faculty of Technological Studies' }
                ]}
                className="w-full min-w-0"
              />
            </div>

            {/* Department Selection */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
              <CustomSelect
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                disabled={!selectedFaculty}
                placeholder={selectedFaculty ? 'All Departments' : 'Select Faculty first'}
                options={[
                  { value: '', label: selectedFaculty ? 'All Departments' : 'Select Faculty first' },
                  ...availableDepartments.map((dept) => ({
                    value: dept.name,
                    label: dept.name
                  }))
                ]}
                className="w-full min-w-0"
              />
            </div>

            {/* Year Selection */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">Year</label>
              <CustomSelect
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                placeholder="All Years"
                options={[
                  { value: '', label: 'All Years' },
                  ...([1, 2, 3, 4].map(y => ({
                    value: String(y),
                    label: `Year ${y}`
                  })))
                ]}
                className="w-full min-w-0"
              />
            </div>

            {/* Action Button */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 opacity-0">Actions</label>
              <button 
                onClick={openCreate}
                disabled={!selectedFaculty || !selectedDepartment || !filterYear}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium text-xs sm:text-sm w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" /> 
                <span>New Course</span>
              </button>
            </div>
          </div>
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
              {!selectedFaculty || !selectedDepartment ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    <p>Please select Faculty and Department to view courses</p>
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <LoadingSpinner size="lg" className="text-cyan-600" />
                      <span className="text-slate-500 dark:text-slate-400">Loading courses...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCourses.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                  {courses.length === 0 ? 'No courses found' : 'No courses match the selected filters'}
                </td></tr>
              ) : (
                filteredCourses.map(c => (
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <input 
                    type="text" 
                    value={form.department} 
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Department is set from filter selection</p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Year</label>
                  <input 
                    type="text" 
                    value={filterYear ? `Year ${filterYear}` : ''} 
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Year is set from filter selection</p>
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


