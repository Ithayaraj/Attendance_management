import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, CheckCircle, Clock, XCircle, TrendingUp, Award } from 'lucide-react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiClient } from '../lib/apiClient';
import { LoadingSpinner } from '../components/LoadingSpinner';

const COLORS = {
  Present: '#10b981',
  Late: '#f59e0b',
  Absent: '#ef4444',
};

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

export const StudentDetailPage = ({ student, onBack }) => {
  const [monthlyData, setMonthlyData] = useState(null);
  const [semesterData, setSemesterData] = useState(null);
  const [showSemesterModal, setShowSemesterModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    loadData();
  }, [student, currentMonth]);

  const loadData = async () => {
    const monthlyCacheKey = `student_monthly_${student._id}_${currentMonth}`;
    const semesterCacheKey = `student_semester_${student._id}`;

    // Check cache first
    const cachedMonthly = sessionStorage.getItem(monthlyCacheKey);
    const cachedSemester = sessionStorage.getItem(semesterCacheKey);
    
    let useCachedMonthly = false;
    let useCachedSemester = false;

    if (cachedMonthly) {
      try {
        const { data, timestamp } = JSON.parse(cachedMonthly);
        const age = Date.now() - timestamp;
        if (age < CACHE_DURATION) {
          setMonthlyData(data);
          useCachedMonthly = true;
        }
      } catch (e) {
        console.error('Cache parse error:', e);
      }
    }

    if (cachedSemester) {
      try {
        const { data, timestamp } = JSON.parse(cachedSemester);
        const age = Date.now() - timestamp;
        if (age < CACHE_DURATION) {
          setSemesterData(data);
          useCachedSemester = true;
        }
      } catch (e) {
        console.error('Cache parse error:', e);
      }
    }

    // If both are cached, we're done
    if (useCachedMonthly && useCachedSemester) {
      setLoading(false);
      // Refresh in background if data is older than 30 seconds
      const cachedMonthlyData = JSON.parse(cachedMonthly);
      const cachedSemesterData = JSON.parse(cachedSemester);
      const monthlyAge = Date.now() - cachedMonthlyData.timestamp;
      const semesterAge = Date.now() - cachedSemesterData.timestamp;
      
      if (monthlyAge > 30 * 1000 || semesterAge > 30 * 1000) {
        loadFresh();
      }
      return;
    }

    await loadFresh();
  };

  const loadFresh = async () => {
    try {
      setLoading(true);
      const [monthly, semester] = await Promise.all([
        apiClient.get(`/api/analytics/students/${student._id}?month=${currentMonth}`),
        apiClient.get(`/api/analytics/students/${student._id}/semester`)
      ]);
      setMonthlyData(monthly.data);
      setSemesterData(semester.data);
      
      // Cache the data
      const monthlyCacheKey = `student_monthly_${student._id}_${currentMonth}`;
      const semesterCacheKey = `student_semester_${student._id}`;
      
      sessionStorage.setItem(monthlyCacheKey, JSON.stringify({
        data: monthly.data,
        timestamp: Date.now()
      }));
      
      sessionStorage.setItem(semesterCacheKey, JSON.stringify({
        data: semester.data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="lg" className="text-cyan-600" />
          <span className="text-slate-600 dark:text-slate-400">Loading student details...</span>
        </div>
      </div>
    );
  }

  const dayWiseAttendance = monthlyData?.dayWiseData || [];
  const monthlyStats = monthlyData?.stats || {};
  const semesterStats = semesterData?.semesterStats || {};

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{student.name}</h3>
          <p className="text-slate-600 dark:text-slate-400">{student.registrationNo} • {student.department}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total Sessions</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{monthlyStats.totalSessions || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Attended</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{monthlyStats.attendedSessions || 0}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Attendance Rate</p>
              <p className="text-3xl font-bold text-cyan-600 mt-2">{monthlyStats.attendancePercentage || 0}%</p>
            </div>
            <div className="w-12 h-12 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-cyan-600" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">80% Target</p>
              <p className="text-3xl font-bold mt-2" style={{ color: monthlyStats.meets80Percent ? '#10b981' : '#ef4444' }}>
                {monthlyStats.meets80Percent ? 'MET' : 'NOT MET'}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${monthlyStats.meets80Percent ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              <Award className="w-6 h-6" style={{ color: monthlyStats.meets80Percent ? '#10b981' : '#ef4444' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Monthly Distribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={monthlyData?.summary || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => percent * 100 < 8 ? '' : `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={85}
                innerRadius={40}
                paddingAngle={2}
                fill="#8884d8"
                dataKey="value"
              >
                {(monthlyData?.summary || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={24} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Semester Overview (6 Months)</h4>
            <button
              onClick={() => setShowSemesterModal(true)}
              className="px-3 py-1.5 text-sm bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              View Details
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400">Total Sessions</span>
              <span className="font-semibold text-slate-900 dark:text-white">{semesterStats.totalSessions || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400">Attended</span>
              <span className="font-semibold text-green-600">{semesterStats.attendedSessions || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 dark:text-slate-400">Attendance Rate</span>
              <span className="font-semibold text-cyan-600">{semesterStats.attendancePercentage || 0}%</span>
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 dark:text-slate-400">80% Requirement:</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${semesterStats.meets80Percent ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                  {semesterStats.meets80Percent ? 'ACHIEVED' : 'NOT ACHIEVED'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Day-wise Attendance (Current Month)</h4>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Check-in Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Session Start</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {dayWiseAttendance.length === 0 ? (
                <tr>
                  <td colSpan="3" className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No attendance records for this month
                  </td>
                </tr>
              ) : (
                dayWiseAttendance.map((record, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-4 py-3 text-sm text-slate-900 dark:text-white">
                      {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        record.status === 'present' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                        record.status === 'late' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                        'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        {record.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {record.checkInAt ? (
                        <span className={`${record.status === 'late' ? 'text-amber-600' : 'text-slate-600 dark:text-slate-400'}`}>
                          {new Date(record.checkInAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {record.sessionStartTime || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showSemesterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Semester Analytics (6 Months)</h3>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Monthly Breakdown</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {semesterData?.monthlyBreakdown?.map((month, index) => (
                    <div key={index} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                      <div className="font-semibold text-slate-900 dark:text-white mb-2">
                        {new Date(month.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Present:</span>
                          <span className="text-green-600 font-medium">{month.present}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Late:</span>
                          <span className="text-amber-600 font-medium">{month.late}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-slate-400">Absent:</span>
                          <span className="text-red-600 font-medium">{month.absent}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-slate-600 dark:text-slate-400">Rate:</span>
                          <span className="text-cyan-600 font-semibold">{month.attendanceRate}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Attendance Trend</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={semesterData?.lineGraphData || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '0.5rem' }} />
                    <Legend />
                    <Line type="monotone" dataKey="present" stroke="#10b981" strokeWidth={2} name="Present" />
                    <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} name="Late" />
                    <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} name="Absent" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setShowSemesterModal(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
