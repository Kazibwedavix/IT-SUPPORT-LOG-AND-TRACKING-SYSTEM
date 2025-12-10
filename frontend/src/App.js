// src/App.js - FINAL PRODUCTION READY VERSION
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Context
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Components
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import SystemStatusBar from './components/SystemStatusBar';
import ConnectionStatus from './components/ConnectionStatus';
import LoadingScreen from './components/LoadingScreen';
import MaintenanceBanner from './components/MaintenanceBanner';

// Services
import { authService } from './services/authService';
import { apiService } from './services/api';

// Pages (REAL PAGES - NO MOCK)
import Login from './pages/Login';
import Register from './pages/Register';
import EmailVerification from './pages/EmailVerification';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import StaffDashboard from './pages/StaffDashboard';
import AdminDashboard from './pages/AdminDashboard';
import TechnicianDashboard from './pages/TechnicianDashboard';
import StudentDashboard from './pages/StudentDashboard';
import RoleBasedDashboard from './pages/RoleBasedDashboard';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import CreateTicket from './pages/CreateTicket';
import Reports from './pages/Reports';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

// Styles
import './styles/App.css';

// Create query client with production settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 401/403 errors
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        // Retry once for network errors
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      retry: 0,
    },
  },
});

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [initializationError, setInitializationError] = useState(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.group('🚀 Initializing Bugema University IT Support System');
        console.log('📱 Version:', process.env.REACT_APP_VERSION || '2.0.0');
        console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
        console.log('🔗 API URL:', process.env.REACT_APP_API_URL || 'http://localhost:5002');
        
        // Initialize auth service FIRST
        authService.initializeAuth();
        
        // Check backend health
        await checkBackendHealth();
        
        // Check for maintenance mode
        checkMaintenanceMode();
        
        console.log('✅ App initialized successfully');
        console.groupEnd();
        
      } catch (error) {
        console.error('❌ App initialization failed:', error);
        setInitializationError(error);
        
        // Log to error tracking service
        logError('AppInitialization', error);
      } finally {
        setIsInitializing(false);
      }
    };

    const checkBackendHealth = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5002';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`${apiUrl}/api/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.database === 'connected') {
            setBackendStatus('online');
            console.log('✅ Backend healthy, database connected');
          } else {
            setBackendStatus('degraded');
            console.warn('⚠️ Backend online but database disconnected');
          }
        } else {
          setBackendStatus('offline');
          console.warn('⚠️ Backend health check failed:', response.status);
        }
      } catch (error) {
        setBackendStatus('offline');
        console.warn('⚠️ Backend not reachable:', error.name);
      }
    };

    const checkMaintenanceMode = () => {
      // Check URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      const forceMaintenance = urlParams.get('maintenance') === 'true';
      
      // Check localStorage
      const savedMaintenance = localStorage.getItem('maintenance_mode');
      
      if (forceMaintenance || savedMaintenance === 'true') {
        setMaintenanceMode(true);
        localStorage.setItem('maintenance_mode', 'true');
        
        if (forceMaintenance) {
          console.log('🔧 Maintenance mode activated via URL parameter');
        }
      }
    };

    const logError = (context, error) => {
      const errorData = {
        context,
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        backendStatus
      };
      
      // Send to error logging service
      try {
        localStorage.setItem('last_app_error', JSON.stringify(errorData));
      } catch (e) {
        // Silent fail
      }
    };

    initializeApp();

    // Setup periodic health check
    const healthCheckInterval = setInterval(checkBackendHealth, 2 * 60 * 1000);

    // Handle online/offline events
    const handleOnline = () => {
      console.log('🌐 Network connection restored');
      checkBackendHealth(); // Re-check backend when network comes back
    };
    
    const handleOffline = () => {
      console.warn('🌐 Network connection lost');
      setBackendStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(healthCheckInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleResumeAccess = () => {
    setMaintenanceMode(false);
    localStorage.removeItem('maintenance_mode');
    
    // Clean URL
    const url = new URL(window.location.href);
    url.searchParams.delete('maintenance');
    window.history.replaceState({}, '', url);
  };

  // Handle initialization errors
  if (initializationError) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f7fafc',
        padding: '20px'
      }}>
        <div style={{
          maxWidth: '600px',
          textAlign: 'center',
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px', color: '#e53e3e' }}>
            ⚠️
          </div>
          
          <h1 style={{ fontSize: '24px', color: '#2d3748', marginBottom: '16px' }}>
            Application Initialization Failed
          </h1>
          
          <p style={{ color: '#4a5568', marginBottom: '24px', lineHeight: '1.6' }}>
            The application failed to initialize properly. This may be due to:
          </p>
          
          <ul style={{
            textAlign: 'left',
            color: '#4a5568',
            paddingLeft: '20px',
            margin: '0 auto 24px',
            maxWidth: '400px'
          }}>
            <li>Backend server not running</li>
            <li>Database connection issues</li>
            <li>Network connectivity problems</li>
            <li>Browser compatibility issues</li>
          </ul>
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#3182ce',
                color: 'white',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Reload Application
            </button>
            
            <button
              onClick={() => window.location.href = '/login'}
              style={{
                backgroundColor: '#edf2f7',
                color: '#4a5568',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Go to Login
            </button>
          </div>
          
          <p style={{ color: '#a0aec0', fontSize: '12px', marginTop: '24px' }}>
            Contact IT Support if the problem persists: support@bugemauniv.ac.ug
          </p>
        </div>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <LoadingScreen 
        message="Initializing Bugema IT Support System..."
        subtitle="Connecting to secure services..."
        showProgress
      />
    );
  }

  if (maintenanceMode && !window.location.pathname.includes('/login')) {
    return (
      <div className="app-container">
        <MaintenanceBanner onResume={handleResumeAccess} />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <Router>
              <div className="app-container">
                <SystemStatusBar backendStatus={backendStatus} />
                <ConnectionStatus status={backendStatus} />
                
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Navigate to="/login" replace />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/verify-email/:token" element={<EmailVerification />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password/:token" element={<ResetPassword />} />
                  <Route path="/maintenance" element={
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                      <h1>System Maintenance</h1>
                      <p>The system is currently undergoing maintenance.</p>
                      <p>Please try again later.</p>
                    </div>
                  } />

                  {/* Protected Routes */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={<RoleBasedDashboard />} />
                    <Route path="/admin/*" element={<AdminDashboard />} />
                    <Route path="/technician/*" element={<TechnicianDashboard />} />
                    <Route path="/staff/*" element={<StaffDashboard />} />
                    <Route path="/student/*" element={<StudentDashboard />} />
                    
                    {/* Ticket Management */}
                    <Route path="/tickets/create" element={<CreateTicket />} />
                    <Route path="/tickets/:id" element={<TicketDetail />} />
                    <Route path="/tickets" element={<Tickets />} />
                    
                    {/* Reports & Analytics */}
                    <Route path="/reports" element={<Reports />} />
                    
                    {/* User Management */}
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/settings" element={<Settings />} />
                    
                    {/* 404 Page */}
                    <Route path="*" element={<NotFound />} />
                  </Route>
                  
                  {/* Catch-all redirect */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
                
                {/* Toast Notifications */}
                <ToastContainer
                  position="top-right"
                  autoClose={5000}
                  hideProgressBar={false}
                  newestOnTop
                  closeOnClick
                  rtl={false}
                  pauseOnFocusLoss
                  draggable
                  pauseOnHover
                  theme="light"
                  style={{ zIndex: 9999 }}
                />
              </div>
            </Router>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// Export for testing
export { App };
export default App;