import { StravaService } from './strava.service';
import { ActivitiesService } from '../../../activities/activities.service';

const mockPrisma = {
  integration: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  processedActivity: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockActivitiesService = {
  createFromExternal: jest.fn(),
  enqueueActivity: jest.fn(),
};

describe('StravaService sync deduplication', () => {
  let service: StravaService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRAVA_CLIENT_ID = 'test-client-id';
    process.env.STRAVA_CLIENT_SECRET = 'test-client-secret';
    process.env.STRAVA_REDIRECT_URI = 'http://localhost:3000/callback';

    service = new StravaService(
      mockPrisma as never,
      mockActivitiesService as never,
    );
  });

  it('should skip already processed Strava activities', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({
      id: 'integration-1',
      userId: 'user-1',
      provider: 'strava',
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: new Date(Date.now() + 3600_000),
    });

    jest.spyOn(service, 'getActivities').mockResolvedValue([
      {
        id: '12345',
        distanceMeters: 5000,
        durationSeconds: 1800,
        startedAt: new Date('2026-06-21T10:00:00.000Z'),
        finishedAt: new Date('2026-06-21T10:30:00.000Z'),
        track: [{ lat: 56.95, lng: 24.1 }],
      },
    ]);

    mockPrisma.processedActivity.findUnique.mockResolvedValue({
      provider: 'strava',
      externalActivityId: '12345',
    });

    const result = await service.sync('user-1');

    expect(result).toEqual({ imported: 0, skipped: 1 });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockActivitiesService.createFromExternal).not.toHaveBeenCalled();
    expect(mockActivitiesService.enqueueActivity).not.toHaveBeenCalled();
  });

  it('should import new Strava activities and mark them processed', async () => {
    mockPrisma.integration.findUnique.mockResolvedValue({
      id: 'integration-1',
      userId: 'user-1',
      provider: 'strava',
      accessToken: 'token',
      refreshToken: 'refresh',
      expiresAt: new Date(Date.now() + 3600_000),
    });

    jest.spyOn(service, 'getActivities').mockResolvedValue([
      {
        id: '67890',
        distanceMeters: 4200,
        durationSeconds: 1500,
        startedAt: new Date('2026-06-21T11:00:00.000Z'),
        finishedAt: new Date('2026-06-21T11:25:00.000Z'),
        track: [
          { lat: 56.95, lng: 24.1, timestamp: '2026-06-21T11:00:00.000Z' },
          { lat: 56.951, lng: 24.101, timestamp: '2026-06-21T11:01:00.000Z' },
        ],
      },
    ]);

    mockPrisma.processedActivity.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback({
        processedActivity: { create: jest.fn() },
      }),
    );
    mockActivitiesService.createFromExternal.mockResolvedValue({ id: 'activity-1' });

    const result = await service.sync('user-1');

    expect(result).toEqual({ imported: 1, skipped: 0 });
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockActivitiesService.enqueueActivity).toHaveBeenCalledWith('activity-1');
  });
});
