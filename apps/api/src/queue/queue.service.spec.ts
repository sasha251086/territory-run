import { ActivityStatus } from '@prisma/client';
import { QueueService } from './queue.service';
import { AnticheatService } from '../activities/anticheat.service';

const mockPrisma = {
  activity: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  userStats: {
    upsert: jest.fn(),
    update: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

const mockInfluenceService = {
  processTrack: jest.fn(),
};

const mockOwnershipService = {
  recalculateOwners: jest.fn(),
};

const mockFeedService = {
  createEvent: jest.fn(),
};

const mockRedisService = {
  set: jest.fn(),
};

describe('QueueService anticheat integration', () => {
  let service: QueueService;
  let anticheatService: AnticheatService;

  beforeEach(() => {
    jest.clearAllMocks();
    anticheatService = new AnticheatService();
    service = new QueueService(
      mockPrisma as never,
      mockRedisService as never,
      mockInfluenceService as never,
      mockOwnershipService as never,
      mockFeedService as never,
      anticheatService,
    );
  });

  it('should not update territories when track exceeds speed limit', async () => {
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: 'activity-1',
      userId: 'user-1',
      distanceMeters: 5000,
      durationSeconds: 1800,
      track: {
        route: [
          { lat: 56.95, lng: 24.1, timestamp: '2026-06-21T10:00:00.000Z' },
          { lat: 56.96, lng: 24.11, timestamp: '2026-06-21T10:00:05.000Z' },
        ],
      },
    });

    await service.processActivity('activity-1');

    expect(mockInfluenceService.processTrack).not.toHaveBeenCalled();
    expect(mockOwnershipService.recalculateOwners).not.toHaveBeenCalled();
    expect(mockPrisma.activity.update).toHaveBeenCalledWith({
      where: { id: 'activity-1' },
      data: expect.objectContaining({
        status: ActivityStatus.failed,
        failureReason: 'SPEED_EXCEEDED',
      }),
    });
    expect(mockFeedService.createEvent).toHaveBeenCalledWith(
      'activity_completed',
      'user-1',
      expect.objectContaining({
        flagged: true,
        reason: 'SPEED_EXCEEDED',
        cellsAffected: 0,
      }),
    );
  });
});
