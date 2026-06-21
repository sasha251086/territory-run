import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ListActivitiesQueryDto } from './dto/list-activities.dto';

@ApiTags('activities')
@ApiBearerAuth()
@Controller('activities')
export class ActivitiesController {
  constructor(private activitiesService: ActivitiesService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'List user activities' })
  async list(
    @Request() req: { user: { id: string } },
    @Query() query: ListActivitiesQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.activitiesService.listForUser(req.user.id, page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Submit a new activity track for processing' })
  @ApiResponse({
    status: 202,
    schema: {
      example: {
        success: true,
        data: { activityId: 'uuid', status: 'processing' },
      },
    },
  })
  async create(@Request() req: { user: { id: string } }, @Body() dto: CreateActivityDto) {
    const activity = await this.activitiesService.create(req.user.id, dto);
    return {
      success: true,
      data: {
        activityId: activity.id,
        status: activity.status,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/status')
  @ApiOperation({ summary: 'Get activity processing status' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        data: { status: 'completed' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Failed activity with anticheat reason',
    schema: {
      example: {
        success: true,
        data: { status: 'failed', reason: 'SPEED_EXCEEDED' },
      },
    },
  })
  async getStatus(
    @Request() req: { user: { id: string } },
    @Param('id') activityId: string,
  ) {
    return this.activitiesService.getStatus(req.user.id, activityId);
  }
}
