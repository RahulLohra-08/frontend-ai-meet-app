import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// We'll lazy load pages for better performance
// Public Pages
const Home = lazy(() => import('./pages/Home'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const Research = lazy(() => import('./pages/Research'));
const Technology = lazy(() => import('./pages/Technology'));
const Applications = lazy(() => import('./pages/Applications'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Contact = lazy(() => import('./pages/Contact'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const JoinMeeting = lazy(() => import('./pages/JoinMeeting'));
// SaaS Dashboard Pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const MeetingRoom = lazy(() => import('./pages/MeetingRoom'));
const MeetingSummary = lazy(() => import('./pages/MeetingSummary'));

function ProtectedRoute({ children }: { children: ReactNode }) {
  // Sends anonymous visitors to /login and returns them to the requested page afterwards.
  const location = useLocation();
  const { status } = useAuth();
  if (status === 'loading') return <div className="flex h-screen w-full items-center justify-center text-xl">Checking your session…</div>;
  return status === 'authenticated' ? <>{children}</> : <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
}

function App() {
  return (
    <AuthProvider>
    <BrowserRouter>
      <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-background text-foreground"><div className="text-xl">Loading Lingua Meet AI...</div></div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/research" element={<Research />} />
          <Route path="/technology" element={<Technology />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/join" element={<ProtectedRoute><JoinMeeting /></ProtectedRoute>} />
          <Route path="/dashboard/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/meeting/:id" element={<ProtectedRoute><MeetingRoom /></ProtectedRoute>} />
          <Route path="/meeting/:id/summary" element={<ProtectedRoute><MeetingSummary /></ProtectedRoute>} />
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
