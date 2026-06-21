import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IntegrationsService } from './integrations.service';
import { StravaService } from './providers/strava/strava.service';
import { StravaCallbackDto } from './dto/strava-callback.dto';

@ApiTags('integrations')
@ApiBearerAuth()
@Controller('integrations')
@UseGuards(JwtAuthGuard)
export class IntegrationsController {
  constructor(
    private integrationsService: IntegrationsService,
    private stravaService: StravaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List connected activity providers' })
  async list(@Request() req: { user: { id: string } }) {
    return this.integrationsService.listForUser(req.user.id);
  }

  @Post('strava/connect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Strava OAuth authorization URL' })
  connect(@Request() req: { user: { id: string } }) {
    return {
      authUrl: this.stravaService.getConnectUrl(req.user.id),
    };
  }

  @Post('strava/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete Strava OAuth with authorization code' })
  async callback(
    @Request() req: { user: { id: string } },
    @Body() dto: StravaCallbackDto,
  ) {
    await this.stravaService.handleCallback(req.user.id, dto.code);
    return { connected: true };
  }

  @Post('strava/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync activities from Strava on demand' })
  async sync(@Request() req: { user: { id: string } }) {
    return this.stravaService.sync(req.user.id);
  }
}
