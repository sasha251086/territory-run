import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class MapQueryDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  north?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  south?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  east?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  west?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  @Type(() => Number)
  limit?: number = 1000;
}
