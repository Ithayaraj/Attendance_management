import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Eye, Edit, Trash2, Download } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CustomSelect } from '../components/CustomSelect';

export const StudentsPage = ({ onViewStudent }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const [formData, setFormData] = useState({
    registrationNo: '',
    name: '',
    email: '',
    department: '',
    year: 1,
    semester: 1,
    phone: '',
    address: ''
  });
  const [selectedBatchYear, setSelectedBatchYear] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [regSuffix, setRegSuffix] = useState('');

  // Faculty and Department structure with prefixes
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

  const BATCHES_CACHE_KEY = 'students_batches_cache';
  const BATCHES_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
        const b = await apiClient.get('/api/batches').catch(()=>[]);
        const batchesData = b || [];
        setBatches(batchesData);
        
        // Cache the data
        sessionStorage.setItem(BATCHES_CACHE_KEY, JSON.stringify({
          data: batchesData,
          timestamp: Date.now()
        }));
      } catch {
        setBatches([]);
      } finally {
        setLoadingBatches(false);
      }
    };

    load();
  }, []);

  const selectedDeptInfo = useMemo(() => {
    if (!selectedDepartment || !selectedFaculty) return null;
    return availableDepartments.find(d => d.name === selectedDepartment);
  }, [selectedDepartment, selectedFaculty, availableDepartments]);

  const deptCode = useMemo(() => {
    return selectedDeptInfo?.code || '';
  }, [selectedDeptInfo]);

  const regPrefix = useMemo(() => {
    if (!selectedBatchYear || !deptCode) return '';
    return `${selectedBatchYear}/${deptCode}/`;
  }, [selectedBatchYear, deptCode]);

  const STUDENTS_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

  // Fetch students from database when filters are selected
  useEffect(() => {
    const loadStudents = async () => {
      if (!selectedBatchYear || !selectedFaculty || !selectedDepartment || !regPrefix) {
        setStudents([]);
        return;
      }

      // Create cache key based on filters (but not search term for main cache)
      const cacheKey = `students_cache_${selectedBatchYear}_${selectedFaculty}_${selectedDepartment}`;
      
      // Check cache first (only if no search term)
      if (!searchTerm.trim()) {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          try {
            const { data, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;
            
            if (age < STUDENTS_CACHE_DURATION) {
              setStudents(data || []);
              setLoading(false);
              
              // Refresh in background if data is older than 30 seconds
              if (age > 30 * 1000) {
                loadFresh();
              }
              return;
            }
          } catch (e) {
            console.error('Cache parse error:', e);
          }
        }
      }

      await loadFresh();
    };

    const loadFresh = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          regPrefix: regPrefix,
          department: selectedDepartment,
          page: '1',
          limit: '1000'
        });
        
        if (searchTerm.trim()) {
          params.append('search', searchTerm);
        }

        const url = `/api/students?${params.toString()}`;
        const res = await apiClient.get(url);
        const studentsList = res?.data?.students || [];
        setStudents(studentsList);
        
        // Cache the data (only if no search term)
        if (!searchTerm.trim()) {
          const cacheKey = `students_cache_${selectedBatchYear}_${selectedFaculty}_${selectedDepartment}`;
          sessionStorage.setItem(cacheKey, JSON.stringify({
            data: studentsList,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error('Error loading students:', error);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };

    loadStudents();
  }, [selectedBatchYear, selectedFaculty, selectedDepartment, regPrefix, searchTerm]);

  // Reload function for manual refresh after create/delete
  const reloadStudents = async () => {
    if (!selectedBatchYear || !selectedFaculty || !selectedDepartment || !regPrefix) {
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        regPrefix: regPrefix,
        department: selectedDepartment,
        page: '1',
        limit: '1000'
      });
      
      if (searchTerm.trim()) {
        params.append('search', searchTerm);
      }

      const url = `/api/students?${params.toString()}`;
      const res = await apiClient.get(url);
      const studentsList = res?.data?.students || [];
      setStudents(studentsList);
      
      // Update cache (only if no search term)
      if (!searchTerm.trim()) {
        const cacheKey = `students_cache_${selectedBatchYear}_${selectedFaculty}_${selectedDepartment}`;
        sessionStorage.setItem(cacheKey, JSON.stringify({
          data: studentsList,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Error reloading students:', error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      if (!editingStudent) {
        if (!selectedBatchYear) return alert('Please select a batch at the top of the page');
        if (!selectedFaculty) return alert('Please select a faculty at the top of the page');
        if (!selectedDepartment) return alert('Please select a department at the top of the page');
        if (!regPrefix) return alert('Please complete registration number prefix');
        if (!regSuffix) return alert('Please enter registration number suffix');
        payload.registrationNo = `${regPrefix}${regSuffix}`;
        payload.department = selectedDepartment;
      }
      if (editingStudent) {
        await apiClient.put(`/api/students/${editingStudent._id}`, payload);
        alert('Student updated successfully!');
      } else {
        await apiClient.post('/api/students', payload);
        alert('Student created successfully!');
      }
      setShowAddModal(false);
      setEditingStudent(null);
      setFormData({
        registrationNo: '',
        name: '',
        email: '',
        department: '',
        year: 1,
        semester: 1,
        phone: '',
        address: ''
      });
      setRegSuffix('');
      // Clear cache and reload
      const cacheKey = `students_cache_${selectedBatchYear}_${selectedFaculty}_${selectedDepartment}`;
      sessionStorage.removeItem(cacheKey);
      await reloadStudents();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    setFormData({
      registrationNo: student.registrationNo,
      name: student.name,
      email: student.email,
      department: student.department,
      year: student.year,
      semester: student.semester,
      phone: student.phone || '',
      address: student.address || ''
    });
    setRegSuffix('');
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this student?')) {
      try {
        await apiClient.delete(`/api/students/${id}`);
        // Clear cache and reload
        const cacheKey = `students_cache_${selectedBatchYear}_${selectedFaculty}_${selectedDepartment}`;
        sessionStorage.removeItem(cacheKey);
        await reloadStudents();
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">Student Management</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Manage student records and information</p>
        </div>
        <button
          onClick={() => {
            if (!selectedBatchYear) return alert('Please select a batch first');
            if (!selectedFaculty) return alert('Please select a faculty first');
            if (!selectedDepartment) return alert('Please select a department first');
            setEditingStudent(null);
            setFormData({
              registrationNo: '',
              name: '',
              email: '',
              department: selectedDepartment,
              year: 1,
              semester: 1,
              phone: '',
              address: ''
            });
            setRegSuffix('');
            setShowAddModal(true);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium ${(!selectedBatchYear || !selectedFaculty || !selectedDepartment) ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={!selectedBatchYear || !selectedFaculty || !selectedDepartment}
        >
          <Plus className="w-5 h-5" />
          Add Student
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 flex-wrap">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Batch:</label>
            <div className="relative w-full sm:w-auto">
              <CustomSelect
              value={selectedBatchYear}
                onChange={(e) => setSelectedBatchYear(e.target.value)}
                disabled={loadingBatches}
                loading={loadingBatches}
                placeholder={loadingBatches ? 'Loading batches...' : 'Select Batch'}
                options={[
                  { value: '', label: loadingBatches ? 'Loading batches...' : 'Select Batch' },
                  ...batches.map((b) => ({
                    value: String(b.startYear),
                    label: b.name || b.startYear
                  }))
                ]}
                className="w-full sm:w-auto"
              />
              {(loading && selectedBatchYear) && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <LoadingSpinner size="sm" className="text-cyan-600" />
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Faculty:</label>
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
              className="w-full sm:w-auto"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Department:</label>
            <CustomSelect
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              disabled={!selectedFaculty}
              placeholder={selectedFaculty ? 'Select Department' : 'Select Faculty first'}
              options={[
                { value: '', label: selectedFaculty ? 'Select Department' : 'Select Faculty first' },
                ...availableDepartments.map((dept) => ({
                  value: dept.name,
                  label: dept.name
                }))
              ]}
              className="w-full sm:w-auto"
            />
          </div>
          {regPrefix && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-100 dark:bg-slate-800 rounded-lg w-full sm:w-auto">
              <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">Registration Prefix:</span>
              <span className="text-xs sm:text-sm font-mono text-slate-900 dark:text-white font-semibold">{regPrefix}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={selectedBatchYear && selectedFaculty && selectedDepartment ? "Search by name, email, or registration number..." : "Please select Batch, Faculty, and Department first"}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={!selectedBatchYear || !selectedFaculty || !selectedDepartment}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Registration No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Year/Semester
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <LoadingSpinner size="lg" className="text-cyan-600" />
                      <span className="text-slate-500 dark:text-slate-400">Loading students...</span>
                    </div>
                  </td>
                </tr>
              ) : !selectedBatchYear || !selectedFaculty || !selectedDepartment ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    Please select Batch, Faculty, and Department to view students
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    No students found for the selected criteria
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student._id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                      {student.registrationNo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                      {student.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                      {student.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                      {student.department}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                      Year {student.year} / Sem {student.semester}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onViewStudent(student)}
                          className="p-2 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(student)}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(student._id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                {editingStudent ? 'Edit Student' : 'Add New Student'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Registration Number *
                  </label>
              {editingStudent ? (
                <input
                  type="text"
                  required
                  value={formData.registrationNo}
                  onChange={(e) => setFormData({ ...formData, registrationNo: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white"
                />
              ) : (
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-300 select-none font-mono">
                    {regPrefix || 'YYYY/DEPT/'}
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="001"
                    value={regSuffix}
                    onChange={(e) => setRegSuffix(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-r-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Department *
                  </label>
                  {editingStudent ? (
                    <CustomSelect
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="Select Department"
                      options={Object.values(facultyStructure).flatMap(faculty => 
                        faculty.departments.map(dept => ({
                          value: dept.name,
                          label: dept.name
                        }))
                      )}
                      className="w-full"
                    />
                  ) : (
                    <input
                      type="text"
                      value={selectedDepartment || ''}
                      disabled
                      className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed text-xs sm:text-sm"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Year *
                  </label>
                  <CustomSelect
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    placeholder="Select Year"
                    options={[1, 2, 3, 4].map(y => ({
                      value: y,
                      label: `Year ${y}`
                    }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Semester *
                  </label>
                  <CustomSelect
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: parseInt(e.target.value) })}
                    placeholder="Select Semester"
                    options={[1, 2].map(s => ({
                      value: s,
                      label: s === 1 ? '1st Semester' : '2nd Semester'
                    }))}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows="2"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all"
                >
                  {editingStudent ? 'Update Student' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
