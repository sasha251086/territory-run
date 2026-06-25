import RunCelebrationOverlay from './RunCelebrationOverlay';
import type { ActivityStatusResult } from '../hooks/useActivityStatusPoll';

function buildResultsMessage(result: ActivityStatusResult): string {
  const parts: string[] = [];
  const captured = result.cellsCaptured ?? 0;
  const touched = result.cellsTouched ?? 0;
  const pvp = result.pvpCaptures ?? 0;
  const influence = Math.round(result.influenceAdded ?? 0);

  if (captured > 0) {
    parts.push(`Захвачено ${captured} клеток`);
  } else if (touched > 0) {
    parts.push(`Затронуто ${touched} клеток`);
  } else {
    parts.push('Пробежка засчитана');
  }

  if (pvp > 0) {
    parts.push(`${pvp} у соперников`);
  }

  if (influence > 0) {
    parts.push(`+${influence} влияния`);
  }

  return parts.join(' · ');
}

export default function ActivityResultsModal({
  result,
  cellsOwned,
  onDismiss,
}: {
  result: ActivityStatusResult;
  cellsOwned: number;
  onDismiss: () => void;
}) {
  return (
    <RunCelebrationOverlay
      cellsOwned={cellsOwned}
      message={buildResultsMessage(result)}
      onDismiss={onDismiss}
    />
  );
}
