import { ActivitiesService } from './activities.service';
import { GpxParserService } from './gpx-parser.service';

const mockPrisma = {
  processedActivity: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockQueueService = {
  addActivityProcessingJob: jest.fn(),
};

describe('ActivitiesService GPX import deduplication', () => {
  let service: ActivitiesService;

  const sampleGpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <trkseg>
      <trkpt lat="56.9496" lon="24.1052">
        <time>2026-06-21T08:00:01Z</time>
      </trkpt>
      <trkpt lat="56.9498" lon="24.1055">
        <time>2026-06-21T08:00:06Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ActivitiesService(
      mockPrisma as never,
      mockQueueService as never,
      new GpxParserService(),
    );
  });

  it('should reject duplicate GPX uploads by file hash', async () => {
    mockPrisma.processedActivity.findUnique.mockResolvedValue({
      provider: 'gpx_import',
      externalActivityId: 'existing-hash',
    });

    await expect(
      service.importGpxFile('user-1', {
        buffer: Buffer.from(sampleGpx, 'utf-8'),
        originalname: 'run.gpx',
        size: sampleGpx.length,
      }),
    ).rejects.toMatchObject({
      code: 'DUPLICATE_ACTIVITY',
    });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should create activity for new GPX file', async () => {
    mockPrisma.processedActivity.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback({
        processedActivity: { create: jest.fn() },
        activity: { create: jest.fn() },
      }),
    );
    jest.spyOn(service, 'createFromExternal').mockResolvedValue({
      id: 'activity-1',
      status: 'processing',
    } as never);

    const activity = await service.importGpxFile('user-1', {
      buffer: Buffer.from(sampleGpx, 'utf-8'),
      originalname: 'run.gpx',
      size: sampleGpx.length,
    });

    expect(activity.id).toBe('activity-1');
    expect(mockQueueService.addActivityProcessingJob).toHaveBeenCalledWith('activity-1');
  });
});
