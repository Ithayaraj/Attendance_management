import { Clock, Users, AlertCircle, BookOpen } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export const SessionContainer = ({ session, onClick }) => {
  const isLive = session.status === 'live';
  const attendingCount = session.scannedCount || (session.present + session.late);
  const notAttendingCount = session.notAttending;
  const attendingPercentage = session.totalStudents > 0 
    ? Math.round((attendingCount / session.totalStudents) * 100) 
    : 0;
  const notAttendingPercentage = 100 - attendingPercentage;

  const pieData = [
    { name: 'Attending', value: attendingPercentage, color: '#2563eb' },
    { name: 'Not Attending', value: notAttendingPercentage, color: '#dc2626' }
  ];

  return (
    <div
      onClick={() => onClick(session)}
      className="bg-white dark:bg-slate-900/60 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 dark:border-slate-600/50 hover:border-cyan-500 dark:hover:border-cyan-400 hover:shadow-2xl p-3 sm:p-4 cursor-pointer transition-all duration-300"
    >
      {/* Faculty Header */}
      <div className="bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-400 rounded-lg px-3 sm:px-4 py-1.5 sm:py-2 mb-2 sm:mb-3 shadow-md">
        <p className="text-xs font-bold text-white text-center tracking-wide">
          {session.department || 'Department of Information and Communication Technology'}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        {/* Top Row on Mobile - Year & Semester Badge + Live Badge */}
        <div className="flex sm:flex-col items-center justify-between sm:justify-start gap-2 flex-shrink-0">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 rounded-xl shadow-lg flex items-center justify-center">
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-extrabold text-white">Y{session.year}</div>
              <div className="text-xs text-cyan-100 font-semibold">Sem {session.semester}</div>
            </div>
          </div>

          {/* Live Badge - Only show if status is 'live' */}
          {session.status === 'live' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-500 rounded-full shadow-md">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
              <span className="text-xs font-bold text-white">LIVE</span>
            </div>
          )}
        </div>

        {/* Middle - Course Info & Time */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          {/* Course Code & Name */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">{session.courseCode}</h4>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 truncate pl-6">{session.courseName}</p>
          </div>

          {/* Time & Room */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 bg-slate-100 dark:bg-slate-700/50 rounded-md border border-slate-200 dark:border-slate-600">
              <Clock className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{session.startTime} - {session.endTime}</span>
            </div>
            <div className="px-2 sm:px-2.5 py-1 bg-slate-100 dark:bg-slate-700/50 rounded-md border border-slate-200 dark:border-slate-600">
              <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{session.room}</span>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-2 border border-slate-200 dark:border-slate-600">
              <div className="flex items-center justify-between">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <div className="text-right">
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{session.totalStudents}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Total Students</div>
                </div>
              </div>
            </div>
            <div className="bg-slate-100 dark:bg-slate-700/50 rounded-lg p-2 border border-slate-200 dark:border-slate-600">
              <div className="flex items-center justify-between">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <div className="text-right">
                  <div className="text-xl font-bold text-red-600 dark:text-red-400">{session.notAttending}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Not Attending</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Pie Chart (Hidden on mobile, shown on sm+) */}
        <div className="hidden sm:flex flex-shrink-0 w-36 flex-col">
          <p className="text-xs font-bold text-slate-300 text-center mb-1">Attendance Status</p>
          <div className="h-28 mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={22}
                  outerRadius={48}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#1e293b" strokeWidth={2} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-blue-100 dark:bg-blue-600/20 rounded p-1.5 text-center border border-blue-300 dark:border-blue-500/30">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{attendingPercentage}%</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Attending</div>
            </div>
            <div className="bg-red-100 dark:bg-red-600/20 rounded p-1.5 text-center border border-red-300 dark:border-red-500/30">
              <div className="text-lg font-bold text-red-600 dark:text-red-400">{notAttendingPercentage}%</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Not Attending</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile-only Attendance Percentages */}
      <div className="sm:hidden mt-3 grid grid-cols-2 gap-2">
        <div className="bg-blue-100 dark:bg-blue-600/20 rounded p-2 text-center border border-blue-300 dark:border-blue-500/30">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{attendingPercentage}%</div>
          <div className="text-xs text-slate-600 dark:text-slate-400">Attending</div>
        </div>
        <div className="bg-red-100 dark:bg-red-600/20 rounded p-2 text-center border border-red-300 dark:border-red-500/30">
          <div className="text-xl font-bold text-red-600 dark:text-red-400">{notAttendingPercentage}%</div>
          <div className="text-xs text-slate-600 dark:text-slate-400">Not Attending</div>
        </div>
      </div>
    </div>
  );
};
