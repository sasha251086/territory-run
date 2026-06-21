import { ApiProperty } from '@nestjs/swagger';

export class CellResponseDto {
  @ApiProperty({ example: '8928308280fffff' })
  h3Index!: string;

  @ApiProperty({ example: 'uuid', nullable: true })
  ownerId!: string | null;

  @ApiProperty({ example: 'runner123', nullable: true })
  ownerNickname!: string | null;

  @ApiProperty({ example: 12.5 })
  influence!: number;

  @ApiProperty({ example: '2026-06-21T12:00:00.000Z', nullable: true })
  lastActivityAt!: Date | null;
}

export class MapCellsResponseDto {
  @ApiProperty({ type: [CellResponseDto] })
  cells!: CellResponseDto[];
}
