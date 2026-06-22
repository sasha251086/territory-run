import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AuthOnlyRoute from './components/AuthOnlyRoute';
import MapPage from './pages/MapPage';
import ActivitiesPage from './pages/ActivitiesPage';
import LeaderboardPage from './pages/LeaderboardPage';
import FeedPage from './pages/FeedPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OnboardingPage from './pages/OnboardingPage';
import StravaCallbackPage from './pages/StravaCallbackPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />

          <Route element={<AuthOnlyRoute />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/strava/callback" element={<StravaCallbackPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MapPage />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/feed" element={<FeedPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
