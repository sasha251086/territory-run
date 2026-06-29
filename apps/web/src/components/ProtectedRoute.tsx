import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import SiegeNotificationWatcher from '../components/SiegeNotificationWatcher';
import SamsungAutoSyncWatcher from '../components/SamsungAutoSyncWatcher';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="page-center">Подключаемся…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.homeLat == null || user.homeLng == null) {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <AppLayout>
      <SiegeNotificationWatcher />
      <SamsungAutoSyncWatcher />
      <Outlet />
    </AppLayout>
  );
}
