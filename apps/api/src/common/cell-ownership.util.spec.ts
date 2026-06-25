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
      { userId: 'a', influence: 1, lastActivityAt: older },
      { userId: 'b', influence: 2, lastActivityAt: older },
      { userId: 'c', influence: 1, lastActivityAt: newer },
    ] as Array<{ userId: string; influence: number; lastActivityAt: Date }>);

    expect(ranked.map((row) => row.userId)).toEqual(['b', 'c', 'a']);
  });

  it('uses last activity as tie-breaker', () => {
    const result = compareOwnershipRank(
      { influence: 1, lastActivityAt: older },
      { influence: 1, lastActivityAt: newer },
    );
    expect(result).toBeGreaterThan(0);
  });

  it('tie-breaks when last activity comes from redis json strings', () => {
    const ranked = rankCellOwnerships([
      { userId: 'a', influence: 1, lastActivityAt: older.toISOString() },
      { userId: 'b', influence: 1, lastActivityAt: newer.toISOString() },
    ] as Array<{ userId: string; influence: number; lastActivityAt: string }>);

    expect(ranked.map((row) => row.userId)).toEqual(['b', 'a']);
  });

  it('marks close influence as contested', () => {
    expect(isCellContested(10, 9.5)).toBe(true);
    expect(isCellContested(1, 1)).toBe(true);
    expect(isCellContested(10, 5)).toBe(false);
  });

  it('reports tied contest state', () => {
    expect(getCellContestState(1, 1)).toEqual({
      contested: true,
      contestGap: 0,
      tiedOnInfluence: true,
    });
  });
});
