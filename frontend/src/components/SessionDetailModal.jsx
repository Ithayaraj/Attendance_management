import { X, Users, UserCheck, Clock, UserX, BookOpen, MapPin, Calendar, GraduationCap, TrendingUp, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export const SessionDetailModal = ({ session, onClose }) => {
  if (!session) return null;

  const attendingCount = session.scannedCount || (session.present + session.late);
  const notAttendingCount = session.notAttending;
  const attendanceRate = session.totalStudents > 0
    ? Math.round((attendingCount / session.totalStudents) * 100)
    : 0;
  const presentRate = session.totalStudents > 0
    ? Math.round((session.present / session.totalStudents) * 100)
    : 0;
  const lateRate = session.totalStudents > 0
    ? Math.round((session.late / session.totalStudents) * 100)
    : 0;
  const absentRate = session.totalStudents > 0
    ? Math.round((session.absent / session.totalStudents) * 100)
    : 0;

  const pieData = [
    { name: 'Present', value: session.present, percentage: presentRate, color: '#10b981' },
    { name: 'Late', value: session.late, percentage: lateRate, color: '#f59e0b' },
    { name: 'Absent', value: session.absent, percentage: absentRate, color: '#ef4444' }
  ];

  const barData = [
    { name: 'Present', value: session.present, fill: '#10b981' },
    { name: 'Late', value: session.late, fill: '#f59e0b' },
    { name: 'Absent', value: session.absent, fill: '#ef4444' },
    { name: 'Not Attending', value: notAttendingCount, fill: '#94a3b8' }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-900 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button - Top Right */}
        <button
          onClick={onClose}
          className="sticky top-4 float-right mr-4 mt-4 w-10 h-10 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-white shadow-lg z-10 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-5 mb-4 border border-slate-600">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {/* Faculty Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg mb-3">
                  <GraduationCap className="w-4 h-4 text-white" />
                  <span className="text-xs font-bold text-white">
                    {session.department || 'Department of Information and Communication Technology'}
                  </span>
                </div>

                {/* Course Info */}
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-6 h-6 text-cyan-400" />
                  <div>
                    <h1 className="text-2xl font-extrabold text-white">{session.courseCode}</h1>
                    <p className="text-sm text-slate-300">{session.courseName}</p>
                  </div>
                </div>

                {/* Session Details Row */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-700/50 rounded-md border border-slate-600">
                    <Calendar className="w-3 h-3 text-blue-400" />
                    <span className="text-xs font-semibold text-slate-200">{session.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-700/50 rounded-md border border-slate-600">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    <span className="text-xs font-semibold text-slate-200">{session.startTime} - {session.endTime}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-700/50 rounded-md border border-slate-600">
                    <MapPin className="w-3 h-3 text-purple-400" />
                    <span className="text-xs font-semibold text-slate-200">{session.room}</span>
                  </div>
                  {session.status === 'live' && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500 rounded-md shadow-md">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                      <span className="text-xs font-bold text-white">LIVE</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Year & Semester Badge */}
              <div className="w-24 h-24 bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 rounded-xl shadow-lg flex items-center justify-center flex-shrink-0">
                <div className="text-center">
                  <div className="text-3xl font-extrabold text-white">Y{session.year}</div>
                  <div className="text-xs text-cyan-100 font-semibold">Semester {session.semester}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4 shadow-md">
              <Users className="w-6 h-6 text-white mb-2" />
              <div className="text-2xl font-bold text-white">{session.totalStudents}</div>
              <div className="text-xs text-blue-100 font-medium">Total</div>
            </div>
            <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-4 shadow-md">
              <UserCheck className="w-6 h-6 text-white mb-2" />
              <div className="text-2xl font-bold text-white">{session.present}</div>
              <div className="text-xs text-green-100 font-medium">Present ({presentRate}%)</div>
            </div>
            <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-lg p-4 shadow-md">
              <Clock className="w-6 h-6 text-white mb-2" />
              <div className="text-2xl font-bold text-white">{session.late}</div>
              <div className="text-xs text-amber-100 font-medium">Late ({lateRate}%)</div>
            </div>
            <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-lg p-4 shadow-md">
              <UserX className="w-6 h-6 text-white mb-2" />
              <div className="text-2xl font-bold text-white">{session.absent}</div>
              <div className="text-xs text-red-100 font-medium">Absent ({absentRate}%)</div>
            </div>
            <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg p-4 shadow-md">
              <AlertCircle className="w-6 h-6 text-white mb-2" />
              <div className="text-2xl font-bold text-white">{notAttendingCount}</div>
              <div className="text-xs text-slate-100 font-medium">Not Attending</div>
            </div>
          </div>

          {/* Attendance Rate Banner */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg p-4 mb-4 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-white" />
                <div>
                  <div className="text-xs text-cyan-100 font-medium">Overall Attendance Rate</div>
                  <div className="text-3xl font-extrabold text-white">{attendanceRate}%</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-cyan-100 font-medium">Students Scanned</div>
                <div className="text-2xl font-bold text-white">{attendingCount} / {session.totalStudents}</div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-2 gap-4">
            {/* Pie Chart */}
            <div className="bg-slate-800 rounded-lg p-4 shadow-md border border-slate-700">
              <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <div className="w-1 h-5 bg-cyan-500 rounded"></div>
                Attendance Distribution
              </h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ percentage }) => `${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#1e293b" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name, props) => [`${value} students (${props.payload.percentage}%)`, name]} />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="bg-slate-800 rounded-lg p-4 shadow-md border border-slate-700">
              <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <div className="w-1 h-5 bg-cyan-500 rounded"></div>
                Student Count Breakdown
              </h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '11px' }} />
                    <YAxis stroke="#94a3b8" style={{ fontSize: '11px' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', fontSize: '12px' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
