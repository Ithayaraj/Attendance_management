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
  const { showSuccess, showError, showWarning } = useNotification();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', department: '', credits: 3 });
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const hasLoadedRef = useRef(false);

  const BATCHES_CACHE_KEY = 'courses_batches_cache';
  const BATCHES_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

  // Helper function to get faculty name from department
  const getFacultyFromDepartment = (departmentName) => {
    for (const [facultyName, facultyData] of Object.entries(facultyStructure)) {
      const found = facultyData.departments.find(d => d.name === departmentName);
      if (found) return facultyName;
    }
    return null;
  };

  // Load batches
  useEffect(() => {
    const load = async () => {
      // Check cache first
      const cached = sessionStorage.getItem(BATCHES_CACHE_KEY);
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          
          if (age < BATCHES_CACHE_DURATION) {
            setBatches(data || []);
            setLoadingBatches(false);
            
            // Refresh in background if data is older than 1 minute
            if (age > 60 * 1000) {
              loadFresh();
            }
            return;
          }
        } catch (e) {
          console.error('Cache parse error:', e);
        }
      }

      await loadFresh();
    };

    const loadFresh = async () => {
      try {
        setLoadingBatches(true);
        const response = await apiClient.get('/api/batches');
        const batchesData = Array.isArray(response) ? response : (response?.data || []);
        setBatches(batchesData);
        
        // Cache the data
        sessionStorage.setItem(BATCHES_CACHE_KEY, JSON.stringify({
          data: batchesData,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Error loading batches:', error);
        setBatches([]);
      } finally {
        setLoadingBatches(false);
      }
    };

    load();
  }, []);

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
    // Don't load if batch is not selected
    if (!selectedBatch) {
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
      
      // Cache the data with batch-specific key
      const cacheKey = `${CACHE_KEY}_${selectedBatch._id}`;
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
  }, [selectedBatch]);

  // Filter courses by batch (department, year, semester)
  const filteredCourses = useMemo(() => {
    if (!selectedBatch) return [];
    
    let filtered = courses;

    // Filter by department
    filtered = filtered.filter(c => c.department === selectedBatch.department);

    // Filter by year and semester
    filtered = filtered.filter(c => {
      const yearInfo = getYearSemesterFromCode(c.code);
      return yearInfo?.year === selectedBatch.currentYear && 
             yearInfo?.semester === selectedBatch.currentSemester;
    });

    return filtered;
  }, [courses, selectedBatch]);

  // Load courses when batch is selected
  useEffect(() => {
    // Don't load if batch is not selected
    if (!selectedBatch) {
      setCourses([]);
      setLoading(false);
      return;
    }

    // Check cache first
    const cacheKey = `${CACHE_KEY}_${selectedBatch._id}`;
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
  }, [selectedBatch, load]);

  const openCreate = () => {
    if (!selectedBatch) {
      showWarning('Please select a batch before creating a course');
      return;
    }
    setEditing(null);
    setForm({ code: '', name: '', department: selectedBatch.department, credits: 3 });
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
      if (selectedBatch) {
        const cacheKey = `${CACHE_KEY}_${selectedBatch._id}`;
        sessionStorage.removeItem(cacheKey);
      }
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
      if (selectedBatch) {
        const cacheKey = `${CACHE_KEY}_${selectedBatch._id}`;
        sessionStorage.removeItem(cacheKey);
      }
      hasLoadedRef.current = false;
      showSuccess('Course deleted successfully!');
      await load();
    } catch (e) {
      showError(e.message || 'Failed to delete course', 'Delete Failed');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">Courses</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Create and manage courses</p>
        </div>
        
        {/* Batch Filter Section */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
            {/* Batch Selection */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Batch:</label>
              <CustomSelect
                value={selectedBatch?._id || ''}
                onChange={(e) => {
                  const batch = batches.find(b => b._id === e.target.value);
                  setSelectedBatch(batch || null);
                }}
                disabled={loadingBatches}
                loading={loadingBatches}
                placeholder={loadingBatches ? 'Loading batches...' : 'Select a batch'}
                options={[
                  { value: '', label: loadingBatches ? 'Loading batches...' : (batches.length === 0 ? 'No batches available' : 'Select a batch') },
                  ...(Array.isArray(batches) ? batches.map((b) => {
                    const faculty = getFacultyFromDepartment(b.department);
                    const facultyShort = faculty ? faculty.replace('Faculty of ', '') : '';
                    return {
                      value: b._id,
                      label: `${b.startYear} - ${facultyShort} - ${b.department} - Year ${b.currentYear}, Semester ${b.currentSemester}`
                    };
                  }) : [])
                ]}
              />
            </div>

            {/* Action Button */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 opacity-0">Actions</label>
              <button 
                onClick={openCreate}
                disabled={!selectedBatch}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium text-sm w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> 
                <span>New Course</span>
              </button>
            </div>
          </div>
          
          {selectedBatch && (
            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium">Selected:</span> {getFacultyFromDepartment(selectedBatch.department)?.replace('Faculty of ', '') || ''} - {selectedBatch.department} - Year {selectedBatch.currentYear}, Semester {selectedBatch.currentSemester}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Faculty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Year</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Semester</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Credits</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {!selectedBatch ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    <p>Please select a batch to view courses</p>
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <LoadingSpinner size="lg" className="text-cyan-600" />
                      <span className="text-slate-500 dark:text-slate-400">Loading courses...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredCourses.length === 0 ? (
                <tr><td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                  {courses.length === 0 ? 'No courses found' : 'No courses match the selected filters'}
                </td></tr>
              ) : (
                filteredCourses.map(c => {
                  const faculty = getFacultyFromDepartment(c.department);
                  const facultyShort = faculty ? faculty.replace('Faculty of ', '') : '-';
                  return (
                    <tr key={c._id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{c.code}</td>
                      <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{c.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{facultyShort}</td>
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
                  );
                })
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
            <form onSubmit={save} className="p-4 sm:p-5 space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Code</label>
                  <input type="text" required value={form.code} onChange={(e)=>setForm({...form, code:e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                  <input type="text" required value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Department</label>
                  <input 
                    type="text" 
                    value={selectedBatch?.department || ''} 
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Year</label>
                  <input 
                    type="text" 
                    value={selectedBatch ? `Year ${selectedBatch.currentYear}` : ''} 
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Semester</label>
                  <input 
                    type="text" 
                    value={selectedBatch ? `Semester ${selectedBatch.currentSemester}` : ''} 
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Department, Year, and Semester are set from the selected batch</p>
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm order-2 sm:order-1">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all text-sm order-1 sm:order-2">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursesPage;


