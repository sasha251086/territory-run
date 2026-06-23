import { Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RivalsService } from './rivals.service';

@ApiTags('rivals')
@ApiBearerAuth()
@Controller('rivals')
export class RivalsController {
  constructor(private rivalsService: RivalsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List followed rivals' })
  async list(@Request() req: { user: { id: string } }) {
    return this.rivalsService.list(req.user.id);
  }

  @Post(':targetUserId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Follow a rival (max 3)' })
  async follow(
    @Request() req: { user: { id: string } },
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.rivalsService.follow(req.user.id, targetUserId);
  }

  @Delete(':targetUserId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Unfollow a rival' })
  async unfollow(
    @Request() req: { user: { id: string } },
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.rivalsService.unfollow(req.user.id, targetUserId);
  }
}
