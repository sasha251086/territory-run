import { registerPlugin } from '@capacitor/core';

export interface ExerciseSession {
  recordId: string;
  startDate: string;
  endDate: string;
  exerciseType: number;
  /** true = маршрут есть (Data) или нужен диалог согласия (ConsentRequired) */
  hasRoute: boolean;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: string;
  altitude?: number;
}

export interface ExerciseRoutePlugin {
  getExerciseSessions(options: { days?: number }): Promise<{ sessions: ExerciseSession[] }>;
  requestRoute(options: { recordId: string }): Promise<{ recordId: string; points: RoutePoint[] }>;
}

export const ExerciseRoute = registerPlugin<ExerciseRoutePlugin>('ExerciseRoute', {
  web: {
    getExerciseSessions: async () => ({ sessions: [] }),
    requestRoute: async () => ({ recordId: '', points: [] }),
  },
});
