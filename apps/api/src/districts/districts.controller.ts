import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DistrictService } from './district.service';

@ApiTags('districts')
@ApiBearerAuth()
@Controller('districts')
export class DistrictsController {
  constructor(private districtService: DistrictService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List all districts with polygons' })
  async listDistricts() {
    return this.districtService.listDistricts();
  }

  @Get('my/overview')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Districts where current user controls at least 15%' })
  async getMyOverview(@Request() req: { user: { id: string } }) {
    const districts = await this.districtService.listUserDistrictOverview(req.user.id);
    return { districts };
  }

  @Get(':id/progress')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Current user control in a district' })
  async getProgress(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.districtService.getUserDistrictProgress(req.user.id, id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get district details and King of District' })
  async getDistrict(@Param('id') id: string) {
    return this.districtService.getDistrict(id);
  }

  @Get(':id/cells')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all cell indices in a district' })
  async getDistrictCells(@Param('id') id: string) {
    return this.districtService.getDistrictCells(id);
  }
}
