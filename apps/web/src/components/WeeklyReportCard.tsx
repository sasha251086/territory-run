import type { WeeklyReport } from '../api/types';
import { formatCellCount } from '../utils/territory';

export default function WeeklyReportCard({
  report,
  compact = false,
}: {
  report: WeeklyReport;
  compact?: boolean;
}) {
  const progress = Math.min(100, Math.max(0, report.progressPercent));

  return (
    <div className={`weekly-report${compact ? ' weekly-report--compact' : ''}`}>
      <div className="weekly-report__head">
        <h3 className="weekly-report__title">{compact ? 'Неделя' : 'Итоги недели'}</h3>
        {report.cellsGained > 0 && (
          <span className="weekly-report__gain">+{formatCellCount(report.cellsGained)}</span>
        )}
      </div>
      <p className="weekly-report__headline">{report.headline}</p>
      <div
        className="weekly-report__bar"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Прогресс недельной цели: ${progress}%`}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      <p className="muted small weekly-report__goal">
        Цель: {report.weeklyGoal} {report.weeklyGoal === 1 ? 'клетка' : report.weeklyGoal < 5 ? 'клетки' : 'клеток'}
        {progress > 0 ? ` · ${progress}%` : ''}
      </p>
    </div>
  );
}
