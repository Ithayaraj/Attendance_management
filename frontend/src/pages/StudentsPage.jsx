import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Eye, Edit, Trash2, Download, Users, Upload, FileSpreadsheet, X } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CustomSelect } from '../components/CustomSelect';
import { useNotification } from '../contexts/NotificationContext';
import * as XLSX from 'xlsx-js-style';

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
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

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
  const [selectedBatch, setSelectedBatch] = useState(null);
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

  // Helper function to get faculty name from department
  const getFacultyFromDepartment = (departmentName) => {
    for (const [facultyName, facultyData] of Object.entries(facultyStructure)) {
      const found = facultyData.departments.find(d => d.name === departmentName);
      if (found) return facultyName;
    }
    return null;
  };

  // Get department code from selected batch
  const deptCode = useMemo(() => {
    if (!selectedBatch) return '';
    const faculty = facultyStructure[selectedBatch.faculty];
    if (!faculty) return '';
    const dept = faculty.departments.find(d => d.name === selectedBatch.department);
    return dept?.code || '';
  }, [selectedBatch]);

  // Generate registration prefix
  const regPrefix = useMemo(() => {
    if (!selectedBatch || !deptCode) return '';
    return `${selectedBatch.startYear}/${deptCode}/`;
  }, [selectedBatch, deptCode]);

  const BATCHES_CACHE_KEY = 'students_batches_cache';
  const BATCHES_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

  const STUDENTS_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

  // Pagination logic
  const totalPages = Math.ceil(students.length / ITEMS_PER_PAGE);
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return students.slice(startIndex, endIndex);
  }, [students, currentPage]);

  // Reset to page 1 when students change
  useEffect(() => {
    setCurrentPage(1);
  }, [students]);

  // Fetch students from database when batch is selected
  useEffect(() => {
    const loadStudents = async () => {
      if (!selectedBatch || !regPrefix) {
        setStudents([]);
        return;
      }

      // Create cache key based on batch ID
      const cacheKey = `students_cache_${selectedBatch._id}`;
      
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
          department: selectedBatch.department,
          year: selectedBatch.currentYear,
          semester: selectedBatch.currentSemester,
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
          const cacheKey = `students_cache_${selectedBatch._id}`;
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
  }, [selectedBatch, regPrefix, searchTerm]);

  // Reload function for manual refresh after create/delete
  const reloadStudents = async () => {
    if (!selectedBatch || !regPrefix) {
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        regPrefix: regPrefix,
        department: selectedBatch.department,
        year: selectedBatch.currentYear,
        semester: selectedBatch.currentSemester,
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
        const cacheKey = `students_cache_${selectedBatch._id}`;
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
        if (!selectedBatch) { 
          showConfirmation(
            'No Batch Selected',
            'Please select a batch before adding a student.',
            () => {},
            'warning',
            'OK',
            ''
          );
          return; 
        }
        if (!regPrefix) { 
          showConfirmation(
            'Incomplete Registration Prefix',
            'Please complete registration number prefix by selecting a valid batch.',
            () => {},
            'warning',
            'OK',
            ''
          );
          return; 
        }
        if (!regSuffix) { 
          showConfirmation(
            'Missing Registration Suffix',
            'Please enter registration number suffix.',
            () => {},
            'warning',
            'OK',
            ''
          );
          return; 
        }
        payload.registrationNo = `${regPrefix}${regSuffix}`;
        payload.department = selectedBatch.department;
        payload.year = selectedBatch.currentYear;
        payload.semester = selectedBatch.currentSemester;
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
      const cacheKey = `students_cache_${selectedBatch._id}`;
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
    const attemptDelete = async (forceDelete = false) => {
      try {
        const url = forceDelete ? `/api/students/${id}?force=true` : `/api/students/${id}`;
        await apiClient.delete(url);
        
        // Clear cache and reload
        if (selectedBatch) {
          const cacheKey = `students_cache_${selectedBatch._id}`;
          sessionStorage.removeItem(cacheKey);
        }
        await reloadStudents();
        showSuccess('Student deleted successfully!');
      } catch (error) {
        if (error.response?.status === 409 && error.response?.data?.requiresForceDelete) {
          // Student has related data, show force delete confirmation
          const relatedData = error.response.data.relatedData;
          const dataDetails = [];
          
          if (relatedData.enrollments > 0) {
            dataDetails.push(`${relatedData.enrollments} enrollment${relatedData.enrollments !== 1 ? 's' : ''}`);
          }
          if (relatedData.attendanceRecords > 0) {
            dataDetails.push(`${relatedData.attendanceRecords} attendance record${relatedData.attendanceRecords !== 1 ? 's' : ''}`);
          }

          const message = `This student has related data that will also be deleted:\n\n• ${dataDetails.join('\n• ')}\n\nThis action cannot be undone. Are you sure you want to proceed?`;

          showConfirmation(
            'Force Delete Required',
            message,
            () => attemptDelete(true),
            'danger',
            'Delete All',
            'Cancel'
          );
        } else {
          showError(error.message || 'Failed to delete student', 'Delete Error');
        }
      }
    };

    showConfirmation(
      'Delete Student',
      'Are you sure you want to delete this student? This action cannot be undone.',
      () => attemptDelete(false),
      'danger',
      'Delete',
      'Cancel'
    );
  };

  const handleBulkDelete = async () => {
    if (selectedStudents.length === 0) {
      showConfirmation(
        'No Students Selected',
        'Please select students to delete.',
        () => {},
        'warning',
        'OK',
        ''
      );
      return;
    }

    const attemptBulkDelete = async (forceDelete = false) => {
      try {
        // Delete all selected students
        const deletePromises = selectedStudents.map(id => {
          const url = forceDelete ? `/api/students/${id}?force=true` : `/api/students/${id}`;
          return apiClient.delete(url);
        });
        
        await Promise.all(deletePromises);
        showSuccess(`Successfully deleted ${selectedStudents.length} student(s)!`);
        setSelectedStudents([]);
        
        // Clear cache and reload
        if (selectedBatch) {
          const cacheKey = `students_cache_${selectedBatch._id}`;
          sessionStorage.removeItem(cacheKey);
        }
        await reloadStudents();
      } catch (error) {
        if (error.response?.status === 409 && error.response?.data?.requiresForceDelete) {
          // Some students have related data, show force delete confirmation
          const message = `Some students have related data (enrollments, attendance records) that will also be deleted.\n\nThis action cannot be undone. Are you sure you want to proceed?`;

          showConfirmation(
            'Force Delete Required',
            message,
            () => attemptBulkDelete(true),
            'danger',
            'Delete All',
            'Cancel'
          );
        } else {
          showError(error.message || 'Failed to delete students', 'Delete Error');
        }
      }
    };

    showConfirmation(
      'Delete Multiple Students',
      `Are you sure you want to delete ${selectedStudents.length} student(s)? This action cannot be undone.`,
      () => attemptBulkDelete(false),
      'danger',
      'Delete All',
      'Cancel'
    );
  };

  const toggleSelectStudent = (id) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map(s => s._id));
    }
  };

  const handleBulkEdit = async (e) => {
    e.preventDefault();
    
    if (!bulkEditData.year && !bulkEditData.semester) {
      showConfirmation(
        'No Fields Selected',
        'Please select at least Year or Semester to update.',
        () => {},
        'warning',
        'OK',
        ''
      );
      return;
    }

    const confirmMsg = `Are you sure you want to update ${students.length} student(s)?\n\n` +
      (bulkEditData.year ? `Year will be set to: ${bulkEditData.year}\n` : '') +
      (bulkEditData.semester ? `Semester will be set to: ${bulkEditData.semester}` : '');

    showConfirmation(
      'Bulk Update Students',
      confirmMsg,
      async () => {
        await performBulkEdit();
      },
      'warning',
      'Update All',
      'Cancel'
    );
  };

  const performBulkEdit = async () => {

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
      if (selectedBatch) {
        const cacheKey = `students_cache_${selectedBatch._id}`;
        sessionStorage.removeItem(cacheKey);
      }
      await reloadStudents();
    } catch (error) {
      showError(error.message || 'Failed to update students', 'Update Failed');
    } finally {
      setBulkEditLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (students.length === 0) {
      showConfirmation(
        'No Students to Export',
        'There are no students to export. Please select a batch with students first.',
        () => {},
        'info',
        'OK',
        ''
      );
      return;
    }

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const wsData = [];

    // Add header rows (centered across all columns)
    wsData.push(['']);
    wsData.push(['UNIVERSITY OF VAVUNIYA']);
    wsData.push([`${selectedBatch.startYear} BATCH - STUDENT LIST`]);
    wsData.push(['Faculty of Technological Studies']);
    wsData.push([`Department of ${selectedBatch.department}`]);
    wsData.push([`${selectedBatch.currentYear}${selectedBatch.currentYear === 1 ? 'st' : selectedBatch.currentYear === 2 ? 'nd' : selectedBatch.currentYear === 3 ? 'rd' : 'th'} Year - ${selectedBatch.currentSemester}${selectedBatch.currentSemester === 1 ? 'st' : selectedBatch.currentSemester === 2 ? 'nd' : 'rd'} Semester`]);
    wsData.push(['']);
    wsData.push([`Total Students: ${students.length}`]);
    wsData.push([`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`]);
    wsData.push(['']);
    wsData.push(['═'.repeat(100)]);
    wsData.push(['']);

    const headerRowIndex = wsData.length;
    
    // Add table headers
    const tableHeaders = ['Registration No', 'Student Name', 'Email', 'Phone', 'Address'];
    wsData.push(tableHeaders);
    
    // Add student rows
    students.forEach(student => {
      wsData.push([
        student.registrationNo,
        student.name,
        student.email || '',
        student.phone || '',
        student.address || ''
      ]);
    });

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    const colWidths = [
      { wch: 20 }, // Registration No
      { wch: 30 }, // Student Name
      { wch: 35 }, // Email
      { wch: 15 }, // Phone
      { wch: 40 }  // Address
    ];
    ws['!cols'] = colWidths;

    // Merge cells for header rows to center them across all columns
    if (!ws['!merges']) ws['!merges'] = [];
    for (let i = 0; i < headerRowIndex; i++) {
      ws['!merges'].push({
        s: { r: i, c: 0 },
        e: { r: i, c: 4 }
      });
    }

    // Apply cell styles
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) continue;
        
        // Initialize cell object if it's just a value
        if (typeof ws[cellAddress] !== 'object') {
          ws[cellAddress] = { v: ws[cellAddress], t: 's' };
        }
        
        // Initialize style object
        if (!ws[cellAddress].s) {
          ws[cellAddress].s = {};
        }
        
        // Header rows (before table) - Bold and Centered
        if (R < headerRowIndex) {
          ws[cellAddress].s = {
            font: { bold: true, sz: 12 },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {}
          };
        }
        
        // Table header row - Bold, Centered, with background
        else if (R === headerRowIndex) {
          ws[cellAddress].s = {
            font: { bold: true, sz: 11 },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          };
        }
        
        // Registration number column - Bold
        else if (R > headerRowIndex && C === 0) {
          ws[cellAddress].s = {
            font: { bold: true, sz: 10 },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: 'CCCCCC' } }
            }
          };
        }
        
        // Student name column - Bold
        else if (R > headerRowIndex && C === 1) {
          ws[cellAddress].s = {
            font: { bold: true, sz: 10 },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: 'CCCCCC' } }
            }
          };
        }
        
        // Other data cells - Normal
        else if (R > headerRowIndex) {
          ws[cellAddress].s = {
            font: { sz: 10 },
            alignment: { horizontal: C === 2 ? 'left' : 'center', vertical: 'center' }, // Email left-aligned, others centered
            border: {
              top: { style: 'thin', color: { rgb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: 'CCCCCC' } }
            }
          };
        }
      }
    }

    // Set row heights for better appearance
    if (!ws['!rows']) ws['!rows'] = [];
    for (let i = 0; i < headerRowIndex; i++) {
      ws['!rows'][i] = { hpt: 18 };
    }
    ws['!rows'][headerRowIndex] = { hpt: 20 }; // Table header row

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Student List');

    // Generate file name
    const fileName = `${selectedBatch.startYear}_${selectedBatch.department}_Students_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Write file
    XLSX.writeFile(wb, fileName);
  };

  const handleImportCSV = async (e) => {
    e.preventDefault();
    
    if (!importFile) {
      showConfirmation(
        'No File Selected',
        'Please select a CSV file to import.',
        () => {},
        'warning',
        'OK',
        ''
      );
      return;
    }

    if (!selectedBatch) {
      showConfirmation(
        'No Batch Selected',
        'Please select a batch first before importing students.',
        () => {},
        'warning',
        'OK',
        ''
      );
      return;
    }

    try {
      setImportLoading(true);
      setImportResults(null);

      const text = await importFile.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        showConfirmation(
          'Invalid File',
          'CSV file is empty or invalid. Please check your file and try again.',
          () => {},
          'danger',
          'OK',
          ''
        );
        return;
      }

      // Parse CSV
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const requiredHeaders = ['registrationNo', 'name'];
      
      // Validate headers
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        showConfirmation(
          'Invalid CSV Format',
          `Missing required columns: ${missingHeaders.join(', ')}. Please check your CSV file format.`,
          () => {},
          'danger',
          'OK',
          ''
        );
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

        // Add year, semester, and department from selected batch
        student.department = selectedBatch.department;
        student.year = selectedBatch.currentYear;
        student.semester = selectedBatch.currentSemester;

        studentsToImport.push(student);
      }

      if (studentsToImport.length === 0) {
        showConfirmation(
          'Import Failed',
          'No valid students found in CSV file. Please check your file format and data.',
          () => {},
          'danger',
          'OK',
          ''
        );
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
        if (selectedBatch) {
          const cacheKey = `students_cache_${selectedBatch._id}`;
          sessionStorage.removeItem(cacheKey);
        }
        await reloadStudents();
      }

    } catch (error) {
      showConfirmation(
        'Import Error',
        error.message || 'Failed to import CSV. Please try again.',
        () => {},
        'danger',
        'OK',
        ''
      );
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">Student Management</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Manage student records and information</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
        <div className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
          Select Batch to View Students
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {selectedBatch && (
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
                  title="Export to Excel"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Export Excel</span>
                  <span className="sm:hidden">Export</span>
                </button>
              )}
            </div>
          )}
          {selectedBatch && students.length > 0 && selectedStudents.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-white rounded-lg hover:shadow-lg transition-all font-medium text-sm sm:text-base"
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Delete Selected ({selectedStudents.length})</span>
              <span className="sm:hidden">Delete ({selectedStudents.length})</span>
            </button>
          )}
          <button
            onClick={() => {
              if (!selectedBatch) { 
                showConfirmation(
                  'No Batch Selected',
                  'Please select a batch first before adding a student.',
                  () => {},
                  'warning',
                  'OK',
                  ''
                );
                return; 
              }
              setEditingStudent(null);
              setFormData({
                registrationNo: '',
                name: '',
                email: '',
                department: selectedBatch.department,
                year: selectedBatch.currentYear,
                semester: selectedBatch.currentSemester,
                phone: '',
                address: ''
              });
              setRegSuffix('');
              setShowAddModal(true);
            }}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium text-sm sm:text-base ${!selectedBatch ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!selectedBatch}
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Add Student</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Batch:</label>
            <CustomSelect
              value={selectedBatch?._id || ''}
              onChange={(e) => {
                const batch = batches.find(b => b._id === e.target.value);
                setSelectedBatch(batch || null);
                setSearchTerm('');
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
          {selectedBatch && regPrefix && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Registration Prefix:</label>
              <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-sm font-mono text-slate-900 dark:text-white font-semibold">{regPrefix}</span>
              </div>
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
              placeholder={selectedBatch ? "Search by name, email, or registration number..." : "Please select a batch first"}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={!selectedBatch}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left">
                  {selectedBatch && students.length > 0 && (
                    <input
                      type="checkbox"
                      checked={selectedStudents.length === students.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-cyan-600 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                      title="Select All"
                    />
                  )}
                </th>
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
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <LoadingSpinner size="lg" className="text-cyan-600" />
                      <span className="text-slate-500 dark:text-slate-400">Loading students...</span>
                    </div>
                  </td>
                </tr>
              ) : !selectedBatch ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    Please select a batch to view students
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    No students found for the selected criteria
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student) => (
                  <tr key={student._id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student._id)}
                        onChange={() => toggleSelectStudent(student._id)}
                        className="w-4 h-4 text-cyan-600 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-cyan-500 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
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

        {/* Pagination */}
        {selectedBatch && students.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, students.length)} of {students.length} students
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      currentPage === page
                        ? 'bg-cyan-600 text-white'
                        : 'border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
              >
                Next
              </button>
            </div>
          </div>
        )}
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
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {editingStudent ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Department
                    </label>
                    <CustomSelect
                      value={formData.department}
                      onChange={() => {}} // No-op function
                      disabled={true}
                      placeholder="Select Department"
                      options={Object.values(facultyStructure).flatMap(faculty => 
                        faculty.departments.map(dept => ({
                          value: dept.name,
                          label: dept.name
                        }))
                      )}
                      className="w-full opacity-50 cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Department cannot be changed when editing</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Year
                      </label>
                      <CustomSelect
                        value={formData.year}
                        onChange={() => {}} // No-op function
                        disabled={true}
                        placeholder="Select Year"
                        options={[1, 2, 3, 4].map(y => ({
                          value: y,
                          label: `Year ${y}`
                        }))}
                        className="w-full opacity-50 cursor-not-allowed"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cannot be changed</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Semester
                      </label>
                      <CustomSelect
                        value={formData.semester}
                        onChange={() => {}} // No-op function
                        disabled={true}
                        placeholder="Select Semester"
                        options={[1, 2].map(s => ({
                          value: s,
                          label: s === 1 ? '1st Semester' : '2nd Semester'
                        }))}
                        className="w-full opacity-50 cursor-not-allowed"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cannot be changed</p>
                    </div>
                  </div>
                </>
              ) : null}

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
                    <X className={`w-5 h-5 text-red-600 dark:text-red-400`} />
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
