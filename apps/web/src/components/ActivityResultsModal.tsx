import RunCelebrationOverlay, { type CelebrationStat } from './RunCelebrationOverlay';
import type { ActivityStatusResult } from '../hooks/useActivityStatusPoll';
import { shareRunResults } from '../utils/share-card';
import { useAuth } from '../context/AuthContext';
import { cellCountWord, formatCellCount } from '../utils/territory';

function buildResultsMessage(result: ActivityStatusResult): string {
  const parts: string[] = [];
  const captured = result.cellsCaptured ?? 0;
  const touched = result.cellsTouched ?? 0;
  const pvp = result.pvpCaptures ?? 0;
  const influence = Math.round(result.influenceAdded ?? 0);
  const km = (result.distanceMeters ?? 0) / 1000;

  if (captured > 0) {
    parts.push(`Захвачено ${formatCellCount(captured)}`);
  } else if (touched > 0) {
    parts.push(`Затронуто ${formatCellCount(touched)}`);
  } else {
    parts.push('Пробежка засчитана');
  }

  if (km > 0) {
    parts.push(`${km.toFixed(1)} км`);
  }

  if (pvp > 0) {
    parts.push(`${pvp} у соперников`);
  }

  if (influence > 0) {
    parts.push(`+${influence} влияния`);
  }

  return parts.join(' · ');
}

function buildCelebrationStats(result: ActivityStatusResult): CelebrationStat[] {
  const captured = result.cellsCaptured ?? result.cellsTouched ?? 0;
  const km = (result.distanceMeters ?? 0) / 1000;
  const influence = Math.round(result.influenceAdded ?? 0);
  const pvp = result.pvpCaptures ?? 0;

  return [
    { value: `+${captured}`, label: 'Клеток' },
    { value: pvp > 0 ? String(pvp) : km > 0 ? `${km.toFixed(1)}` : '—', label: pvp > 0 ? 'PvP' : 'Км' },
    { value: influence > 0 ? `+${influence}` : '—', label: 'Влияние' },
  ];
}

function buildHeadline(result: ActivityStatusResult): string {
  const captured = result.cellsCaptured ?? result.cellsTouched ?? 0;
  if (captured > 0) {
    return `+${captured} ${cellCountWord(captured)} захвачено`;
  }
  return 'Пробежка засчитана';
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
  const { user } = useAuth();
  const message = buildResultsMessage(result);
  const captured = result.cellsCaptured ?? result.cellsTouched ?? 0;
  const km = (result.distanceMeters ?? 0) / 1000;
  const influence = Math.round(result.influenceAdded ?? 0);

  async function handleShare() {
    await shareRunResults(
      {
        nickname: user?.nickname ?? 'runner',
        cellsCaptured: captured,
        km,
        influence,
        cellsOwned,
        areaLabel: user?.homeAreaLabel,
        pvpCaptures: result.pvpCaptures,
      },
      message,
    );
  }

  return (
    <RunCelebrationOverlay
      cellsOwned={cellsOwned}
      headline={buildHeadline(result)}
      message={message}
      stats={buildCelebrationStats(result)}
      onDismiss={onDismiss}
      onShare={() => void handleShare()}
    />
  );
}
