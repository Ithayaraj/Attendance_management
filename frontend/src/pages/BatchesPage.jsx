import { useEffect, useState, useRef, useMemo } from 'react';
import { Plus, Trash2, Edit, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CustomSelect } from '../components/CustomSelect';
import { useNotification } from '../contexts/NotificationContext';

const CACHE_KEY = 'batches_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const BatchesPage = () => {
  const { showSuccess, showError } = useNotification();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false);
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [newBatchYear, setNewBatchYear] = useState('');
  const [selectedBatchYear, setSelectedBatchYear] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');

  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState({
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: () => {},
    type: 'warning' // 'warning', 'danger', 'info'
  });
  const [currentYear, setCurrentYear] = useState('1');
  const [currentSemester, setCurrentSemester] = useState('1');
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [editingBatchYear, setEditingBatchYear] = useState(null);
  const [newYearValue, setNewYearValue] = useState('');
  const [expandedYears, setExpandedYears] = useState({});
  const [batchRelations, setBatchRelations] = useState({});
  const hasLoadedRef = useRef(false);

  // Helper function to show confirmation modal
  const showConfirmation = (title, message, onConfirm, type = 'warning', confirmText = 'Confirm', cancelText = 'Cancel') => {
    setConfirmModalData({
      title,
      message,
      confirmText,
      cancelText,
      onConfirm,
      type
    });
    setShowConfirmModal(true);
  };
  
  // Get all unique batch years
  const batchYears = useMemo(() => {
    const years = [...new Set(batches.map(b => b.startYear))];
    return years.sort((a, b) => b - a);
  }, [batches]);

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

  // Departments based on selected faculty
  const availableDepartments = useMemo(() => {
    if (!selectedFaculty || !facultyStructure[selectedFaculty]) return [];
    return facultyStructure[selectedFaculty].departments;
  }, [selectedFaculty]);

  // Group batches by year
  const groupedBatches = useMemo(() => {
    const grouped = {};
    batches.forEach(batch => {
      const year = batch.startYear;
      if (!grouped[year]) {
        grouped[year] = [];
      }
      grouped[year].push(batch);
    });
    return grouped;
  }, [batches]);

  // Get sorted years
  const sortedYears = useMemo(() => {
    return Object.keys(groupedBatches).sort((a, b) => b - a);
  }, [groupedBatches]);

  // Check if any department in a batch year has relations
  const batchYearHasRelations = (year) => {
    if (!groupedBatches[year]) return false;
    return groupedBatches[year].some(batch => batchRelations[batch._id]?.hasRelatedData);
  };

  // Check if batch has relations
  const checkBatchRelations = async (batchId) => {
    try {
      const response = await apiClient.get(`/api/batches/${batchId}/relations`);
      return response.data || {};
    } catch (e) {
      console.error('Failed to check batch relations:', e);
      return {};
    }
  };

  // Load batch relations for all batches
  const loadBatchRelations = async (batchesData) => {
    try {
      const relations = {};
      const relationPromises = batchesData.map(async (batch) => {
        const batchRelation = await checkBatchRelations(batch._id);
        relations[batch._id] = batchRelation;
      });
      
      await Promise.all(relationPromises);
      setBatchRelations(relations);
    } catch (e) {
      console.error('Failed to load batch relations:', e);
    }
  };

  const load = async (useCache = true) => {
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
            
            // Load relations for cached data
            await loadBatchRelations(data || []);
            
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
      const batchesData = Array.isArray(res) ? res : (res?.data || []);
      setBatches(batchesData);
      
      // Load relations for all batches
      await loadBatchRelations(batchesData);
      
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        data: batchesData,
        timestamp: Date.now()
      }));
      hasLoadedRef.current = true;
    } catch (e) {
      showError(e.message || 'Failed to load batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createBatch = async (e) => {
    e.preventDefault();
    try {
      if (!newBatchYear) {
        showConfirmation(
          'Missing Batch Year',
          'Please enter batch year.',
          () => {},
          'warning',
          'OK',
          ''
        );
        return;
      }
      
      const year = Number(newBatchYear);
      if (year < 1900 || year > 3000) {
        showConfirmation(
          'Invalid Year',
          'Please enter a valid year between 1900 and 3000.',
          () => {},
          'warning',
          'OK',
          ''
        );
        return;
      }
      
      // Check if batch year already exists
      if (batchYears.includes(year)) {
        showConfirmation(
          'Batch Year Exists',
          'This batch year already exists. Please choose a different year.',
          () => {},
          'warning',
          'OK',
          ''
        );
        return;
      }
      
      // Close modal and open add department modal
      setShowCreateBatchModal(false);
      setNewBatchYear('');
      
      // Open add department modal for this year
      openAddDeptModal(year);
      
      showSuccess(`Now add a department to ${year} batch`);
    } catch (e) {
      showError(e.message || 'Failed to create batch');
    }
  };

  const openAddDeptModal = (year) => {
    setSelectedBatchYear(String(year));
    setSelectedFaculty('');
    setSelectedDepartment('');
    setCurrentYear('1');
    setCurrentSemester('1');
    setShowAddDeptModal(true);
  };

  const addDepartment = async (e) => {
    e.preventDefault();
    try {
      if (!selectedBatchYear) {
        showConfirmation(
          'No Batch Year Selected',
          'Please select batch year.',
          () => {},
          'warning',
          'OK',
          ''
        );
        return;
      }
      if (!selectedFaculty) {
        showConfirmation(
          'No Faculty Selected',
          'Please select faculty.',
          () => {},
          'warning',
          'OK',
          ''
        );
        return;
      }
      if (!selectedDepartment) {
        showConfirmation(
          'No Department Selected',
          'Please select department.',
          () => {},
          'warning',
          'OK',
          ''
        );
        return;
      }
      
      const year = Number(selectedBatchYear);
      
      await apiClient.post('/api/batches', { 
        startYear: year, 
        name: `${year} Batch`,
        faculty: selectedFaculty,
        department: selectedDepartment,
        currentYear: Number(currentYear),
        currentSemester: Number(currentSemester)
      });
      
      showSuccess('Department added to batch successfully!');
      setShowAddDeptModal(false);
      setSelectedBatchYear('');
      setSelectedFaculty('');
      setSelectedDepartment('');
      setCurrentYear('1');
      setCurrentSemester('1');
      sessionStorage.removeItem(CACHE_KEY);
      await load(false);
    } catch (e) {
      showError(e.message || 'Failed to add department');
    }
  };

  const remove = async (id) => {
    const attemptDelete = async (forceDelete = false) => {
      try {
        const url = forceDelete ? `/api/batches/${id}?force=true` : `/api/batches/${id}`;
        await apiClient.delete(url);
        showSuccess('Department deleted successfully!');
        sessionStorage.removeItem(CACHE_KEY);
        await load(false);
      } catch (e) {
        if (e.response?.status === 409 && e.response?.data?.requiresForceDelete) {
          // Batch has related data, show force delete confirmation
          const relatedData = e.response.data.relatedData;
          const batchInfo = e.response.data.batchInfo;
          const dataDetails = [];
          
          if (relatedData.students > 0) {
            dataDetails.push(`${relatedData.students} student${relatedData.students !== 1 ? 's' : ''}`);
          }
          if (relatedData.courses > 0) {
            dataDetails.push(`${relatedData.courses} course${relatedData.courses !== 1 ? 's' : ''}`);
          }
          if (relatedData.sessions > 0) {
            dataDetails.push(`${relatedData.sessions} session${relatedData.sessions !== 1 ? 's' : ''}`);
          }
          if (relatedData.enrollments > 0) {
            dataDetails.push(`${relatedData.enrollments} enrollment${relatedData.enrollments !== 1 ? 's' : ''}`);
          }
          if (relatedData.attendanceRecords > 0) {
            dataDetails.push(`${relatedData.attendanceRecords} attendance record${relatedData.attendanceRecords !== 1 ? 's' : ''}`);
          }
          if (relatedData.scanRecords > 0) {
            dataDetails.push(`${relatedData.scanRecords} scan record${relatedData.scanRecords !== 1 ? 's' : ''}`);
          }

          const message = `This department (${batchInfo.department} - Year ${batchInfo.year}, Semester ${batchInfo.semester}) has related data that will also be deleted:\n\n• ${dataDetails.join('\n• ')}\n\nThis action cannot be undone. Are you sure you want to proceed?`;

          showConfirmation(
            'Force Delete Required',
            message,
            () => attemptDelete(true),
            'danger',
            'Delete All',
            'Cancel'
          );
        } else {
          showError(e.message || 'Failed to delete');
        }
      }
    };

    showConfirmation(
      'Delete Department',
      'Are you sure you want to delete this department? This action cannot be undone.',
      () => attemptDelete(false),
      'danger',
      'Delete',
      'Cancel'
    );
  };

  const forceRemove = async (id) => {
    showConfirmation(
      'Force Delete Department',
      'This will permanently delete the department and ALL related data including students, courses, sessions, enrollments, attendance records, and scan records.\n\nThis action cannot be undone. Are you absolutely sure?',
      async () => {
        try {
          await apiClient.delete(`/api/batches/${id}?force=true`);
          showSuccess('Department and all related data deleted successfully!');
          sessionStorage.removeItem(CACHE_KEY);
          await load(false);
        } catch (e) {
          showError(e.message || 'Failed to force delete');
        }
      },
      'danger',
      'Force Delete All',
      'Cancel'
    );
  };

  const deleteBatch = async (year) => {
    const deptCount = groupedBatches[year].length;
    const deptText = deptCount === 1 ? 'department' : 'departments';
    
    showConfirmation(
      'Delete Entire Batch',
      `Are you sure you want to delete ${year} batch with all ${deptCount} ${deptText}? This action cannot be undone.`,
      async () => {
        await performBatchDelete(year, false);
      },
      'danger',
      'Delete Batch',
      'Cancel'
    );
  };

  const performBatchDelete = async (year, forceDelete = false) => {
    try {
      // Delete all departments in this batch
      const deletePromises = groupedBatches[year].map(batch => {
        const url = forceDelete ? `/api/batches/${batch._id}?force=true` : `/api/batches/${batch._id}`;
        return apiClient.delete(url);
      });
      
      await Promise.all(deletePromises);
      showSuccess(`${year} batch deleted successfully!`);
      sessionStorage.removeItem(CACHE_KEY);
      await load(false);
    } catch (e) {
      if (e.response?.status === 409 && e.response?.data?.requiresForceDelete) {
        // Some departments have related data, show force delete confirmation
        const message = `Some departments in ${year} batch have related data (students, courses, sessions, enrollments, attendance records, scan records) that will also be deleted.\n\nThis action cannot be undone. Are you sure you want to proceed?`;

        showConfirmation(
          'Force Delete Required',
          message,
          () => performBatchDelete(year, true),
          'danger',
          'Delete All',
          'Cancel'
        );
      } else {
        showError(e.message || 'Failed to delete batch');
      }
    }
  };

  const forceBatchDelete = async (year) => {
    const deptCount = groupedBatches[year].length;
    const deptText = deptCount === 1 ? 'department' : 'departments';
    
    showConfirmation(
      'Force Delete Entire Batch',
      `This will permanently delete ${year} batch with all ${deptCount} ${deptText} and ALL related data including students, courses, sessions, enrollments, attendance records, and scan records.\n\nThis action cannot be undone. Are you absolutely sure?`,
      async () => {
        try {
          // Force delete all departments in this batch
          const deletePromises = groupedBatches[year].map(batch => 
            apiClient.delete(`/api/batches/${batch._id}?force=true`)
          );
          
          await Promise.all(deletePromises);
          showSuccess(`${year} batch and all related data deleted successfully!`);
          sessionStorage.removeItem(CACHE_KEY);
          await load(false);
        } catch (e) {
          showError(e.message || 'Failed to force delete batch');
        }
      },
      'danger',
      'Force Delete All',
      'Cancel'
    );
  };

  const openEditBatchYear = (year) => {
    setEditingBatchYear(year);
    setNewYearValue(String(year));
  };

  const saveEditBatchYear = async (e) => {
    e.preventDefault();
    try {
      const oldYear = editingBatchYear;
      const newYear = Number(newYearValue);
      
      if (newYear < 1900 || newYear > 3000) {
        showConfirmation(
          'Invalid Year',
          'Please enter a valid year between 1900 and 3000.',
          () => {},
          'warning',
          'OK',
          ''
        );
        return;
      }
      
      if (newYear !== oldYear && batchYears.includes(newYear)) {
        showConfirmation(
          'Batch Year Exists',
          'This batch year already exists. Please choose a different year.',
          () => {},
          'warning',
          'OK',
          ''
        );
        return;
      }
      
      if (newYear === oldYear) {
        setEditingBatchYear(null);
        return;
      }
      
      // Update all departments in this batch with new year
      const updatePromises = groupedBatches[oldYear].map(batch => 
        apiClient.put(`/api/batches/${batch._id}`, {
          ...batch,
          startYear: newYear,
          name: `${newYear} Batch`
        })
      );
      
      await Promise.all(updatePromises);
      showSuccess(`Batch year updated from ${oldYear} to ${newYear}!`);
      setEditingBatchYear(null);
      setNewYearValue('');
      sessionStorage.removeItem(CACHE_KEY);
      await load(false);
    } catch (e) {
      showError(e.message || 'Failed to update batch year');
    }
  };

  const openEdit = (b) => {
    setEditing(b);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      // Find faculty for selected department
      let faculty = '';
      for (const [facultyName, facultyData] of Object.entries(facultyStructure)) {
        if (facultyData.departments.some(d => d.name === editing.department)) {
          faculty = facultyName;
          break;
        }
      }
      
      const response = await apiClient.put(`/api/batches/${editing._id}`, { 
        startYear: editing.startYear, 
        name: `${editing.startYear} Batch`,
        faculty: faculty,
        department: editing.department,
        currentYear: editing.currentYear,
        currentSemester: editing.currentSemester
      });
      
      // Show success message with student update count if available
      if (response.studentsUpdated !== undefined) {
        showSuccess(`Batch updated successfully! ${response.studentsUpdated} student(s) have been updated to Year ${editing.currentYear}, Semester ${editing.currentSemester}.`);
      } else {
        showSuccess('Batch updated successfully!');
      }
      
      setEditing(null);
      sessionStorage.removeItem(CACHE_KEY);
      // Clear students cache as well since they may have been updated
      sessionStorage.removeItem('students_batches_cache');
      await load(false);
    } catch (e) {
      showError(e.message || 'Failed to update');
    }
  };

  const toggleYear = (year) => {
    setExpandedYears(prev => ({
      ...prev,
      [year]: !prev[year]
    }));
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">Batch Management</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Create batches and manage their departments</p>
        </div>
        <button
          onClick={() => setShowCreateBatchModal(true)}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium text-sm w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          Create Batch
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        {loading ? (
          <div className="p-12 text-center">
            <div className="flex flex-col items-center justify-center gap-3">
              <LoadingSpinner size="lg" className="text-cyan-600" />
              <span className="text-slate-500 dark:text-slate-400">Loading batches...</span>
            </div>
          </div>
        ) : sortedYears.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            No batches created yet
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {sortedYears.map(year => (
              <div key={year}>
                {/* Year Header */}
                <div 
                  className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer gap-3"
                  onClick={() => toggleYear(year)}
                >
                  <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    {expandedYears[year] ? (
                      <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 flex-shrink-0" />
                    )}
                    <h4 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                      {year} Batch
                    </h4>
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-medium">
                      {groupedBatches[year].length} {groupedBatches[year].length === 1 ? 'Dept' : 'Depts'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddDeptModal(year);
                      }}
                      className="flex-1 sm:flex-none sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-all text-xs sm:text-sm font-medium"
                    >
                      <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">Add Department</span>
                      <span className="sm:hidden">Add Dept</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditBatchYear(year);
                      }}
                      className="sm:opacity-0 sm:group-hover:opacity-100 p-1.5 sm:p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Edit Batch Year"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {batchYearHasRelations(year) ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          forceBatchDelete(year);
                        }}
                        className="sm:opacity-0 sm:group-hover:opacity-100 p-1.5 sm:p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                        title="Force Delete Batch (Delete with all related data)"
                      >
                        <Trash2 className="w-4 h-4 stroke-2" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBatch(year);
                        }}
                        className="sm:opacity-0 sm:group-hover:opacity-100 p-1.5 sm:p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete Batch"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Departments List */}
                {expandedYears[year] && (
                  <div className="bg-slate-50 dark:bg-slate-800/50">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-100 dark:bg-slate-800 border-y border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Department</th>
                            <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Current Year</th>
                            <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Current Semester</th>
                            <th className="px-4 lg:px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                          {groupedBatches[year].map(batch => (
                            <tr key={batch._id} className="hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                              <td className="px-4 lg:px-6 py-3 text-sm text-slate-900 dark:text-white">
                                <div>{batch.department}</div>
                                {batch.faculty && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{batch.faculty}</div>}
                              </td>
                              <td className="px-4 lg:px-6 py-3 text-sm text-slate-900 dark:text-white">
                                {batch.currentYear}
                                {batch.currentYear === 1 ? 'st' : batch.currentYear === 2 ? 'nd' : batch.currentYear === 3 ? 'rd' : 'th'} Year
                              </td>
                              <td className="px-4 lg:px-6 py-3 text-sm text-slate-900 dark:text-white">
                                {batch.currentSemester === 1 ? '1st' : '2nd'} Semester
                              </td>
                              <td className="px-4 lg:px-6 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={() => setViewing(batch)} 
                                    className="p-2 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg transition-colors" 
                                    title="View"
                                  >
                                    <Eye className="w-4 h-4"/>
                                  </button>
                                  <button 
                                    onClick={() => openEdit(batch)} 
                                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" 
                                    title="Edit"
                                  >
                                    <Edit className="w-4 h-4"/>
                                  </button>
                                  {batchRelations[batch._id]?.hasRelatedData ? (
                                    <button 
                                      onClick={() => forceRemove(batch._id)} 
                                      className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors" 
                                      title="Force Delete (Delete with all related data)"
                                    >
                                      <Trash2 className="w-4 h-4 stroke-2"/>
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => remove(batch._id)} 
                                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" 
                                      title="Delete"
                                    >
                                      <Trash2 className="w-4 h-4"/>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-700">
                      {groupedBatches[year].map(batch => (
                        <div key={batch._id} className="p-4 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                          <div className="space-y-3">
                            {/* Department Name */}
                            <div>
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">{batch.department}</div>
                              {batch.faculty && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{batch.faculty}</div>}
                            </div>

                            {/* Year and Semester */}
                            <div className="flex gap-3">
                              <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
                                <div className="text-xs text-slate-500 dark:text-slate-400">Current Year</div>
                                <div className="text-sm font-medium text-slate-900 dark:text-white mt-0.5">
                                  {batch.currentYear}
                                  {batch.currentYear === 1 ? 'st' : batch.currentYear === 2 ? 'nd' : batch.currentYear === 3 ? 'rd' : 'th'} Year
                                </div>
                              </div>
                              <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
                                <div className="text-xs text-slate-500 dark:text-slate-400">Current Semester</div>
                                <div className="text-sm font-medium text-slate-900 dark:text-white mt-0.5">
                                  {batch.currentSemester === 1 ? '1st' : '2nd'} Semester
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-2">
                              <button 
                                onClick={() => setViewing(batch)} 
                                className="flex items-center justify-center gap-2 px-3 py-2 text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 rounded-lg transition-colors text-sm font-medium"
                              >
                                <Eye className="w-4 h-4"/>
                                View
                              </button>
                              <button 
                                onClick={() => openEdit(batch)} 
                                className="flex items-center justify-center gap-2 px-3 py-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors text-sm font-medium"
                              >
                                <Edit className="w-4 h-4"/>
                                Edit
                              </button>
                              {batchRelations[batch._id]?.hasRelatedData ? (
                                <button 
                                  onClick={() => forceRemove(batch._id)} 
                                  className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg transition-colors text-sm font-medium"
                                >
                                  <Trash2 className="w-4 h-4 stroke-2"/>
                                  Force Delete
                                </button>
                              ) : (
                                <button 
                                  onClick={() => remove(batch._id)} 
                                  className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-sm font-medium"
                                >
                                  <Trash2 className="w-4 h-4"/>
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Batch Modal */}
      {showCreateBatchModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateBatchModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                Create New Batch
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Enter the batch year to create a new batch
              </p>
            </div>
            <form onSubmit={createBatch} className="p-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Batch Year *
                </label>
                <input
                  type="number"
                  required
                  value={newBatchYear}
                  onChange={(e) => setNewBatchYear(e.target.value)}
                  placeholder="e.g., 2019"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white"
                  min="1900"
                  max="3000"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  After creating the batch, you can add departments to it
                </p>
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowCreateBatchModal(false)} 
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all text-sm"
                >
                  Create Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Department Modal */}
      {showAddDeptModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowAddDeptModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                Add Department to {selectedBatchYear} Batch
              </h3>
            </div>
            <form onSubmit={addDepartment} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Faculty *</label>
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
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Department *</label>
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
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Current Year *</label>
                  <CustomSelect
                    value={currentYear}
                    onChange={(e) => setCurrentYear(e.target.value)}
                    options={[
                      { value: '1', label: '1st Year' },
                      { value: '2', label: '2nd Year' },
                      { value: '3', label: '3rd Year' },
                      { value: '4', label: '4th Year' }
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Current Semester *</label>
                  <CustomSelect
                    value={currentSemester}
                    onChange={(e) => setCurrentSemester(e.target.value)}
                    options={[
                      { value: '1', label: '1st Semester' },
                      { value: '2', label: '2nd Semester' }
                    ]}
                  />
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowAddDeptModal(false)} 
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all text-sm"
                >
                  Add Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewing && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setViewing(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Batch Details</h3>
            </div>
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Batch Year</label>
                  <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">{viewing.startYear}</p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Department</label>
                  <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">{viewing.department}</p>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Faculty</label>
                  <p className="text-sm sm:text-base text-slate-900 dark:text-white">{viewing.faculty}</p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Current Year</label>
                  <p className="text-sm sm:text-base text-slate-900 dark:text-white">
                    {viewing.currentYear}
                    {viewing.currentYear === 1 ? 'st' : viewing.currentYear === 2 ? 'nd' : viewing.currentYear === 3 ? 'rd' : 'th'} Year
                  </p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Current Semester</label>
                  <p className="text-sm sm:text-base text-slate-900 dark:text-white">
                    {viewing.currentSemester === 1 ? '1st' : '2nd'} Semester
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-700 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
              <button 
                onClick={() => setViewing(null)} 
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  openEdit(viewing);
                  setViewing(null);
                }} 
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all text-sm"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Batch Year Modal */}
      {editingBatchYear && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setEditingBatchYear(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                Edit Batch Year
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                This will update the year for all departments in this batch
              </p>
            </div>
            <form onSubmit={saveEditBatchYear} className="p-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Batch Year *
                </label>
                <input
                  type="number"
                  required
                  value={newYearValue}
                  onChange={(e) => setNewYearValue(e.target.value)}
                  placeholder="e.g., 2019"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white"
                  min="1900"
                  max="3000"
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setEditingBatchYear(null)} 
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all text-sm"
                >
                  Update Year
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setEditing(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Edit Batch Department</h3>
            </div>
            <form onSubmit={saveEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Department</label>
                  <input 
                    type="text" 
                    value={editing.department} 
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Current Year *</label>
                  <CustomSelect
                    value={String(editing.currentYear)}
                    onChange={(e) => setEditing({...editing, currentYear: Number(e.target.value)})}
                    options={[
                      { value: '1', label: '1st Year' },
                      { value: '2', label: '2nd Year' },
                      { value: '3', label: '3rd Year' },
                      { value: '4', label: '4th Year' }
                    ]}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Current Semester *</label>
                  <CustomSelect
                    value={String(editing.currentSemester)}
                    onChange={(e) => setEditing({...editing, currentSemester: Number(e.target.value)})}
                    options={[
                      { value: '1', label: '1st Semester' },
                      { value: '2', label: '2nd Semester' }
                    ]}
                  />
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setEditing(null)} 
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all text-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className={`p-5 border-b border-slate-200 dark:border-slate-700 ${
              confirmModalData.type === 'danger' ? 'bg-red-50 dark:bg-red-900/20' :
              confirmModalData.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20' :
              'bg-blue-50 dark:bg-blue-900/20'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  confirmModalData.type === 'danger' ? 'bg-red-100 dark:bg-red-900/40' :
                  confirmModalData.type === 'warning' ? 'bg-amber-100 dark:bg-amber-900/40' :
                  'bg-blue-100 dark:bg-blue-900/40'
                }`}>
                  {confirmModalData.type === 'danger' ? (
                    <span className="text-red-600 dark:text-red-400 text-lg font-bold">✕</span>
                  ) : confirmModalData.type === 'warning' ? (
                    <span className="text-amber-600 dark:text-amber-400 text-lg font-bold">!</span>
                  ) : (
                    <span className="text-blue-600 dark:text-blue-400 text-lg font-bold">i</span>
                  )}
                </div>
                <h3 className={`text-lg font-semibold ${
                  confirmModalData.type === 'danger' ? 'text-red-900 dark:text-red-100' :
                  confirmModalData.type === 'warning' ? 'text-amber-900 dark:text-amber-100' :
                  'text-blue-900 dark:text-blue-100'
                }`}>
                  {confirmModalData.title}
                </h3>
              </div>
            </div>
            <div className="p-5">
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line">
                {confirmModalData.message}
              </p>
            </div>
            <div className="flex justify-end gap-3 p-5 pt-0">
              {confirmModalData.cancelText && (
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  {confirmModalData.cancelText}
                </button>
              )}
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  confirmModalData.onConfirm();
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  confirmModalData.type === 'danger' 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : confirmModalData.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {confirmModalData.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchesPage;
