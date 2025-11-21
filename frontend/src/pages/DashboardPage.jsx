import { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import { useScanStream } from '../hooks/useScanStream';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { SessionContainer } from '../components/SessionContainer';
import { SessionDetailModal } from '../components/SessionDetailModal';

export const DashboardPage = () => {
  const { lastScan, sessionStatus } = useScanStream();
  const [currentSessions, setCurrentSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    loadCurrentSessions();
  }, []);

  useEffect(() => {
    // Refresh sessions on incoming scans or session status changes
    if (lastScan || sessionStatus) {
      loadCurrentSessions();
    }
  }, [lastScan, sessionStatus]);

  const loadCurrentSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await apiClient.get('/api/analytics/current-sessions');
      setCurrentSessions(res.data || []);
    } catch (e) {
      console.error('Error loading current sessions', e);
      setCurrentSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-cyan-500" />
          Current Sessions
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Current Sessions Section */}
      <div className="bg-slate-800/30 dark:bg-slate-900/50 backdrop-blur-sm rounded-xl shadow-lg border border-slate-700/50 dark:border-slate-600/50 p-6">
        {loadingSessions ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <LoadingSpinner size="lg" className="text-cyan-500" />
              <span className="text-sm text-slate-400">Loading sessions...</span>
            </div>
          </div>
        ) : currentSessions.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-20 h-20 text-slate-600 dark:text-slate-500 mx-auto mb-4" />
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No Sessions Today</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">There are no scheduled or live sessions for today</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {currentSessions.map((session) => (
              <SessionContainer
                key={session.id}
                session={session}
                onClick={setSelectedSession}
              />
            ))}
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
