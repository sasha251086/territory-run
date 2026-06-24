import { Outlet, useLocation } from 'react-router-dom';
import TrNavBar from './TrNavBar';
export default function AppLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();
  const isMapRoute = location.pathname === '/';

  return (
    <div className={`tr-app tr-app-shell${isMapRoute ? ' map-shell' : ''}`}>
      <main className="tr-app-main app-main">{children ?? <Outlet />}</main>
      <TrNavBar />
    </div>
  );
}
