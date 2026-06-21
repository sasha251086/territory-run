export interface ExternalActivity {
  id: string;
  distanceMeters: number;
  durationSeconds: number;
  startedAt: Date;
  finishedAt: Date;
  track: { lat: number; lng: number; timestamp?: string }[];
}

export interface ActivityProvider {
  getActivities(accessToken: string): Promise<ExternalActivity[]>;
  getActivity(accessToken: string, id: string): Promise<ExternalActivity>;
  sync(userId: string): Promise<{ imported: number; skipped: number }>;
}
