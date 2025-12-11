import { useState, useEffect } from 'react';
import { BookOpen, Users, GraduationCap, Calendar, TrendingUp } from 'lucide-react';
import { useScanStream } from '../hooks/useScanStream';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SessionContainer } from '../components/SessionContainer';
import { SessionDetailModal } from '../components/SessionDetailModal';

// University-wide statistics component when no sessions are active
const UniversityStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUniversityStats();
  }, []);

  const loadUniversityStats = async () => {
    try {
      setLoading(true);
      // Get today's date
      const today = new Date().toISOString().slice(0, 10);

      // Fetch various statistics
      const [studentsRes, batchesRes, sessionsRes] = await Promise.all([
        apiClient.get('/api/students?limit=1'),
        apiClient.get('/api/batches'),
        apiClient.get('/api/sessions')
      ]);

      // Count total students
      const totalStudents = studentsRes.data?.total || 0;

      // Count batches
      const batches = Array.isArray(batchesRes) ? batchesRes : (batchesRes?.data || []);
      const totalBatches = batches.length;

      // Get unique departments
      const departments = [...new Set(batches.map(b => b.department))];
      const totalDepartments = departments.length;

      // Count today's sessions
      const allSessions = sessionsRes.data || [];
      const todaySessions = allSessions.filter(s => s.date === today);
      const completedToday = todaySessions.filter(s => s.status === 'closed').length;

      setStats({
        totalStudents,
        totalBatches,
        totalDepartments,
        todaySessions: todaySessions.length,
        completedToday
      });
    } catch (error) {
      console.error('Error loading university stats:', error);
      setStats({
        totalStudents: 0,
        totalBatches: 0,
        totalDepartments: 0,
        todaySessions: 0,
        completedToday: 0
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" className="text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <BookOpen className="w-16 h-16 sm:w-20 sm:h-20 text-cyan-500 mx-auto mb-4" />
        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
          No Active Sessions
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Here's an overview of your university attendance system
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8 text-white opacity-80" />
            <div className="text-right">
              <div className="text-3xl font-bold text-white">{stats.totalStudents}</div>
              <div className="text-xs text-blue-100 font-medium">Total Students</div>
            </div>
          </div>
          <div className="text-xs text-blue-100">
            Registered in the system
          </div>
        </div>

        {/* Total Batches */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <GraduationCap className="w-8 h-8 text-white opacity-80" />
            <div className="text-right">
              <div className="text-3xl font-bold text-white">{stats.totalBatches}</div>
              <div className="text-xs text-purple-100 font-medium">Active Batches</div>
            </div>
          </div>
          <div className="text-xs text-purple-100">
            Across {stats.totalDepartments} department{stats.totalDepartments !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Today's Sessions */}
        <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Calendar className="w-8 h-8 text-white opacity-80" />
            <div className="text-right">
              <div className="text-3xl font-bold text-white">{stats.todaySessions}</div>
              <div className="text-xs text-cyan-100 font-medium">Today's Sessions</div>
            </div>
          </div>
          <div className="text-xs text-cyan-100">
            {stats.completedToday} completed
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 text-white opacity-80" />
            <div className="text-right">
              <div className="text-3xl font-bold text-white">
                {stats.todaySessions > 0 ? Math.round((stats.completedToday / stats.todaySessions) * 100) : 0}%
              </div>
              <div className="text-xs text-green-100 font-medium">Completion Rate</div>
            </div>
          </div>
          <div className="text-xs text-green-100">
            Sessions completed today
          </div>
        </div>
      </div>

      {/* Info Message */}
      <div className="bg-white dark:bg-slate-900/50 rounded-xl p-6 border border-slate-200 dark:border-slate-700/50 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
              Waiting for Sessions
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              When a session goes live, it will appear here with real-time attendance tracking.
              Students can scan their IDs to mark attendance, and you'll see the statistics update instantly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DashboardPage = () => {
  const { lastScan, sessionStatus, connected } = useScanStream();
  const [currentSessions, setCurrentSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  useEffect(() => {
    loadCurrentSessions();
  }, []);

  useEffect(() => {
    // Trigger refresh whenever lastScan changes (even if it's the same object)
    if (lastScan) {
      const scanTime = lastScan.timestamp || Date.now();
      console.log('🔄 Dashboard: Scan detected, refreshing...', {
        type: lastScan.type,
        student: lastScan.student?.name,
        registrationNo: lastScan.student?.registrationNo,
        session: lastScan.session?.courseCode,
        scanTime: new Date(scanTime).toLocaleTimeString()
      });

      // Force refresh by updating timestamp
      setLastUpdateTime(Date.now());
      loadCurrentSessions();

      // If a session modal is open, update it with fresh data
      if (selectedSession) {
        setTimeout(() => {
          setCurrentSessions(prevSessions => {
            const updatedSession = prevSessions.find(s => s.id === selectedSession.id);
            if (updatedSession) {
              console.log('✅ Dashboard: Updated selected session in modal');
              setSelectedSession(updatedSession);
            }
            return prevSessions;
          });
        }, 500);
      }
    }
  }, [lastScan]);

  useEffect(() => {
    // Handle session status changes
    if (sessionStatus) {
      console.log('🔄 Dashboard: Session status changed, refreshing...', sessionStatus);
      setLastUpdateTime(Date.now());
      loadCurrentSessions();
    }
  }, [sessionStatus]);

  // Log WebSocket connection status
  useEffect(() => {
    console.log('🔌 WebSocket connection status:', connected ? 'CONNECTED ✅' : 'DISCONNECTED ❌');
  }, [connected]);

  const loadCurrentSessions = async () => {
    try {
      console.log('📡 Loading current sessions...');
      setLoadingSessions(true);
      const res = await apiClient.get('/api/analytics/current-sessions');
      console.log('📊 API Response:', res.data);

      // API returns { success: true, data: [...] }
      const sessions = res.data?.data || res.data || [];
      console.log(`✅ Loaded ${sessions.length} session(s)`);

      if (sessions.length > 0) {
        console.log('Session details:', sessions.map(s => ({
          course: s.courseCode,
          total: s.totalStudents,
          present: s.present,
          late: s.late,
          notAttending: s.notAttending
        })));
      }

      setCurrentSessions(sessions);
    } catch (e) {
      console.error('❌ Error loading current sessions:', e);
      setCurrentSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2 sm:gap-3">
              <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-500" />
              Current Sessions
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          {/* WebSocket Connection Status and Manual Refresh */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                console.log('🔄 Manual refresh triggered');
                loadCurrentSessions();
              }}
              className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors flex items-center gap-1.5"
              title="Refresh data manually"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {connected ? 'Live' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900/50 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 dark:border-slate-600/50 p-4 sm:p-6">
        {loadingSessions ? (
          <div className="flex items-center justify-center py-12 sm:py-20">
            <div className="flex flex-col items-center gap-4">
              <LoadingSpinner size="lg" className="text-cyan-500" />
              <span className="text-xs sm:text-sm text-slate-400">Loading sessions...</span>
            </div>
          </div>
        ) : currentSessions.length === 0 ? (
          <UniversityStats />
        ) : (
          <div className="space-y-8">
            {/* Live Sessions */}
            {currentSessions.some(s => s.status === 'live') && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                  Live Now
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {currentSessions
                    .filter(s => s.status === 'live')
                    .map((session) => (
                      <SessionContainer
                        key={session.id}
                        session={session}
                        onClick={setSelectedSession}
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Scheduled Sessions */}
            {currentSessions.some(s => s.status === 'scheduled') && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-500" />
                    Scheduled for Today
                  </h4>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {currentSessions
                    .filter(s => s.status === 'scheduled')
                    .map((session) => (
                      <SessionContainer
                        key={session.id}
                        session={session}
                        onClick={setSelectedSession}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Session Detail Modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  );
};
