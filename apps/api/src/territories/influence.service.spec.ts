import { Test, TestingModule } from '@nestjs/testing';
import * as h3 from 'h3-js';
import { InfluenceService } from './influence.service';
import { PrismaService } from '../prisma/prisma.service';
import { DistrictService } from '../districts/district.service';

const mockPrisma = {
  cell: { findMany: jest.fn(), createMany: jest.fn() },
  cellOwnership: { findMany: jest.fn(), update: jest.fn(), createMany: jest.fn() },
  user: { findUnique: jest.fn() },
  $transaction: jest.fn(),
  $executeRaw: jest.fn(),
};

const mockDistrictService = {
  assignCellToDistrict: jest.fn(),
  assignCellsToDistricts: jest.fn(),
};

describe('InfluenceService', () => {
  let service: InfluenceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.cell.findMany.mockResolvedValue([]);
    mockPrisma.cellOwnership.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InfluenceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DistrictService, useValue: mockDistrictService },
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
      stats: { currentStreak: 0, cellsOwned: 0 },
    });
    mockPrisma.cell.createMany.mockResolvedValue({ count: 3 });
    mockPrisma.cellOwnership.createMany.mockResolvedValue({ count: 3 });

    const result = await service.processTrack('user1', track);
    expect(result.h3Indices).toHaveLength(3);
    expect(mockPrisma.cellOwnership.createMany).toHaveBeenCalled();
  });

  it('should cap influence at 100 when existing + gain exceeds limit', async () => {
    const track = [
      { lat: 56.95, lng: 24.1 },
      { lat: 56.951, lng: 24.1 },
    ];
    const h3Index = h3.latLngToCell(56.95, 24.1, 9);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user1',
      homeLat: null,
      homeLng: null,
      createdAt: new Date('2020-01-01'),
      stats: { currentStreak: 0, cellsOwned: 0 },
    });
    mockPrisma.cellOwnership.findMany.mockResolvedValue([
      {
        h3Index,
        userId: 'user1',
        influence: 99.5,
      },
    ]);
    mockPrisma.cellOwnership.update.mockResolvedValue({});

    await service.processTrack('user1', track);

    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
  });

  it('should apply new player bonus on new cells outside home zone', async () => {
    const track = [
      { lat: 56.95, lng: 24.1 },
      { lat: 56.951, lng: 24.1 },
    ];
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user1',
      homeLat: null,
      homeLng: null,
      createdAt: oneDayAgo,
      stats: { currentStreak: 0, cellsOwned: 0 },
    });
    mockPrisma.cellOwnership.createMany.mockResolvedValue({ count: 1 });

    await service.processTrack('user1', track);

    expect(mockPrisma.cellOwnership.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ influence: 1.25 }),
        ]),
      }),
    );
  });

  it('should not stack new player bonus with home zone bonus', async () => {
    const track = [
      { lat: 56.95, lng: 24.1 },
      { lat: 56.951, lng: 24.1 },
    ];
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user1',
      homeLat: 56.95,
      homeLng: 24.1,
      createdAt: oneDayAgo,
      stats: { currentStreak: 0, cellsOwned: 0 },
    });
    mockPrisma.cellOwnership.createMany.mockResolvedValue({ count: 1 });

    await service.processTrack('user1', track);

    expect(mockPrisma.cellOwnership.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ influence: 1.25 }),
        ]),
      }),
    );
  });
});
