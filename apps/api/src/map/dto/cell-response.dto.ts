export class CellResponseDto {
  h3Index!: string;
  ownerId!: string | null;
  ownerNickname!: string | null;
  influence!: number;
  lastActivityAt!: Date | null;
}

export class MapCellsResponseDto {
  cells!: CellResponseDto[];
}