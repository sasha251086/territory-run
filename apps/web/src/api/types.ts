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
  homeAreaLabel?: string | null;
  freezeActive: boolean;
  freezeActivatedAt: string | null;
  freezeLastUsedAt: string | null;
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
  gameTutorialShownAt?: string | null;
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
  contested?: boolean;
  contestGap?: number;
  challengerNickname?: string | null;
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
  contested: boolean;
  contestGap: number | null;
  tiedOnInfluence: boolean;
  challengerNickname: string | null;
  myLastActivityAt?: string | null;
  daysSinceMyActivity?: number | null;
  decayRisk?: DecayRisk;
  freshness?: 'fresh' | 'warning' | 'critical';
  dailyInfluenceLoss?: number;
  daysUntilWipe?: number | null;
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
  category: 'capture' | 'finish' | 'defend' | 'expand';
}

export interface MissionHint {
  category: 'capture' | 'finish' | 'defend' | 'expand';
  label: string;
  count: number;
}

export interface WeeklyReport {
  cellsGained: number;
  weeklyGoal: number;
  progressPercent: number;
  headline: string;
  rivalNickname?: string | null;
  rivalBeat?: boolean;
}

export interface MapSummary {
  cellsAtRisk: number;
  cellsFresh: number;
  cellsWarning: number;
  cellsCritical: number;
  dailyInfluenceLoss: number;
  captureTargetsNearby: number;
  territoryAreaM2: number;
  cellsGainedThisWeek: number;
  weeklyProgressPercent: number;
  missions?: MissionHint[];
  influencePerRun?: number;
  effectiveInfluenceMultiplier?: number;
  influenceMultiplierCapped?: boolean;
  atSoftCap?: boolean;
  locationMultiplier?: number;
  streakMultiplier?: number;
  softCapMultiplier?: number;
  weeklyReport?: WeeklyReport;
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
  cellsCaptured?: number | null;
  cellsTouched?: number | null;
  newCellsCaptured?: number | null;
  pvpCaptures?: number | null;
  influenceAdded?: number | null;
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
  rank?: number;
  userId: string;
  nickname: string;
  avatarUrl?: string | null;
  value: number;
}

export interface RegionalLeaderboardEntry extends LeaderboardEntry {
  rank: number;
  distanceKm: number;
}

export interface RegionalLeaderboardResponse {
  noHomeBase: boolean;
  items: RegionalLeaderboardEntry[];
}

export interface SeasonLeaderboardEntry {
  rank: number;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  value: number;
  seasonInfluence: number;
}

export interface SeasonLeaderboardResponse {
  season: {
    number: number;
    startDate: string;
    endDate: string;
    daysLeft: number;
  } | null;
  items: SeasonLeaderboardEntry[];
}

export interface SeasonHistoryEntry {
  seasonNumber: number;
  rank: number;
  cellsOwned: number;
  totalInfluence: number;
  endedAt: string;
}

export interface IntegrationInfo {
  provider: string;
  externalUserId: string | null;
  expiresAt: string;
  connected: boolean;
}
