import { CONTEST_GAP_ABSOLUTE, CONTEST_GAP_RELATIVE } from './constants';

export type OwnershipRankInput = {
  influence: number;
  lastActivityAt: Date | string;
};

function activityTimestamp(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function compareOwnershipRank<T extends OwnershipRankInput>(a: T, b: T): number {
  const aInfluence = Number(a.influence);
  const bInfluence = Number(b.influence);
  if (bInfluence !== aInfluence) {
    return bInfluence - aInfluence;
  }
  return activityTimestamp(b.lastActivityAt) - activityTimestamp(a.lastActivityAt);
}

export function rankCellOwnerships<T extends OwnershipRankInput>(ownerships: T[]): T[] {
  return [...ownerships].sort(compareOwnershipRank);
}

export function contestGapThreshold(leaderInfluence: number): number {
  return Math.max(CONTEST_GAP_ABSOLUTE, leaderInfluence * CONTEST_GAP_RELATIVE);
}

export function influenceGap(leaderInfluence: number, challengerInfluence: number): number {
  return Math.max(0, leaderInfluence - challengerInfluence);
}

export function isCellContested(leaderInfluence: number, challengerInfluence: number): boolean {
  const challenger = Number(challengerInfluence);
  const leader = Number(leaderInfluence);
  if (challenger <= 0) {
    return false;
  }
  return influenceGap(leader, challenger) <= contestGapThreshold(leader);
}

export function getCellContestState(leaderInfluence: number, challengerInfluence: number) {
  const leader = Number(leaderInfluence);
  const challenger = Number(challengerInfluence);
  const contested = isCellContested(leader, challenger);
  const gap = influenceGap(leader, challenger);
  return {
    contested,
    contestGap: contested ? gap : 0,
    tiedOnInfluence: contested && gap === 0,
  };
}
