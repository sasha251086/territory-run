import { Body, Controller, Delete, Get, Patch, Post, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req: { user: { id: string } }) {
    return this.usersService.getProfile(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @ApiOperation({ summary: 'Update profile (home base coordinates)' })
  async updateProfile(
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/first-capture-shown')
  @ApiOperation({ summary: 'Mark first capture celebration as shown' })
  async markFirstCaptureShown(@Request() req: { user: { id: string } }) {
    return this.usersService.markFirstCaptureShown(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/freeze')
  @ApiOperation({ summary: 'Activate territory freeze for 7 days' })
  async activateFreeze(@Request() req: { user: { id: string } }) {
    return this.usersService.activateFreeze(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/freeze')
  @ApiOperation({ summary: 'Cancel active territory freeze early' })
  async cancelFreeze(@Request() req: { user: { id: string } }) {
    return this.usersService.cancelFreeze(req.user.id);
  }
}
