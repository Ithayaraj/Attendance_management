import { useState, useEffect, useRef } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { NotificationContainer } from './components/Notification';
import { useAuth } from './hooks/useAuth';
import { useScanStream } from './hooks/useScanStream';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { DashboardPage } from './pages/DashboardPage';
import { CoursesPage } from './pages/CoursesPage';
import { SessionsPage } from './pages/SessionsPage';
import { StudentsPage } from './pages/StudentsPage';
import { BatchesPage } from './pages/BatchesPage';
import { StudentDetailPage } from './pages/StudentDetailPage';
import { Activity } from 'lucide-react';
import { PageLoader, ButtonSpinner } from './components/LoadingSpinner';

function AppContent() {
  const { user, loading, login, logout, loginLoading, logoutLoading } = useAuth();
  const { lastScan } = useScanStream();
  const { showNotification, notifications, removeNotification } = useNotification();
  // Initialize currentPage from URL or default to dashboard
  const getInitialPage = () => {
    const path = window.location.pathname.slice(1) || 'dashboard';
    const validPages = ['dashboard', 'students', 'courses', 'sessions', 'batches', 'analytics', 'settings'];
    return validPages.includes(path) ? path : 'dashboard';
  };

  const [currentPage, setCurrentPage] = useState(getInitialPage());
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const lastScanIdRef = useRef(null);

  // Sync URL with current page (only when user is logged in)
  useEffect(() => {
    if (user) {
      const path = currentPage === 'dashboard' ? '/' : `/${currentPage}`;
      window.history.pushState({ page: currentPage }, '', path);
    }
  }, [currentPage, user]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event) => {
      const path = window.location.pathname.slice(1) || 'dashboard';
      const validPages = ['dashboard', 'students', 'courses', 'sessions', 'batches', 'analytics', 'settings'];
      if (validPages.includes(path)) {
        setCurrentPage(path);
        setSelectedStudent(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle logout and redirect
  const handleLogout = async () => {
    await logout();
    // Reset to dashboard and clear URL
    setCurrentPage('dashboard');
    setSelectedStudent(null);
    window.history.pushState({}, '', '/');
  };
  
  // Show notification when scan is received (matching Arduino LCD display exactly)
  useEffect(() => {
    if (!user) return; // Don't show notifications if not logged in
    
    if (lastScan) {
      // Create unique ID from scan data to prevent duplicates
      const scanId = `${lastScan.type}_${lastScan.registrationNo || 'unknown'}_${lastScan.checkInAt || Date.now()}`;
      
      if (scanId !== lastScanIdRef.current) {
        lastScanIdRef.current = scanId;
        console.log('=== NOTIFICATION TRIGGER ===');
        console.log('Scan received for notification:', lastScan);
        const scanType = lastScan.type;
        
        if (scanType === 'scan.error') {
          // Match Arduino error display: "Error:" on line 1, error message on line 2
          const errorMsg = lastScan.error || 'Unknown error';
          console.log('Showing error notification:', errorMsg);
          showNotification({
            type: 'error',
            title: 'Error:',
            message: errorMsg.length > 16 ? errorMsg.substring(0, 13) + '...' : errorMsg,
            duration: 6000,
          });
        } else if (scanType === 'scan.duplicate') {
          // Match Arduino: "Already Entered" on line 1, "status (dup)" on line 2
          const status = lastScan.status || 'present';
          const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
          console.log('Showing duplicate notification:', statusLabel);
          showNotification({
            type: 'warning',
            title: 'Already Entered',
            message: `${statusLabel} (dup)`,
            duration: 4000,
          });
        } else if (scanType === 'scan.ingested') {
          // Match Arduino: "Allowed (status)" on line 1, "Attendance Saved" on line 2
          const status = lastScan.status || 'present';
          const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
          console.log('Showing success notification:', statusLabel);
          showNotification({
            type: 'success',
            title: `Allowed (${statusLabel})`,
            message: 'Attendance Saved',
            duration: 5000,
          });
        }
      } else {
        console.log('Skipping duplicate scan notification');
      }
    }
  }, [lastScan, user, showNotification]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const result = await login(email, password);
    if (!result.success) {
      setLoginError(result.error || 'Login failed');
    }
  };

  if (loading) {
    return <PageLoader message="Loading application..." />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 border border-slate-200 dark:border-slate-700">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-600 to-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Activity className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              University of Vavuniya
            </h1>
            <p className="text-slate-600 dark:text-slate-400">Attendance Management System</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-900 dark:text-white transition-all"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-900 dark:text-white transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {loginError && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-3 px-4 rounded-lg hover:shadow-xl transition-all font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loginLoading && <ButtonSpinner className="text-white" />}
              {loginLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

        </div>
      </div>
    );
  }

  const getPageTitle = () => {
    if (selectedStudent) return 'Student Details';
    switch (currentPage) {
      case 'dashboard': return 'Dashboard';
      case 'students': return 'Students';
      case 'courses': return 'Courses';
      case 'sessions': return 'Sessions';
      case 'analytics': return 'Analytics';
      case 'settings': return 'Settings';
      default: return 'Dashboard';
    }
  };

  return (
    <>
      {/* Notification Container - Outside main layout for proper z-index */}
      <NotificationContainer 
        notifications={notifications} 
        onRemove={removeNotification} 
      />
      
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-slate-900 w-full overflow-x-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar 
        currentPage={currentPage} 
        onNavigate={(page) => {
          setCurrentPage(page);
          setSelectedStudent(null);
          setSidebarOpen(false); // Close sidebar on mobile after navigation
        }}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={handleLogout}
        logoutLoading={logoutLoading}
        user={user}
      />

      <div className="flex-1 flex flex-col overflow-hidden md:ml-64 w-full">
        <Header 
          user={user} 
          onLogout={handleLogout} 
          title={getPageTitle()} 
          logoutLoading={logoutLoading}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 w-full max-w-full">
          {selectedStudent ? (
            <StudentDetailPage
              student={selectedStudent}
              onBack={() => setSelectedStudent(null)}
            />
          ) : currentPage === 'dashboard' ? (
            <DashboardPage />
          ) : currentPage === 'students' ? (
            <StudentsPage onViewStudent={setSelectedStudent} />
          ) : currentPage === 'courses' ? (
            <CoursesPage />
          ) : currentPage === 'sessions' ? (
            <SessionsPage />
          ) : currentPage === 'batches' ? (
            <BatchesPage />
          ) : (
            <div className="py-10 text-center text-slate-600 dark:text-slate-400">
              {currentPage.charAt(0).toUpperCase() + currentPage.slice(1)} page - Coming soon
            </div>
          )}
        </main>
      </div>
    </div>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;
