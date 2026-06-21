import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        success: true,
        data: {
          cells: [
            {
              h3Index: '8928308280fffff',
              ownerId: 'uuid',
              ownerNickname: 'runner123',
              influence: 5,
              lastActivityAt: '2026-06-21T12:00:00.000Z',
            },
          ],
        },
      },
    },
  })
  async getCells(@Query() query: MapQueryDto): Promise<MapCellsResponseDto> {
    const cells = await this.mapService.getCells(query);
    return { cells };
  }

  @Get('cells/mine')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all cells owned by current user' })
  async getMyCells(@Request() req: { user: { id: string } }): Promise<MapCellsResponseDto> {
    const cells = await this.mapService.getMyCells(req.user.id);
    return { cells };
  }
}
