import { Controller, Post, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';

@Controller('activities')
export class ActivitiesController {
  constructor(private activitiesService: ActivitiesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async create(@Request() req: any, @Body() dto: CreateActivityDto) {
    const activity = await this.activitiesService.create(req.user.id, dto);
    return {
      success: true,
      data: {
        activityId: activity.id,
        status: 'processing',
      },
    };
  }
}