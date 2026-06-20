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
      { lat: 56.95, lng: 24.10 },
      { lat: 56.96, lng: 24.11 },
      { lat: 56.97, lng: 24.12 },
    ];
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user1', homeLat: null, homeLng: null });
    mockPrisma.cell.upsert.mockResolvedValue({});
    mockPrisma.cellOwnership.findUnique.mockResolvedValue(null);
    mockPrisma.cellOwnership.create.mockResolvedValue({});

    const result = await service.processTrack('user1', track);
    expect(result).toHaveLength(3);
    expect(mockPrisma.cellOwnership.create).toHaveBeenCalledTimes(3);
  });
});