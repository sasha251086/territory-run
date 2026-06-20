import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MapService } from './map.service';
import { MapQueryDto } from './dto/map-query.dto';
import { MapCellsResponseDto } from './dto/cell-response.dto';

@Controller('map')
export class MapController {
  constructor(private mapService: MapService) {}

  @Get('cells')
  @UseGuards(JwtAuthGuard)
  async getCells(@Query() query: MapQueryDto): Promise<MapCellsResponseDto> {
    const cells = await this.mapService.getCells(query);
    return { cells };
  }
}
