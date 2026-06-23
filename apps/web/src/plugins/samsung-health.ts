import { registerPlugin, Capacitor } from '@capacitor/core';

export interface SamsungWorkout {
  platformId: string;
  startDate: string;
  endDate: string;
  exerciseType: string;
  distanceMeters: number;
  durationSeconds: number;
  track: { lat: number; lng: number; timestamp: string }[];
}

export interface SamsungHealthPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestSamsungPermissions(): Promise<{ granted: boolean }>;
  getExercisesWithLocation(options: { days?: number }): Promise<{ workouts: SamsungWorkout[] }>;
}

export const SamsungHealth = registerPlugin<SamsungHealthPlugin>('SamsungHealth', {
  web: {
    isAvailable: async () => ({ available: false }),
    requestSamsungPermissions: async () => ({ granted: false }),
    getExercisesWithLocation: async () => ({ workouts: [] }),
  },
});

export async function isSamsungHealthAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (Capacitor.getPlatform() !== 'android') return false;
  try {
    const { available } = await SamsungHealth.isAvailable();
    return available;
  } catch {
    return false;
  }
}
