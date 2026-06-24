import { ApiProperty } from '@nestjs/swagger';

export class ActivityResultDto {
  @ApiProperty({ example: 3 })
  newCellsCount!: number;

  @ApiProperty({ example: 1 })
  capturedCellsCount!: number;

  @ApiProperty({ example: 4.5 })
  influenceGained!: number;

  @ApiProperty({ type: [String], example: ['8928308280fffff'] })
  affectedH3Indices!: string[];

  @ApiProperty({ example: 8300, required: false })
  distanceMeters?: number;
}
