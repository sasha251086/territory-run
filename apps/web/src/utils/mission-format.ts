import type { MissionHint } from '../api/types';

const MISSION_SHORT: Record<MissionHint['category'], string> = {
  defend: 'Защити',
  finish: 'Добей',
  capture: 'Захвати',
  expand: 'Расширь',
};

export function formatMissionSummary(missions: MissionHint[]): string {
  return missions
    .map((mission) => `${MISSION_SHORT[mission.category]} (${mission.count})`)
    .join(' · ');
}

export function missionTargetCount(missions: MissionHint[]): number {
  return missions.reduce((sum, mission) => sum + mission.count, 0);
}

const TODAY_LABELS: Record<MissionHint['category'], string> = {
  defend: 'защитить',
  finish: 'добить',
  capture: 'захватить',
  expand: 'расширить',
};

/** Одна строка для блока «Сегодня» на карте: «1 защитить · 5 расширить». */
export function formatTodayMissions(missions: MissionHint[]): string {
  return missions
    .filter((mission) => mission.count > 0)
    .map((mission) => `${mission.count} ${TODAY_LABELS[mission.category]}`)
    .join(' · ');
}
