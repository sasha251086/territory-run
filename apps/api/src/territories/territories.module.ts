import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FeedModule } from '../feed/feed.module'; // <-- добавить
import { TerritoriesService } from './territories.service';
import { InfluenceService } from './influence.service';
import { OwnershipService } from './ownership.service';

@Module({
  imports: [PrismaModule, FeedModule],
  providers: [TerritoriesService, InfluenceService, OwnershipService],
  exports: [TerritoriesService, InfluenceService, OwnershipService],
})
export class TerritoriesModule {}