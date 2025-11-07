import { Home, Users, BookOpen, Calendar, BarChart3, Settings, GraduationCap, X } from 'lucide-react';

const Logo = () => (
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
      <svg
        viewBox="0 0 24 24"
        className="w-6 h-6 md:w-7 md:h-7 text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 12l10-7 10 7-10 7-10-7z" />
        <path d="M22 12v5" />
        <path d="M12 19l0 4" />
      </svg>
    </div>
    <div>
      <h1 className="text-base md:text-lg font-bold text-slate-900 dark:text-white leading-tight">
        Real time Barcode
      </h1>
      <p className="text-xs text-slate-600 dark:text-slate-400">Attendance System</p>
    </div>
  </div>
);

export const Sidebar = ({ currentPage, onNavigate, isOpen = false, onClose }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'courses', label: 'Courses', icon: BookOpen },
    { id: 'sessions', label: 'Sessions', icon: Calendar },
    { id: 'batches', label: 'Batches', icon: GraduationCap },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderButton = (item) => {
    const Icon = item.icon;
    const isActive = currentPage === item.id;

    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.id)}
        className={`flex items-center gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 rounded-lg transition-all duration-200 whitespace-nowrap ${
          isActive
            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/30'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <Icon className={`w-4 h-4 md:w-5 md:h-5 ${isActive ? 'text-white' : ''}`} />
        <span className="text-sm md:text-base font-medium">{item.label}</span>
      </button>
    );
  };

  return (
    <>
      {/* Mobile Sidebar - Slides in from left */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex-col z-40 transform transition-transform duration-300 ease-in-out md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <Logo />
          <button
            onClick={onClose}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto scrollbar-thin">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.id}>{renderButton(item)}</li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 rounded-lg p-4 border border-cyan-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div className="text-xs font-semibold text-cyan-900 dark:text-cyan-100">
                UoV
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Faculty of Technological Studies
              <br />
              Vavuniya, Sri Lanka
            </p>
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar - Fixed on left */}
      <aside className="hidden md:flex md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex-col fixed left-0 top-0 h-screen z-20">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <Logo />
        </div>

        <nav className="flex-1 p-4 overflow-y-auto scrollbar-thin">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.id}>{renderButton(item)}</li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700">
          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-slate-800 dark:to-slate-800 rounded-lg p-4 border border-cyan-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div className="text-xs font-semibold text-cyan-900 dark:text-cyan-100">
                UoV
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Faculty of Technological Studies
              <br />
              Vavuniya, Sri Lanka
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
