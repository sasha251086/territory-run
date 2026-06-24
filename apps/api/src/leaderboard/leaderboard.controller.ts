import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
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

  @Get('regional')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Regional leaderboard within radius of home base' })
  @ApiQuery({ name: 'radiusKm', required: false, example: 5 })
  async getRegional(
    @Request() req: { user: { id: string } },
    @Query('radiusKm') radiusKm: string = '5',
  ) {
    const radius = parseFloat(radiusKm) || 5;
    return this.leaderboardService.getRegionalLeaderboard(req.user.id, radius);
  }

  @Get('season/history')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Past season placements for current user' })
  async getSeasonHistory(@Request() req: { user: { id: string } }) {
    return this.leaderboardService.getSeasonHistory(req.user.id);
  }

  @Get('season')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Current season leaderboard' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  async getSeasonLeaderboard(@Query('limit') limit: string = '50') {
    const limitNum = parseInt(limit, 10) || 50;
    return this.leaderboardService.getSeasonLeaderboard(limitNum);
  }
}
