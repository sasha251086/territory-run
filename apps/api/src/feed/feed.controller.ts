import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FeedService } from './feed.service';

@ApiTags('feed')
@ApiBearerAuth()
@Controller('feed')
export class FeedController {
  constructor(private feedService: FeedService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get activity feed' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'rivals', required: false, example: 'true' })
  async getFeed(
    @Request() req: { user: { id: string } },
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('rivals') rivals?: string,
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const rivalsOnly = rivals === 'true' || rivals === '1';
    return this.feedService.getFeed(req.user.id, pageNum, limitNum, rivalsOnly);
  }
}
