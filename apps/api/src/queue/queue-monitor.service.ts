import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { QueueService } from './queue.service';

@Injectable()
export class QueueMonitorService {
  private readonly logger = new Logger(QueueMonitorService.name);

  constructor(private queueService: QueueService) {}

  @Cron('0 */5 * * * *')
  async logQueueSize(): Promise<void> {
    const counts = await this.queueService.getJobCounts();
    this.logger.log({
      msg: 'Activity queue job counts',
      queue: 'activity-processing',
      ...counts,
    });
  }
}
