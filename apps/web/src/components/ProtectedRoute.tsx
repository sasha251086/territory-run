import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="page-center">Загрузка...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.homeLat == null || user.homeLng == null) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
