import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Plus, RefreshCw, Eye, Edit, Trash2 } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CustomSelect } from '../components/CustomSelect';
import { useNotification } from '../contexts/NotificationContext';

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

export const SessionsPage = () => {
  const { showSuccess, showError, showWarning } = useNotification();
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(null);
  const coursesLoadedRef = useRef(false);
  const isRestoringRef = useRef(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [batchActiveSessions, setBatchActiveSessions] = useState({});
  const [activeGlobalSessions, setActiveGlobalSessions] = useState([]);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingSession, setViewingSession] = useState(null);
  const [sessionRelations, setSessionRelations] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());



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

  const BATCHES_CACHE_KEY = 'sessions_batches_cache';
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

  // Check if session has relations
  const checkSessionRelations = async (sessionId) => {
    try {
      const response = await apiClient.get(`/api/sessions/${sessionId}/relations`);
      const data = response.data?.data || {};
      
      // Ensure we always return a proper structure
      return {
        hasRelatedData: data.hasRelatedData || false,
        relatedData: data.relatedData || {
          attendanceRecords: 0,
          scanRecords: 0,
          activeDevices: 0
        }
      };
    } catch (e) {
      console.error('Failed to check session relations:', e.message);
      // Return default structure on error
      return {
        hasRelatedData: false,
        relatedData: {
          attendanceRecords: 0,
          scanRecords: 0,
          activeDevices: 0
        }
      };
    }
  };

  // Load session relations for all sessions
  const loadSessionRelations = async (sessionsList) => {
    try {
      const relations = {};
      
      const relationPromises = sessionsList.map(async (session) => {
        try {
          const sessionRelation = await checkSessionRelations(session._id);
          relations[session._id] = sessionRelation;
        } catch (error) {
          console.error('Error checking relations for session', session._id, ':', error);
          // Default to no relations if API call fails
          relations[session._id] = { hasRelatedData: false };
        }
      });
      
      await Promise.all(relationPromises);
      setSessionRelations(relations);
    } catch (e) {
      console.error('Failed to load session relations:', e);
      // Set default relations for all sessions if the entire operation fails
      const defaultRelations = {};
      sessionsList.forEach(session => {
        defaultRelations[session._id] = { hasRelatedData: false };
      });
      setSessionRelations(defaultRelations);
    }
  };

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

  // Helper function to get faculty name from department
  const getFacultyFromDepartment = (departmentName) => {
    for (const [facultyName, facultyData] of Object.entries(facultyStructure)) {
      const found = facultyData.departments.find(d => d.name === departmentName);
      if (found) return facultyName;
    }
    return null;
  };

  // Load active sessions count for all batches
  const loadBatchActiveSessions = async (batchesList) => {
    try {
      // Get today's date
      const today = new Date().toISOString().slice(0, 10);

      // Fetch all sessions for today
      const res = await apiClient.get('/api/analytics/current-sessions');
      const currentSessions = res.data?.data || res.data || [];

      // Count active sessions per batch (department + year + semester)
      const activeSessionsMap = {};

      batchesList.forEach(batch => {
        const batchKey = `${batch.department}-${batch.currentYear}-${batch.currentSemester}`;
        const count = currentSessions.filter(s =>
          s.department === batch.department &&
          s.year === batch.currentYear &&
          s.semester === batch.currentSemester &&
          s.status === 'live'
        ).length;

        activeSessionsMap[batchKey] = count;
      });

      setBatchActiveSessions(activeSessionsMap);
      setActiveGlobalSessions(currentSessions);
    } catch (error) {
      console.error('Error loading batch active sessions:', error);
      setBatchActiveSessions({});
    }
  };

  // Filter courses by selected batch (department, year, semester)
  const filteredCourses = useMemo(() => {
    if (!selectedBatch) return [];

    let filtered = courses.filter(c => c.department === selectedBatch.department);

    // Filter by year and semester from course code
    filtered = filtered.filter(c => {
      const yearInfo = getYearSemesterFromCode(c.code);
      return yearInfo?.year === selectedBatch.currentYear &&
        yearInfo?.semester === selectedBatch.currentSemester;
    });

    return filtered;
  }, [courses, selectedBatch]);

  // Check if there are any active (live or scheduled) sessions for the selected batch
  const activeSessions = useMemo(() => {
    if (!selectedBatch) return [];
    return sessions.filter(s =>
      s.status === 'live' || s.status === 'scheduled'
    );
  }, [sessions, selectedBatch]);

  const hasActiveSessions = activeSessions.length > 0;

  // Pagination logic
  const totalPages = Math.ceil(sessions.length / ITEMS_PER_PAGE);
  const paginatedSessions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sessions.slice(startIndex, endIndex);
  }, [sessions, currentPage]);

  // Reset to page 1 when sessions change
  useEffect(() => {
    setCurrentPage(1);
  }, [sessions]);
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
      showError(e.message || 'Failed to load courses');
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

  // Calculate time remaining until session goes live (at exact start time)
  const getTimeUntilLive = (session) => {
    if (!session.date || !session.startTime) return null;

    const now = new Date();
    const sessionStartDate = getSessionDateTime(session.date, session.startTime);
    if (!sessionStartDate) return null;

    const diffMs = sessionStartDate.getTime() - now.getTime();
    
    if (diffMs <= 0) return null; // Already time to go live

    const diffMinutes = Math.ceil(diffMs / (60 * 1000));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
  };

  const loadSessions = useCallback(async (courseId) => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/api/courses/${courseId}/sessions`);
      const sessionsData = res.data || [];
      setSessions(sessionsData);

      // Load relations for all sessions
      await loadSessionRelations(sessionsData);

      // Cache sessions for this course
      sessionStorage.setItem(`sessions_${courseId}`, JSON.stringify({
        data: sessionsData,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error(e);
      showError(e.message || 'Failed to load sessions');
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
      
      // Load relations for all sessions
      await loadSessionRelations(flatSessions);
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
    // Only update to live if the session has actually started (at exact start time)
    const sessionsToLive = sessionsList.filter(s => {
      if (s.status !== 'scheduled') return false;
      
      return shouldBeLive(s);
    });

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

            // Always fetch active sessions status to ensure indicators are correct
            loadBatchActiveSessions(data || []);

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

        // Load active sessions count for each batch
        await loadBatchActiveSessions(batchesData);

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

  // Restore filter selections from sessionStorage on mount
  useEffect(() => {
    const savedFilters = sessionStorage.getItem('sessions_filters');
    if (savedFilters) {
      try {
        isRestoringRef.current = true;
        const filters = JSON.parse(savedFilters);
        if (filters.batchId) {
          // Find and set the batch
          const batch = batches.find(b => b._id === filters.batchId);
          if (batch) setSelectedBatch(batch);
        }
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
  }, [batches]);

  // Save filter selections to sessionStorage whenever they change
  useEffect(() => {
    const filters = {
      batchId: selectedBatch?._id || '',
      courseId: selectedCourseId
    };
    sessionStorage.setItem('sessions_filters', JSON.stringify(filters));
  }, [selectedBatch, selectedCourseId]);

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

  // Reset course when batch changes (but not during restoration)
  useEffect(() => {
    if (isRestoringRef.current) return; // Don't reset during restoration
    setSelectedCourseId('');
    setSessions([]);
  }, [selectedBatch]);

  useEffect(() => {
    if (selectedBatch) {
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
  }, [selectedCourseId, selectedBatch, filteredCourses, loadSessions, loadAllCourseSessions, checkAndUpdateSessionStatuses]);

  // Update current time every minute to refresh countdown timers
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60 * 1000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Periodically check and update session statuses (every minute)
  useEffect(() => {
    if (!selectedCourseId || sessions.length === 0) return;

    const interval = setInterval(() => {
      checkAndUpdateSessionStatuses(sessions);
    }, 60 * 1000); // Check every minute

    return () => clearInterval(interval);
  }, [selectedCourseId, sessions, checkAndUpdateSessionStatuses]);

  // Check if there's a room conflict within the same faculty
  const checkRoomConflict = async (date, startTime, endTime, room, department) => {
    try {
      // Fetch ALL sessions for the given date and room to check conflicts across all departments
      const response = await apiClient.get('/api/sessions', {
        params: {
          date,
          room,
          status: ['live', 'scheduled'] // Only check active sessions
        }
      });

      const allSessions = response.data || [];

      // Filter for conflicts within the same department only
      const conflictingSessions = allSessions.filter(s => {
        // Skip closed sessions
        if (s.status === 'closed') return false;

        // Must be same date and room (already filtered by API, but double-check)
        if (s.date !== date || s.room !== room) return false;

        // Get the department from the session's course
        // The courseId might be populated or just an ID
        let sessionDept = null;
        if (s.courseId) {
          if (typeof s.courseId === 'object') {
            sessionDept = s.courseId.department;
          } else {
            // If courseId is just an ID, find it in our courses list
            const course = courses.find(c => c._id === s.courseId);
            sessionDept = course?.department;
          }
        }

        // Only check conflicts within the same department
        if (!sessionDept || sessionDept !== department) return false;

        // Check time overlap
        const newStart = getSessionDateTime(date, startTime);
        const newEnd = getSessionDateTime(date, endTime);
        const existingStart = getSessionDateTime(s.date, s.startTime);
        let existingEnd = getSessionDateTime(s.date, s.endTime);

        if (!newStart || !newEnd || !existingStart || !existingEnd) return false;

        // Handle midnight rollover for existing session
        if (existingEnd < existingStart) {
          existingEnd.setDate(existingEnd.getDate() + 1);
        }

        // Handle midnight rollover for new session
        let adjustedNewEnd = new Date(newEnd);
        if (adjustedNewEnd < newStart) {
          adjustedNewEnd.setDate(adjustedNewEnd.getDate() + 1);
        }

        // Check if times overlap: (newStart < existingEnd) && (newEnd > existingStart)
        return (newStart < existingEnd) && (adjustedNewEnd > existingStart);
      });

      return conflictingSessions;
    } catch (error) {
      console.error('Error checking room conflicts:', error);
      // Fallback to local check if API fails
      return sessions.filter(s => {
        if (s.status === 'closed') return false;
        if (s.date !== date || s.room !== room) return false;

        const sessionDept = s.courseId?.department;
        if (!sessionDept || sessionDept !== department) return false;

        const newStart = getSessionDateTime(date, startTime);
        const newEnd = getSessionDateTime(date, endTime);
        const existingStart = getSessionDateTime(s.date, s.startTime);
        let existingEnd = getSessionDateTime(s.date, s.endTime);

        if (!newStart || !newEnd || !existingStart || !existingEnd) return false;

        if (existingEnd < existingStart) {
          existingEnd.setDate(existingEnd.getDate() + 1);
        }

        let adjustedNewEnd = new Date(newEnd);
        if (adjustedNewEnd < newStart) {
          adjustedNewEnd.setDate(adjustedNewEnd.getDate() + 1);
        }

        return (newStart < existingEnd) && (adjustedNewEnd > existingStart);
      });
    }
  };

  const createSession = async (e) => {
    e.preventDefault();
    if (!selectedCourseId) {
      showConfirmation(
        'No Course Selected',
        'Please select a course first.',
        () => {},
        'warning',
        'OK',
        ''
      );
      return;
    }

    // Get the faculty/department of the selected course
    const selectedCourse = courses.find(c => c._id === selectedCourseId);
    if (!selectedCourse) {
      showError('Course not found');
      return;
    }

    setCreating(true);

    try {
      // Check for room conflicts within the same department
      const conflicts = await checkRoomConflict(
        form.date,
        form.startTime,
        form.endTime,
        form.room,
        selectedCourse.department
      );

      if (conflicts.length > 0) {
        const conflictDetails = conflicts.map(s => {
          const courseCode = typeof s.courseId === 'object' ? s.courseId?.code :
            courses.find(c => c._id === s.courseId)?.code;
          return `${courseCode || 'N/A'} (${s.startTime}-${s.endTime})`;
        }).join(', ');
        showError(`Room ${form.room} already booked on ${form.date}. Conflicts: ${conflictDetails}`);
        return;
      }

      const payload = {
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room
      };
      const res = await apiClient.post(`/api/courses/${selectedCourseId}/sessions`, payload);
      const session = res.data;
      if (form.goLive && session?._id) {
        try {
          await apiClient.patch(`/api/sessions/${session._id}/status`, { status: 'live' });
        } catch (statusError) {
          // If setting to live fails due to timing, show warning but don't fail the creation
          showWarning(`Session created but could not be set to live: ${statusError.message || 'Timing validation failed'}`);
        }
      }
      setShowCreate(false);
      showSuccess('Session created successfully!', 'Success');
      
      // Clear all relevant caches to ensure fresh data
      sessionStorage.removeItem(`sessions_${selectedCourseId}`);
      sessionStorage.removeItem(BATCHES_CACHE_KEY);
      
      // Refresh sessions and batch active sessions status
      await loadSessions(selectedCourseId);
      await loadBatchActiveSessions(batches);
      
      // Also refresh courses to update the live indicators in dropdown
      await loadCourses();
      
      // Reset form to defaults for next session
      const nowRounded = roundToQuarter(new Date());
      const startDefault = toTimeString(nowRounded);
      const endDefault = addMinutesLocal(startDefault, 60);
      setForm({
        date: new Date().toISOString().slice(0, 10),
        startTime: startDefault,
        endTime: endDefault,
        room: 'LAB-1',
        goLive: false
      });
    } catch (e) {
      showError(e.message || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const setStatus = async (sessionId, status) => {
    try {
      await apiClient.patch(`/api/sessions/${sessionId}/status`, { status });
      showSuccess(`Session status updated to ${status}`, 'Status Updated');
      
      // Clear all relevant caches to ensure fresh data
      sessionStorage.removeItem(`sessions_${selectedCourseId}`);
      sessionStorage.removeItem(BATCHES_CACHE_KEY);
      
      // Refresh sessions and batch active sessions status
      await loadSessions(selectedCourseId);
      await loadBatchActiveSessions(batches);
      
      // Also refresh courses to update the live indicators in dropdown
      await loadCourses();
    } catch (e) {
      showError(e.message || 'Failed to update status');
    }
  };

  const openView = (s) => {
    setViewingSession(s);
    setShowViewModal(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ date: s.date, startTime: s.startTime, endTime: s.endTime, room: s.room, goLive: false });
    setShowEdit(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();

    // Get the faculty/department of the session being edited
    const sessionCourse = courses.find(c => c._id === editing.courseId?._id);
    if (!sessionCourse) {
      showError('Course not found');
      return;
    }

    try {
      // Check for room conflicts (excluding the current session being edited)
      const allConflicts = await checkRoomConflict(
        form.date,
        form.startTime,
        form.endTime,
        form.room,
        sessionCourse.department
      );

      const conflicts = allConflicts.filter(s => s._id !== editing._id); // Exclude current session

      if (conflicts.length > 0) {
        const conflictDetails = conflicts.map(s => {
          const courseCode = typeof s.courseId === 'object' ? s.courseId?.code :
            courses.find(c => c._id === s.courseId)?.code;
          return `${courseCode || 'N/A'} (${s.startTime}-${s.endTime})`;
        }).join(', ');
        showError(`Room ${form.room} already booked on ${form.date}. Conflicts: ${conflictDetails}`);
        return;
      }

      await apiClient.put(`/api/sessions/${editing._id}`, {
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room
      });
      setShowEdit(false);
      setEditing(null);
      showSuccess('Session updated successfully!', 'Success');
      
      // Clear all relevant caches to ensure fresh data
      sessionStorage.removeItem(`sessions_${selectedCourseId}`);
      sessionStorage.removeItem(BATCHES_CACHE_KEY);
      
      // Refresh sessions and batch active sessions status
      await loadSessions(selectedCourseId);
      await loadBatchActiveSessions(batches);
      
      // Also refresh courses to update the live indicators in dropdown
      await loadCourses();
    } catch (err) {
      showError(err.message || 'Failed to update session');
    }
  };

  const remove = async (s) => {
    const attemptDelete = async (forceDelete = false) => {
      try {
        const url = forceDelete ? `/api/sessions/${s._id}?force=true` : `/api/sessions/${s._id}`;
        const response = await apiClient.delete(url);
        
        const message = forceDelete 
          ? 'Session and all related data deleted successfully!' 
          : 'Session deleted successfully!';
        showSuccess(message, 'Success');
        
        // Clear all relevant caches to ensure fresh data
        sessionStorage.removeItem(`sessions_${selectedCourseId}`);
        sessionStorage.removeItem(BATCHES_CACHE_KEY);
        
        // Refresh sessions and batch active sessions status
        if (selectedCourseId) {
          await loadSessions(selectedCourseId);
        } else {
          await loadAllCourseSessions();
        }
        await loadBatchActiveSessions(batches);
        
        // Also refresh courses to update the live indicators in dropdown
        await loadCourses();
      } catch (err) {
        console.error('Delete error:', err);
        
        if (err.response?.status === 409 && err.response?.data?.requiresForceDelete) {
          // Session has related data, show force delete confirmation
          const relatedData = err.response.data.relatedData || {};
          const dataDetails = [];
          
          if (relatedData.attendanceRecords > 0) {
            dataDetails.push(`${relatedData.attendanceRecords} attendance record${relatedData.attendanceRecords !== 1 ? 's' : ''}`);
          }
          if (relatedData.scanRecords > 0) {
            dataDetails.push(`${relatedData.scanRecords} scan record${relatedData.scanRecords !== 1 ? 's' : ''}`);
          }
          if (relatedData.activeDevices > 0) {
            dataDetails.push(`${relatedData.activeDevices} active device${relatedData.activeDevices !== 1 ? 's' : ''}`);
          }

          const message = dataDetails.length > 0 
            ? `This session has related data that will also be deleted:\n\n• ${dataDetails.join('\n• ')}\n\nThis action cannot be undone. Are you sure you want to proceed?`
            : 'This session has related data that will also be deleted. This action cannot be undone. Are you sure you want to proceed?';

          showConfirmation(
            'Force Delete Required',
            message,
            () => attemptDelete(true),
            'danger',
            'Delete All Data',
            'Cancel'
          );
        } else {
          showError(err.message || 'Failed to delete session');
        }
      }
    };

    // For sessions without related data, show simple confirmation
    showConfirmation(
      'Delete Session',
      `Are you sure you want to delete this session?\n\nCourse: ${s.courseId?.code || 'N/A'}\nDate: ${s.date}\nTime: ${s.startTime} - ${s.endTime}\n\nThis action cannot be undone.`,
      () => attemptDelete(false),
      'danger',
      'Delete Session',
      'Cancel'
    );
  };

  const forceRemove = async (s) => {
    // Get the relation data for this session to show specific details
    const relations = sessionRelations[s._id];
    const relatedData = relations?.relatedData || {};
    
    const dataDetails = [];
    if (relatedData.attendanceRecords > 0) {
      dataDetails.push(`• ${relatedData.attendanceRecords} attendance record${relatedData.attendanceRecords !== 1 ? 's' : ''}`);
    }
    if (relatedData.scanRecords > 0) {
      dataDetails.push(`• ${relatedData.scanRecords} scan record${relatedData.scanRecords !== 1 ? 's' : ''}`);
    }
    if (relatedData.activeDevices > 0) {
      dataDetails.push(`• ${relatedData.activeDevices} active device${relatedData.activeDevices !== 1 ? 's' : ''}`);
    }

    const detailsText = dataDetails.length > 0 
      ? `\n\nThis will delete:\n${dataDetails.join('\n')}`
      : '\n\nThis will delete all associated data.';

    showConfirmation(
      'Force Delete Session & All Data',
      `⚠️ WARNING: This will permanently delete the session and ALL related data.${detailsText}\n\nSession Details:\n• Course: ${s.courseId?.code || 'N/A'}\n• Date: ${s.date}\n• Time: ${s.startTime} - ${s.endTime}\n\nThis action cannot be undone. Are you absolutely sure?`,
      async () => {
        try {
          await apiClient.delete(`/api/sessions/${s._id}?force=true`);
          showSuccess('Session and all related data deleted successfully!', 'Force Delete Complete');
          
          // Clear all relevant caches to ensure fresh data
          sessionStorage.removeItem(`sessions_${selectedCourseId}`);
          sessionStorage.removeItem(BATCHES_CACHE_KEY);
          
          // Refresh sessions and batch active sessions status
          if (selectedCourseId) {
            await loadSessions(selectedCourseId);
          } else {
            await loadAllCourseSessions();
          }
          await loadBatchActiveSessions(batches);
          
          // Also refresh courses to update the live indicators in dropdown
          await loadCourses();
        } catch (e) {
          console.error('Force delete error:', e);
          showError(e.message || 'Failed to force delete session');
        }
      },
      'danger',
      'Yes, Delete Everything',
      'Cancel'
    );
  };

  // specific course active status helper
  const activeCourseIds = useMemo(() => {
    const ids = new Set();

    // checks activeGlobalSessions
    activeGlobalSessions.forEach(s => {
      if (s.status === 'live') {
        const cid = s.courseId?._id || s.courseId;
        if (cid) ids.add(String(cid));
      }
    });

    // checks current loaded sessions
    sessions.forEach(s => {
      if (s.status === 'live') {
        const cid = s.courseId?._id || s.courseId;
        if (cid) ids.add(String(cid));
      }
    });

    return ids;
  }, [activeGlobalSessions, sessions]);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">Sessions</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Manage class sessions and go live</p>
        </div>

        {/* Batch and Course Filter Section */}
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
                  setSelectedCourseId('');
                }}
                disabled={loadingBatches}
                loading={loadingBatches}
                placeholder={loadingBatches ? 'Loading batches...' : 'Select a batch'}
                options={[
                  { value: '', label: loadingBatches ? 'Loading batches...' : (batches.length === 0 ? 'No batches available' : 'Select a batch') },
                  ...(Array.isArray(batches) ? batches.map((b) => {
                    const faculty = getFacultyFromDepartment(b.department);
                    const facultyShort = faculty ? faculty.replace('Faculty of ', '') : '';
                    const batchKey = `${b.department}-${b.currentYear}-${b.currentSemester}`;
                    const activeCount = batchActiveSessions[batchKey] || 0;
                    const liveIndicator = activeCount > 0 ? `🟢 | ` : '';
                    const batchLabel = `${liveIndicator}${b.startYear} - ${facultyShort} - ${b.department} - Year ${b.currentYear}, Semester ${b.currentSemester}`;
                    return {
                      value: b._id,
                      label: batchLabel
                    };
                  }) : [])
                ]}
              />
            </div>

            {/* Course Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Course (Optional):</label>
              <CustomSelect
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                disabled={!selectedBatch}
                placeholder={selectedBatch ? 'All Courses' : 'Select batch first'}
                options={[
                  { value: '', label: selectedBatch ? 'All Courses' : 'Select batch first' },
                  ...filteredCourses.map(c => {
                    const isLive = activeCourseIds.has(String(c._id));

                    return {
                      value: c._id,
                      label: `${isLive ? '🟢 ' : ''}${c.code} - ${c.name}`,
                      badge: isLive ? 'Live' : null
                    };
                  })
                ]}
              />
            </div>
          </div>

          {selectedBatch && (
            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium">Selected:</span> {getFacultyFromDepartment(selectedBatch.department)?.replace('Faculty of ', '') || ''} - {selectedBatch.department} - Year {selectedBatch.currentYear}, Semester {selectedBatch.currentSemester}
                {filteredCourses.length > 0 && (
                  <span className="ml-2">• {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} available</span>
                )}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={async () => {
                // Clear all relevant caches
                if (selectedCourseId) {
                  sessionStorage.removeItem(`sessions_${selectedCourseId}`);
                }
                sessionStorage.removeItem(BATCHES_CACHE_KEY);
                
                // Refresh data
                if (selectedCourseId) {
                  await loadSessions(selectedCourseId);
                } else {
                  await loadAllCourseSessions();
                }
                await loadBatchActiveSessions(batches);
                
                // Also refresh courses to update the live indicators in dropdown
                await loadCourses();
              }}
              disabled={!selectedBatch}
              className="w-full sm:w-auto px-3 sm:px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setShowCreate(true)}
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
      {selectedBatch && sessions.length > 0 && sessions.some(s => !s.year || !s.semester) && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 sm:p-4 mb-3 sm:mb-4">
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
        {!selectedBatch ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            <p>Please select a batch to view sessions</p>
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
                  {selectedCourseId && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={selectedCourseId ? 7 : 6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <LoadingSpinner size="lg" className="text-cyan-600" />
                        <span className="text-slate-500 dark:text-slate-400">Loading sessions...</span>
                      </div>
                    </td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr><td colSpan={selectedCourseId ? 7 : 6} className="px-6 py-12 text-center text-slate-500">No sessions</td></tr>
                ) : (
                  paginatedSessions.map(s => (
                    <tr key={s._id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>{s.courseId?.code || 'N/A'}</span>
                          {sessionRelations[s._id]?.hasRelatedData && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" title="Has related data">
                              📊
                            </span>
                          )}
                        </div>
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
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${s.status === 'live' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : s.status === 'scheduled' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                            {s.status}
                          </span>
                          {s.status === 'scheduled' && (() => {
                            const timeUntil = getTimeUntilLive(s);
                            return timeUntil ? (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                Live in {timeUntil}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </td>
                      {selectedCourseId && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openView(s)} className="p-2 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg" title="View"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => openEdit(s)} className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Edit"><Edit className="w-4 h-4" /></button>
                            {(() => {
                              const relations = sessionRelations[s._id];
                              const hasRelatedData = relations?.hasRelatedData;
                              
                              // Show loading state if relations haven't been loaded yet
                              if (relations === undefined) {
                                return (
                                  <button disabled className="p-2 text-gray-400 rounded-lg" title="Loading relations...">
                                    <LoadingSpinner size="sm" />
                                  </button>
                                );
                              }
                              
                              return hasRelatedData ? (
                                <button 
                                  onClick={() => forceRemove(s)} 
                                  className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800" 
                                  title={`Force Delete Required - Has related data: ${relations.relatedData?.attendanceRecords || 0} attendance records, ${relations.relatedData?.scanRecords || 0} scan records, ${relations.relatedData?.activeDevices || 0} active devices`}
                                >
                                  <Trash2 className="w-4 h-4 stroke-2" />
                                </button>
                              ) : (
                                <button 
                                  onClick={() => remove(s)} 
                                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" 
                                  title="Delete Session (No related data)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              );
                            })()}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {selectedBatch && sessions.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sessions.length)} of {sessions.length} sessions
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
                    className={`px-3 py-1.5 text-sm rounded-lg ${currentPage === page
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

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-xl w-full overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">New Session</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={createSession} className="p-4 sm:p-5 space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                  <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Room</label>
                  <input type="text" required value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={form.startTime}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Calculate end time as 1 hour after start time
                      const end = value ? addMinutesLocal(value, 60) : '';
                      setForm({ ...form, startTime: value, endTime: end });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Time</label>
                  <input type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white text-sm" />
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.goLive} onChange={(e) => setForm({ ...form, goLive: e.target.checked })} />
                <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">Set status to Live after create</span>
              </label>
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm order-2 sm:order-1">Cancel</button>
                <button type="submit" disabled={creating} className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all text-sm order-1 sm:order-2">{creating ? 'Creating...' : 'Create'}</button>
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
              <button onClick={() => setShowEdit(false)} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={saveEdit} className="p-4 sm:p-5 space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                  <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Room</label>
                  <input type="text" required value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Time</label>
                  <input type="time" required value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white text-sm" />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-2">
                <button type="button" onClick={() => setShowEdit(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm order-2 sm:order-1">Cancel</button>
                <button type="submit" disabled={creating} className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all text-sm order-1 sm:order-2">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Session Modal */}
      {showViewModal && viewingSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Session Details</h3>
              <button onClick={() => setShowViewModal(false)} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Course</label>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {viewingSession.courseId?.code || 'N/A'}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {viewingSession.courseId?.name || 'Course name not available'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Status</label>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    viewingSession.status === 'live' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 
                    viewingSession.status === 'scheduled' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 
                    'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {viewingSession.status}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
                  <p className="text-base text-slate-900 dark:text-white">
                    {new Date(viewingSession.date).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Time</label>
                  <p className="text-base text-slate-900 dark:text-white">
                    {viewingSession.startTime} - {viewingSession.endTime}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Room</label>
                  <p className="text-base text-slate-900 dark:text-white">{viewingSession.room}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Batch</label>
                  <p className="text-base text-slate-900 dark:text-white">
                    {viewingSession.year && viewingSession.semester ? (
                      `Year ${viewingSession.year}, Semester ${viewingSession.semester}`
                    ) : (
                      <span className="text-red-600 dark:text-red-400">⚠️ Missing batch info</span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Department</label>
                  <p className="text-base text-slate-900 dark:text-white">
                    {viewingSession.courseId?.department || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Created</label>
                  <p className="text-base text-slate-900 dark:text-white">
                    {viewingSession.createdAt ? new Date(viewingSession.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 pt-0 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  openEdit(viewingSession);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all"
              >
                <Edit className="w-4 h-4" />
                Edit Session
              </button>
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

export default SessionsPage;


