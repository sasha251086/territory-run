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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ImportNativeActivityDto } from './dto/import-native-activity.dto';
import { ListActivitiesQueryDto } from './dto/list-activities.dto';

const MAX_GPX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_SAMSUNG_ZIP_BYTES = 350 * 1024 * 1024;

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
  @Post('import')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_GPX_FILE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import activity from GPX file' })
  @ApiResponse({
    status: 202,
    schema: {
      example: {
        success: true,
        data: { activityId: 'uuid', status: 'processing' },
      },
    },
  })
  async importGpx(
    @Request() req: { user: { id: string } },
    @UploadedFile() file: { buffer: Buffer; originalname: string; size: number } | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const activity = await this.activitiesService.importGpxFile(req.user.id, file);
    return {
      success: true,
      data: {
        activityId: activity.id,
        status: activity.status,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('import-samsung-zip')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_SAMSUNG_ZIP_BYTES },
      storage: diskStorage({
        destination: tmpdir(),
        filename: (_req, file, callback) => {
          callback(null, `samsung-${randomUUID()}.zip`);
        },
      }),
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import workouts from Samsung Health personal data ZIP export' })
  @ApiResponse({
    status: 202,
    schema: {
      example: {
        success: true,
        data: {
          imported: 12,
          duplicates: 2,
          withoutRoute: 5,
          total: 19,
          activityIds: ['uuid'],
        },
      },
    },
  })
  async importSamsungZip(
    @Request() req: { user: { id: string } },
    @UploadedFile() file: { path: string; originalname: string; size: number } | undefined,
    @Query('days') days?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const parsedDays = days ? Number.parseInt(days, 10) : 365;
    const safeDays = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 365;

    const summary = await this.activitiesService.importSamsungZip(req.user.id, file, safeDays);
    return {
      success: true,
      data: summary,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('import-native')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Import a workout read from the device health store (HealthKit / Health Connect)',
  })
  @ApiResponse({
    status: 202,
    schema: {
      example: {
        success: true,
        data: { activityId: 'uuid', status: 'processing' },
      },
    },
  })
  async importNative(
    @Request() req: { user: { id: string } },
    @Body() dto: ImportNativeActivityDto,
  ) {
    const activity = await this.activitiesService.importNativeWorkout(req.user.id, dto);
    return {
      success: true,
      data: {
        activityId: activity.id,
        status: activity.status,
      },
    };
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
  @Post('reprocess-failed')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Reprocess failed activities after GPS track cleanup' })
  async reprocessFailed(@Request() req: { user: { id: string } }) {
    const summary = await this.activitiesService.reprocessFailedActivities(req.user.id);
    return {
      success: true,
      data: summary,
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
