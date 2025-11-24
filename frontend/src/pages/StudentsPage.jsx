import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Eye, Edit, Trash2, Download, Users, Upload, FileSpreadsheet, X } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CustomSelect } from '../components/CustomSelect';
import { useNotification } from '../contexts/NotificationContext';

export const StudentsPage = ({ onViewStudent }) => {
  const { showSuccess, showError, showWarning } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({ year: '', semester: '' });
  const [bulkEditLoading, setBulkEditLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingStudent, setViewingStudent] = useState(null);

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
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedSemester, setSelectedSemester] = useState('all');
  const [regSuffix, setRegSuffix] = useState('');
  const [quickSearch, setQuickSearch] = useState('');
  const [quickSearchResults, setQuickSearchResults] = useState([]);
  const [quickSearchLoading, setQuickSearchLoading] = useState(false);

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

  // Quick search by registration number
  useEffect(() => {
    const searchByRegNo = async () => {
      // Disable quick search when filters are active
      if (selectedBatchYear || selectedFaculty || selectedDepartment) {
        setQuickSearchResults([]);
        setQuickSearch('');
        return;
      }
      
      if (!quickSearch.trim()) {
        setQuickSearchResults([]);
        return;
      }

      try {
        setQuickSearchLoading(true);
        const params = new URLSearchParams({
          search: quickSearch.trim(),
          page: '1',
          limit: '50'
        });

        const url = `/api/students?${params.toString()}`;
        const res = await apiClient.get(url);
        const studentsList = res?.data?.students || [];
        setQuickSearchResults(studentsList);
      } catch (error) {
        console.error('Error in quick search:', error);
        setQuickSearchResults([]);
      } finally {
        setQuickSearchLoading(false);
      }
    };

    // Debounce search
    const timer = setTimeout(() => {
      searchByRegNo();
    }, 300);

    return () => clearTimeout(timer);
  }, [quickSearch, selectedBatchYear, selectedFaculty, selectedDepartment]);

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
        // API returns array directly, not wrapped in data property
        const batchesData = Array.isArray(response) ? response : (response?.data || []);
        console.log('Batches loaded:', batchesData);
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
      
      // Year and Semester are optional now (can be "all")
      if (!selectedYear || !selectedSemester) {
        setStudents([]);
        return;
      }

      // Create cache key based on filters (but not search term for main cache)
      const cacheKey = `students_cache_${selectedBatchYear}_${selectedFaculty}_${selectedDepartment}_${selectedYear}_${selectedSemester}`;
      
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
        
        // Only add year and semester if not "all"
        if (selectedYear && selectedYear !== 'all') {
          params.append('year', selectedYear);
        }
        if (selectedSemester && selectedSemester !== 'all') {
          params.append('semester', selectedSemester);
        }
        
        if (searchTerm.trim()) {
          params.append('search', searchTerm);
        }

        const url = `/api/students?${params.toString()}`;
        const res = await apiClient.get(url);
        const studentsList = res?.data?.students || [];
        setStudents(studentsList);
        
        // Cache the data (only if no search term)
        if (!searchTerm.trim()) {
          const cacheKey = `students_cache_${selectedBatchYear}_${selectedFaculty}_${selectedDepartment}_${selectedYear}_${selectedSemester}`;
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
  }, [selectedBatchYear, selectedFaculty, selectedDepartment, regPrefix, selectedYear, selectedSemester, searchTerm]);

  // Reload function for manual refresh after create/delete
  const reloadStudents = async () => {
    if (!selectedBatchYear || !selectedFaculty || !selectedDepartment || !regPrefix || !selectedYear || !selectedSemester) {
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
      
      // Only add year and semester if not "all"
      if (selectedYear && selectedYear !== 'all') {
        params.append('year', selectedYear);
      }
      if (selectedSemester && selectedSemester !== 'all') {
        params.append('semester', selectedSemester);
      }
      
      if (searchTerm.trim()) {
        params.append('search', searchTerm);
      }

      const url = `/api/students?${params.toString()}`;
      const res = await apiClient.get(url);
      const studentsList = res?.data?.students || [];
      setStudents(studentsList);
      
      // Update cache (only if no search term)
      if (!searchTerm.trim()) {
        const cacheKey = `students_cache_${selectedBatchYear}_${selectedFaculty}_${selectedDepartment}_${selectedYear}_${selectedSemester}`;
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
        if (!selectedBatchYear) { showWarning('Please select a batch at the top of the page'); return; }
        if (!selectedFaculty) { showWarning('Please select a faculty at the top of the page'); return; }
        if (!selectedDepartment) { showWarning('Please select a department at the top of the page'); return; }
        if (!selectedYear || selectedYear === 'all') { showWarning('Please select a specific year (not "All Years") to add a student'); return; }
        if (!selectedSemester || selectedSemester === 'all') { showWarning('Please select a specific semester (not "All Semesters") to add a student'); return; }
        if (!regPrefix) { showWarning('Please complete registration number prefix'); return; }
        if (!regSuffix) { showWarning('Please enter registration number suffix'); return; }
        payload.registrationNo = `${regPrefix}${regSuffix}`;
        payload.department = selectedDepartment;
        payload.year = parseInt(selectedYear);
        payload.semester = parseInt(selectedSemester);
      }
      if (editingStudent) {
        await apiClient.put(`/api/students/${editingStudent._id}`, payload);
        showSuccess('Student updated successfully!');
      } else {
        await apiClient.post('/api/students', payload);
        showSuccess('Student created successfully!');
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
      const cacheKey = `students_cache_${selectedBatchYear}_${selectedFaculty}_${selectedDepartment}_${selectedYear}_${selectedSemester}`;
      sessionStorage.removeItem(cacheKey);
      await reloadStudents();
    } catch (error) {
      showError(error.message || 'Failed to save student', 'Error');
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
        const cacheKey = `students_cache_${selectedBatchYear}_${selectedFaculty}_${selectedDepartment}_${selectedYear}_${selectedSemester}`;
        sessionStorage.removeItem(cacheKey);
        await reloadStudents();
      } catch (error) {
        showError(error.message || 'Failed to delete student', 'Delete Error');
      }
    }
  };

  const handleBulkEdit = async (e) => {
    e.preventDefault();
    
    if (!bulkEditData.year && !bulkEditData.semester) {
      showWarning('Please select at least Year or Semester to update');
      return;
    }

    const confirmMsg = `Are you sure you want to update ${students.length} student(s)?\n\n` +
      (bulkEditData.year ? `Year will be set to: ${bulkEditData.year}\n` : '') +
      (bulkEditData.semester ? `Semester will be set to: ${bulkEditData.semester}` : '');

    if (!confirm(confirmMsg)) return;

    try {
      setBulkEditLoading(true);
      
      // Prepare update data
      const updateData = {};
      if (bulkEditData.year) updateData.year = parseInt(bulkEditData.year);
      if (bulkEditData.semester) updateData.semester = parseInt(bulkEditData.semester);

      // Get all student IDs from filtered list
      const studentIds = students.map(s => s._id);

      // Call bulk update API
      await apiClient.put('/api/students/bulk-update', {
        studentIds,
        updateData
      });

      showSuccess(`Successfully updated ${students.length} student(s)!`);
      setShowBulkEditModal(false);
      setBulkEditData({ year: '', semester: '' });
      
      // Clear cache and reload
      const cacheKey = `students_cache_${selectedBatchYear}_${selectedFaculty}_${selectedDepartment}_${selectedYear}_${selectedSemester}`;
      sessionStorage.removeItem(cacheKey);
      await reloadStudents();
    } catch (error) {
      showError(error.message || 'Failed to update students', 'Update Failed');
    } finally {
      setBulkEditLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (students.length === 0) {
      showWarning('No students to export');
      return;
    }

    // Create CSV content
    const headers = ['registrationNo', 'name', 'email', 'department', 'year', 'semester', 'phone', 'address'];
    const csvContent = [
      headers.join(','),
      ...students.map(student => 
        headers.map(header => {
          const value = student[header] || '';
          // Escape commas and quotes in values
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `students_${selectedBatchYear}_${selectedDepartment}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = async (e) => {
    e.preventDefault();
    
    if (!importFile) {
      showWarning('Please select a file');
      return;
    }

    if (!selectedBatchYear || !selectedFaculty || !selectedDepartment) {
      showWarning('Please select Batch, Faculty, and Department first');
      return;
    }
    
    if (selectedYear === 'all' || selectedSemester === 'all') {
      showWarning('Please select specific Year and Semester (not "All") for importing students');
      return;
    }

    try {
      setImportLoading(true);
      setImportResults(null);

      const text = await importFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        showError('CSV file is empty or invalid', 'Invalid File');
        return;
      }

      // Parse CSV
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const requiredHeaders = ['registrationNo', 'name', 'email', 'department', 'year', 'semester'];
      
      // Validate headers
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        showError(`Missing required columns: ${missingHeaders.join(', ')}`, 'Invalid CSV Format');
        return;
      }

      const studentsToImport = [];
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV line (handle quoted values)
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

        const student = {};
        headers.forEach((header, index) => {
          student[header] = values[index] || '';
        });

        // Validate required fields
        const missing = requiredHeaders.filter(h => !student[h]);
        if (missing.length > 0) {
          errors.push(`Line ${i + 1}: Missing ${missing.join(', ')}`);
          continue;
        }

        // Convert year and semester to numbers
        student.year = parseInt(student.year);
        student.semester = parseInt(student.semester);

        if (isNaN(student.year) || isNaN(student.semester)) {
          errors.push(`Line ${i + 1}: Invalid year or semester`);
          continue;
        }

        studentsToImport.push(student);
      }

      if (studentsToImport.length === 0) {
        showError('No valid students found in CSV file', 'Import Failed');
        setImportResults({ success: 0, failed: errors.length, errors });
        return;
      }

      // Import students
      let successCount = 0;
      let failCount = 0;

      for (const student of studentsToImport) {
        try {
          await apiClient.post('/api/students', student);
          successCount++;
        } catch (error) {
          failCount++;
          errors.push(`${student.registrationNo}: ${error.message}`);
        }
      }

      setImportResults({
        success: successCount,
        failed: failCount,
        errors: errors.slice(0, 10) // Show first 10 errors
      });

      if (successCount > 0) {
        // Clear cache and reload
        const cacheKey = `students_cache_${selectedBatchYear}_${selectedFaculty}_${selectedDepartment}_${selectedYear}_${selectedSemester}`;
        sessionStorage.removeItem(cacheKey);
        await reloadStudents();
      }

    } catch (error) {
      showError(error.message || 'Failed to import CSV', 'Import Error');
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">Student Management</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Manage student records and information</p>
        </div>
      </div>

      {/* Quick Search Bar */}
      <div className={`mb-6 rounded-xl p-4 border transition-all ${
        (selectedBatchYear || selectedFaculty || selectedDepartment) 
          ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700 opacity-60' 
          : 'bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 border-cyan-200 dark:border-slate-700'
      }`}>
        <div className="relative">
          <Search className={`w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 ${
            (selectedBatchYear || selectedFaculty || selectedDepartment)
              ? 'text-slate-400 dark:text-slate-600'
              : 'text-cyan-600 dark:text-cyan-400'
          }`} />
          <input
            type="text"
            placeholder={
              (selectedBatchYear || selectedFaculty || selectedDepartment)
                ? "Quick search is disabled when filters are active. Clear filters to use quick search."
                : "Quick search by registration number, name, or email..."
            }
            value={quickSearch}
            onChange={(e) => setQuickSearch(e.target.value)}
            disabled={selectedBatchYear || selectedFaculty || selectedDepartment}
            className="w-full pl-10 pr-10 py-3 bg-white dark:bg-slate-900 border border-cyan-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800"
          />
          {quickSearch && (
            <button
              onClick={() => setQuickSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title="Clear search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {quickSearchLoading && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2">
              <LoadingSpinner size="sm" className="text-cyan-600" />
            </div>
          )}
        </div>
        
        {/* Quick Search Results */}
        {quickSearch && quickSearchResults.length > 0 && (
          <div className="mt-3 bg-white dark:bg-slate-900 rounded-lg border border-cyan-200 dark:border-slate-700 max-h-96 overflow-y-auto">
            <div className="p-2">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 px-2 py-1">
                Found {quickSearchResults.length} student(s)
              </p>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {quickSearchResults.map((student) => (
                <div
                  key={student._id}
                  className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-cyan-600 dark:text-cyan-400">
                        {student.registrationNo}
                      </span>
                      <span 
                        className="text-sm font-medium text-slate-900 dark:text-white inline-block max-w-[200px] truncate cursor-help" 
                        title={student.name}
                      >
                        {student.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-600 dark:text-slate-400">
                      <span>{student.email}</span>
                      <span>•</span>
                      <span>{student.department}</span>
                      <span>•</span>
                      <span>Year {student.year} / Sem {student.semester}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setViewingStudent(student);
                        setShowViewModal(true);
                        setQuickSearch('');
                      }}
                      className="p-2 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        handleEdit(student);
                        setQuickSearch('');
                      }}
                      className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        handleDelete(student._id);
                        setQuickSearch('');
                      }}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {quickSearch && !quickSearchLoading && quickSearchResults.length === 0 && (
          <div className="mt-3 bg-white dark:bg-slate-900 rounded-lg border border-cyan-200 dark:border-slate-700 p-4 text-center text-sm text-slate-600 dark:text-slate-400">
            No students found matching "{quickSearch}"
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Filter by Batch, Faculty, Department, Year & Semester
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {selectedBatchYear && selectedFaculty && selectedDepartment && selectedYear && selectedSemester && selectedYear !== 'all' && selectedSemester !== 'all' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setImportFile(null);
                  setImportResults(null);
                  setShowImportModal(true);
                }}
                className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium text-sm sm:text-base"
                title="Import from CSV"
              >
                <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Import</span>
              </button>
              {students.length > 0 && (
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white rounded-lg hover:shadow-lg transition-all font-medium text-sm sm:text-base"
                  title="Export to CSV"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Export</span>
                </button>
              )}
            </div>
          )}
          {selectedBatchYear && selectedFaculty && selectedDepartment && selectedYear && selectedSemester && students.length > 0 && (
            <button
              onClick={() => {
                setBulkEditData({ year: '', semester: '' });
                setShowBulkEditModal(true);
              }}
              className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-slate-600 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg hover:shadow-lg transition-all font-medium text-sm sm:text-base"
            >
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Bulk Edit</span>
              <span className="sm:hidden">Edit All</span>
            </button>
          )}
          <button
            onClick={() => {
              if (!selectedBatchYear) { showWarning('Please select a batch first'); return; }
              if (!selectedFaculty) { showWarning('Please select a faculty first'); return; }
              if (!selectedDepartment) { showWarning('Please select a department first'); return; }
              if (!selectedYear || selectedYear === 'all') { showWarning('Please select a specific year (not "All Years") to add a student'); return; }
              if (!selectedSemester || selectedSemester === 'all') { showWarning('Please select a specific semester (not "All Semesters") to add a student'); return; }
              setEditingStudent(null);
              setFormData({
                registrationNo: '',
                name: '',
                email: '',
                department: selectedDepartment,
                year: parseInt(selectedYear),
                semester: parseInt(selectedSemester),
                phone: '',
                address: ''
              });
              setRegSuffix('');
              setShowAddModal(true);
            }}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium text-sm sm:text-base ${(!selectedBatchYear || !selectedFaculty || !selectedDepartment || !selectedYear || !selectedSemester || selectedYear === 'all' || selectedSemester === 'all') ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!selectedBatchYear || !selectedFaculty || !selectedDepartment || !selectedYear || !selectedSemester || selectedYear === 'all' || selectedSemester === 'all'}
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Add Student</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
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
                  { value: '', label: loadingBatches ? 'Loading batches...' : (batches.length === 0 ? 'No batches available' : 'Select Batch') },
                  ...(Array.isArray(batches) ? batches.map((b) => ({
                    value: String(b.startYear),
                    label: b.name || b.startYear
                  })) : [])
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Year:</label>
            <CustomSelect
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              disabled={!selectedDepartment}
              placeholder={selectedDepartment ? 'Select Year' : 'Select Department first'}
              options={[
                { value: 'all', label: 'All Years' },
                { value: '1', label: 'Year 1' },
                { value: '2', label: 'Year 2' },
                { value: '3', label: 'Year 3' },
                { value: '4', label: 'Year 4' }
              ]}
              className="w-full sm:w-auto"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">Semester:</label>
            <CustomSelect
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              disabled={!selectedYear}
              placeholder={selectedYear ? 'Select Semester' : 'Select Year first'}
              options={[
                { value: 'all', label: 'All Semesters' },
                { value: '1', label: '1st Semester' },
                { value: '2', label: '2nd Semester' }
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
          {(selectedBatchYear || selectedFaculty || selectedDepartment || selectedYear !== 'all' || selectedSemester !== 'all') && (
            <button
              onClick={() => {
                setSelectedBatchYear('');
                setSelectedFaculty('');
                setSelectedDepartment('');
                setSelectedYear('all');
                setSelectedSemester('all');
                setSearchTerm('');
                setStudents([]);
              }}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded-lg transition-all font-medium text-xs sm:text-sm border border-red-300 dark:border-red-800"
              title="Clear all filters"
            >
              <X className="w-4 h-4" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={selectedBatchYear && selectedFaculty && selectedDepartment && selectedYear && selectedSemester ? "Search by name, email, or registration number..." : "Please select all filters first"}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={!selectedBatchYear || !selectedFaculty || !selectedDepartment || !selectedYear || !selectedSemester}
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
              ) : !selectedBatchYear || !selectedFaculty || !selectedDepartment || !selectedYear || !selectedSemester ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    Please select all filters to view students
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
                      <span 
                        className="inline-block max-w-[200px] truncate cursor-help" 
                        title={student.name}
                      >
                        {student.name}
                      </span>
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
                          onClick={() => {
                            setViewingStudent(student);
                            setShowViewModal(true);
                          }}
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

      {showImportModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowImportModal(false);
            setImportResults(null);
            setImportFile(null);
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                Import Students from CSV
              </h3>
            </div>
            <form onSubmit={handleImportCSV} className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-xs">
                <p className="font-mono text-slate-700 dark:text-slate-300 mb-2">
                  registrationNo,name,email,department,year,semester
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  Optional: phone, address
                </p>
              </div>

              <div>
                <label className="block">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setImportFile(e.target.files[0])}
                    className="hidden"
                    id="csv-file-input"
                    required
                  />
                  <div className="w-full px-4 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-cyan-500 dark:hover:border-cyan-500 transition-colors cursor-pointer bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400">
                      <FileSpreadsheet className="w-5 h-5" />
                      <span className="text-sm">
                        {importFile ? importFile.name : 'Choose CSV file...'}
                      </span>
                    </div>
                  </div>
                </label>
              </div>

              {importResults && (
                <div className={`p-3 rounded-lg text-sm ${importResults.failed > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200' : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'}`}>
                  <p>✅ Success: {importResults.success}</p>
                  <p>❌ Failed: {importResults.failed}</p>
                  {importResults.errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-semibold">View Errors</summary>
                      <ul className="text-xs mt-1 max-h-24 overflow-y-auto">
                        {importResults.errors.map((err, idx) => (
                          <li key={idx}>• {err}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportResults(null);
                    setImportFile(null);
                  }}
                  disabled={importLoading}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  {importResults ? 'Close' : 'Cancel'}
                </button>
                {!importResults && (
                  <button
                    type="submit"
                    disabled={importLoading || !importFile}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {importLoading && <LoadingSpinner size="sm" className="text-white" />}
                    {importLoading ? 'Importing...' : 'Import'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkEditModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowBulkEditModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                Bulk Edit Students
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                Update Year and/or Semester for {students.length} filtered student(s)
              </p>
            </div>
            <form onSubmit={handleBulkEdit} className="p-6 space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> This will update all {students.length} student(s) currently displayed in the filtered list.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Update Year (Optional)
                </label>
                <CustomSelect
                  value={bulkEditData.year}
                  onChange={(e) => setBulkEditData({ ...bulkEditData, year: e.target.value })}
                  placeholder="Keep current year"
                  options={[
                    { value: '', label: 'Keep current year' },
                    { value: '1', label: 'Year 1' },
                    { value: '2', label: 'Year 2' },
                    { value: '3', label: 'Year 3' },
                    { value: '4', label: 'Year 4' }
                  ]}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Update Semester (Optional)
                </label>
                <CustomSelect
                  value={bulkEditData.semester}
                  onChange={(e) => setBulkEditData({ ...bulkEditData, semester: e.target.value })}
                  placeholder="Keep current semester"
                  options={[
                    { value: '', label: 'Keep current semester' },
                    { value: '1', label: '1st Semester' },
                    { value: '2', label: '2nd Semester' }
                  ]}
                  className="w-full"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBulkEditModal(false)}
                  disabled={bulkEditLoading}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkEditLoading || (!bulkEditData.year && !bulkEditData.semester)}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {bulkEditLoading && <LoadingSpinner size="sm" className="text-white" />}
                  {bulkEditLoading ? 'Updating...' : 'Update All Students'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
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

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
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
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                  />
                )}
              </div>

              {editingStudent && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
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
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
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
              )}

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

      {/* View Student Details Modal */}
      {showViewModal && viewingStudent && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowViewModal(false);
            setViewingStudent(null);
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Student Details</h3>
            </div>
            <div className="p-6 space-y-6">
              {/* Registration Number */}
              <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 rounded-lg p-4 border border-cyan-200 dark:border-slate-700">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Registration Number
                </label>
                <p className="text-lg font-mono font-bold text-cyan-600 dark:text-cyan-400">
                  {viewingStudent.registrationNo}
                </p>
              </div>

              {/* Name and Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Full Name
                  </label>
                  <p className="text-base text-slate-900 dark:text-white font-medium">
                    {viewingStudent.name}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Email Address
                  </label>
                  <p className="text-base text-slate-900 dark:text-white">
                    {viewingStudent.email}
                  </p>
                </div>
              </div>

              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Department
                </label>
                <p className="text-base text-slate-900 dark:text-white">
                  {viewingStudent.department}
                </p>
              </div>

              {/* Year and Semester */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Academic Year
                  </label>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    Year {viewingStudent.year}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Semester
                  </label>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {viewingStudent.semester === 1 ? '1st' : '2nd'} Semester
                  </p>
                </div>
              </div>

              {/* Phone and Address */}
              {(viewingStudent.phone || viewingStudent.address) && (
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  {viewingStudent.phone && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Phone Number
                      </label>
                      <p className="text-base text-slate-900 dark:text-white">
                        {viewingStudent.phone}
                      </p>
                    </div>
                  )}
                  {viewingStudent.address && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Address
                      </label>
                      <p className="text-base text-slate-900 dark:text-white">
                        {viewingStudent.address}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Timestamps */}
              {(viewingStudent.createdAt || viewingStudent.updatedAt) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  {viewingStudent.createdAt && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Created At
                      </label>
                      <p className="text-sm text-slate-900 dark:text-white">
                        {new Date(viewingStudent.createdAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {viewingStudent.updatedAt && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Last Updated
                      </label>
                      <p className="text-sm text-slate-900 dark:text-white">
                        {new Date(viewingStudent.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingStudent(null);
                  }}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors font-medium"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleEdit(viewingStudent);
                    setShowViewModal(false);
                    setViewingStudent(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
                >
                  <Edit className="w-4 h-4" />
                  Edit Student
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
