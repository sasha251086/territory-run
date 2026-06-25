import { Test, TestingModule } from '@nestjs/testing';
import { DecayService } from './decay.service';
import { PrismaService } from '../prisma/prisma.service';
import { OwnershipService } from '../territories/ownership.service';

const mockPrisma = {
  cellOwnership: {
    deleteMany: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    updateMany: jest.fn(),
  },
  $executeRaw: jest.fn(),
};

const mockOwnershipService = {
  recalculateOwners: jest.fn(),
};

describe('DecayService', () => {
  let service: DecayService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.cellOwnership.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.cellOwnership.findMany.mockResolvedValue([
      { h3Index: 'cell-1' },
      { h3Index: 'cell-2' },
    ]);
    mockPrisma.$executeRaw.mockResolvedValue(2);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
    mockOwnershipService.recalculateOwners.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecayService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OwnershipService, useValue: mockOwnershipService },
      ],
    }).compile();

    service = module.get<DecayService>(DecayService);
  });

  it('applies decay with a single SQL update', async () => {
    await service.runDecayManually();

    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(mockOwnershipService.recalculateOwners).toHaveBeenCalledWith([
      'cell-1',
      'cell-2',
    ]);
  });
});
