import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
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
import './styles/App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify-email/:token" element={<EmailVerification />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />

              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                {/* Dashboard Routes */}
                <Route path="/dashboard" element={<RoleBasedDashboard />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/technician" element={<TechnicianDashboard />} />
                <Route path="/staff" element={<StaffDashboard />} />
                <Route path="/student" element={<StudentDashboard />} />

                {/* Ticket Routes - FIXED ORDER */}
                <Route path="/tickets/create" element={<CreateTicket />} />
                <Route path="/tickets/:id" element={<TicketDetail />} />
                <Route path="/tickets" element={<Tickets />} />

                {/* Reports */}
                <Route path="/reports" element={<Reports />} />

                {/* Legacy redirect for compatibility */}
                <Route path="/create-ticket" element={<Navigate to="/tickets/create" replace />} />

                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
            <ReactQueryDevtools initialIsOpen={false} />
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
