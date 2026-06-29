import {
  compareOwnershipRank,
  getCellContestState,
  isCellContested,
  rankCellOwnerships,
} from './cell-ownership.util';

describe('cell-ownership.util', () => {
  const older = new Date('2026-06-20T10:00:00Z');
  const newer = new Date('2026-06-25T10:00:00Z');

  it('ranks by influence then last activity', () => {
    const ranked = rankCellOwnerships([
      { userId: 'a', influence: 100, lastActivityAt: older },
      { userId: 'b', influence: 200, lastActivityAt: older },
      { userId: 'c', influence: 100, lastActivityAt: newer },
    ] as Array<{ userId: string; influence: number; lastActivityAt: Date }>);

    expect(ranked.map((row) => row.userId)).toEqual(['b', 'c', 'a']);
  });

  it('uses last activity as tie-breaker', () => {
    const result = compareOwnershipRank(
      { influence: 100, lastActivityAt: older },
      { influence: 100, lastActivityAt: newer },
    );
    expect(result).toBeGreaterThan(0);
  });

  it('tie-breaks when last activity comes from redis json strings', () => {
    const ranked = rankCellOwnerships([
      { userId: 'a', influence: 100, lastActivityAt: older.toISOString() },
      { userId: 'b', influence: 100, lastActivityAt: newer.toISOString() },
    ] as Array<{ userId: string; influence: number; lastActivityAt: string }>);

    expect(ranked.map((row) => row.userId)).toEqual(['b', 'a']);
  });

  it('marks close influence as contested', () => {
    expect(isCellContested(1000, 950)).toBe(true);
    expect(isCellContested(100, 100)).toBe(true);
    expect(isCellContested(1000, 500)).toBe(false);
  });

  it('reports tied contest state', () => {
    expect(getCellContestState(100, 100)).toEqual({
      contested: true,
      contestGap: 0,
      tiedOnInfluence: true,
    });
  });
});
