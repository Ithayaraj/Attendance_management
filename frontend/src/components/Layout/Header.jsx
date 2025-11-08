import { LogOut, Moon, Sun, Bell, Menu, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { ButtonSpinner } from '../LoadingSpinner';
import { useNotification } from '../../contexts/NotificationContext';

export const Header = ({ user, onLogout, title = 'Dashboard', logoutLoading = false, onMenuClick }) => {
  const { isDark, toggleTheme } = useTheme();
  const { showNotification } = useNotification();

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 w-full">
      <div className="px-4 sm:px-6 py-4 w-full">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            {/* Hamburger button for mobile */}
            {onMenuClick && (
              <button
                onClick={onMenuClick}
                className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                aria-label="Toggle menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  // Test notification
                  showNotification({
                    type: 'success',
                    title: 'Allowed (Present)',
                    message: 'Attendance Saved',
                    duration: 3000,
                  });
                }}
                className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors relative"
                title="Test notification"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              <button
                onClick={toggleTheme}
                className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title={isDark ? 'Light mode' : 'Dark mode'}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700"></div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {user.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                    {user.role}
                  </div>
                </div>
              </div>

              {/* Desktop Logout Button - Hidden on mobile */}
              <button
                onClick={onLogout}
                disabled={logoutLoading}
                className="hidden md:flex p-2.5 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed items-center justify-center"
                title="Logout"
              >
                {logoutLoading ? (
                  <ButtonSpinner className="text-slate-600 dark:text-slate-300" />
                ) : (
                  <LogOut className="w-5 h-5" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
