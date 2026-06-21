export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  homeLat: number | null;
  homeLng: number | null;
  createdAt: string;
  stats: UserStats | null;
}

export interface UserStats {
  userId: string;
  totalDistance: string;
  totalRuns: number;
  cellsOwned: number;
  totalInfluence: number;
  firstCaptureShownAt: string | null;
}

export interface MapCell {
  h3Index: string;
  ownerId: string | null;
  ownerNickname: string | null;
  influence: number;
  lastActivityAt: string | null;
  lat: number | null;
  lng: number | null;
}

export interface ActivityItem {
  id: string;
  source: string;
  distanceMeters: number;
  durationSeconds: number;
  avgPace: number | null;
  startedAt: string;
  finishedAt: string;
  status: 'processing' | 'completed' | 'failed';
  failureReason: string | null;
  processedAt: string | null;
}

export interface FeedEvent {
  id: string;
  type: string;
  userId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  user: { id: string; nickname: string; avatarUrl: string | null };
}

export interface LeaderboardEntry {
  userId: string;
  nickname: string;
  value: number;
}

export interface IntegrationInfo {
  provider: string;
  externalUserId: string | null;
  expiresAt: string;
  connected: boolean;
}
