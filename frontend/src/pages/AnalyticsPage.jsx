import { useEffect, useState, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Label } from 'recharts';
import { GraduationCap, Users, BookOpen, TrendingUp, ChevronRight, Search, ChevronLeft, BarChart3, Table, X, Download } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import * as XLSX from 'xlsx-js-style';

const COLORS = {
  present: '#10b981',
  late: '#f59e0b',
  absent: '#ef4444'
};

// Custom Tooltip Component
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    // Calculate percentage using the total we added to each data point
    const total = data.payload.total || data.value;
    const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
    
    return (
      <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-lg shadow-xl border-2 border-slate-200 dark:border-slate-600">
        <p className="font-bold text-slate-900 dark:text-white text-base mb-1">{data.name}</p>
        <p className="text-slate-700 dark:text-slate-300 text-sm">
          Count: <span className="font-semibold">{data.value}</span>
        </p>
        <p className="text-slate-700 dark:text-slate-300 text-sm">
          Percentage: <span className="font-semibold">{percentage}%</span>
        </p>
      </div>
    );
  }
  return null;
};

export const AnalyticsPage = () => {
  const [batchStats, setBatchStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseAttendance, setCourseAttendance] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loadingCourseId, setLoadingCourseId] = useState(null); // Track which course is loading
  const [courseViewMode, setCourseViewMode] = useState('chart'); // 'chart' or 'table'
  const [courseTableData, setCourseTableData] = useState(null);
  
  // Date range filter states for course view
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [isDateFilterActive, setIsDateFilterActive] = useState(false);
  
  // Date range filter states for student course view (per-student level)
  const [studentDateRange, setStudentDateRange] = useState({ startDate: '', endDate: '' });
  const [isStudentDateFilterActive, setIsStudentDateFilterActive] = useState(false);
  
  // Date range filter states for individual courses within student view (per-course level)
  const [courseDateRanges, setCourseDateRanges] = useState({}); // { courseId: { startDate, endDate, isActive } }
  const [filteredCourseData, setFilteredCourseData] = useState({}); // { courseId: { present, late, absent, ... } }
  
  // Student view states
  const [viewMode, setViewMode] = useState('courses'); // 'courses', 'students', or 'overview'
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentAttendance, setStudentAttendance] = useState(null);
  const [selectedStudentCourse, setSelectedStudentCourse] = useState(null);
  const [loadingStudentId, setLoadingStudentId] = useState(null); // Track which student is loading
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [isSearching, setIsSearching] = useState(false); // Track search loading separately
  
  // Overview table states
  const [overviewData, setOverviewData] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  
  // Ref for debouncing search
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    loadBatchAnalytics();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear search timeout on unmount
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const loadBatchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/analytics/batch-wise');
      setBatchStats(response.data || []);
    } catch (error) {
      console.error('Error loading batch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchClick = async (batch) => {
    setSelectedBatch(batch);
    setViewMode('courses');
    setSelectedCourse(null);
    setCourseAttendance(null);
    setSelectedStudent(null);
    setStudentAttendance(null);
    setSearchQuery('');
    setPagination({ page: 1, limit: 10, total: 0, pages: 0 });
    setModalLoading(true);
    
    try {
      const response = await apiClient.get(`/api/analytics/batch/${batch.batchId}/courses`);
      setCourses(response.data || []);
    } catch (error) {
      console.error('Error loading courses:', error);
      setCourses([]);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCourseSelect = async (course) => {
    if (!course) {
      setSelectedCourse(null);
      setCourseAttendance(null);
      setLoadingCourseId(null);
      setDateRange({ startDate: '', endDate: '' });
      setIsDateFilterActive(false);
      setCourseViewMode('chart');
      setCourseTableData(null);
      return;
    }
    
    // If clicking the same course, just toggle (collapse)
    if (selectedCourse?._id === course._id) {
      setSelectedCourse(null);
      setCourseAttendance(null);
      setLoadingCourseId(null);
      setDateRange({ startDate: '', endDate: '' });
      setIsDateFilterActive(false);
      setCourseViewMode('chart');
      setCourseTableData(null);
      return;
    }
    
    setSelectedCourse(course);
    setDateRange({ startDate: '', endDate: '' });
    setIsDateFilterActive(false);
    setCourseViewMode('chart');
    setCourseTableData(null);
    
    // Only fetch if we don't have data for this course or it's a different course
    if (!courseAttendance || courseAttendance.courseId !== course._id) {
      setLoadingCourseId(course._id);
      
      try {
        const response = await apiClient.get(`/api/analytics/batch/${selectedBatch.batchId}/course/${course._id}`);
        setCourseAttendance(response.data || null);
      } catch (error) {
        console.error('Error loading course attendance:', error);
        setCourseAttendance(null);
      } finally {
        setLoadingCourseId(null);
      }
    }
  };

  const loadCourseTableData = async (startDate = null, endDate = null) => {
    setLoadingCourseId(selectedCourse._id);
    
    try {
      const params = new URLSearchParams();
      if (startDate && endDate) {
        params.append('startDate', startDate);
        params.append('endDate', endDate);
      }
      const response = await apiClient.get(
        `/api/analytics/batch/${selectedBatch.batchId}/course/${selectedCourse._id}/details?${params}`
      );
      setCourseTableData(response.data || null);
    } catch (error) {
      console.error('Error loading course table data:', error);
      setCourseTableData(null);
    } finally {
      setLoadingCourseId(null);
    }
  };

  const handleDateRangeFilter = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      alert('Please select both start and end dates');
      return;
    }

    if (new Date(dateRange.startDate) > new Date(dateRange.endDate)) {
      alert('Start date must be before end date');
      return;
    }

    setLoadingCourseId(selectedCourse._id);
    setIsDateFilterActive(true);

    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      
      // Load chart data
      const chartResponse = await apiClient.get(
        `/api/analytics/batch/${selectedBatch.batchId}/course/${selectedCourse._id}?${params}`
      );
      setCourseAttendance(chartResponse.data || null);
      
      // If table view is active, also load table data
      if (courseViewMode === 'table') {
        const tableResponse = await apiClient.get(
          `/api/analytics/batch/${selectedBatch.batchId}/course/${selectedCourse._id}/details?${params}`
        );
        setCourseTableData(tableResponse.data || null);
      }
    } catch (error) {
      console.error('Error loading filtered course attendance:', error);
      setCourseAttendance(null);
    } finally {
      setLoadingCourseId(null);
    }
  };

  const clearDateFilter = async () => {
    setDateRange({ startDate: '', endDate: '' });
    setIsDateFilterActive(false);
    setLoadingCourseId(selectedCourse._id);

    try {
      const chartResponse = await apiClient.get(`/api/analytics/batch/${selectedBatch.batchId}/course/${selectedCourse._id}`);
      setCourseAttendance(chartResponse.data || null);
      
      // If table view is active, also reload table data
      if (courseViewMode === 'table') {
        const tableResponse = await apiClient.get(`/api/analytics/batch/${selectedBatch.batchId}/course/${selectedCourse._id}/details`);
        setCourseTableData(tableResponse.data || null);
      }
    } catch (error) {
      console.error('Error loading course attendance:', error);
      setCourseAttendance(null);
    } finally {
      setLoadingCourseId(null);
    }
  };

  const handleCourseViewModeChange = async (mode) => {
    setCourseViewMode(mode);
    
    // If switching to table view and we don't have table data yet, load it
    if (mode === 'table' && !courseTableData) {
      await loadCourseTableData(
        isDateFilterActive ? dateRange.startDate : null,
        isDateFilterActive ? dateRange.endDate : null
      );
    }
  };

  const exportToCSV = () => {
    if (!courseTableData || !courseTableData.students.length) {
      alert('No data to export');
      return;
    }

    // Calculate total number of columns
    const totalColumns = 2 + courseTableData.months.length + 1; // Student + Reg No + Months + Overall
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const wsData = [];

    // Add header rows (centered across all columns)
    wsData.push(['']);
    wsData.push(['UNIVERSITY OF VAVUNIYA']);
    wsData.push([`${selectedBatch.batchName} ATTENDANCE`]);
    wsData.push(['Faculty of Technological Studies']);
    wsData.push([`Department of ${selectedBatch.department}`]);
    wsData.push([`${selectedBatch.currentYear}${selectedBatch.currentYear === 1 ? 'st' : selectedBatch.currentYear === 2 ? 'nd' : selectedBatch.currentYear === 3 ? 'rd' : 'th'} Year - ${selectedBatch.currentSemester}${selectedBatch.currentSemester === 1 ? 'st' : selectedBatch.currentSemester === 2 ? 'nd' : 'rd'} Semester`]);
    wsData.push([`${selectedCourse.code} - ${selectedCourse.name}`]);
    wsData.push(['']);
    
    if (isDateFilterActive) {
      wsData.push([`Period: ${new Date(dateRange.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} to ${new Date(dateRange.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`]);
      wsData.push(['']);
    }
    
    wsData.push([`Total Students: ${courseTableData.totalStudents} | Total Sessions: ${courseTableData.totalSessions} | Overall Attendance: ${courseTableData.averages.attendanceRate}%`]);
    wsData.push([`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`]);
    wsData.push(['']);
    wsData.push(['═'.repeat(100)]);
    wsData.push(['']);

    const headerRowIndex = wsData.length;
    
    // Add table headers
    const tableHeaders = ['Registration No', 'Student', ...courseTableData.months.map(month => 
      new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    ), 'Overall'];
    wsData.push(tableHeaders);
    
    // Add student rows
    courseTableData.students.forEach(student => {
      const monthlyData = courseTableData.months.map(month => {
        const monthData = student.monthlyStats.find(m => m.month === month);
        return monthData ? parseFloat(monthData.attendanceRate) : '-';
      });
      
      wsData.push([
        student.registrationNo,
        student.name,
        ...monthlyData,
        parseFloat(student.overall.attendanceRate)
      ]);
    });

    // Add class average row
    const avgRow = ['Class Average', ''];
    courseTableData.months.forEach(month => {
      let totalRate = 0;
      let count = 0;
      courseTableData.students.forEach(student => {
        const monthData = student.monthlyStats.find(m => m.month === month);
        if (monthData) {
          totalRate += parseFloat(monthData.attendanceRate);
          count++;
        }
      });
      const avgRate = count > 0 ? (totalRate / count).toFixed(1) : '-';
      avgRow.push(avgRate !== '-' ? parseFloat(avgRate) : '-');
    });
    avgRow.push(parseFloat(courseTableData.averages.attendanceRate));
    wsData.push(avgRow);

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    const colWidths = [
      { wch: 30 }, // Student name
      { wch: 15 }, // Registration No
      ...courseTableData.months.map(() => ({ wch: 12 })), // Month columns
      { wch: 10 } // Overall
    ];
    ws['!cols'] = colWidths;

    // Merge cells for header rows to center them across all columns
    if (!ws['!merges']) ws['!merges'] = [];
    for (let i = 0; i < headerRowIndex; i++) {
      ws['!merges'].push({
        s: { r: i, c: 0 },
        e: { r: i, c: totalColumns - 1 }
      });
    }

    // Apply cell styles using the proper format
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
        
        // Student name column - Bold
        else if (R > headerRowIndex && C === 0) {
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
        
        // Class Average row - Bold with background
        else if (R === range.e.r) {
          const cellValue = ws[cellAddress].v;
          let fontColor = { rgb: '000000' }; // Default black
          
          // Apply color coding for percentage values in average row
          if (typeof cellValue === 'number' && C > 1) {
            if (cellValue >= 75) {
              fontColor = { rgb: '059669' }; // Green
            } else if (cellValue >= 50) {
              fontColor = { rgb: 'D97706' }; // Amber
            } else {
              fontColor = { rgb: 'DC2626' }; // Red
            }
            
            // Format as percentage
            ws[cellAddress].t = 'n';
            ws[cellAddress].z = '0.0"%"';
          }
          
          ws[cellAddress].s = {
            font: { bold: true, sz: 10, color: fontColor },
            alignment: { horizontal: C <= 1 ? 'left' : 'center', vertical: 'center' },
            fill: { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } },
            border: {
              top: { style: 'medium', color: { rgb: '000000' } },
              bottom: { style: 'medium', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          };
        }
        
        // Regular data cells - Centered with color coding
        else if (R > headerRowIndex && R < range.e.r && C > 1) {
          const cellValue = ws[cellAddress].v;
          let fontColor = { rgb: '000000' }; // Default black
          
          // Apply color coding based on percentage value
          if (typeof cellValue === 'number') {
            if (cellValue >= 75) {
              fontColor = { rgb: '059669' }; // Green for >= 75%
            } else if (cellValue >= 50) {
              fontColor = { rgb: 'D97706' }; // Amber for >= 50%
            } else {
              fontColor = { rgb: 'DC2626' }; // Red for < 50%
            }
            
            // Format as percentage
            ws[cellAddress].t = 'n';
            ws[cellAddress].z = '0.0"%"';
          }
          
          ws[cellAddress].s = {
            font: { sz: 10, color: fontColor, bold: C === totalColumns - 1 }, // Bold for Overall column
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
              top: { style: 'thin', color: { rgb: 'CCCCCC' } },
              bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: 'CCCCCC' } }
            }
          };
          
          // Highlight Overall column with light background
          if (C === totalColumns - 1) {
            ws[cellAddress].s.fill = { patternType: 'solid', fgColor: { rgb: 'F0F9FF' } };
          }
        }
        
        // Registration number column
        else if (R > headerRowIndex && R < range.e.r && C === 1) {
          ws[cellAddress].s = {
            font: { sz: 10 },
            alignment: { horizontal: 'center', vertical: 'center' },
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
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Breakdown');

    // ============================================
    // CREATE SECOND SHEET: Overall Course Summary
    // ============================================
    const summaryData = [];
    
    // Add header for summary sheet
    summaryData.push(['']);
    summaryData.push(['UNIVERSITY OF VAVUNIYA']);
    summaryData.push([`${selectedBatch.batchName} - OVERALL COURSE ATTENDANCE`]);
    summaryData.push(['Faculty of Technological Studies']);
    summaryData.push([`Department of ${selectedBatch.department}`]);
    summaryData.push([`${selectedBatch.currentYear}${selectedBatch.currentYear === 1 ? 'st' : selectedBatch.currentYear === 2 ? 'nd' : selectedBatch.currentYear === 3 ? 'rd' : 'th'} Year - ${selectedBatch.currentSemester}${selectedBatch.currentSemester === 1 ? 'st' : selectedBatch.currentSemester === 2 ? 'nd' : 'rd'} Semester`]);
    summaryData.push(['']);
    summaryData.push([`Course: ${selectedCourse.code} - ${selectedCourse.name}`]);
    summaryData.push([`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`]);
    summaryData.push(['']);
    summaryData.push(['═'.repeat(80)]);
    summaryData.push(['']);
    
    const summaryHeaderRow = summaryData.length;
    
    // Create summary table headers
    summaryData.push(['Registration No', 'Student', 'Overall Attendance']);
    
    // Add student data with overall attendance
    courseTableData.students.forEach(student => {
      summaryData.push([
        student.registrationNo,
        student.name,
        parseFloat(student.overall.attendanceRate)
      ]);
    });
    
    // Add class average
    summaryData.push([
      'Class Average',
      '',
      parseFloat(courseTableData.averages.attendanceRate)
    ]);
    
    // Create summary worksheet
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    
    // Set column widths for summary sheet
    wsSummary['!cols'] = [
      { wch: 30 }, // Student name
      { wch: 15 }, // Registration No
      { wch: 18 }  // Overall Attendance
    ];
    
    // Merge cells for header rows in summary sheet
    if (!wsSummary['!merges']) wsSummary['!merges'] = [];
    for (let i = 0; i < summaryHeaderRow; i++) {
      wsSummary['!merges'].push({
        s: { r: i, c: 0 },
        e: { r: i, c: 2 }
      });
    }
    
    // Apply styles to summary sheet
    const summaryRange = XLSX.utils.decode_range(wsSummary['!ref']);
    for (let R = summaryRange.s.r; R <= summaryRange.e.r; ++R) {
      for (let C = summaryRange.s.c; C <= summaryRange.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!wsSummary[cellAddress]) continue;
        
        if (typeof wsSummary[cellAddress] !== 'object') {
          wsSummary[cellAddress] = { v: wsSummary[cellAddress], t: 's' };
        }
        
        if (!wsSummary[cellAddress].s) {
          wsSummary[cellAddress].s = {};
        }
        
        // Header rows - Bold and Centered
        if (R < summaryHeaderRow) {
          wsSummary[cellAddress].s = {
            font: { bold: true, sz: 12 },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
          };
        }
        
        // Table header row
        else if (R === summaryHeaderRow) {
          wsSummary[cellAddress].s = {
            font: { bold: true, sz: 11 },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { patternType: 'solid', fgColor: { rgb: 'E2E8F0' } },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            }
          };
        }
        
        // Student name column
        else if (R > summaryHeaderRow && C === 0) {
          wsSummary[cellAddress].s = {
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
        
        // Overall attendance column with color coding
        else if (R > summaryHeaderRow && C === 2) {
          const cellValue = wsSummary[cellAddress].v;
          let fontColor = { rgb: '000000' };
          let fillColor = { rgb: 'F0F9FF' }; // Light blue background
          
          if (typeof cellValue === 'number') {
            if (cellValue >= 75) {
              fontColor = { rgb: '059669' }; // Green
            } else if (cellValue >= 50) {
              fontColor = { rgb: 'D97706' }; // Amber
            } else {
              fontColor = { rgb: 'DC2626' }; // Red
            }
            
            // Format as percentage
            wsSummary[cellAddress].t = 'n';
            wsSummary[cellAddress].z = '0.0"%"';
          }
          
          // Class Average row styling
          if (R === summaryRange.e.r) {
            fillColor = { rgb: 'DBEAFE' }; // Darker blue for average
            wsSummary[cellAddress].s = {
              font: { bold: true, sz: 11, color: fontColor },
              alignment: { horizontal: 'center', vertical: 'center' },
              fill: { patternType: 'solid', fgColor: fillColor },
              border: {
                top: { style: 'medium', color: { rgb: '000000' } },
                bottom: { style: 'medium', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } }
              }
            };
          } else {
            wsSummary[cellAddress].s = {
              font: { bold: true, sz: 10, color: fontColor },
              alignment: { horizontal: 'center', vertical: 'center' },
              fill: { patternType: 'solid', fgColor: fillColor },
              border: {
                top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                right: { style: 'thin', color: { rgb: 'CCCCCC' } }
              }
            };
          }
        }
        
        // Registration number and Class Average label
        else if (R > summaryHeaderRow && C === 1) {
          const isAvgRow = R === summaryRange.e.r;
          wsSummary[cellAddress].s = {
            font: { sz: 10, bold: isAvgRow },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: isAvgRow ? { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } } : undefined,
            border: {
              top: { style: isAvgRow ? 'medium' : 'thin', color: { rgb: isAvgRow ? '000000' : 'CCCCCC' } },
              bottom: { style: isAvgRow ? 'medium' : 'thin', color: { rgb: isAvgRow ? '000000' : 'CCCCCC' } },
              left: { style: 'thin', color: { rgb: isAvgRow ? '000000' : 'CCCCCC' } },
              right: { style: 'thin', color: { rgb: isAvgRow ? '000000' : 'CCCCCC' } }
            }
          };
        }
      }
    }
    
    // Set row heights for summary sheet
    if (!wsSummary['!rows']) wsSummary['!rows'] = [];
    for (let i = 0; i < summaryHeaderRow; i++) {
      wsSummary['!rows'][i] = { hpt: 18 };
    }
    wsSummary['!rows'][summaryHeaderRow] = { hpt: 20 };
    
    // Add summary worksheet to workbook
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Overall Summary');

    // Generate file name
    const fileName = `${selectedBatch.batchName}_${selectedCourse.code}_Attendance_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Write file
    XLSX.writeFile(wb, fileName);
  };

  const switchToStudentsView = async () => {
    setViewMode('students');
    setSelectedStudent(null);
    setStudentAttendance(null);
    setSelectedStudentCourse(null);
    
    // Only load students if we don't have any yet
    if (students.length === 0) {
      await loadStudents(1, searchQuery, true); // Mark as initial load
    }
  };

  const switchToOverviewView = async () => {
    setViewMode('overview');
    
    // Load overview data if not already loaded
    if (!overviewData) {
      await loadOverviewData();
    }
  };

  const loadOverviewData = async () => {
    setLoadingOverview(true);
    
    try {
      // Fetch all students
      const studentsResponse = await apiClient.get(`/api/analytics/batch/${selectedBatch.batchId}/students?limit=1000`);
      const allStudents = studentsResponse.data.students || [];

      if (allStudents.length === 0) {
        setOverviewData({ students: [], courses: [] });
        return;
      }

      // Fetch attendance data for each student
      const studentCourseData = await Promise.all(
        allStudents.map(async (student) => {
          try {
            const attendanceResponse = await apiClient.get(`/api/analytics/batch/${selectedBatch.batchId}/student/${student._id}`);
            return {
              _id: student._id,
              name: student.name,
              registrationNo: student.registrationNo,
              courses: attendanceResponse.data?.courses || []
            };
          } catch (error) {
            console.error(`Error loading data for student ${student.name}:`, error);
            return {
              _id: student._id,
              name: student.name,
              registrationNo: student.registrationNo,
              courses: []
            };
          }
        })
      );

      setOverviewData({
        students: studentCourseData,
        courses: courses
      });
    } catch (error) {
      console.error('Error loading overview data:', error);
      setOverviewData({ students: [], courses: [] });
    } finally {
      setLoadingOverview(false);
    }
  };

  const loadStudents = async (page = 1, search = '', isInitialLoad = false) => {
    // Only show modal loading on initial load, use search loading for searches
    if (isInitialLoad) {
      setModalLoading(true);
    } else {
      setIsSearching(true);
    }
    
    try {
      const response = await apiClient.get(
        `/api/analytics/batch/${selectedBatch.batchId}/students?page=${page}&limit=10&search=${encodeURIComponent(search)}`
      );
      setStudents(response.data.students || []);
      setPagination(response.data.pagination || { page: 1, limit: 10, total: 0, pages: 0 });
    } catch (error) {
      console.error('Error loading students:', error);
      setStudents([]);
    } finally {
      if (isInitialLoad) {
        setModalLoading(false);
      } else {
        setIsSearching(false);
      }
    }
  };

  const handleStudentSelect = async (student) => {
    if (!student) {
      setSelectedStudent(null);
      setStudentAttendance(null);
      setSelectedStudentCourse(null);
      setLoadingStudentId(null);
      setStudentDateRange({ startDate: '', endDate: '' });
      setIsStudentDateFilterActive(false);
      return;
    }
    
    // If clicking the same student, just toggle (collapse)
    if (selectedStudent?._id === student._id) {
      setSelectedStudent(null);
      setStudentAttendance(null);
      setSelectedStudentCourse(null);
      setLoadingStudentId(null);
      setStudentDateRange({ startDate: '', endDate: '' });
      setIsStudentDateFilterActive(false);
      return;
    }
    
    setSelectedStudent(student);
    setSelectedStudentCourse(null);
    setStudentDateRange({ startDate: '', endDate: '' });
    setIsStudentDateFilterActive(false);
    setCourseDateRanges({}); // Reset all course-level date filters
    
    // Only fetch if we don't have data for this student or it's a different student
    if (!studentAttendance || studentAttendance.student._id !== student._id) {
      setLoadingStudentId(student._id);
      
      try {
        const response = await apiClient.get(`/api/analytics/batch/${selectedBatch.batchId}/student/${student._id}`);
        setStudentAttendance(response.data || null);
      } catch (error) {
        console.error('Error loading student attendance:', error);
        setStudentAttendance(null);
      } finally {
        setLoadingStudentId(null);
      }
    }
  };

  const handleStudentCourseSelect = (course) => {
    // Toggle: if clicking the same course, collapse it
    if (selectedStudentCourse?.courseId === course?.courseId) {
      setSelectedStudentCourse(null);
    } else {
      setSelectedStudentCourse(course);
    }
  };

  const handleStudentDateRangeFilter = async () => {
    if (!studentDateRange.startDate || !studentDateRange.endDate) {
      alert('Please select both start and end dates');
      return;
    }

    if (new Date(studentDateRange.startDate) > new Date(studentDateRange.endDate)) {
      alert('Start date must be before end date');
      return;
    }

    setLoadingStudentId(selectedStudent._id);
    setIsStudentDateFilterActive(true);

    try {
      const params = new URLSearchParams({
        startDate: studentDateRange.startDate,
        endDate: studentDateRange.endDate
      });
      const response = await apiClient.get(
        `/api/analytics/batch/${selectedBatch.batchId}/student/${selectedStudent._id}?${params}`
      );
      setStudentAttendance(response.data || null);
    } catch (error) {
      console.error('Error loading filtered student attendance:', error);
      setStudentAttendance(null);
    } finally {
      setLoadingStudentId(null);
    }
  };

  const clearStudentDateFilter = async () => {
    setStudentDateRange({ startDate: '', endDate: '' });
    setIsStudentDateFilterActive(false);
    setLoadingStudentId(selectedStudent._id);

    try {
      const response = await apiClient.get(`/api/analytics/batch/${selectedBatch.batchId}/student/${selectedStudent._id}`);
      setStudentAttendance(response.data || null);
    } catch (error) {
      console.error('Error loading student attendance:', error);
      setStudentAttendance(null);
    } finally {
      setLoadingStudentId(null);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      loadStudents(1, query);
    }, 500); // Wait 500ms after user stops typing
  };

  const handlePageChange = (newPage) => {
    loadStudents(newPage, searchQuery);
  };

  const closeModal = () => {
    setSelectedBatch(null);
    setSelectedCourse(null);
    setCourseAttendance(null);
    setCourses([]);
    setViewMode('courses');
    setStudents([]);
    setSelectedStudent(null);
    setStudentAttendance(null);
    setSelectedStudentCourse(null);
    setSearchQuery('');
    setPagination({ page: 1, limit: 10, total: 0, pages: 0 });
  };

  const exportBatchCourseSummary = async () => {
    if (!selectedBatch || !courses.length) {
      alert('No course data available to export');
      return;
    }

    try {
      // Fetch all students and their course attendance data
      const response = await apiClient.get(`/api/analytics/batch/${selectedBatch.batchId}/students?limit=1000`);
      const allStudents = response.data.students || [];

      if (allStudents.length === 0) {
        alert('No student data available');
        return;
      }

      // Fetch attendance data for each student
      const studentCourseData = await Promise.all(
        allStudents.map(async (student) => {
          try {
            const attendanceResponse = await apiClient.get(`/api/analytics/batch/${selectedBatch.batchId}/student/${student._id}`);
            return {
              name: student.name,
              registrationNo: student.registrationNo,
              courses: attendanceResponse.data?.courses || []
            };
          } catch (error) {
            console.error(`Error loading data for student ${student.name}:`, error);
            return {
              name: student.name,
              registrationNo: student.registrationNo,
              courses: []
            };
          }
        })
      );

      // Create workbook
      const wb = XLSX.utils.book_new();
      const wsData = [];

      // Add header rows
      wsData.push(['']);
      wsData.push(['UNIVERSITY OF VAVUNIYA']);
      wsData.push([`${selectedBatch.batchName} - COURSE-WISE ATTENDANCE SUMMARY`]);
      wsData.push(['Faculty of Technological Studies']);
      wsData.push([`Department of ${selectedBatch.department}`]);
      wsData.push([`${selectedBatch.currentYear}${selectedBatch.currentYear === 1 ? 'st' : selectedBatch.currentYear === 2 ? 'nd' : selectedBatch.currentYear === 3 ? 'rd' : 'th'} Year - ${selectedBatch.currentSemester}${selectedBatch.currentSemester === 1 ? 'st' : selectedBatch.currentSemester === 2 ? 'nd' : 'rd'} Semester`]);
      wsData.push(['']);
      wsData.push([`Total Students: ${allStudents.length} | Total Courses: ${courses.length}`]);
      wsData.push([`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`]);
      wsData.push(['']);
      wsData.push(['']);
      wsData.push(['']);

      const headerRowIndex = wsData.length;

      // Create table headers: Reg No, Student, Course1, Course2, ..., Average
      const tableHeaders = [
        'Registration No',
        'Student',
        ...courses.map(course => `${course.code}\n${course.name}`),
        'Average'
      ];
      wsData.push(tableHeaders);

      // Add student rows
      studentCourseData.forEach(student => {
        const row = [student.registrationNo, student.name];
        
        let totalPercentage = 0;
        let courseCount = 0;

        courses.forEach(course => {
          const courseData = student.courses.find(c => c.courseId === course._id);
          if (courseData) {
            row.push(parseFloat(courseData.attendanceRate));
            totalPercentage += parseFloat(courseData.attendanceRate);
            courseCount++;
          } else {
            row.push('-');
          }
        });

        // Calculate average
        const average = courseCount > 0 ? (totalPercentage / courseCount).toFixed(1) : '-';
        row.push(average !== '-' ? parseFloat(average) : '-');
        
        wsData.push(row);
      });

      // Add class average row
      const avgRow = ['Class Average', ''];
      courses.forEach(course => {
        let totalRate = 0;
        let count = 0;
        studentCourseData.forEach(student => {
          const courseData = student.courses.find(c => c.courseId === course._id);
          if (courseData) {
            totalRate += parseFloat(courseData.attendanceRate);
            count++;
          }
        });
        const avgRate = count > 0 ? (totalRate / count).toFixed(1) : '-';
        avgRow.push(avgRate !== '-' ? parseFloat(avgRate) : '-');
      });

      // Calculate overall average
      let overallTotal = 0;
      let overallCount = 0;
      for (let i = 2; i < avgRow.length; i++) {
        if (avgRow[i] !== '-') {
          overallTotal += avgRow[i];
          overallCount++;
        }
      }
      const overallAvg = overallCount > 0 ? (overallTotal / overallCount).toFixed(1) : '-';
      avgRow.push(overallAvg !== '-' ? parseFloat(overallAvg) : '-');
      
      wsData.push(avgRow);

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Set column widths
      const colWidths = [
        { wch: 30 }, // Student name
        { wch: 15 }, // Registration No
        ...courses.map(() => ({ wch: 15 })), // Course columns
        { wch: 12 } // Average
      ];
      ws['!cols'] = colWidths;

      // Apply styles FIRST before merging
      const range = XLSX.utils.decode_range(ws['!ref']);
      const totalColumns = 2 + courses.length + 1;
      
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!ws[cellAddress]) {
            // Create empty cells for merged areas
            ws[cellAddress] = { v: '', t: 's' };
          }

          if (typeof ws[cellAddress] !== 'object') {
            ws[cellAddress] = { v: ws[cellAddress], t: 's' };
          }

          if (!ws[cellAddress].s) {
            ws[cellAddress].s = {};
          }

          // Header rows - Bold and Centered (apply to ALL cells in header rows)
          if (R < headerRowIndex) {
            ws[cellAddress].s = {
              font: { bold: true, sz: 11 },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
            };
          }

          // Table header row
          else if (R === headerRowIndex) {
            ws[cellAddress].s = {
              font: { bold: true, sz: 10 },
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

          // Student name column
          else if (R > headerRowIndex && C === 0) {
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

          // Data cells with color coding
          else if (R > headerRowIndex && C > 1) {
            const cellValue = ws[cellAddress].v;
            let fontColor = { rgb: '000000' };
            let fillColor = undefined;

            if (typeof cellValue === 'number') {
              if (cellValue >= 75) {
                fontColor = { rgb: '059669' }; // Green
              } else if (cellValue >= 50) {
                fontColor = { rgb: 'D97706' }; // Amber
              } else {
                fontColor = { rgb: 'DC2626' }; // Red
              }

              ws[cellAddress].t = 'n';
              ws[cellAddress].z = '0.0"%"';
            }

            // Highlight Average column
            if (C === totalColumns - 1) {
              fillColor = { patternType: 'solid', fgColor: { rgb: 'F0F9FF' } };
            }

            // Class Average row
            if (R === range.e.r) {
              fillColor = { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } };
              ws[cellAddress].s = {
                font: { bold: true, sz: 10, color: fontColor },
                alignment: { horizontal: 'center', vertical: 'center' },
                fill: fillColor,
                border: {
                  top: { style: 'medium', color: { rgb: '000000' } },
                  bottom: { style: 'medium', color: { rgb: '000000' } },
                  left: { style: 'thin', color: { rgb: '000000' } },
                  right: { style: 'thin', color: { rgb: '000000' } }
                }
              };
            } else {
              ws[cellAddress].s = {
                font: { sz: 10, color: fontColor, bold: C === totalColumns - 1 },
                alignment: { horizontal: 'center', vertical: 'center' },
                fill: fillColor,
                border: {
                  top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                  bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                  left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                  right: { style: 'thin', color: { rgb: 'CCCCCC' } }
                }
              };
            }
          }

          // Registration number column
          else if (R > headerRowIndex && C === 1) {
            const isAvgRow = R === range.e.r;
            ws[cellAddress].s = {
              font: { sz: 10, bold: isAvgRow },
              alignment: { horizontal: 'center', vertical: 'center' },
              fill: isAvgRow ? { patternType: 'solid', fgColor: { rgb: 'DBEAFE' } } : undefined,
              border: {
                top: { style: isAvgRow ? 'medium' : 'thin', color: { rgb: isAvgRow ? '000000' : 'CCCCCC' } },
                bottom: { style: isAvgRow ? 'medium' : 'thin', color: { rgb: isAvgRow ? '000000' : 'CCCCCC' } },
                left: { style: 'thin', color: { rgb: isAvgRow ? '000000' : 'CCCCCC' } },
                right: { style: 'thin', color: { rgb: isAvgRow ? '000000' : 'CCCCCC' } }
              }
            };
          }
        }
      }

      // Merge cells for header rows AFTER applying styles
      if (!ws['!merges']) ws['!merges'] = [];
      for (let i = 0; i < headerRowIndex; i++) {
        ws['!merges'].push({
          s: { r: i, c: 0 },
          e: { r: i, c: totalColumns - 1 }
        });
      }

      // Set row heights
      if (!ws['!rows']) ws['!rows'] = [];
      ws['!rows'][0] = { hpt: 15 }; // Empty row
      ws['!rows'][1] = { hpt: 20 }; // University name
      ws['!rows'][2] = { hpt: 20 }; // Batch title
      ws['!rows'][3] = { hpt: 18 }; // Faculty
      ws['!rows'][4] = { hpt: 18 }; // Department
      ws['!rows'][5] = { hpt: 18 }; // Year/Semester
      for (let i = 6; i < headerRowIndex; i++) {
        ws['!rows'][i] = { hpt: 16 };
      }
      ws['!rows'][headerRowIndex] = { hpt: 35 }; // Taller for wrapped course names

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Course Summary');

      // Generate file name
      const fileName = `${selectedBatch.batchName}_All_Courses_Summary_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Write file
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('Error exporting batch course summary:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" className="text-cyan-600" />
      </div>
    );
  }

  const totalStudents = batchStats.reduce((sum, batch) => sum + batch.totalStudents, 0);
  const totalSessions = batchStats.reduce((sum, batch) => sum + batch.totalSessions, 0);
  const avgAttendance = batchStats.length > 0 
    ? (batchStats.reduce((sum, batch) => sum + parseFloat(batch.attendanceRate), 0) / batchStats.length).toFixed(1)
    : 0;

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        {!selectedBatch && (
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Batch-wise Attendance Analytics</h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">Overview of attendance across all batches</p>
          </div>
        )}

      {!selectedBatch && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Batches</p>
              <p className="text-3xl font-bold mt-2">{batchStats.length}</p>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-8 h-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Total Students</p>
              <p className="text-3xl font-bold mt-2">{totalStudents}</p>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-lg flex items-center justify-center">
              <Users className="w-8 h-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Total Sessions</p>
              <p className="text-3xl font-bold mt-2">{totalSessions}</p>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-lg flex items-center justify-center">
              <BookOpen className="w-8 h-8" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-cyan-100 text-sm font-medium">Avg Attendance</p>
              <p className="text-3xl font-bold mt-2">{avgAttendance}%</p>
            </div>
            <div className="w-14 h-14 bg-white/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-8 h-8" />
            </div>
          </div>
        </div>
      </div>

          {/* Batch Cards with Pie Charts */}
          {batchStats.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-slate-200 dark:border-slate-700 p-12 text-center shadow-sm">
              <GraduationCap className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400 text-lg">No batch data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {batchStats.map((batch) => {
            const total = batch.present + batch.late + batch.absent;
            const chartData = [
              { name: 'Present', value: batch.present, color: COLORS.present, total },
              { name: 'Late', value: batch.late, color: COLORS.late, total },
              { name: 'Absent', value: batch.absent, color: COLORS.absent, total }
            ].filter(item => item.value > 0);

            return (
              <div 
                key={batch.batchId} 
                onClick={() => handleBatchClick(batch)}
                className="bg-white dark:bg-slate-900 rounded-xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-xl hover:border-cyan-400 dark:hover:border-cyan-600 transition-all cursor-pointer hover:scale-105"
              >
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800 p-4 border-b-2 border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1 truncate">{batch.batchName}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {batch.department}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                        Year {batch.currentYear} • Sem {batch.currentSemester}
                      </p>
                    </div>
                    <div className="flex flex-col items-end justify-center flex-shrink-0">
                      <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 leading-none">
                        {batch.attendanceRate}%
                      </div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wide">Attendance</div>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-slate-900 dark:text-white">{batch.totalStudents}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Students</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-slate-900 dark:text-white">{batch.totalSessions}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Sessions</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-slate-900 dark:text-white">{total}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Records</div>
                    </div>
                  </div>

                  {total > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={65}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
                            labelLine={false}
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Present</span>
                          </div>
                          <div className="text-base font-bold text-green-600 dark:text-green-400">{batch.present}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {total > 0 ? ((batch.present / total) * 100).toFixed(1) : 0}%
                          </div>
                        </div>

                        <div className="text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Late</span>
                          </div>
                          <div className="text-base font-bold text-amber-600 dark:text-amber-400">{batch.late}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {total > 0 ? ((batch.late / total) * 100).toFixed(1) : 0}%
                          </div>
                        </div>

                        <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Absent</span>
                          </div>
                          <div className="text-base font-bold text-red-600 dark:text-red-400">{batch.absent}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {total > 0 ? ((batch.absent / total) * 100).toFixed(1) : 0}%
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                      <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No attendance records yet</p>
                    </div>
                  )}
                </div>
              </div>
            );
              })}
            </div>
          )}
        </>
      )}

      {/* Batch Details View */}
      {selectedBatch && (
        <div className="space-y-6">
          {/* Back Button and Header */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={closeModal}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
            >
              <ChevronLeft className="w-4 sm:w-5 h-4 sm:h-5 text-slate-700 dark:text-slate-300" />
            </button>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 dark:text-white truncate">{selectedBatch.batchName}</h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 sm:mt-1 truncate">
                {selectedBatch.department} • Year {selectedBatch.currentYear} • Sem {selectedBatch.currentSemester}
              </p>
            </div>
          </div>

          <div>
              {/* View Mode Toggle and Export Button */}
              <div className="flex gap-2 mb-3 sm:mb-4">
                <div className="flex gap-1 sm:gap-2 flex-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button
                    onClick={() => setViewMode('courses')}
                    className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-md font-medium transition-all text-xs sm:text-sm ${
                      viewMode === 'courses'
                        ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <BookOpen className="w-3.5 sm:w-4 h-3.5 sm:h-4 inline-block mr-0.5 sm:mr-1" />
                    <span className="hidden sm:inline">Courses</span>
                    <span className="sm:hidden">Crs</span>
                  </button>
                  <button
                    onClick={switchToStudentsView}
                    className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-md font-medium transition-all text-xs sm:text-sm ${
                      viewMode === 'students'
                        ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Users className="w-3.5 sm:w-4 h-3.5 sm:h-4 inline-block mr-0.5 sm:mr-1" />
                    <span className="hidden sm:inline">Students</span>
                    <span className="sm:hidden">Std</span>
                  </button>
                  <button
                    onClick={switchToOverviewView}
                    className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 rounded-md font-medium transition-all text-xs sm:text-sm ${
                      viewMode === 'overview'
                        ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Table className="w-3.5 sm:w-4 h-3.5 sm:h-4 inline-block mr-0.5 sm:mr-1" />
                    <span className="hidden sm:inline">Overview</span>
                    <span className="sm:hidden">All</span>
                  </button>
                </div>
              </div>

              {viewMode === 'courses' ? (
                // Course View - Accordion Style
                modalLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner size="lg" className="text-cyan-600" />
                  </div>
                ) : courses.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No courses available for this batch</p>
                  </div>
                ) : (
                  <div>
                    <div className="mb-3">
                      {selectedCourse ? (
                        <button
                          onClick={() => handleCourseSelect(null)}
                          className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-medium"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Back to all courses
                        </button>
                      ) : (
                        <h4 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-cyan-600" />
                          Courses
                        </h4>
                      )}
                    </div>
                    
                    {selectedCourse ? (
                      // Show only selected course with chart and table
                      (() => {
                        const course = selectedCourse;
                        const total = courseAttendance ? (courseAttendance.present + courseAttendance.late + courseAttendance.absent) : 0;
                        const chartData = courseAttendance ? [
                          { name: 'Present', value: courseAttendance.present, color: COLORS.present, total },
                          { name: 'Late', value: courseAttendance.late, color: COLORS.late, total },
                          { name: 'Absent', value: courseAttendance.absent, color: COLORS.absent, total }
                        ].filter(item => item.value > 0) : [];

                        return (
                          <div className="border-2 rounded-lg overflow-hidden transition-all bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            {/* Course Header */}
                            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 border-b-2 border-slate-200 dark:border-slate-700">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h6 className="font-semibold text-slate-900 dark:text-white text-base">{course.code}</h6>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{course.name}</p>
                                  {courseAttendance && courseAttendance.courseId === course._id && (
                                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                                      {courseAttendance.totalSessions} {courseAttendance.totalSessions === 1 ? 'Session' : 'Sessions'} • {courseAttendance.totalStudents} {courseAttendance.totalStudents === 1 ? 'Student' : 'Students'}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Content - Pie Chart or Loading */}
                            <div className="p-4 bg-white dark:bg-slate-900">
                              {loadingCourseId === course._id ? (
                                <div className="flex items-center justify-center py-8">
                                  <LoadingSpinner size="lg" className="text-cyan-600" />
                                </div>
                              ) : courseAttendance && courseAttendance.courseId === course._id ? (
                                (() => {
                                  // Recalculate total and chartData based on current courseAttendance data
                                  const displayTotal = courseAttendance.present + courseAttendance.late + courseAttendance.absent;
                                  const displayChartData = [
                                    { name: 'Present', value: courseAttendance.present, color: COLORS.present, total: displayTotal },
                                    { name: 'Late', value: courseAttendance.late, color: COLORS.late, total: displayTotal },
                                    { name: 'Absent', value: courseAttendance.absent, color: COLORS.absent, total: displayTotal }
                                  ].filter(item => item.value > 0);
                                  return (
                                    <>
                                      {/* Date Range Filter */}
                                      <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border-2 border-slate-200 dark:border-slate-700">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <div className="flex items-center gap-2">
                                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">From:</label>
                                            <input
                                              type="date"
                                              value={dateRange.startDate}
                                              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                                              className="px-2 py-1 text-xs rounded border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
                                            />
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">To:</label>
                                            <input
                                              type="date"
                                              value={dateRange.endDate}
                                              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                                              className="px-2 py-1 text-xs rounded border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
                                            />
                                          </div>
                                          <button
                                            onClick={handleDateRangeFilter}
                                            className="px-3 py-1 text-xs font-medium bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors"
                                          >
                                            Apply
                                          </button>
                                          {isDateFilterActive && (
                                            <button
                                              onClick={clearDateFilter}
                                              className="px-3 py-1 text-xs font-medium bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors"
                                            >
                                              Clear Filter
                                            </button>
                                          )}
                                        </div>
                                        {isDateFilterActive && (
                                          <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-2 font-medium">
                                            Showing data from {new Date(dateRange.startDate).toLocaleDateString()} to {new Date(dateRange.endDate).toLocaleDateString()}
                                          </p>
                                        )}
                                      </div>

                                      {/* View Mode Toggle and Export Button */}
                                      <div className="flex flex-col sm:flex-row gap-2 mb-4">
                                        <div className="flex gap-2 flex-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                          <button
                                            onClick={() => handleCourseViewModeChange('chart')}
                                            className={`flex-1 py-2 px-2 sm:px-3 rounded-md font-medium transition-all text-xs ${
                                              courseViewMode === 'chart'
                                                ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                            }`}
                                          >
                                            <BarChart3 className="w-3.5 h-3.5 inline-block mr-1" />
                                            <span className="hidden xs:inline">Chart View</span>
                                            <span className="xs:hidden">Chart</span>
                                          </button>
                                          <button
                                            onClick={() => handleCourseViewModeChange('table')}
                                            className={`flex-1 py-2 px-2 sm:px-3 rounded-md font-medium transition-all text-xs ${
                                              courseViewMode === 'table'
                                                ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                            }`}
                                          >
                                            <Table className="w-3.5 h-3.5 inline-block mr-1" />
                                            <span className="hidden xs:inline">Table View</span>
                                            <span className="xs:hidden">Table</span>
                                          </button>
                                        </div>
                                        {courseViewMode === 'table' && courseTableData && (
                                          <button
                                            onClick={exportToCSV}
                                            className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all text-xs flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm whitespace-nowrap"
                                            title="Export to Excel"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">Export Excel</span>
                                            <span className="sm:hidden">Export</span>
                                          </button>
                                        )}
                                      </div>

                                      {courseViewMode === 'chart' ? (
                                        <>
                                          <div className="text-center mb-3">
                                            <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                                              {courseAttendance.attendanceRate}%
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Attendance Rate</div>
                                          </div>

                                          <div className="grid grid-cols-3 gap-2 mb-3">
                                            <div className="text-center">
                                              <div className="text-base font-bold text-slate-900 dark:text-white">{courseAttendance.totalStudents}</div>
                                              <div className="text-xs text-slate-500 dark:text-slate-400">Students</div>
                                            </div>
                                            <div className="text-center">
                                              <div className="text-base font-bold text-slate-900 dark:text-white">{courseAttendance.totalSessions}</div>
                                              <div className="text-xs text-slate-500 dark:text-slate-400">Sessions</div>
                                            </div>
                                            <div className="text-center">
                                              <div className="text-base font-bold text-slate-900 dark:text-white">{displayTotal}</div>
                                              <div className="text-xs text-slate-500 dark:text-slate-400">Records</div>
                                            </div>
                                          </div>

                                          {displayTotal > 0 ? (
                                            <>
                                              <ResponsiveContainer width="100%" height={140}>
                                                <PieChart>
                                                  <Pie
                                                    data={displayChartData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={35}
                                                    outerRadius={60}
                                                    paddingAngle={2}
                                                    dataKey="value"
                                                    label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
                                                    labelLine={false}
                                                  >
                                                    {displayChartData.map((entry, index) => (
                                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                  </Pie>
                                                  <Tooltip content={<CustomTooltip />} />
                                                </PieChart>
                                              </ResponsiveContainer>

                                              <div className="grid grid-cols-3 gap-2 mt-3">
                                                <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                                  <div className="flex items-center justify-center gap-1 mb-0.5">
                                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Present</span>
                                                  </div>
                                                  <div className="text-base font-bold text-green-600 dark:text-green-400">{courseAttendance.present}</div>
                                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                                    {((courseAttendance.present / displayTotal) * 100).toFixed(1)}%
                                                  </div>
                                                </div>

                                                <div className="text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                                                  <div className="flex items-center justify-center gap-1 mb-0.5">
                                                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Late</span>
                                                  </div>
                                                  <div className="text-base font-bold text-amber-600 dark:text-amber-400">{courseAttendance.late}</div>
                                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                                    {((courseAttendance.late / displayTotal) * 100).toFixed(1)}%
                                                  </div>
                                                </div>

                                                <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                                  <div className="flex items-center justify-center gap-1 mb-0.5">
                                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Absent</span>
                                                  </div>
                                                  <div className="text-base font-bold text-red-600 dark:text-red-400">{courseAttendance.absent}</div>
                                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                                    {((courseAttendance.absent / displayTotal) * 100).toFixed(1)}%
                                                  </div>
                                                </div>
                                              </div>
                                            </>
                                          ) : (
                                            <div className="text-center py-8 text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                                              <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                              <p className="text-sm">No attendance records yet</p>
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        // Table View
                                        <div className="w-full">
                                          {!courseTableData ? (
                                            <div className="flex items-center justify-center py-8">
                                              <LoadingSpinner size="lg" className="text-cyan-600" />
                                            </div>
                                          ) : courseTableData.students.length === 0 ? (
                                            <div className="text-center py-8 text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                                              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                              <p className="text-sm">No student data available</p>
                                            </div>
                                          ) : (
                                            <div className="border-2 border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto relative">
                                              <table className="w-full text-xs min-w-max">
                                                  <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                                                    <tr>
                                                      <th className="px-2 sm:px-3 py-2 text-left font-bold text-slate-900 dark:text-white border-b-2 border-slate-200 dark:border-slate-700 sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 min-w-[80px] sm:min-w-[120px]">Reg No</th>
                                                      <th className="px-2 sm:px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 border-b-2 border-slate-200 dark:border-slate-700 min-w-[120px] sm:min-w-[200px]">Student</th>
                                                      {courseTableData.months.map(month => (
                                                        <th key={month} className="px-2 sm:px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-300 border-b-2 border-slate-200 dark:border-slate-700 whitespace-nowrap min-w-[70px] sm:min-w-[100px]">
                                                          <span className="hidden sm:inline">{new Date(month + '-01').toLocaleDateString('en-US', { month: 'long' })}</span>
                                                          <span className="sm:hidden text-[10px]">{new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' })}</span>
                                                        </th>
                                                      ))}
                                                      <th className="px-2 sm:px-3 py-2 text-center font-semibold text-slate-700 dark:text-slate-300 border-b-2 border-slate-200 dark:border-slate-700 bg-cyan-50 dark:bg-cyan-900/20 min-w-[70px] sm:min-w-[80px]">Overall</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {courseTableData.students.map((student, idx) => (
                                                      <tr key={student.studentId} className={`${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50'} hover:bg-cyan-50 dark:hover:bg-cyan-900/10 transition-colors`}>
                                                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-slate-900 dark:text-white font-bold border-b border-slate-200 dark:border-slate-700 sticky left-0 bg-inherit z-20">{student.registrationNo}</td>
                                                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-slate-900 dark:text-white font-medium border-b border-slate-200 dark:border-slate-700">{student.name}</td>
                                                        {courseTableData.months.map(month => {
                                                          const monthData = student.monthlyStats.find(m => m.month === month);
                                                          return (
                                                            <td key={month} className="px-2 sm:px-3 py-1.5 sm:py-2 text-center border-b border-slate-200 dark:border-slate-700">
                                                              {monthData ? (
                                                                <span className={`font-semibold text-[10px] sm:text-xs ${
                                                                  parseFloat(monthData.attendanceRate) >= 75 ? 'text-green-600 dark:text-green-400' :
                                                                  parseFloat(monthData.attendanceRate) >= 50 ? 'text-amber-600 dark:text-amber-400' :
                                                                  'text-red-600 dark:text-red-400'
                                                                }`}>
                                                                  {monthData.attendanceRate}%
                                                                </span>
                                                              ) : (
                                                                <span className="text-slate-400 text-[10px] sm:text-xs">-</span>
                                                              )}
                                                            </td>
                                                          );
                                                        })}
                                                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-center border-b border-slate-200 dark:border-slate-700 bg-cyan-50 dark:bg-cyan-900/20">
                                                          <span className={`font-bold text-[10px] sm:text-xs ${
                                                            parseFloat(student.overall.attendanceRate) >= 75 ? 'text-green-600 dark:text-green-400' :
                                                            parseFloat(student.overall.attendanceRate) >= 50 ? 'text-amber-600 dark:text-amber-400' :
                                                            'text-red-600 dark:text-red-400'
                                                          }`}>
                                                            {student.overall.attendanceRate}%
                                                          </span>
                                                        </td>
                                                      </tr>
                                                    ))}
                                                    {/* Average Row */}
                                                    <tr className="bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 font-bold">
                                                      <td className="px-2 sm:px-3 py-2 text-[10px] sm:text-xs text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-600 sticky left-0 bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 z-20 font-bold">
                                                        Class Average
                                                      </td>
                                                      <td className="px-2 sm:px-3 py-2 text-[10px] sm:text-xs text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-600 bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30"></td>
                                                      {courseTableData.months.map(month => {
                                                        // Calculate average for this month
                                                        let totalRate = 0;
                                                        let count = 0;
                                                        courseTableData.students.forEach(student => {
                                                          const monthData = student.monthlyStats.find(m => m.month === month);
                                                          if (monthData) {
                                                            totalRate += parseFloat(monthData.attendanceRate);
                                                            count++;
                                                          }
                                                        });
                                                        const avgRate = count > 0 ? (totalRate / count).toFixed(1) : '-';
                                                        return (
                                                          <td key={month} className="px-2 sm:px-3 py-2 text-center border-t-2 border-slate-300 dark:border-slate-600">
                                                            <span className={`font-bold text-[10px] sm:text-xs ${
                                                              avgRate !== '-' && parseFloat(avgRate) >= 75 ? 'text-green-600 dark:text-green-400' :
                                                              avgRate !== '-' && parseFloat(avgRate) >= 50 ? 'text-amber-600 dark:text-amber-400' :
                                                              avgRate !== '-' ? 'text-red-600 dark:text-red-400' : 'text-slate-400'
                                                            }`}>
                                                              {avgRate !== '-' ? `${avgRate}%` : '-'}
                                                            </span>
                                                          </td>
                                                        );
                                                      })}
                                                      <td className="px-2 sm:px-3 py-2 text-center border-t-2 border-slate-300 dark:border-slate-600 bg-cyan-100 dark:bg-cyan-900/40">
                                                        <span className={`font-bold text-xs sm:text-sm ${
                                                          parseFloat(courseTableData.averages.attendanceRate) >= 75 ? 'text-green-600 dark:text-green-400' :
                                                          parseFloat(courseTableData.averages.attendanceRate) >= 50 ? 'text-amber-600 dark:text-amber-400' :
                                                          'text-red-600 dark:text-red-400'
                                                        }`}>
                                                          {courseTableData.averages.attendanceRate}%
                                                        </span>
                                                      </td>
                                                    </tr>
                                                  </tbody>
                                                </table>
                                              </div>
                                            )}
                                          </div>
                                      )}
                                    </>
                                  );
                                })()
                              ) : null}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      // Show all courses list when no course is selected
                      <div className="space-y-1.5">
                        {courses.map((course) => {
                          return (
                            <div key={course._id} className="border-2 rounded-lg overflow-hidden transition-all bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-600 hover:shadow-md">
                              {/* Course Header - Always Visible */}
                              <button
                                onClick={() => handleCourseSelect(course)}
                                className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <h6 className="font-semibold text-slate-900 dark:text-white text-base">{course.code}</h6>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{course.name}</p>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ml-3" />
                                </div>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )
            ) : viewMode === 'students' ? (
              // Students View - Accordion Style
              modalLoading ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="lg" className="text-cyan-600" />
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-cyan-600" />
                      Students
                    </h4>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {pagination.total} total
                    </span>
                  </div>

                  {/* Search Bar - Compact */}
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by name, reg no, email, or mobile..."
                      value={searchQuery}
                      onChange={handleSearch}
                      className="w-full pl-9 pr-20 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 dark:focus:ring-cyan-800 focus:outline-none text-sm transition-all"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {searchQuery && !isSearching && (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            if (searchTimeoutRef.current) {
                              clearTimeout(searchTimeoutRef.current);
                            }
                            loadStudents(1, '');
                          }}
                          className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center transition-colors"
                          title="Clear search"
                        >
                          <X className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                        </button>
                      )}
                      {isSearching && (
                        <LoadingSpinner size="sm" className="text-cyan-600" />
                      )}
                    </div>
                  </div>

                  {students.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">{searchQuery ? 'No students found' : 'No students available'}</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5 mb-3">
                        {students.map((student) => {
                          const isExpanded = selectedStudent?._id === student._id;

                          return (
                            <div key={student._id} className="border-2 rounded-lg overflow-hidden transition-all bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-600 hover:shadow-md">
                              {/* Student Header - Always Visible */}
                              <button
                                onClick={() => handleStudentSelect(isExpanded ? null : student)}
                                className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <p className="font-semibold text-slate-900 dark:text-white text-base">{student.name}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{student.registrationNo}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <p className="text-xs text-slate-500 dark:text-slate-500">{student.email}</p>
                                      {student.mobile && (
                                        <>
                                          <span className="text-xs text-slate-400">•</span>
                                          <p className="text-xs text-slate-500 dark:text-slate-500">{student.mobile}</p>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ml-3 ${
                                    isExpanded ? 'rotate-90' : ''
                                  }`} />
                                </div>
                              </button>

                              {/* Expanded Content - Course List with Accordion or Loading */}
                              {isExpanded && (
                                <div className="border-t-2 border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900">
                                  {loadingStudentId === student._id ? (
                                    <div className="flex items-center justify-center py-8">
                                      <LoadingSpinner size="lg" className="text-cyan-600" />
                                    </div>
                                  ) : studentAttendance && studentAttendance.student._id === student._id ? (
                                    <>
                                      {studentAttendance.courses.length === 0 ? (
                                        <div className="text-center py-6 text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                                          <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                          <p className="text-sm">No course attendance data</p>
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          {studentAttendance.courses.map((course) => {
                                        const isCourseExpanded = selectedStudentCourse?.courseId === course.courseId;
                                        // Use filtered data if available, otherwise use original course data
                                        const displayCourse = filteredCourseData[course.courseId] || course;
                                        const total = displayCourse.present + displayCourse.late + displayCourse.absent;
                                        const chartData = [
                                          { name: 'Present', value: displayCourse.present, color: COLORS.present, total },
                                          { name: 'Late', value: displayCourse.late, color: COLORS.late, total },
                                          { name: 'Absent', value: displayCourse.absent, color: COLORS.absent, total }
                                        ].filter(item => item.value > 0);

                                        return (
                                          <div key={course.courseId} className="border-2 rounded-lg overflow-hidden transition-all bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-600 hover:shadow-md">
                                            {/* Course Header */}
                                            <button
                                              onClick={() => handleStudentCourseSelect(isCourseExpanded ? null : course)}
                                              className="w-full text-left p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                            >
                                              <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                  <h6 className="font-bold text-sm text-slate-900 dark:text-white">{course.courseCode}</h6>
                                                  <p className="text-xs text-slate-600 dark:text-slate-400">{course.courseName}</p>
                                                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                                                    {displayCourse.totalSessions} {displayCourse.totalSessions === 1 ? 'Session' : 'Sessions'}
                                                  </p>
                                                  <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                      <span className="text-green-600 dark:text-green-400 font-semibold">{displayCourse.present}</span> P
                                                    </span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                      <span className="text-amber-600 dark:text-amber-400 font-semibold">{displayCourse.late}</span> L
                                                    </span>
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                                      <span className="text-red-600 dark:text-red-400 font-semibold">{displayCourse.absent}</span> A
                                                    </span>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <div className="text-right">
                                                    <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                                                      {displayCourse.attendanceRate}%
                                                    </div>
                                                  </div>
                                                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${
                                                    isCourseExpanded ? 'rotate-90' : ''
                                                  }`} />
                                                </div>
                                              </div>
                                            </button>

                                            {/* Expanded Pie Chart */}
                                            {isCourseExpanded && (
                                              <div className="border-t-2 border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900">
                                                {/* Date Range Filter for Individual Course */}
                                                <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border-2 border-slate-200 dark:border-slate-700">
                                                  <div className="flex items-center gap-2 flex-wrap">
                                                    <div className="flex items-center gap-1">
                                                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">From:</label>
                                                      <input
                                                        type="date"
                                                        value={courseDateRanges[course.courseId]?.startDate || ''}
                                                        onChange={(e) => setCourseDateRanges({
                                                          ...courseDateRanges,
                                                          [course.courseId]: {
                                                            ...courseDateRanges[course.courseId],
                                                            startDate: e.target.value
                                                          }
                                                        })}
                                                        className="px-2 py-0.5 text-xs rounded border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
                                                      />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">To:</label>
                                                      <input
                                                        type="date"
                                                        value={courseDateRanges[course.courseId]?.endDate || ''}
                                                        onChange={(e) => setCourseDateRanges({
                                                          ...courseDateRanges,
                                                          [course.courseId]: {
                                                            ...courseDateRanges[course.courseId],
                                                            endDate: e.target.value
                                                          }
                                                        })}
                                                        className="px-2 py-0.5 text-xs rounded border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-cyan-500 focus:outline-none"
                                                      />
                                                    </div>
                                                    <button
                                                      onClick={async () => {
                                                        const range = courseDateRanges[course.courseId];
                                                        if (!range?.startDate || !range?.endDate) {
                                                          alert('Please select both dates');
                                                          return;
                                                        }
                                                        if (new Date(range.startDate) > new Date(range.endDate)) {
                                                          alert('Start date must be before end date');
                                                          return;
                                                        }
                                                        
                                                        // Fetch filtered data for this specific course
                                                        try {
                                                          const params = new URLSearchParams({
                                                            startDate: range.startDate,
                                                            endDate: range.endDate,
                                                            courseId: course.courseId
                                                          });
                                                          const response = await apiClient.get(
                                                            `/api/analytics/batch/${selectedBatch.batchId}/student/${selectedStudent._id}?${params}`
                                                          );
                                                          
                                                          // Find the specific course data from response
                                                          const filteredCourse = response.data.courses.find(c => c.courseId === course.courseId);
                                                          if (filteredCourse) {
                                                            setFilteredCourseData({
                                                              ...filteredCourseData,
                                                              [course.courseId]: filteredCourse
                                                            });
                                                          }
                                                          
                                                          // Mark as active
                                                          setCourseDateRanges({
                                                            ...courseDateRanges,
                                                            [course.courseId]: { ...range, isActive: true }
                                                          });
                                                        } catch (error) {
                                                          console.error('Error loading filtered course data:', error);
                                                          alert('Failed to load filtered data');
                                                        }
                                                      }}
                                                      className="px-2 py-0.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors"
                                                    >
                                                      Apply
                                                    </button>
                                                    {courseDateRanges[course.courseId]?.isActive && (
                                                      <button
                                                        onClick={() => {
                                                          // Clear date range
                                                          const newRanges = { ...courseDateRanges };
                                                          delete newRanges[course.courseId];
                                                          setCourseDateRanges(newRanges);
                                                          
                                                          // Clear filtered data
                                                          const newFilteredData = { ...filteredCourseData };
                                                          delete newFilteredData[course.courseId];
                                                          setFilteredCourseData(newFilteredData);
                                                        }}
                                                        className="px-2 py-0.5 text-xs font-medium bg-slate-600 hover:bg-slate-700 text-white rounded transition-colors"
                                                      >
                                                        Clear
                                                      </button>
                                                    )}
                                                  </div>
                                                  {courseDateRanges[course.courseId]?.isActive && (
                                                    <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1 font-medium">
                                                      Filtered: {new Date(courseDateRanges[course.courseId].startDate).toLocaleDateString()} - {new Date(courseDateRanges[course.courseId].endDate).toLocaleDateString()}
                                                    </p>
                                                  )}
                                                </div>

                                                {total > 0 ? (
                                                  <>
                                                    <ResponsiveContainer width="100%" height={140}>
                                                      <PieChart>
                                                        <Pie
                                                          data={chartData}
                                                          cx="50%"
                                                          cy="50%"
                                                          innerRadius={35}
                                                          outerRadius={55}
                                                          paddingAngle={2}
                                                          dataKey="value"
                                                          label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
                                                          labelLine={false}
                                                        >
                                                          {chartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                          ))}
                                                        </Pie>
                                                        <Tooltip content={<CustomTooltip />} />
                                                      </PieChart>
                                                    </ResponsiveContainer>

                                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                                      <div className="text-center p-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                                        <div className="flex items-center justify-center gap-1 mb-0.5">
                                                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Present</span>
                                                        </div>
                                                        <div className="text-base font-bold text-green-600 dark:text-green-400">{course.present}</div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                                          {((course.present / total) * 100).toFixed(1)}%
                                                        </div>
                                                      </div>

                                                      <div className="text-center p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                                                        <div className="flex items-center justify-center gap-1 mb-0.5">
                                                          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Late</span>
                                                        </div>
                                                        <div className="text-base font-bold text-amber-600 dark:text-amber-400">{course.late}</div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                                          {((course.late / total) * 100).toFixed(1)}%
                                                        </div>
                                                      </div>

                                                      <div className="text-center p-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                                        <div className="flex items-center justify-center gap-1 mb-0.5">
                                                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Absent</span>
                                                        </div>
                                                        <div className="text-base font-bold text-red-600 dark:text-red-400">{course.absent}</div>
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                                          {((course.absent / total) * 100).toFixed(1)}%
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </>
                                                ) : (
                                                  <p className="text-center text-xs text-slate-400 py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">No records</p>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                          })}
                                        </div>
                                      )}
                                    </>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Pagination */}
                      {pagination.pages > 1 && (
                        <div className="flex items-center justify-between pt-4 border-t-2 border-slate-200 dark:border-slate-700">
                          <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            className="px-4 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-cyan-400 dark:hover:border-cyan-600 transition-all"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                            Page {pagination.page} of {pagination.pages}
                          </span>
                          <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={pagination.page === pagination.pages}
                            className="px-4 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-cyan-400 dark:hover:border-cyan-600 transition-all"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            ) : viewMode === 'overview' ? (
              // Overview Table View - All Courses for All Students
              loadingOverview ? (
                <div className="flex items-center justify-center py-12">
                  <LoadingSpinner size="lg" className="text-cyan-600" />
                </div>
              ) : !overviewData || overviewData.students.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                  <Table className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No data available</p>
                </div>
              ) : (
                <div>
                  <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Table className="w-4 h-4 text-cyan-600" />
                        Course-wise Attendance Overview
                      </h4>
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                        {overviewData.students.length} Students • {overviewData.courses.length} Courses
                      </span>
                    </div>
                    
                    {/* Export Button */}
                    <button
                      onClick={exportBatchCourseSummary}
                      disabled={!overviewData || !overviewData.students.length}
                      className="w-full sm:w-auto px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
                      title="Export all courses attendance for all students"
                    >
                      <Download className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                      <span className="hidden sm:inline">Export to Excel</span>
                      <span className="sm:hidden">Export</span>
                    </button>
                  </div>

                  <div className="border-2 border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto w-full relative">
                    <table className="w-full text-xs min-w-max">
                        <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                          <tr>
                            <th className="px-2 sm:px-3 py-2 sm:py-3 text-left font-bold text-slate-900 dark:text-white border-b-2 border-slate-200 dark:border-slate-700 sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 whitespace-nowrap min-w-[80px] sm:min-w-[120px]">
                              Reg No
                            </th>
                            <th className="px-2 sm:px-3 py-2 sm:py-3 text-left font-semibold text-slate-700 dark:text-slate-300 border-b-2 border-slate-200 dark:border-slate-700 whitespace-nowrap min-w-[120px] sm:min-w-[200px]">
                              Student
                            </th>
                            {overviewData.courses.map(course => (
                              <th key={course._id} className="px-2 sm:px-3 py-2 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-300 border-b-2 border-slate-200 dark:border-slate-700 whitespace-nowrap min-w-[90px] sm:min-w-[120px]">
                                <div className="font-bold text-[10px] sm:text-xs">{course.code}</div>
                                <div className="text-[9px] sm:text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5 max-w-[90px] sm:max-w-none truncate">{course.name}</div>
                              </th>
                            ))}
                            <th className="px-2 sm:px-3 py-2 sm:py-3 text-center font-semibold text-slate-700 dark:text-slate-300 border-b-2 border-slate-200 dark:border-slate-700 bg-cyan-50 dark:bg-cyan-900/20 min-w-[70px] sm:min-w-[100px]">
                              Average
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {overviewData.students.map((student, idx) => {
                            let totalPercentage = 0;
                            let courseCount = 0;

                            return (
                              <tr key={student._id} className={`${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/50'} hover:bg-cyan-50 dark:hover:bg-cyan-900/10 transition-colors`}>
                                <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-slate-900 dark:text-white font-bold border-b border-slate-200 dark:border-slate-700 sticky left-0 bg-inherit z-20 whitespace-nowrap">
                                  {student.registrationNo}
                                </td>
                                <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-slate-900 dark:text-white font-medium border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                  {student.name}
                                </td>
                                {overviewData.courses.map(course => {
                                  const courseData = student.courses.find(c => c.courseId === course._id);
                                  const percentage = courseData ? parseFloat(courseData.attendanceRate) : null;
                                  
                                  if (percentage !== null) {
                                    totalPercentage += percentage;
                                    courseCount++;
                                  }

                                  return (
                                    <td key={course._id} className="px-2 sm:px-3 py-1.5 sm:py-2 text-center border-b border-slate-200 dark:border-slate-700">
                                      {percentage !== null ? (
                                        <span className={`font-semibold text-[10px] sm:text-xs ${
                                          percentage >= 75 ? 'text-green-600 dark:text-green-400' :
                                          percentage >= 50 ? 'text-amber-600 dark:text-amber-400' :
                                          'text-red-600 dark:text-red-400'
                                        }`}>
                                          {percentage.toFixed(1)}%
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 text-[10px] sm:text-xs">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-center border-b border-slate-200 dark:border-slate-700 bg-cyan-50 dark:bg-cyan-900/20">
                                  {(() => {
                                    const average = courseCount > 0 ? (totalPercentage / courseCount).toFixed(1) : null;
                                    return average !== null ? (
                                      <span className={`font-bold text-[10px] sm:text-xs ${
                                        average >= 75 ? 'text-green-600 dark:text-green-400' :
                                        average >= 50 ? 'text-amber-600 dark:text-amber-400' :
                                        'text-red-600 dark:text-red-400'
                                      }`}>
                                        {average}%
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-[10px] sm:text-xs">-</span>
                                    );
                                  })()}
                                </td>
                              </tr>
                            );
                          })}
                          
                          {/* Class Average Row */}
                          <tr className="bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 font-bold">
                            <td className="px-2 sm:px-3 py-2 sm:py-3 text-[10px] sm:text-xs text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-600 sticky left-0 bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 z-20 whitespace-nowrap font-bold">
                              Class Average
                            </td>
                            <td className="px-2 sm:px-3 py-2 sm:py-3 border-t-2 border-slate-300 dark:border-slate-600 bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30"></td>
                            {overviewData.courses.map(course => {
                              let totalRate = 0;
                              let count = 0;
                              overviewData.students.forEach(student => {
                                const courseData = student.courses.find(c => c.courseId === course._id);
                                if (courseData) {
                                  totalRate += parseFloat(courseData.attendanceRate);
                                  count++;
                                }
                              });
                              const avgRate = count > 0 ? (totalRate / count).toFixed(1) : null;
                              
                              return (
                                <td key={course._id} className="px-2 sm:px-3 py-2 sm:py-3 text-center border-t-2 border-slate-300 dark:border-slate-600">
                                  {avgRate !== null ? (
                                    <span className={`font-bold text-[10px] sm:text-xs ${
                                      avgRate >= 75 ? 'text-green-600 dark:text-green-400' :
                                      avgRate >= 50 ? 'text-amber-600 dark:text-amber-400' :
                                      'text-red-600 dark:text-red-400'
                                    }`}>
                                      {avgRate}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[10px] sm:text-xs">-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-2 sm:px-3 py-2 sm:py-3 text-center border-t-2 border-slate-300 dark:border-slate-600 bg-cyan-100 dark:bg-cyan-900/40">
                              {(() => {
                                let overallTotal = 0;
                                let overallCount = 0;
                                overviewData.courses.forEach(course => {
                                  let totalRate = 0;
                                  let count = 0;
                                  overviewData.students.forEach(student => {
                                    const courseData = student.courses.find(c => c.courseId === course._id);
                                    if (courseData) {
                                      totalRate += parseFloat(courseData.attendanceRate);
                                      count++;
                                    }
                                  });
                                  if (count > 0) {
                                    overallTotal += (totalRate / count);
                                    overallCount++;
                                  }
                                });
                                const overallAvg = overallCount > 0 ? (overallTotal / overallCount).toFixed(1) : null;
                                
                                return overallAvg !== null ? (
                                  <span className={`font-bold text-xs sm:text-sm ${
                                    overallAvg >= 75 ? 'text-green-600 dark:text-green-400' :
                                    overallAvg >= 50 ? 'text-amber-600 dark:text-amber-400' :
                                    'text-red-600 dark:text-red-400'
                                  }`}>
                                    {overallAvg}%
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px] sm:text-xs">-</span>
                                );
                              })()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                  </div>
                </div>
              )
            ) : null}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
