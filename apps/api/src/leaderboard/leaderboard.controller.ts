import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('leaderboard')
@ApiBearerAuth()
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private leaderboardService: LeaderboardService) {}

  @Get('cells')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Leaderboard by cells owned' })
  @ApiQuery({ name: 'limit', required: false, example: 100 })
  async getTopByCells(@Query('limit') limit: string = '100') {
    const limitNum = parseInt(limit, 10) || 100;
    return this.leaderboardService.getTopByCells(limitNum);
  }

  @Get('influence')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Leaderboard by total influence' })
  @ApiQuery({ name: 'limit', required: false, example: 100 })
  async getTopByInfluence(@Query('limit') limit: string = '100') {
    const limitNum = parseInt(limit, 10) || 100;
    return this.leaderboardService.getTopByInfluence(limitNum);
  }

  @Get('distance')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Leaderboard by total distance' })
  @ApiQuery({ name: 'limit', required: false, example: 100 })
  async getTopByDistance(@Query('limit') limit: string = '100') {
    const limitNum = parseInt(limit, 10) || 100;
    return this.leaderboardService.getTopByDistance(limitNum);
  }
}
