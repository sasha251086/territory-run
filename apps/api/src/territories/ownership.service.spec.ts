import { Test, TestingModule } from '@nestjs/testing';
import { OwnershipService } from './ownership.service';
import { PrismaService } from '../prisma/prisma.service';
import { FeedService } from '../feed/feed.service';
import { DistrictService } from '../districts/district.service';

const mockPrisma = {
  cellOwnership: {
    findMany: jest.fn(),
  },
  cellHistory: {
    create: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
};

const mockFeedService = {
  createEvent: jest.fn(),
  hasRecentSiegeEvent: jest.fn(),
};

const mockDistrictService = {
  recalculateForCells: jest.fn(),
};

describe('OwnershipService', () => {
  let service: OwnershipService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFeedService.hasRecentSiegeEvent.mockResolvedValue(false);
    mockDistrictService.recalculateForCells.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnershipService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FeedService, useValue: mockFeedService },
        { provide: DistrictService, useValue: mockDistrictService },
      ],
    }).compile();

    service = module.get<OwnershipService>(OwnershipService);
  });

  it('snapshotOwners picks leader with tie-breaker', async () => {
    mockPrisma.cellOwnership.findMany.mockResolvedValue([
      { h3Index: 'a', userId: 'user-1', influence: 2, lastActivityAt: new Date('2026-06-20') },
      { h3Index: 'b', userId: 'user-2', influence: 1, lastActivityAt: new Date('2026-06-25') },
      { h3Index: 'b', userId: 'user-3', influence: 1, lastActivityAt: new Date('2026-06-20') },
    ]);

    const snapshot = await service.snapshotOwners(['a', 'b', 'c']);

    expect(mockPrisma.cellOwnership.findMany).toHaveBeenCalledTimes(1);
    expect(snapshot.get('a')).toBe('user-1');
    expect(snapshot.get('b')).toBe('user-2');
    expect(snapshot.get('c')).toBeNull();
  });
});
