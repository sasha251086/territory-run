import { useAuth } from '../context/AuthContext';
import { useSamsungAutoSync } from '../hooks/useSamsungAutoSync';

/** Imports new Samsung Health runs when auto-sync is enabled in profile. */
export default function SamsungAutoSyncWatcher() {
  const { user } = useAuth();
  useSamsungAutoSync(user?.id);
  return null;
}
