export const StudentsTable = ({ students, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">Loading students...</div>
      </div>
    );
  }

  if (!students || students.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">No students found</div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800';
      case 'late':
        return 'bg-amber-100 text-amber-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Student ID
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Department
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Year
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {students.map((student) => (
            <tr key={student._id} className="hover:bg-slate-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                {student.studentId}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                {student.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                {student.email}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                {student.department}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                {student.year}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {student.status ? (
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                      student.status
                    )}`}
                  >
                    {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                  </span>
                ) : (
                  <span className="text-slate-400 text-xs">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
