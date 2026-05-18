import { useAuth } from '../context/AuthContext';
import BuyerDashboard    from './dashboard/BuyerDashboard';
import SupplierDashboard from './dashboard/SupplierDashboard';

export default function Dashboard() {
  const { user } = useAuth();

  if (user?.role === 'buyer')    return <BuyerDashboard />;
  if (user?.role === 'supplier') return <SupplierDashboard />;
  return <p>Rol necunoscut</p>;
}