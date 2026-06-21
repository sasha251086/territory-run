import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MapQueryDto {
  @ApiProperty({ example: 57.0, description: 'Northern boundary (max latitude)' })
  @IsNumber()
  @Type(() => Number)
  north!: number;

  @ApiProperty({ example: 56.9, description: 'Southern boundary (min latitude)' })
  @IsNumber()
  @Type(() => Number)
  south!: number;

  @ApiProperty({ example: 24.2, description: 'Eastern boundary (max longitude)' })
  @IsNumber()
  @Type(() => Number)
  east!: number;

  @ApiProperty({ example: 24.0, description: 'Western boundary (min longitude)' })
  @IsNumber()
  @Type(() => Number)
  west!: number;

  @ApiPropertyOptional({ example: 1000, default: 1000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  @Type(() => Number)
  limit?: number = 1000;
}
