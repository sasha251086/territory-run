import { Module, forwardRef } from '@nestjs/common';
import { DistrictService } from './district.service';
import { DistrictsController } from './districts.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { FeedModule } from '../feed/feed.module';
import { TerritoriesModule } from '../territories/territories.module';

@Module({
  imports: [PrismaModule, FeedModule, forwardRef(() => TerritoriesModule)],
  controllers: [DistrictsController],
  providers: [DistrictService],
  exports: [DistrictService],
})
export class DistrictsModule {}
