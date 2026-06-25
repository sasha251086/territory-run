import { IsString, IsNumber, IsArray, IsDateString, IsOptional, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class TrackPointDto {
  @ApiProperty({ example: 56.95 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({ example: 24.1 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({ example: '2026-06-21T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  timestamp?: string;
}

export class CreateActivityDto {
  @ApiProperty({
    example: 'internal',
    enum: ['internal', 'strava', 'gpx_import', 'apple_health', 'health_connect', 'samsung_health', 'samsung_health_zip'],
  })
  @IsString()
  source!:
    | 'internal'
    | 'strava'
    | 'gpx_import'
    | 'apple_health'
    | 'health_connect'
    | 'samsung_health'
    | 'samsung_health_zip';

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
