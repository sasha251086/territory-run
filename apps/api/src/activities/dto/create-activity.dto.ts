import { IsString, IsNumber, IsArray, IsDateString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class TrackPointDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsOptional()
  @IsDateString()
  timestamp?: string;
}

export class CreateActivityDto {
  @IsString()
  source!: 'internal' | 'strava' | 'apple_health' | 'health_connect';

  @IsNumber()
  distanceMeters!: number;

  @IsNumber()
  durationSeconds!: number;

  @IsOptional()
  @IsNumber()
  avgPace?: number;

  @IsDateString()
  startedAt!: string;

  @IsDateString()
  finishedAt!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrackPointDto)
  track!: TrackPointDto[];
}