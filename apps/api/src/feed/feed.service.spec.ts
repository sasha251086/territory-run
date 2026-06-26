import { FeedService } from './feed.service';

describe('FeedService.shouldShowInFeed', () => {
  const service = new FeedService({} as never);

  it('hides cell_captured spam', () => {
    expect(
      service.shouldShowInFeed({
        type: 'cell_captured',
        payload: {},
      }),
    ).toBe(false);
  });

  it('hides short and empty activities', () => {
    expect(
      service.shouldShowInFeed({
        type: 'activity_completed',
        payload: { distance: 50, cellsAffected: 3 },
      }),
    ).toBe(false);

    expect(
      service.shouldShowInFeed({
        type: 'activity_completed',
        payload: { distance: 0, cellsAffected: 0 },
      }),
    ).toBe(false);
  });

  it('keeps valid activity_completed rows', () => {
    expect(
      service.shouldShowInFeed({
        type: 'activity_completed',
        payload: { distance: 5000, cellsCaptured: 7 },
      }),
    ).toBe(true);
  });
});

describe('FeedService.dedupeFeedEvents', () => {
  const service = new FeedService({} as never);

  it('dedupes siege events for same cell and challenger', () => {
    const list = [
      {
        type: 'cell_siege',
        userId: 'owner-1',
        payload: { h3Index: 'abc', challengerUserId: 'rival-1' },
      },
      {
        type: 'cell_siege',
        userId: 'owner-1',
        payload: { h3Index: 'abc', challengerUserId: 'rival-1' },
      },
    ];

    expect(service.dedupeFeedEvents(list)).toHaveLength(1);
  });
});

describe('FeedService.shouldKeepInFeedPage', () => {
  const service = new FeedService({} as never);

  it('dedupes siege events for same cell and challenger', () => {
    const list = [
      {
        type: 'cell_siege',
        userId: 'owner-1',
        payload: { h3Index: 'abc', challengerUserId: 'rival-1' },
      },
      {
        type: 'cell_siege',
        userId: 'owner-1',
        payload: { h3Index: 'abc', challengerUserId: 'rival-1' },
      },
    ];

    expect(service.shouldKeepInFeedPage(list[0], 0, list)).toBe(true);
    expect(service.shouldKeepInFeedPage(list[1], 1, list)).toBe(false);
  });
});
