import { useState, useEffect, useRef } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { NotificationContainer } from './components/Notification';
import { FloatingDeviceStatus } from './components/FloatingDeviceStatus';
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
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DevicesPage } from './pages/DevicesPage';
import { Activity, Eye, EyeOff } from 'lucide-react';
import { PageLoader, ButtonSpinner } from './components/LoadingSpinner';

function AppContent() {
  const { user, loading, login, logout, loginLoading, logoutLoading } = useAuth();
  const { lastScan, connected } = useScanStream();
  const { showNotification, notifications, removeNotification } = useNotification();
  // Initialize currentPage from URL or default to dashboard
  const getInitialPage = () => {
    const path = window.location.pathname.slice(1) || 'dashboard';
    const validPages = ['dashboard', 'students', 'courses', 'sessions', 'batches', 'analytics', 'devices'];
    return validPages.includes(path) ? path : 'dashboard';
  };

  const [currentPage, setCurrentPage] = useState(getInitialPage());
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const lastScanIdRef = useRef(null);

  // Sync URL with current page (only when user is logged in)
  useEffect(() => {
    if (user) {
      const path = currentPage === 'dashboard' ? '/dashboard' : `/${currentPage}`;
      window.history.pushState({ page: currentPage }, '', path);
    }
  }, [currentPage, user]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event) => {
      const path = window.location.pathname.slice(1) || 'dashboard';
      const validPages = ['dashboard', 'students', 'courses', 'sessions', 'batches', 'analytics', 'devices'];
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

  // Show notification when scan is received with detailed attendance information
  useEffect(() => {
    if (!user) {
      console.log('No user, skipping notification');
      return; // Don't show notifications if not logged in
    }

    if (!connected) {
      console.log('WebSocket not connected, skipping notification');
      return;
    }

    console.log('=== SCAN NOTIFICATION EFFECT TRIGGERED ===');
    console.log('lastScan:', lastScan);
    console.log('lastScan type:', lastScan?.type);
    console.log('user:', user?.name);
    console.log('WebSocket connected:', connected);
    console.log('showNotification function:', typeof showNotification);

    if (lastScan && lastScan.type) {
      // Create unique ID from scan data to prevent duplicates
      const scanId = `${lastScan.type}_${lastScan.registrationNo || 'unknown'}_${lastScan.checkInAt || Date.now()}`;

      console.log('Generated Scan ID:', scanId);
      console.log('Last scan ID ref:', lastScanIdRef.current);

      if (scanId !== lastScanIdRef.current) {
        lastScanIdRef.current = scanId;
        console.log('=== PROCESSING NEW SCAN FOR NOTIFICATION ===');
        console.log('Full scan data:', JSON.stringify(lastScan, null, 2));

        const scanType = lastScan.type;
        console.log('Scan type:', scanType);

        // Use setTimeout to ensure state is ready
        setTimeout(() => {
          // Immediately show notification (no setTimeout needed)
          if (scanType === 'scan.error') {
            // Show error with scanned ID if available
            const errorMsg = lastScan.error || 'Unknown error';
            const registrationNo = lastScan.registrationNo || 'N/A';
            console.log('=== SHOWING ERROR NOTIFICATION ===');
            console.log('Error message:', errorMsg);
            console.log('Scanned ID:', registrationNo);

            const errorMessage = registrationNo !== 'N/A'
              ? `📋 Scanned ID: ${registrationNo}\n❌ ${errorMsg}`
              : `❌ ${errorMsg}`;

            showNotification({
              type: 'error',
              title: '❌ Scan Error',
              message: errorMessage,
              duration: 7000,
            });
          } else if (scanType === 'scan.duplicate') {
            // Show detailed duplicate attendance information with scanned ID prominently displayed
            const status = lastScan.status || 'present';
            const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
            const studentName = lastScan.studentName || 'Unknown';
            const registrationNo = lastScan.registrationNo || 'N/A';
            const courseCode = lastScan.courseCode || 'N/A';

            console.log('=== SHOWING DUPLICATE NOTIFICATION ===');
            console.log('Data:', { studentName, registrationNo, courseCode, status });

            // Create message with scanned ID prominently displayed first
            const message = `📋 Scanned ID: ${registrationNo}\n👤 ${studentName}\n📚 ${courseCode}\n⚠️ Status: ${statusLabel} (Already Entered)`;
            showNotification({
              type: 'warning',
              title: '⚠️ Duplicate Scan Detected',
              message: message,
              duration: 6000,
            });
          } else if (scanType === 'scan.ingested') {
            // Show detailed attendance information with scanned ID prominently displayed
            const status = lastScan.status || 'present';
            const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
            const studentName = lastScan.studentName || 'Unknown';
            const registrationNo = lastScan.registrationNo || 'N/A';
            const courseCode = lastScan.courseCode || 'N/A';

            // Format check-in time
            let checkInTime = '';
            if (lastScan.checkInAt) {
              try {
                const checkInDate = new Date(lastScan.checkInAt);
                checkInTime = checkInDate.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                });
              } catch (e) {
                console.error('Error formatting time:', e);
              }
            }

            console.log('=== SHOWING ATTENDANCE NOTIFICATION ===');
            console.log('Data:', { studentName, registrationNo, courseCode, status, checkInTime });

            // Create detailed message with scanned ID prominently displayed first
            const detailedMessage = checkInTime
              ? `📋 Scanned ID: ${registrationNo}\n👤 ${studentName}\n📚 ${courseCode}\n⏰ Check-in: ${checkInTime}\n✅ Status: ${statusLabel}`
              : `📋 Scanned ID: ${registrationNo}\n👤 ${studentName}\n📚 ${courseCode}\n✅ Status: ${statusLabel}`;

            console.log('Notification details:', {
              type: 'success',
              title: `✅ ID Scanned - Attendance Recorded`,
              message: detailedMessage,
              duration: 8000
            });

            const notificationId = showNotification({
              type: 'success',
              title: `✅ ID Scanned - Attendance Recorded`,
              message: detailedMessage,
              duration: 8000,
            });

            console.log('Notification ID returned:', notificationId);
            console.log('Notification should be visible now');
          } else {
            console.log('Unknown scan type:', scanType);
          }
        }, 100); // Small delay to ensure state is ready
      } else {
        console.log('Skipping duplicate scan notification (same scan ID)');
      }
    } else {
      console.log('No valid lastScan data or missing type');
    }
  }, [lastScan, user, showNotification, connected]);

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
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-slate-900 dark:text-white transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-500 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
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
      case 'devices': return 'Devices';
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

      {/* Floating Device Status - Bottom right corner */}
      <FloatingDeviceStatus />

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

          <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin p-4 sm:p-6 w-full max-w-full">
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
              ) : currentPage === 'analytics' ? (
                <AnalyticsPage />
              ) : currentPage === 'devices' ? (
                <DevicesPage />
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
