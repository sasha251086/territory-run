import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private leaderboardService: LeaderboardService) {}

  @Get('cells')
  @UseGuards(JwtAuthGuard)
  async getTopByCells(@Query('limit') limit: string = '100') {
    const limitNum = parseInt(limit, 10) || 100;
    return this.leaderboardService.getTopByCells(limitNum);
  }

  @Get('influence')
  @UseGuards(JwtAuthGuard)
  async getTopByInfluence(@Query('limit') limit: string = '100') {
    const limitNum = parseInt(limit, 10) || 100;
    return this.leaderboardService.getTopByInfluence(limitNum);
  }

  @Get('distance')
  @UseGuards(JwtAuthGuard)
  async getTopByDistance(@Query('limit') limit: string = '100') {
    const limitNum = parseInt(limit, 10) || 100;
    return this.leaderboardService.getTopByDistance(limitNum);
  }
}
