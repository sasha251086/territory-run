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
  currentStreak: number;
  firstCaptureShownAt: string | null;
}

export type DecayRisk = 'none' | 'warning' | 'critical';

export interface MapCell {
  h3Index: string;
  ownerId: string | null;
  ownerNickname: string | null;
  influence: number;
  lastActivityAt: string | null;
  lat: number | null;
  lng: number | null;
  myInfluence?: number;
  myLastActivityAt?: string | null;
  daysSinceMyActivity?: number | null;
  decayRisk?: DecayRisk;
  isOwner?: boolean;
  gapToLeader?: number;
  runsToCapture?: number;
  myRank?: number | null;
}

export interface CellPlayer {
  rank: number;
  userId: string;
  nickname: string;
  influence: number;
  isMe: boolean;
}

export interface CellHistoryEntry {
  fromNickname: string | null;
  toNickname: string;
  changedAt: string;
}

export interface CellPlayersResponse {
  h3Index: string;
  players: CellPlayer[];
  myInfluence: number;
  myRank: number | null;
  leaderInfluence: number;
  gapToLeader: number;
  runsToCapture: number;
  isOwner: boolean;
  leadOverNext: number | null;
  history: CellHistoryEntry[];
}

export interface CaptureTarget {
  h3Index: string;
  lat: number;
  lng: number;
  myInfluence: number;
  leaderInfluence: number;
  gap: number;
  runsNeeded: number;
  ownerNickname: string | null;
}

export interface MapSummary {
  cellsAtRisk: number;
  captureTargetsNearby: number;
}

export interface RivalCell {
  h3Index: string;
  targetUserId: string;
  nickname: string;
  lat: number;
  lng: number;
}

export interface RivalFollow {
  userId: string;
  nickname: string;
  cellsOwned?: number;
  totalInfluence?: number;
  followedAt: string;
}

export interface DistrictListItem {
  id: string;
  name: string;
  polygon: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
  king: { userId: string; nickname: string } | null;
}

export interface DistrictProgress {
  districtId: string;
  districtName: string;
  myControlPercent: number;
  kingThresholdPercent: number;
  isKing: boolean;
  king: { userId: string; nickname: string; controlPercent: number | null } | null;
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
