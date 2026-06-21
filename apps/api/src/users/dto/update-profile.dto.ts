import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 56.95 })
  @IsOptional()
  @IsNumber()
  homeLat?: number;

  @ApiPropertyOptional({ example: 24.1 })
  @IsOptional()
  @IsNumber()
  homeLng?: number;
}
