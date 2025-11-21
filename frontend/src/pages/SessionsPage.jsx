import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Plus, RefreshCw, PlayCircle, XCircle, Edit, Trash2 } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CustomSelect } from '../components/CustomSelect';
import { useNotification } from '../contexts/NotificationContext';

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

export const SessionsPage = () => {
  const { showSuccess, showError, showWarning } = useNotification();
  const [courses, setCourses] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(null);
  const coursesLoadedRef = useRef(false);
  const isRestoringRef = useRef(false);

  // Extract year and semester from course code
  const getYearSemesterFromCode = (code) => {
    if (!code || typeof code !== 'string') return null;
    const match = code.match(/^[A-Za-z]+(\d)(\d)/);
    if (!match) return null;
    return { year: Number(match[1]), semester: Number(match[2]) };
  };

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

  // Filter courses by selected department, year, and semester
  const filteredCourses = useMemo(() => {
    if (!selectedDepartment || !selectedYear) return [];
    let filtered = courses.filter(c => c.department === selectedDepartment);
    
    // Filter by year (required)
    filtered = filtered.filter(c => c.year === Number(selectedYear));
    
    // Filter by semester if selected (optional - empty means all semesters)
    if (selectedSemester) {
      filtered = filtered.filter(c => c.semester === Number(selectedSemester));
    }
    
    return filtered;
  }, [courses, selectedDepartment, selectedYear, selectedSemester]);
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

  const loadCourses = async () => {
    try {
      const res = await apiClient.get('/api/courses');
      const list = res.data || [];
      setCourses(list);
      coursesLoadedRef.current = true;
      
      // Cache courses
      sessionStorage.setItem('sessions_courses', JSON.stringify({
        data: list,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error(e);
      showError(e.message || 'Failed to load courses', 'Error Loading Courses');
    }
  };

  // Helper to create date from date string and time string
  const getSessionDateTime = (dateString, timeString) => {
    if (!dateString || !timeString) return null;
    const [hour, minute] = timeString.split(':').map(Number);
    const dateTime = new Date(dateString);
    dateTime.setHours(hour, minute, 0, 0);
    return dateTime;
  };

  // Check if a session has started (current time >= startTime on session date)
  const isSessionStarted = (session) => {
    if (!session.date || !session.startTime) return false;
    
    const now = new Date();
    const sessionStartDate = getSessionDateTime(session.date, session.startTime);
    if (!sessionStartDate) return false;
    
    return now >= sessionStartDate;
  };

  // Check if a session has ended (current time > endTime on session date, accounting for midnight rollover)
  const isSessionEnded = (session) => {
    if (!session.date || !session.startTime || !session.endTime) return false;
    
    const now = new Date();
    const sessionStartDate = getSessionDateTime(session.date, session.startTime);
    let sessionEndDate = getSessionDateTime(session.date, session.endTime);
    
    if (!sessionStartDate || !sessionEndDate) return false;
    
    // If end time is earlier than start time (e.g., 23:15 -> 00:15), session spans midnight
    // So end time is on the next day
    if (sessionEndDate < sessionStartDate) {
      sessionEndDate.setDate(sessionEndDate.getDate() + 1);
    }
    
    return now > sessionEndDate;
  };

  // Check if a session should be live (started but not ended)
  const shouldBeLive = (session) => {
    return isSessionStarted(session) && !isSessionEnded(session);
  };

  const loadSessions = useCallback(async (courseId) => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/api/courses/${courseId}/sessions`);
      const sessionsData = res.data || [];
      setSessions(sessionsData);
      
      // Cache sessions for this course
      sessionStorage.setItem(`sessions_${courseId}`, JSON.stringify({
        data: sessionsData,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error(e);
      showError(e.message || 'Failed to load sessions', 'Error Loading Sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAllCourseSessions = useCallback(async () => {
    if (filteredCourses.length === 0) {
      setSessions([]);
      return;
    }

    try {
      setLoading(true);
      // Load sessions for all filtered courses
      const allSessions = await Promise.all(
        filteredCourses.map(async (course) => {
          try {
            const res = await apiClient.get(`/api/courses/${course._id}/sessions`);
            const sessions = res.data || [];
            // Ensure each session has courseId populated with at least code and name
            return sessions.map(session => ({
              ...session,
              courseId: session.courseId || {
                _id: course._id,
                code: course.code,
                name: course.name
              }
            }));
          } catch (e) {
            console.error(`Failed to load sessions for ${course.code}:`, e);
            return [];
          }
        })
      );
      
      // Flatten and sort by date (newest first), then by start time
      const flatSessions = allSessions.flat().sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        return b.startTime.localeCompare(a.startTime);
      });
      
      setSessions(flatSessions);
    } catch (e) {
      console.error('Failed to load sessions:', e);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [filteredCourses]);

  // Automatically update session statuses (scheduled -> live -> closed)
  const checkAndUpdateSessionStatuses = useCallback(async (sessionsList) => {
    if (!selectedCourseId) return;
    
    const updates = [];
    
    // Check for sessions that should be closed (ended)
    const expiredSessions = sessionsList.filter(s => 
      (s.status === 'live' || s.status === 'scheduled') && isSessionEnded(s)
    );

    // Check for sessions that should be live (started but not ended)
    const sessionsToLive = sessionsList.filter(s => 
      s.status === 'scheduled' && shouldBeLive(s)
    );

    // Update expired sessions to closed
    if (expiredSessions.length > 0) {
      expiredSessions.forEach(session => {
        updates.push(
          apiClient.patch(`/api/sessions/${session._id}/status`, { status: 'closed' })
            .catch(err => console.error(`Failed to close session ${session._id}:`, err))
        );
      });
    }

    // Update scheduled sessions to live when start time arrives
    if (sessionsToLive.length > 0) {
      sessionsToLive.forEach(session => {
        updates.push(
          apiClient.patch(`/api/sessions/${session._id}/status`, { status: 'live' })
            .catch(err => console.error(`Failed to set session ${session._id} to live:`, err))
        );
      });
    }

    if (updates.length > 0) {
      await Promise.all(updates);
      
      // Reload sessions after updating statuses
      await loadSessions(selectedCourseId);
    }
  }, [selectedCourseId, loadSessions]);

  // Restore filter selections from sessionStorage on mount
  useEffect(() => {
    const savedFilters = sessionStorage.getItem('sessions_filters');
    if (savedFilters) {
      try {
        isRestoringRef.current = true;
        const filters = JSON.parse(savedFilters);
        if (filters.faculty) setSelectedFaculty(filters.faculty);
        if (filters.department) setSelectedDepartment(filters.department);
        if (filters.year) setSelectedYear(filters.year);
        if (filters.semester) setSelectedSemester(filters.semester);
        if (filters.courseId) setSelectedCourseId(filters.courseId);
        // Reset the flag after a short delay to allow state updates
        setTimeout(() => {
          isRestoringRef.current = false;
        }, 100);
      } catch (e) {
        console.error('Error restoring filters:', e);
        isRestoringRef.current = false;
      }
    }
  }, []);

  // Save filter selections to sessionStorage whenever they change
  useEffect(() => {
    const filters = {
      faculty: selectedFaculty,
      department: selectedDepartment,
      year: selectedYear,
      semester: selectedSemester,
      courseId: selectedCourseId
    };
    sessionStorage.setItem('sessions_filters', JSON.stringify(filters));
  }, [selectedFaculty, selectedDepartment, selectedYear, selectedSemester, selectedCourseId]);

  useEffect(() => {
    // Check cache for courses
    const cacheKey = 'sessions_courses';
    const cached = sessionStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        
        if (age < CACHE_DURATION) {
          setCourses(data);
          coursesLoadedRef.current = true;
          
          // Refresh in background if older than 1 minute
          if (age > 60 * 1000) {
            loadCourses();
          }
          return;
        }
      } catch (e) {
        console.error('Cache error:', e);
      }
    }
    
    if (!coursesLoadedRef.current) {
      loadCourses();
    }
  }, []);

  // Reset course when department, year, or semester changes (but not during restoration)
  useEffect(() => {
    if (isRestoringRef.current) return; // Don't reset during restoration
    setSelectedCourseId('');
    setSessions([]);
  }, [selectedDepartment, selectedYear, selectedSemester]);

  useEffect(() => {
    if (selectedYear && selectedDepartment) {
      // If no specific course selected, load sessions for all filtered courses
      if (!selectedCourseId && filteredCourses.length > 0) {
        loadAllCourseSessions();
      } else if (selectedCourseId) {
        // Check cache for sessions
        const cacheKey = `sessions_${selectedCourseId}`;
        const cached = sessionStorage.getItem(cacheKey);
        
        if (cached) {
          try {
            const { data, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;
            
            if (age < CACHE_DURATION) {
              setSessions(data);
              
              // Check and update session statuses even from cache
              checkAndUpdateSessionStatuses(data);
              
              // Refresh in background if older than 30 seconds
              if (age > 30 * 1000) {
                loadSessions(selectedCourseId);
              }
              return;
            }
          } catch (e) {
            console.error('Cache error:', e);
          }
        }
        
        loadSessions(selectedCourseId).then(() => {
          // After loading, check and update session statuses
          if (selectedCourseId) {
            const cacheKey = `sessions_${selectedCourseId}`;
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
              try {
                const { data } = JSON.parse(cached);
                checkAndUpdateSessionStatuses(data);
              } catch (e) {
                // ignore
              }
            }
          }
        });
      }
    }
  }, [selectedCourseId, selectedYear, selectedDepartment, filteredCourses, loadSessions, loadAllCourseSessions, checkAndUpdateSessionStatuses]);

  // Periodically check and update session statuses (every minute)
  useEffect(() => {
    if (!selectedCourseId || sessions.length === 0) return;

    const interval = setInterval(() => {
      checkAndUpdateSessionStatuses(sessions);
    }, 60 * 1000); // Check every minute

    return () => clearInterval(interval);
  }, [selectedCourseId, sessions, checkAndUpdateSessionStatuses]);

  const createSession = async (e) => {
    e.preventDefault();
    if (!selectedCourseId) {
      showWarning('Please select a course first', 'Course Required');
      return;
    }
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
      showSuccess('Session created successfully!', 'Success');
      // Clear cache and reload
      sessionStorage.removeItem(`sessions_${selectedCourseId}`);
      await loadSessions(selectedCourseId);
    } catch (e) {
      showError(e.message || 'Failed to create session', 'Creation Failed');
    } finally {
      setCreating(false);
    }
  };

  const setStatus = async (sessionId, status) => {
    try {
      await apiClient.patch(`/api/sessions/${sessionId}/status`, { status });
      showSuccess(`Session status updated to ${status}`, 'Status Updated');
      // Clear cache and reload
      sessionStorage.removeItem(`sessions_${selectedCourseId}`);
      await loadSessions(selectedCourseId);
    } catch (e) {
      showError(e.message || 'Failed to update status', 'Update Failed');
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
      showSuccess('Session updated successfully!', 'Success');
      // Clear cache and reload
      sessionStorage.removeItem(`sessions_${selectedCourseId}`);
      await loadSessions(selectedCourseId);
    } catch (err) {
      showError(err.message || 'Failed to update session', 'Update Failed');
    }
  };

  const remove = async (s) => {
    if (!confirm('Delete this session?')) return;
    try {
      await apiClient.delete(`/api/sessions/${s._id}`);
      showSuccess('Session deleted successfully!', 'Success');
      // Clear cache and reload
      sessionStorage.removeItem(`sessions_${selectedCourseId}`);
      await loadSessions(selectedCourseId);
    } catch (err) {
      showError(err.message || 'Failed to delete session', 'Delete Failed');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">Sessions</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Manage class sessions and go live</p>
        </div>
        
        {/* Filter Section */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            {/* Faculty Selection */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">Faculty</label>
              <CustomSelect
                value={selectedFaculty}
                onChange={(e) => {
                  setSelectedFaculty(e.target.value);
                  setSelectedDepartment('');
                  setSelectedYear('');
                  setSelectedCourseId('');
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
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setSelectedCourseId('');
                }}
                disabled={!selectedFaculty}
                placeholder={selectedFaculty ? 'Select Department' : 'Select Faculty first'}
                options={[
                  { value: '', label: selectedFaculty ? 'Select Department' : 'Select Faculty first' },
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
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setSelectedCourseId('');
                }}
                disabled={!selectedDepartment}
                placeholder={selectedDepartment ? 'Select Year' : 'Select Department first'}
                options={[
                  { value: '', label: selectedDepartment ? 'Select Year' : 'Select Department first' },
                  ...([1, 2, 3, 4].map(y => ({
                    value: String(y),
                    label: `Year ${y}`
                  })))
                ]}
                className="w-full min-w-0"
              />
            </div>

            {/* Semester Selection */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">Semester</label>
              <CustomSelect
                value={selectedSemester}
                onChange={(e) => {
                  setSelectedSemester(e.target.value);
                  setSelectedCourseId('');
                }}
                disabled={!selectedYear}
                placeholder={selectedYear ? 'All Semesters' : 'Select Year first'}
                options={[
                  { value: '', label: selectedYear ? 'All Semesters' : 'Select Year first' },
                  { value: '1', label: 'Semester 1' },
                  { value: '2', label: 'Semester 2' }
                ]}
                className="w-full min-w-0"
              />
            </div>

            {/* Course Selection */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <label className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">Course</label>
              <CustomSelect
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                disabled={!selectedYear}
                placeholder={selectedYear ? 'All Courses' : 'Select Year first'}
                options={[
                  { value: '', label: selectedYear ? 'All Courses' : 'Select Year first' },
                  ...filteredCourses.map(c => ({
                    value: c._id,
                    label: `${c.code} - ${c.name}`
                  }))
                ]}
                className="w-full min-w-0"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button 
              onClick={() => selectedCourseId ? loadSessions(selectedCourseId) : loadAllCourseSessions()} 
              disabled={!selectedYear || !selectedDepartment} 
              className="w-full sm:w-auto px-3 sm:px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> 
              <span>Refresh</span>
            </button>
            <button 
              onClick={()=>setShowCreate(true)} 
              disabled={!selectedCourseId} 
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4" /> 
              <span>New Session</span>
            </button>
          </div>
        </div>
      </div>

      {/* Warning for sessions without year/semester */}
      {selectedCourseId && sessions.length > 0 && sessions.some(s => !s.year || !s.semester) && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h4 className="font-semibold text-red-800 dark:text-red-200 mb-1">
                Old Sessions Detected
              </h4>
              <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                Some sessions are missing year/semester data. Students cannot attend these sessions.
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">
                <strong>Solution:</strong> Run the migration script: <code className="bg-red-100 dark:bg-red-900/40 px-2 py-1 rounded">node backend/src/scripts/migrateSessionsYearSemester.js</code>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        {!selectedYear || !selectedDepartment ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            {!selectedFaculty ? (
              <p>Please select Faculty, Department, and Year to view sessions</p>
            ) : !selectedDepartment ? (
              <p>Please select Department and Year to view sessions</p>
            ) : !selectedYear ? (
              <p>Please select Year to view sessions</p>
            ) : (
              <p>Please select filters to view sessions</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Course</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Room</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Batch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <LoadingSpinner size="lg" className="text-cyan-600" />
                        <span className="text-slate-500 dark:text-slate-400">Loading sessions...</span>
                      </div>
                    </td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500">No sessions</td></tr>
                ) : (
                  sessions.map(s => (
                    <tr key={s._id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                        {s.courseId?.code || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{s.date}</td>
                      <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{s.startTime} - {s.endTime}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{s.room}</td>
                      <td className="px-6 py-4 text-sm">
                        {s.year && s.semester ? (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            Y{s.year}S{s.semester}
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" title="Missing year/semester - students cannot attend">
                            ⚠️ Missing
                          </span>
                        )}
                      </td>
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
                  <input 
                    type="time" 
                    required 
                    value={form.startTime} 
                    onChange={(e) => {
                      const value = e.target.value;
                      // Calculate end time as 1 hour after start time
                      const end = value ? addMinutesLocal(value, 60) : '';
                      setForm({...form, startTime: value, endTime: end});
                    }}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white" 
                  />
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
                  <input 
                    type="time" 
                    required 
                    value={form.startTime} 
                    onChange={(e) => setForm({...form, startTime: e.target.value})} 
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white" 
                  />
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


