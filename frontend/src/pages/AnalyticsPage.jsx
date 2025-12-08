import { useEffect, useState, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Label } from 'recharts';
import { GraduationCap, Users, BookOpen, TrendingUp, X, ChevronRight, Search, ChevronLeft } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';

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
  const [viewMode, setViewMode] = useState('courses'); // 'courses' or 'students'
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentAttendance, setStudentAttendance] = useState(null);
  const [selectedStudentCourse, setSelectedStudentCourse] = useState(null);
  const [loadingStudentId, setLoadingStudentId] = useState(null); // Track which student is loading
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [isSearching, setIsSearching] = useState(false); // Track search loading separately
  
  // Ref for debouncing search
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    loadBatchAnalytics();
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (selectedBatch) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset';
      // Clear search timeout on unmount
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [selectedBatch]);

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
      return;
    }
    
    // If clicking the same course, just toggle (collapse)
    if (selectedCourse?._id === course._id) {
      setSelectedCourse(null);
      setCourseAttendance(null);
      setLoadingCourseId(null);
      setDateRange({ startDate: '', endDate: '' });
      setIsDateFilterActive(false);
      return;
    }
    
    setSelectedCourse(course);
    setDateRange({ startDate: '', endDate: '' });
    setIsDateFilterActive(false);
    
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
      const response = await apiClient.get(
        `/api/analytics/batch/${selectedBatch.batchId}/course/${selectedCourse._id}?${params}`
      );
      setCourseAttendance(response.data || null);
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
      const response = await apiClient.get(`/api/analytics/batch/${selectedBatch.batchId}/course/${selectedCourse._id}`);
      setCourseAttendance(response.data || null);
    } catch (error) {
      console.error('Error loading course attendance:', error);
      setCourseAttendance(null);
    } finally {
      setLoadingCourseId(null);
    }
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
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Batch-wise Attendance Analytics</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Overview of attendance across all batches</p>
      </div>

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

      {/* Modal for Course Selection */}
      {selectedBatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden border-2 border-slate-300 dark:border-slate-600">
            {/* Modal Header - Compact */}
            <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">{selectedBatch.batchName}</h3>
                <p className="text-cyan-100 text-sm mt-0.5">
                  {selectedBatch.department} • Year {selectedBatch.currentYear} • Sem {selectedBatch.currentSemester}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* View Mode Toggle - Compact */}
              <div className="flex gap-2 mb-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('courses')}
                  className={`flex-1 py-2.5 px-4 rounded-md font-medium transition-all text-sm ${
                    viewMode === 'courses'
                      ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <BookOpen className="w-4 h-4 inline-block mr-1.5" />
                  Courses
                </button>
                <button
                  onClick={switchToStudentsView}
                  className={`flex-1 py-2.5 px-4 rounded-md font-medium transition-all text-sm ${
                    viewMode === 'students'
                      ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Users className="w-4 h-4 inline-block mr-1.5" />
                  Students
                </button>
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
                    <h4 className="text-base font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-cyan-600" />
                      Courses
                    </h4>
                    
                    <div className="space-y-1.5">
                      {courses.map((course) => {
                        const isExpanded = selectedCourse?._id === course._id;
                        const total = courseAttendance ? (courseAttendance.present + courseAttendance.late + courseAttendance.absent) : 0;
                        const chartData = courseAttendance ? [
                          { name: 'Present', value: courseAttendance.present, color: COLORS.present, total },
                          { name: 'Late', value: courseAttendance.late, color: COLORS.late, total },
                          { name: 'Absent', value: courseAttendance.absent, color: COLORS.absent, total }
                        ].filter(item => item.value > 0) : [];

                        return (
                          <div key={course._id} className="border-2 rounded-lg overflow-hidden transition-all bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-600 hover:shadow-md">
                            {/* Course Header - Always Visible */}
                            <button
                              onClick={() => handleCourseSelect(isExpanded ? null : course)}
                              className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h6 className="font-semibold text-slate-900 dark:text-white text-base">{course.code}</h6>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{course.name}</p>
                                  {isExpanded && courseAttendance && courseAttendance.courseId === course._id && (
                                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                                      {courseAttendance.totalSessions} {courseAttendance.totalSessions === 1 ? 'Session' : 'Sessions'} • {courseAttendance.totalStudents} {courseAttendance.totalStudents === 1 ? 'Student' : 'Students'}
                                    </p>
                                  )}
                                </div>
                                <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ml-3 ${
                                  isExpanded ? 'rotate-90' : ''
                                }`} />
                              </div>
                            </button>

                            {/* Expanded Content - Pie Chart or Loading */}
                            {isExpanded && (
                              <div className="border-t-2 border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
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
                            );
                          })()
                        ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
            ) : (
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
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
