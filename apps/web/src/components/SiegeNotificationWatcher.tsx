import { useAuth } from '../context/AuthContext';
import { useSiegeNotificationPolling } from '../hooks/useSiegeNotifications';

/** Polls feed for siege events when user enabled notifications in profile. */
export default function SiegeNotificationWatcher() {
  const { user } = useAuth();
  useSiegeNotificationPolling(user?.id, user?.homeLat, user?.homeLng);
  return null;
}
