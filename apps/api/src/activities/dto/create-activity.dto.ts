import { IsString, IsNumber, IsArray, IsDateString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class TrackPointDto {
  @ApiProperty({ example: 56.95 })
  @IsNumber()
  lat!: number;

  @ApiProperty({ example: 24.1 })
  @IsNumber()
  lng!: number;

  @ApiPropertyOptional({ example: '2026-06-21T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  timestamp?: string;
}

export class CreateActivityDto {
  @ApiProperty({ example: 'internal', enum: ['internal', 'strava', 'gpx_import', 'apple_health', 'health_connect'] })
  @IsString()
  source!: 'internal' | 'strava' | 'gpx_import' | 'apple_health' | 'health_connect';

  @ApiProperty({ example: 5200 })
  @IsNumber()
  distanceMeters!: number;

  @ApiProperty({ example: 1800 })
  @IsNumber()
  durationSeconds!: number;

  @ApiPropertyOptional({ example: 5.5 })
  @IsOptional()
  @IsNumber()
  avgPace?: number;

  @ApiProperty({ example: '2026-06-21T10:00:00.000Z' })
  @IsDateString()
  startedAt!: string;

  @ApiProperty({ example: '2026-06-21T10:30:00.000Z' })
  @IsDateString()
  finishedAt!: string;

  @ApiProperty({ type: [TrackPointDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrackPointDto)
  track!: TrackPointDto[];
}
