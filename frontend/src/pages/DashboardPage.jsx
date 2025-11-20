import { useState, useEffect, useRef } from 'react';
import { Activity, Users, Clock, UserX, TrendingUp, Trophy, AlertCircle, Plus } from 'lucide-react';
import { LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MonthlyPie } from '../components/Charts/MonthlyPie';
import { useMonthlyAnalytics } from '../hooks/useMonthlyAnalytics';
import { useScanStream } from '../hooks/useScanStream';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { CustomSelect } from '../components/CustomSelect';

// Cache duration: 2 minutes for dashboard data
const CACHE_DURATION = 2 * 60 * 1000;
const cacheKey = 'dashboard_data';

export const DashboardPage = () => {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data: analytics } = useMonthlyAnalytics(currentMonth);
  const { connected, lastScan, sessionStatus } = useScanStream();
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [topAttendees, setTopAttendees] = useState([]);
  const [bottomAttendees, setBottomAttendees] = useState([]);
  const [bannerScan, setBannerScan] = useState(null);
  const [courses, setCourses] = useState([]);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadingTop, setLoadingTop] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [batchLineLoading, setBatchLineLoading] = useState(false);
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
    courseId: '',
    date: new Date().toISOString().slice(0, 10),
    startTime: startDefault,
    endTime: endDefault,
    room: 'LAB-1',
    goLive: true
  });

  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [batchLine, setBatchLine] = useState([]);
  const hasLoadedRef = useRef(false);

  // Load each section independently
  useEffect(() => {
    const initialize = async () => {
      // Check cache first
      const cached = sessionStorage.getItem(cacheKey);
      const now = Date.now();
      
      if (cached) {
        try {
          const { data, timestamp } = JSON.parse(cached);
          const age = now - timestamp;
          
          if (age < CACHE_DURATION && !hasLoadedRef.current) {
            // Use cached data immediately
            setTopAttendees(data.topAttendees || []);
            setBottomAttendees(data.bottomAttendees || []);
            setCourses(data.courses || []);
            setBatches(data.batches || []);
            if (data.courses?.length > 0 && !form.courseId) {
              setForm((f) => ({ ...f, courseId: data.courses[0]._id }));
            }
            hasLoadedRef.current = true;
            setLoadingDashboard(false);
            
            // Refresh in background if data is older than 1 minute
            if (age > 60 * 1000) {
              loadAllSectionsIndependently();
            }
            return;
          }
        } catch (e) {
          console.error('Cache parse error:', e);
        }
      }

      // Load all sections independently (not waiting for each other)
      if (!hasLoadedRef.current) {
        loadAllSectionsIndependently();
      }
    };

    const loadAllSectionsIndependently = () => {
      // Load each section independently - they don't wait for each other
    loadTopAttendees();
    loadCourses();
    loadBatches();
      loadLive();
      loadYearWise();
    };

    initialize();
  }, []);

  const loadTopAttendees = async () => {
    try {
      setLoadingTop(true);
      const [top, bottom] = await Promise.all([
        apiClient.get('/api/analytics/top-attendees?limit=3&type=top'),
        apiClient.get('/api/analytics/top-attendees?limit=3&type=bottom')
      ]);
      setTopAttendees(top.data);
      setBottomAttendees(bottom.data);
      
      // Update cache
      updateCache('topAttendees', top.data, 'bottomAttendees', bottom.data);
    } catch (error) {
      console.error('Error loading attendees:', error);
    } finally {
      setLoadingTop(false);
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        setLoadingDashboard(false);
      }
    }
  };

  const updateCache = (key1, value1, key2, value2) => {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const cacheData = JSON.parse(cached);
      if (key1) cacheData[key1] = value1;
      if (key2) cacheData[key2] = value2;
      cacheData.timestamp = Date.now();
      sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
    } else {
      // Create new cache
      const cacheData = {
        topAttendees: [],
        bottomAttendees: [],
        courses: [],
        batches: [],
        timestamp: Date.now()
      };
      if (key1) cacheData[key1] = value1;
      if (key2) cacheData[key2] = value2;
      sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
    }
  };

  // Auto-hide scan banner after 15 seconds
  useEffect(() => {
    if (lastScan) {
      setBannerScan(lastScan);
      const t = setTimeout(() => setBannerScan(null), 15000);
      return () => clearTimeout(t);
    }
  }, [lastScan]);

  const loadCourses = async () => {
    try {
      setLoadingCourses(true);
      const res = await apiClient.get('/api/courses');
      const coursesData = res.data || [];
      setCourses(coursesData);
      if (coursesData.length > 0 && !form.courseId) {
        setForm((f) => ({ ...f, courseId: coursesData[0]._id }));
      }
      
      // Update cache
      updateCache('courses', coursesData);
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoadingCourses(false);
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        setLoadingDashboard(false);
      }
    }
  };

  const loadBatches = async () => {
    try {
      setLoadingBatches(true);
      const res = await apiClient.get('/api/batches');
      const batchesData = res || [];
      setBatches(batchesData);
      
      // Update cache
      updateCache('batches', batchesData);
    } catch (e) {
      console.error('Error loading batches:', e);
    } finally {
      setLoadingBatches(false);
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        setLoadingDashboard(false);
      }
    }
  };

  useEffect(() => {
    const fetchLine = async () => {
      if (!selectedBatch) {
        setBatchLine([]);
        return;
      }
      try {
        setBatchLineLoading(true);
        const res = await apiClient.get(`/api/analytics/batch/line?startYear=${selectedBatch}`);
        setBatchLine(res.data?.points || []);
      } catch (e) {
        console.error('Error loading batch line:', e);
        setBatchLine([]);
      } finally {
        setBatchLineLoading(false);
      }
    };
    fetchLine();
  }, [selectedBatch]);

  const createSession = async (e) => {
    e?.preventDefault();
    if (!form.courseId) return alert('Please select a course');
    setCreating(true);
    try {
      const payload = {
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room
      };
      const res = await apiClient.post(`/api/courses/${form.courseId}/sessions`, payload);
      const session = res.data;
      if (form.goLive && session?._id) {
        await apiClient.patch(`/api/sessions/${session._id}/status`, { status: 'live' });
      }
      alert('Session created successfully');
      setShowCreateSession(false);
    } catch (err) {
      alert(err.message || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const summary = analytics?.summary || [];
  const presentCount = summary.find((s) => s.name === 'Present')?.value || 0;
  const lateCount = summary.find((s) => s.name === 'Late')?.value || 0;
  const absentCount = summary.find((s) => s.name === 'Absent')?.value || 0;
  const totalScans = presentCount + lateCount;

  const [liveStats, setLiveStats] = useState(null);
  const [yearWise, setYearWise] = useState(null);
  const [loadingLive, setLoadingLive] = useState(true);
  const [loadingYearWise, setLoadingYearWise] = useState(true);

  useEffect(() => {
    loadLive();
    loadYearWise();
  }, []);

  useEffect(() => {
    // refresh live stats on incoming scans or session status changes
    if (lastScan || sessionStatus) loadLive();
  }, [lastScan, sessionStatus]);

  const loadLive = async () => {
    try {
      setLoadingLive(true);
      const res = await apiClient.get('/api/analytics/live');
      setLiveStats(res.data);
    } catch (e) {
      console.error('Error loading live stats', e);
    } finally {
      setLoadingLive(false);
    }
  };

  const loadYearWise = async () => {
    try {
      setLoadingYearWise(true);
      const res = await apiClient.get('/api/analytics/session/year-wise');
      setYearWise(res.data);
    } catch (e) {
      console.error('Error loading year-wise', e);
    } finally {
      setLoadingYearWise(false);
    }
  };

  // Don't show full page loader - let individual sections load

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Overview</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Monthly statistics for {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {connected ? 'Live' : 'Disconnected'}
            </span>
          </div> */}
          <button
            onClick={() => setShowCreateSession(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-medium"
          >
            <Plus className="w-5 h-5" /> Create Session
          </button>
        </div>
      </div>

      {bannerScan && (
        <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 border border-cyan-200 dark:border-cyan-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-600 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-cyan-900 dark:text-cyan-100">
                {bannerScan.type === 'scan.duplicate' ? 'Duplicate Scan' : 'New Scan Detected'}
              </p>
              <p className="text-xs text-cyan-700 dark:text-cyan-300">
                {bannerScan.studentName} • {bannerScan.status.toUpperCase()} • {bannerScan.courseCode}
              </p>
            </div>
            <span className="text-xs text-cyan-600 dark:text-cyan-400">Just now</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Scans</p>
              {analytics ? (
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{totalScans}</p>
              ) : (
                <div className="mt-2">
                  <LoadingSpinner size="sm" className="text-cyan-600" />
                </div>
              )}
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Present</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{presentCount}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Late</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">{lateCount}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Absent</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{absentCount}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <UserX className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-600" />
            Monthly Attendance Distribution
          </h4>
          {analytics ? (
          <MonthlyPie data={summary} />
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <LoadingSpinner size="lg" className="text-cyan-600" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Loading analytics...</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
            <h4 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">Batch Trend (Last 12 months)</h4>
            {loadingBatches ? (
              <LoadingSpinner size="sm" className="text-cyan-600" />
            ) : (
            <CustomSelect
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              placeholder="Select batch"
              options={[
                { value: '', label: 'Select batch' },
                ...batches.map(b => ({
                  value: b.startYear,
                  label: b.name || b.startYear
                }))
              ]}
              className="w-full sm:w-auto"
            />
            )}
          </div>
          {loadingBatches ? (
            <div className="h-64 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <LoadingSpinner size="lg" className="text-cyan-600" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Loading batches...</span>
              </div>
            </div>
          ) : (!selectedBatch) ? (
            <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">Select a batch to view</div>
          ) : batchLineLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <LoadingSpinner size="lg" className="text-cyan-600" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Loading trend data...</span>
              </div>
            </div>
          ) : (batchLine?.length ?? 0) === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ReLineChart data={batchLine} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="present" name="Present" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="late" name="Late" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="absent" name="Absent" stroke="#ef4444" strokeWidth={2} dot={false} />
              </ReLineChart>
            </ResponsiveContainer>
          )}
        </div>

        {loadingLive ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Current Live Session</h4>
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <LoadingSpinner size="lg" className="text-cyan-600" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Loading live session...</span>
              </div>
            </div>
          </div>
        ) : liveStats?.session ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Current Live Session</h4>
          {liveStats?.session ? (
            <div className="space-y-4">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-900 dark:text-white">{liveStats.session.courseCode}</span> — {liveStats.session.courseName}<br />
                {liveStats.session.date} • {liveStats.session.startTime} - {liveStats.session.endTime}
              </div>
              <MonthlyPie data={liveStats.summary} />
              {liveStats.images?.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Recent Captures</h5>
                  <div className="grid grid-cols-3 gap-2">
                    {liveStats.images.map((src, i) => (
                      <img key={i} src={src} alt="scan" className="w-full h-20 object-cover rounded" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-slate-500 dark:text-slate-400">No live session</p>
          )}
        </div>
        ) : loadingYearWise ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Last Session Summary</h4>
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <LoadingSpinner size="lg" className="text-cyan-600" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Loading session data...</span>
              </div>
            </div>
        </div>
        ) : yearWise?.session ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Last Session Summary</h4>
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            <span className="font-medium text-slate-900 dark:text-white">{yearWise.session.courseCode}</span> — {yearWise.session.courseName}<br />
            {yearWise.session.date} • {yearWise.session.startTime} - {yearWise.session.endTime}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {yearWise.perYear?.map((y) => (
              <div key={y.year} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Year {y.year}</div>
                <div className="text-sm"><span className="text-green-600">Present:</span> {y.present}</div>
                <div className="text-sm"><span className="text-amber-600">Late:</span> {y.late}</div>
                <div className="text-sm"><span className="text-red-600">Absent:</span> {y.absent}</div>
              </div>
            ))}
          </div>
        </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <p className="text-slate-500 dark:text-slate-400">No session data</p>
          </div>
        )}
      </div>

      {showCreateSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-xl w-full overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Create Session</h3>
              <button onClick={() => setShowCreateSession(false)} className="text-slate-500 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={createSession} className="p-5 space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Course</label>
                <CustomSelect
                  value={form.courseId}
                  onChange={(e) => setForm({ ...form, courseId: e.target.value })}
                  placeholder="Select Course"
                  options={courses.map((c) => ({
                    value: c._id,
                    label: `${c.code} - ${c.name}`
                  }))}
                  className="w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Room</label>
                  <input
                    type="text"
                    required
                    value={form.room}
                    onChange={(e) => setForm({ ...form, room: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white"
                  />
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
                      const [h, m] = value.split(':').map(Number);
                      const d = new Date();
                      d.setHours(h || 0, m || 0, 0, 0);
                      const rounded = roundToQuarter(d);
                      const start = toTimeString(rounded);
                      const end = addMinutesLocal(start, 60);
                      setForm({ ...form, startTime: start, endTime: end });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.goLive}
                  onChange={(e) => setForm({ ...form, goLive: e.target.checked })}
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Set status to Live after create</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateSession(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Cancel</button>
                <button type="submit" disabled={creating} className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all">
                  {creating ? 'Creating...' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-green-600" />
            Top 3 Attendees
          </h4>
          {loadingTop ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <LoadingSpinner size="lg" className="text-cyan-600" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Loading...</span>
              </div>
            </div>
          ) : (
          <div className="space-y-3">
            {topAttendees.map((item, index) => (
              <div key={item.student.id} className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="w-8 h-8 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  #{index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">{item.student.name}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{item.student.registrationNo} • {item.student.department}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">{item.attendancePercentage}%</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.attendedSessions}/{item.totalSessions}</p>
                </div>
              </div>
            ))}
            {topAttendees.length === 0 && (
              <p className="text-slate-500 dark:text-slate-400 text-center py-8">No data available</p>
            )}
          </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            Bottom 3 Attendees (Need Attention)
          </h4>
          {loadingTop ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <LoadingSpinner size="lg" className="text-cyan-600" />
                <span className="text-sm text-slate-500 dark:text-slate-400">Loading...</span>
              </div>
            </div>
          ) : (
          <div className="space-y-3">
            {bottomAttendees.map((item, index) => (
              <div key={item.student.id} className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-rose-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                  #{index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">{item.student.name}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{item.student.registrationNo} • {item.student.department}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-red-600">{item.attendancePercentage}%</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.attendedSessions}/{item.totalSessions}</p>
                </div>
              </div>
            ))}
            {bottomAttendees.length === 0 && (
              <p className="text-slate-500 dark:text-slate-400 text-center py-8">No data available</p>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
};
