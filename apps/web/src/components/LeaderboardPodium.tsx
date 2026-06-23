import type { LeaderboardEntry } from '../api/types';

const PODIUM_ORDER = [1, 0, 2] as const;

export default function LeaderboardPodium({
  items,
  currentUserId,
  valueLabel,
}: {
  items: LeaderboardEntry[];
  currentUserId?: string;
  valueLabel: (value: number) => string;
}) {
  const top3 = items.slice(0, 3);
  if (top3.length === 0) {
    return null;
  }

  return (
    <div className="leaderboard-podium" aria-label="Топ-3 игроков">
      {PODIUM_ORDER.map((slot) => {
        const entry = top3[slot];
        if (!entry) {
          return <div key={`empty-${slot}`} className="podium-slot podium-empty" />;
        }
        const rank = slot + 1;
        const isYou = entry.userId === currentUserId;
        return (
          <div
            key={entry.userId}
            className={`podium-slot podium-rank-${rank}${isYou ? ' is-you' : ''}`}
          >
            <div className="podium-avatar" aria-hidden="true">
              {rank === 1 ? '👑' : rank}
            </div>
            <strong>{entry.nickname}</strong>
            <span>{valueLabel(Math.round(entry.value))}</span>
          </div>
        );
      })}
    </div>
  );
}
