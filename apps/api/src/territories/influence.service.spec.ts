import { Test, TestingModule } from '@nestjs/testing';
import { InfluenceService } from './influence.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  cell: { upsert: jest.fn() },
  cellOwnership: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  user: { findUnique: jest.fn() },
};

describe('InfluenceService', () => {
  let service: InfluenceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InfluenceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<InfluenceService>(InfluenceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should process track and return unique cells', async () => {
    const track = [
      { lat: 56.95, lng: 24.1 },
      { lat: 56.96, lng: 24.11 },
      { lat: 56.97, lng: 24.12 },
    ];
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user1',
      homeLat: null,
      homeLng: null,
      createdAt: new Date('2020-01-01'),
    });
    mockPrisma.cell.upsert.mockResolvedValue({});
    mockPrisma.cellOwnership.findUnique.mockResolvedValue(null);
    mockPrisma.cellOwnership.create.mockResolvedValue({});

    const result = await service.processTrack('user1', track);
    expect(result).toHaveLength(3);
    expect(mockPrisma.cellOwnership.create).toHaveBeenCalledTimes(3);
  });

  it('should cap influence at 100 when existing + gain exceeds limit', async () => {
    const track = [{ lat: 56.95, lng: 24.1 }];
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user1',
      homeLat: null,
      homeLng: null,
      createdAt: new Date('2020-01-01'),
    });
    mockPrisma.cell.upsert.mockResolvedValue({});
    mockPrisma.cellOwnership.findUnique.mockResolvedValue({
      h3Index: 'cell1',
      userId: 'user1',
      influence: 99.5,
    });
    mockPrisma.cellOwnership.update.mockResolvedValue({});

    await service.processTrack('user1', track);

    expect(mockPrisma.cellOwnership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ influence: 100 }),
      }),
    );
  });

  it('should apply new player bonus on new cells outside home zone', async () => {
    const track = [{ lat: 56.95, lng: 24.1 }];
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user1',
      homeLat: null,
      homeLng: null,
      createdAt: oneDayAgo,
    });
    mockPrisma.cell.upsert.mockResolvedValue({});
    mockPrisma.cellOwnership.findUnique.mockResolvedValue(null);
    mockPrisma.cellOwnership.create.mockResolvedValue({});

    await service.processTrack('user1', track);

    expect(mockPrisma.cellOwnership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ influence: 1.25 }),
      }),
    );
  });

  it('should not stack new player bonus with home zone bonus', async () => {
    const track = [{ lat: 56.95, lng: 24.1 }];
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user1',
      homeLat: 56.95,
      homeLng: 24.1,
      createdAt: oneDayAgo,
    });
    mockPrisma.cell.upsert.mockResolvedValue({});
    mockPrisma.cellOwnership.findUnique.mockResolvedValue(null);
    mockPrisma.cellOwnership.create.mockResolvedValue({});

    await service.processTrack('user1', track);

    expect(mockPrisma.cellOwnership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ influence: 1.5 }),
      }),
    );
  });
});
