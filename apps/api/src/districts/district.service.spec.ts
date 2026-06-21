import { DistrictService } from './district.service';
import { KING_CLAIM_THRESHOLD, KING_LOSS_THRESHOLD } from '../common/constants';

const mockPrisma = {
  district: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  districtCell: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

const mockFeedService = {
  createEvent: jest.fn(),
};

const mockOwnershipService = {
  getCurrentOwner: jest.fn(),
};

describe('DistrictService recalculateDistrictControl', () => {
  let service: DistrictService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DistrictService(
      mockPrisma as never,
      mockFeedService as never,
      mockOwnershipService as never,
    );
  });

  function mockDistrictWithCells(cellIds: string[], kingUserId: string | null = null) {
    mockPrisma.district.findUnique.mockResolvedValue({
      id: 'district-1',
      name: 'Test District',
      kingUserId,
      cells: cellIds.map((h3Index) => ({ districtId: 'district-1', h3Index })),
    });
  }

  it('should crown a player with at least 60% control', async () => {
    const cellIds = Array.from({ length: 10 }, (_, i) => `cell-${i}`);
    mockDistrictWithCells(cellIds, null);

    mockOwnershipService.getCurrentOwner.mockImplementation(async (h3Index: string) => {
      const index = Number(h3Index.split('-')[1]);
      if (index < 6) {
        return { userId: 'player-a', user: { nickname: 'Alpha' } };
      }
      return { userId: 'player-b', user: { nickname: 'Beta' } };
    });

    mockPrisma.district.update.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'player-a', nickname: 'Alpha' });

    await service.recalculateDistrictControl('district-1');

    expect(mockPrisma.district.update).toHaveBeenCalledWith({
      where: { id: 'district-1' },
      data: { kingUserId: 'player-a' },
    });
    expect(mockFeedService.createEvent).toHaveBeenCalledWith(
      'district_captured',
      'player-a',
      expect.objectContaining({ districtId: 'district-1' }),
    );
  });

  it('should remove king when control drops below 50% without crowning replacement in same pass', async () => {
    const cellIds = Array.from({ length: 10 }, (_, i) => `cell-${i}`);
    mockDistrictWithCells(cellIds, 'player-a');

    mockOwnershipService.getCurrentOwner.mockImplementation(async (h3Index: string) => {
      const index = Number(h3Index.split('-')[1]);
      if (index < 4) {
        return { userId: 'player-a', user: { nickname: 'Alpha' } };
      }
      return { userId: 'player-b', user: { nickname: 'Beta' } };
    });

    mockPrisma.district.update.mockResolvedValue({});

    await service.recalculateDistrictControl('district-1');

    expect(mockPrisma.district.update).toHaveBeenCalledWith({
      where: { id: 'district-1' },
      data: { kingUserId: null },
    });
    expect(mockFeedService.createEvent).not.toHaveBeenCalled();
  });

  it('should not crown at 55% and should keep existing king at 55%', async () => {
    const cellIds = Array.from({ length: 20 }, (_, i) => `cell-${i}`);
    mockDistrictWithCells(cellIds, 'player-a');

    mockOwnershipService.getCurrentOwner.mockImplementation(async (h3Index: string) => {
      const index = Number(h3Index.split('-')[1]);
      if (index < 11) {
        return { userId: 'player-a', user: { nickname: 'Alpha' } };
      }
      return { userId: 'player-b', user: { nickname: 'Beta' } };
    });

    await service.recalculateDistrictControl('district-1');

    expect(mockPrisma.district.update).not.toHaveBeenCalled();
    expect(KING_CLAIM_THRESHOLD).toBe(0.6);
    expect(KING_LOSS_THRESHOLD).toBe(0.5);
  });
});
