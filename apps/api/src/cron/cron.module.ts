import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DecayService } from './decay.service';
import { DecayController } from './decay.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TerritoriesModule } from '../territories/territories.module';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, TerritoriesModule],
  controllers: [DecayController],
  providers: [DecayService],
})
export class CronModule {}
