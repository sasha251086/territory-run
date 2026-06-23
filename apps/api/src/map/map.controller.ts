import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MapService } from './map.service';
import { MapQueryDto } from './dto/map-query.dto';
import { MapCellsResponseDto } from './dto/cell-response.dto';

@ApiTags('map')
@ApiBearerAuth()
@Controller('map')
export class MapController {
  constructor(private mapService: MapService) {}

  @Get('cells')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get map cells within bounding box' })
  async getCells(
    @Query() query: MapQueryDto,
    @Request() req: { user: { id: string } },
  ): Promise<MapCellsResponseDto> {
    const cells = await this.mapService.getCells(query, req.user.id);
    return { cells };
  }

  @Get('cells/mine')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all cells where current user has influence' })
  async getMyCells(@Request() req: { user: { id: string } }): Promise<MapCellsResponseDto> {
    const cells = await this.mapService.getMyCells(req.user.id);
    return { cells };
  }

  @Get('cells/:h3Index/players')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Top players for a cell with capture progress' })
  async getCellPlayers(
    @Param('h3Index') h3Index: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.mapService.getCellPlayers(h3Index, req.user.id);
  }

  @Get('targets')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Nearby cells capturable in 1-3 runs' })
  @ApiQuery({ name: 'lat', required: true })
  @ApiQuery({ name: 'lng', required: true })
  async getCaptureTargets(
    @Request() req: { user: { id: string } },
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    return this.mapService.getCaptureTargets(
      req.user.id,
      parseFloat(lat),
      parseFloat(lng),
    );
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Map HUD summary (decay risk, targets)' })
  async getSummary(@Request() req: { user: { id: string } }) {
    return this.mapService.getMapSummary(req.user.id);
  }

  @Get('rivals/cells')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cells owned by followed rivals' })
  async getRivalCells(@Request() req: { user: { id: string } }) {
    const cells = await this.mapService.getRivalCells(req.user.id);
    return { cells };
  }
}
