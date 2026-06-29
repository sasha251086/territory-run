import RunCelebrationOverlay, { type CelebrationStat } from './RunCelebrationOverlay';
import type { ActivityStatusResult } from '../hooks/useActivityStatusPoll';
import { shareRunResults } from '../utils/share-card';
import { useAuth } from '../context/AuthContext';
import { cellCountWord, formatCellCount } from '../utils/territory';
import { displayInfluence } from '../constants/game';
import { cellsWord } from '../utils/cell-lifespan';
import {
  MAINTENANCE_RUN_HEADLINE,
  MAINTENANCE_RUN_MESSAGE,
} from '../utils/run-labels';

function buildResultsMessage(result: ActivityStatusResult): string {
  const captured = result.cellsCaptured ?? 0;
  const touched = result.cellsTouched ?? 0;
  const stillAtRisk = result.cellsStillAtRisk ?? 0;
  const pvp = result.pvpCaptures ?? 0;

  if (stillAtRisk > 0) {
    return `${stillAtRisk} ${cellsWord(stillAtRisk)} ждут пробежки`;
  }
  if (captured > 0 && pvp > 0) {
    return `+${captured} ${cellCountWord(captured)} · ${pvp} у соперников`;
  }
  if (captured > 0) {
    return `Захвачено ${formatCellCount(captured)}`;
  }
  if (pvp > 0) {
    return `${pvp} ${pvp === 1 ? 'клетка' : pvp < 5 ? 'клетки' : 'клеток'} у соперников`;
  }
  if (touched > 0) {
    return MAINTENANCE_RUN_MESSAGE;
  }
  return 'Пробежка засчитана';
}

function buildHeadline(result: ActivityStatusResult): string {
  const captured = result.cellsCaptured ?? 0;
  const pvp = result.pvpCaptures ?? 0;
  if (captured > 0) {
    return `+${captured} ${cellCountWord(captured)}`;
  }
  if (pvp > 0) {
    return `+${pvp} у соперников`;
  }
  if ((result.cellsTouched ?? 0) > 0) {
    return MAINTENANCE_RUN_HEADLINE;
  }
  return 'Готово';
}

function buildCelebrationStats(result: ActivityStatusResult): CelebrationStat[] {
  const captured = result.cellsCaptured ?? result.cellsTouched ?? 0;
  const km = (result.distanceMeters ?? 0) / 1000;
  const influence = displayInfluence(result.influenceAdded ?? 0);
  const pvp = result.pvpCaptures ?? 0;

  return [
    { value: `+${captured}`, label: 'Клеток' },
    {
      value: influence > 0 ? `+${influence}` : km > 0 ? `${km.toFixed(1)}` : '—',
      label: influence > 0 ? 'Влияние' : 'Км',
    },
    { value: pvp > 0 ? String(pvp) : '—', label: pvp > 0 ? 'У соперников' : ' ' },
  ];
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
  const influence = displayInfluence(result.influenceAdded ?? 0);

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
