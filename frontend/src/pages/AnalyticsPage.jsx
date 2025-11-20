import { useEffect, useState } from 'react';
import { TrendingUp, Users, Calendar, Award, BarChart3 } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const AnalyticsPage = () => {
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [topAttendees, setTopAttendees] = useState([]);
  const [yearWiseStats, setYearWiseStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Get current month in YYYY-MM format
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      const [monthly, top, yearWise] = await Promise.all([
        apiClient.get(`/api/analytics/monthly?month=${currentMonth}`).catch(() => ({ data: null })),
        apiClient.get('/api/analytics/top-attendees').catch(() => ({ data: [] })),
        apiClient.get('/api/analytics/session/year-wise').catch(() => ({ data: [] }))
      ]);

      setMonthlyStats(monthly?.data || null);
      setTopAttendees(Array.isArray(top?.data) ? top.data : (Array.isArray(top) ? top : []));
      setYearWiseStats(Array.isArray(yearWise?.data) ? yearWise.data : (Array.isArray(yearWise) ? yearWise : []));
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" className="text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">Analytics Dashboard</h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">Overview of attendance statistics</p>
      </div>

      {/* Monthly Stats Cards */}
      {monthlyStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Students</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {monthlyStats.totalStudents || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Sessions</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {monthlyStats.totalSessions || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Avg Attendance</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {monthlyStats.avgAttendance ? `${monthlyStats.avgAttendance.toFixed(1)}%` : '0%'}
                </p>
              </div>
              <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Scans</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {monthlyStats.totalScans || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Attendees */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-600" />
            Top Attendees
          </h4>
        </div>
        <div className="p-6">
          {topAttendees.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8">No attendance data available</p>
          ) : (
            <div className="space-y-3">
              {topAttendees.slice(0, 10).map((student, index) => (
                <div key={student._id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                      index === 1 ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300' :
                      index === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                      'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{student.name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{student.registrationNo}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600 dark:text-green-400">
                      {student.attendanceRate ? `${student.attendanceRate.toFixed(1)}%` : '0%'}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {student.attendedSessions || 0}/{student.totalSessions || 0} sessions
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Year-wise Session Summary */}
      {yearWiseStats.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Year-wise Session Summary</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Year</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Sessions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Avg Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {yearWiseStats.map((stat) => (
                  <tr key={stat.year} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                      Year {stat.year}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {stat.sessionCount || 0}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                      {stat.avgAttendance ? `${stat.avgAttendance.toFixed(1)}%` : '0%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
