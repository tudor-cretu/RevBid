import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login              from './pages/Login';
import Register          from './pages/Register';
import ForgotPassword    from './pages/ForgotPassword';
import ResetPassword     from './pages/ResetPassword';
import Dashboard         from './pages/Dashboard';
import CreateAuction     from './pages/CreateAuction';
import AdminDashboard    from './pages/AdminDashboard';
import AuctionDetail     from './pages/AuctionDetail';
import AuctionRequestForm from './pages/AuctionRequestForm';
import VerifyEmail       from './pages/VerifyEmail';
import AuthCallback      from './pages/AuthCallback';
import Navbar            from './components/Navbar';
import Settings          from './pages/Settings';
import Support           from './pages/Support';
import PublicProfile     from './pages/PublicProfile';
import Messages          from './pages/Messages';
import LandingPage       from './pages/LandingPage';
import MyBids            from './pages/MyBids';
import Notifications     from './pages/Notifications';
import BuyerStatistici    from './pages/dashboard/BuyerAnalytics';
import SupplierStatistici from './pages/dashboard/SupplierAnalytics';
import './App.css';

/* Router statistici — alege componenta corectă în funcție de rol.
   Adminii sunt redirecționați la dashboard (nu au statistici proprii). */
function StatisticiRouter() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'buyer')    return <BuyerStatistici />;
  if (user.role === 'supplier') return <SupplierStatistici />;
  return <Navigate to="/dashboard" />;
}

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
          <Route path="/verify-email"     element={<VerifyEmail />} />
          <Route path="/forgot-password"  element={<ForgotPassword />} />
          <Route path="/reset-password"   element={<ResetPassword />} />
          <Route path="/auth/callback"    element={<AuthCallback />} />
          <Route path="/dashboard"      element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard/statistici" element={<ProtectedRoute><StatisticiRouter /></ProtectedRoute>} />
          <Route path="/auction/create"              element={<ProtectedRoute><CreateAuction /></ProtectedRoute>} />
          <Route path="/auction/:id/edit"            element={<ProtectedRoute><CreateAuction /></ProtectedRoute>} />
          <Route path="/auction/:id"                 element={<ProtectedRoute><AuctionDetail /></ProtectedRoute>} />
          <Route path="/auction/:id/edit-request"    element={<ProtectedRoute><AuctionRequestForm /></ProtectedRoute>} />
          <Route path="/my-bids"                     element={<ProtectedRoute><MyBids /></ProtectedRoute>} />
          <Route path="/admin"                       element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/settings"       element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/support"        element={<ProtectedRoute><Support /></ProtectedRoute>} />
          <Route path="/profile/:id"    element={<ProtectedRoute><PublicProfile /></ProtectedRoute>} />
          <Route path="/messages"       element={<ProtectedRoute><Messages /></ProtectedRoute>} />
          <Route path="/notifications"  element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
          <Route path="*"               element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;