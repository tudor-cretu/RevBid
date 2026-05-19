import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login          from './pages/Login';
import Register       from './pages/Register';
import Dashboard      from './pages/Dashboard';
import CreateAuction  from './pages/CreateAuction';
import AdminDashboard from './pages/AdminDashboard';
import AuctionDetail  from './pages/AuctionDetail';
import VerifyEmail    from './pages/VerifyEmail';
import AuthCallback   from './pages/AuthCallback';
import Navbar         from './components/Navbar';
import Settings       from './pages/Settings';
import Support        from './pages/Support';
import PublicProfile  from './pages/PublicProfile';
import Messages       from './pages/Messages';
import LandingPage    from './pages/LandingPage';
import './App.css';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"              element={<PublicOnly><LandingPage /></PublicOnly>} />
          <Route path="/login"          element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/register"       element={<PublicOnly><Register /></PublicOnly>} />
          <Route path="/verify-email"   element={<VerifyEmail />} />
          <Route path="/auth/callback"  element={<AuthCallback />} />
          <Route path="/dashboard"      element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/auction/create" element={<ProtectedRoute><CreateAuction /></ProtectedRoute>} />
          <Route path="/auction/:id"    element={<ProtectedRoute><AuctionDetail /></ProtectedRoute>} />
          <Route path="/admin"          element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/settings"       element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/support"        element={<ProtectedRoute><Support /></ProtectedRoute>} />
          <Route path="/profile/:id"    element={<ProtectedRoute><PublicProfile /></ProtectedRoute>} />
          <Route path="/messages"       element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="*"               element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;