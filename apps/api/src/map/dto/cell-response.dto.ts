import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiProperty({ example: 56.95, nullable: true })
  lat!: number | null;

  @ApiProperty({ example: 24.1, nullable: true })
  lng!: number | null;

  @ApiPropertyOptional({ example: 5.5 })
  myInfluence?: number;

  @ApiPropertyOptional({ example: '2026-06-20T12:00:00.000Z', nullable: true })
  myLastActivityAt?: Date | null;

  @ApiPropertyOptional({ example: 3 })
  daysSinceMyActivity?: number | null;

  @ApiPropertyOptional({ enum: ['none', 'warning', 'critical'] })
  decayRisk?: 'none' | 'warning' | 'critical';

  @ApiPropertyOptional()
  isOwner?: boolean;

  @ApiPropertyOptional({ example: 2.5 })
  gapToLeader?: number;

  @ApiPropertyOptional({ example: 3 })
  runsToCapture?: number;

  @ApiPropertyOptional({ example: 2 })
  myRank?: number | null;

  @ApiPropertyOptional({ example: true })
  contested?: boolean;

  @ApiPropertyOptional({ example: 0.5 })
  contestGap?: number;

  @ApiPropertyOptional({ example: 'runner_ivan', nullable: true })
  challengerNickname?: string | null;
}

export class MapCellsResponseDto {
  @ApiProperty({ type: [CellResponseDto] })
  cells!: CellResponseDto[];
}

export class CellPlayerDto {
  rank!: number;
  userId!: string;
  nickname!: string;
  influence!: number;
  isMe!: boolean;
}

export class CellPlayersResponseDto {
  h3Index!: string;
  players!: CellPlayerDto[];
  myInfluence!: number;
  myRank!: number | null;
  leaderInfluence!: number;
  gapToLeader!: number;
  runsToCapture!: number;
  isOwner!: boolean;
  leadOverNext!: number | null;
  contested!: boolean;
  contestGap!: number | null;
  tiedOnInfluence!: boolean;
  challengerNickname!: string | null;
  history!: Array<{
    fromNickname: string | null;
    toNickname: string;
    changedAt: Date;
  }>;
}

export class CaptureTargetDto {
  h3Index!: string;
  lat!: number;
  lng!: number;
  myInfluence!: number;
  leaderInfluence!: number;
  gap!: number;
  runsNeeded!: number;
  ownerNickname!: string | null;
}

export class CaptureTargetsResponseDto {
  targets!: CaptureTargetDto[];
  message!: string;
}

export class MapSummaryResponseDto {
  cellsAtRisk!: number;
  captureTargetsNearby!: number;
  territoryAreaM2!: number;
  cellsGainedThisWeek!: number;
  weeklyProgressPercent!: number;
}
