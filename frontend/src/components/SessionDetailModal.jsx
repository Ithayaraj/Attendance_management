import { useState, useEffect } from 'react';
import { X, Users, UserCheck, Clock, UserX, BookOpen, MapPin, Calendar, GraduationCap, TrendingUp, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { apiClient } from '../lib/apiClient';

export const SessionDetailModal = ({ session, onClose }) => {
  const [showStudentList, setShowStudentList] = useState(null); // 'total', 'present', 'late', 'absent', 'notAttending'
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  if (!session) return null;

  const attendingCount = session.scannedCount || (session.present + session.late);
  const notAttendingCount = session.notAttending || 0;

  const loadStudentList = async (type) => {
    try {
      setLoadingStudents(true);
      setShowStudentList(type);
      
      console.log('Loading student list for type:', type);
      
      if (type === 'total') {
        // Get all students in the batch
        const res = await apiClient.get(`/api/students?department=${encodeURIComponent(session.department)}&year=${session.year}&semester=${session.semester}&limit=1000`);
        console.log('Total students response:', res.data);
        setStudents(res.data?.students || []);
      } else {
        // Get attendance records for this session
        const res = await apiClient.get(`/api/sessions/${session.id}/attendance`);
        console.log('Attendance response:', res.data);
        
        // API returns { success: true, data: { session, records } }
        const records = res.data?.data?.records || res.data?.records || [];
        console.log('Records:', records.length);
        
        if (type === 'present') {
          const presentStudents = records
            .filter(r => r.status === 'present')
            .map(r => r.studentId)
            .filter(s => s && s._id); // Filter out null/undefined
          console.log('Present students:', presentStudents.length);
          setStudents(presentStudents);
        } else if (type === 'late') {
          const lateStudents = records
            .filter(r => r.status === 'late')
            .map(r => r.studentId)
            .filter(s => s && s._id);
          console.log('Late students:', lateStudents.length);
          setStudents(lateStudents);
        } else if (type === 'absent') {
          const absentStudents = records
            .filter(r => r.status === 'absent')
            .map(r => r.studentId)
            .filter(s => s && s._id);
          console.log('Absent students:', absentStudents.length);
          setStudents(absentStudents);
        } else if (type === 'notAttending') {
          // Not attending = students who haven't scanned (no real attendance record)
          // The API already includes virtual absents, so we need to get only students without any record
          const allStudentsRes = await apiClient.get(`/api/students?department=${encodeURIComponent(session.department)}&year=${session.year}&semester=${session.semester}&limit=1000`);
          const allStudents = allStudentsRes.data?.students || [];
          
          // Get only real records (not virtual ones)
          const realRecords = records.filter(r => !String(r._id).startsWith('virtual-'));
          const recordedIds = new Set(realRecords.map(r => String(r.studentId?._id || r.studentId)));
          
          const notAttendingStudents = allStudents.filter(s => !recordedIds.has(String(s._id)));
          console.log('Not attending students:', notAttendingStudents.length);
          setStudents(notAttendingStudents);
        }
      }
    } catch (error) {
      console.error('Error loading students:', error);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };
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
  const notAttendingRate = session.totalStudents > 0
    ? Math.round((notAttendingCount / session.totalStudents) * 100)
    : 0;

  // Pie chart data - only include categories with values > 0
  const pieData = [
    session.present > 0 && { name: 'Present', value: session.present, percentage: presentRate, color: '#10b981' },
    session.late > 0 && { name: 'Late', value: session.late, percentage: lateRate, color: '#f59e0b' },
    session.absent > 0 && { name: 'Absent', value: session.absent, percentage: absentRate, color: '#ef4444' },
    notAttendingCount > 0 && { name: 'Not Attending', value: notAttendingCount, percentage: notAttendingRate, color: '#94a3b8' }
  ].filter(Boolean);

  const barData = [
    { name: 'Present', value: session.present, fill: '#10b981' },
    { name: 'Late', value: session.late, fill: '#f59e0b' },
    { name: 'Absent', value: session.absent, fill: '#ef4444' },
    { name: 'Not Attending', value: notAttendingCount, fill: '#94a3b8' }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button - Top Right */}
        <button
          onClick={onClose}
          className="sticky top-2 sm:top-4 float-right mr-2 sm:mr-4 mt-2 sm:mt-4 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white shadow-lg z-10 transition-all"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Content */}
        <div className="p-3 sm:p-6">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-xl p-4 sm:p-5 mb-4 border border-slate-300 dark:border-slate-600">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
              <div className="flex-1 w-full">
                {/* Faculty Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-lg mb-3">
                  <GraduationCap className="w-4 h-4 text-white" />
                  <span className="text-xs font-bold text-white">
                    {session.department || 'Department of Information and Communication Technology'}
                  </span>
                </div>

                {/* Course Info */}
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-600 dark:text-cyan-400" />
                  <div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{session.courseCode}</h1>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">{session.courseName}</p>
                  </div>
                </div>

                {/* Session Details Row */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-700/50 rounded-md border border-slate-300 dark:border-slate-600">
                    <Calendar className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{session.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-700/50 rounded-md border border-slate-300 dark:border-slate-600">
                    <Clock className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{session.startTime} - {session.endTime}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-700/50 rounded-md border border-slate-300 dark:border-slate-600">
                    <MapPin className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{session.room}</span>
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
              <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 rounded-xl shadow-lg flex items-center justify-center flex-shrink-0">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-extrabold text-white">Y{session.year}</div>
                  <div className="text-xs text-cyan-100 font-semibold">Sem {session.semester}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Overview - Clickable Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-4">
            <button
              onClick={() => loadStudentList('total')}
              className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-3 sm:p-4 shadow-md hover:shadow-xl transition-all cursor-pointer text-left"
            >
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-white mb-1 sm:mb-2" />
              <div className="text-xl sm:text-2xl font-bold text-white">{session.totalStudents}</div>
              <div className="text-xs text-blue-100 font-medium">Total</div>
            </button>
            <button
              onClick={() => loadStudentList('present')}
              className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg p-3 sm:p-4 shadow-md hover:shadow-xl transition-all cursor-pointer text-left"
            >
              <UserCheck className="w-5 h-5 sm:w-6 sm:h-6 text-white mb-1 sm:mb-2" />
              <div className="text-xl sm:text-2xl font-bold text-white">{session.present}</div>
              <div className="text-xs text-green-100 font-medium">Present ({presentRate}%)</div>
            </button>
            <button
              onClick={() => loadStudentList('late')}
              className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-lg p-3 sm:p-4 shadow-md hover:shadow-xl transition-all cursor-pointer text-left"
            >
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white mb-1 sm:mb-2" />
              <div className="text-xl sm:text-2xl font-bold text-white">{session.late}</div>
              <div className="text-xs text-amber-100 font-medium">Late ({lateRate}%)</div>
            </button>
            <button
              onClick={() => loadStudentList('absent')}
              className="bg-gradient-to-br from-red-600 to-red-700 rounded-lg p-3 sm:p-4 shadow-md hover:shadow-xl transition-all cursor-pointer text-left"
            >
              <UserX className="w-5 h-5 sm:w-6 sm:h-6 text-white mb-1 sm:mb-2" />
              <div className="text-xl sm:text-2xl font-bold text-white">{session.absent}</div>
              <div className="text-xs text-red-100 font-medium">Absent ({absentRate}%)</div>
            </button>
            <button
              onClick={() => loadStudentList('notAttending')}
              className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg p-3 sm:p-4 shadow-md hover:shadow-xl transition-all cursor-pointer text-left sm:col-span-3 lg:col-span-1"
            >
              <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white mb-1 sm:mb-2" />
              <div className="text-xl sm:text-2xl font-bold text-white">{notAttendingCount}</div>
              <div className="text-xs text-slate-100 font-medium">Not Attending</div>
            </button>
          </div>

          {/* Attendance Rate Banner */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg p-3 sm:p-4 mb-4 shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                <div>
                  <div className="text-xs text-cyan-100 font-medium">Overall Attendance Rate</div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-white">{attendanceRate}%</div>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-xs text-cyan-100 font-medium">Students Scanned</div>
                <div className="text-xl sm:text-2xl font-bold text-white">{attendingCount} / {session.totalStudents}</div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pie Chart */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 shadow-md border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <div className="w-1 h-5 bg-cyan-500 rounded"></div>
                Attendance Distribution
              </h3>
              <div className="h-56 sm:h-64">
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
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" className="dark:stroke-slate-900" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name, props) => [`${value} students (${props.payload.percentage}%)`, name]}
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                      labelStyle={{ color: '#1e293b' }}
                      itemStyle={{ color: '#475569' }}
                      wrapperClassName="dark:[&>div]:!bg-slate-800 dark:[&>div]:!border-slate-600"
                    />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: '12px', color: '#475569' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 shadow-md border border-slate-200 dark:border-slate-700">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <div className="w-1 h-5 bg-cyan-500 rounded"></div>
                Student Count Breakdown
              </h3>
              <div className="h-56 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" className="dark:stroke-slate-600" />
                    <XAxis dataKey="name" stroke="#64748b" className="dark:stroke-slate-400" style={{ fontSize: '11px' }} />
                    <YAxis stroke="#64748b" className="dark:stroke-slate-400" style={{ fontSize: '11px' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                      labelStyle={{ color: '#1e293b' }}
                      itemStyle={{ color: '#475569' }}
                      wrapperClassName="dark:[&>div]:!bg-slate-800 dark:[&>div]:!border-slate-600"
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Student List Modal */}
        {showStudentList && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowStudentList(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                {showStudentList === 'total' && 'All Students in Batch'}
                {showStudentList === 'present' && 'Present Students'}
                {showStudentList === 'late' && 'Late Students'}
                {showStudentList === 'absent' && 'Absent Students'}
                {showStudentList === 'notAttending' && 'Not Attending Students'}
                <span className="text-sm text-slate-400">({students.length})</span>
              </h3>
              <button onClick={() => setShowStudentList(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Student List */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              {loadingStudents ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-slate-400">Loading students...</div>
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No students found
                </div>
              ) : (
                <div className="space-y-2">
                  {students.map((student, index) => (
                    <div key={student._id || index} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-white">{student.name}</div>
                          <div className="text-sm text-slate-400">{student.registrationNo}</div>
                        </div>
                        <div className="text-xs text-slate-500">
                          {student.email}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};
