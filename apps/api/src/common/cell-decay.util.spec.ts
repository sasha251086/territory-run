import {
  dailyDecayLoss,
  describeCellLifespan,
  freshnessStatus,
  coerceActivityDate,
  daysSinceActivity,
} from './cell-decay.util';

describe('cell-decay.util', () => {
  it('coerces ISO strings for activity dates', () => {
    const iso = '2026-06-20T12:00:00.000Z';
    expect(coerceActivityDate(iso)?.toISOString()).toBe(iso);
    expect(daysSinceActivity(iso)).not.toBeNull();
  });
  it('treats recent visits as fresh with no decay', () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(freshnessStatus(recent)).toBe('fresh');
    expect(dailyDecayLoss(5000, recent)).toBe(0);
  });

  it('applies 2% decay after grace period', () => {
    const stale = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(freshnessStatus(stale)).toBe('warning');
    expect(dailyDecayLoss(5000, stale)).toBe(100);
    expect(dailyDecayLoss(225, stale)).toBe(5);
  });

  it('summarizes lifespan for UI', () => {
    const stale = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000);
    const summary = describeCellLifespan(7800, stale);
    expect(summary.freshness).toBe('critical');
    expect(summary.dailyLossInternal).toBe(156);
    expect(summary.dailyLossDisplay).toBe(2);
    expect(summary.daysUntilWipe).toBe(48);
  });
});
