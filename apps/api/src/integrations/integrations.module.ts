import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { StravaService } from './providers/strava/strava.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivitiesModule } from '../activities/activities.module';

@Module({
  imports: [PrismaModule, ActivitiesModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, StravaService],
  exports: [StravaService],
})
export class IntegrationsModule {}
