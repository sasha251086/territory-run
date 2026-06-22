import {
  IsString,
  IsNumber,
  IsArray,
  IsDateString,
  IsOptional,
  IsIn,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class NativeTrackPointDto {
  @ApiProperty({ example: 56.95 })
  @IsNumber()
  lat!: number;

  @ApiProperty({ example: 24.1 })
  @IsNumber()
  lng!: number;

  @ApiProperty({ example: '2026-06-21T10:00:00.000Z' })
  @IsDateString()
  timestamp!: string;
}

export class ImportNativeActivityDto {
  @ApiProperty({ enum: ['health_connect', 'apple_health'] })
  @IsIn(['health_connect', 'apple_health'])
  source!: 'health_connect' | 'apple_health';

  @ApiProperty({
    example: 'a1b2c3-uuid-from-healthkit',
    description:
      'Stable per-workout id from the native store (HealthKit UUID / Health Connect metadata id). Used for deduplication.',
  })
  @IsString()
  platformId!: string;

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

  @ApiProperty({ type: [NativeTrackPointDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => NativeTrackPointDto)
  track!: NativeTrackPointDto[];
}
