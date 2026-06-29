import { streakBonusLabel, streakMultiplier } from '../constants/game';

export type StreakTier = 'none' | 'warm' | 'hot' | 'legend';

export function streakTier(streak: number): StreakTier {
  if (streak >= 14) return 'legend';
  if (streak >= 7) return 'hot';
  if (streak >= 4) return 'warm';
  return 'none';
}

export function streakTierTitle(tier: StreakTier): string {
  switch (tier) {
    case 'legend':
      return 'Легендарный стрик';
    case 'hot':
      return 'Горячий стрик';
    case 'warm':
      return 'Стрик набирает силу';
    default:
      return 'Стрик';
  }
}

export function streakTierEmoji(tier: StreakTier): string {
  switch (tier) {
    case 'legend':
      return '🔥✨';
    case 'hot':
      return '🔥🔥';
    case 'warm':
      return '🔥';
    default:
      return '';
  }
}

export function streakDisplay(streak: number): {
  tier: StreakTier;
  multiplier: number;
  bonusLabel: string;
  title: string;
  emoji: string;
  nextMilestone: number | null;
} {
  const tier = streakTier(streak);
  const multiplier = streakMultiplier(streak);
  let nextMilestone: number | null = null;
  if (streak < 4) nextMilestone = 4;
  else if (streak < 7) nextMilestone = 7;
  else if (streak < 14) nextMilestone = 14;

  return {
    tier,
    multiplier,
    bonusLabel: streakBonusLabel(streak),
    title: streakTierTitle(tier),
    emoji: streakTierEmoji(tier),
    nextMilestone,
  };
}
