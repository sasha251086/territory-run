import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiException } from '../common/api.exception';
import { ErrorCodes } from '../common/error-codes';
import { MAX_RIVAL_FOLLOWS } from '../common/constants';

@Injectable()
export class RivalsService {
  constructor(private prisma: PrismaService) {}

  async list(followerId: string) {
    const rows = await this.prisma.rivalFollow.findMany({
      where: { followerId },
      include: {
        target: {
          select: { id: true, nickname: true, stats: { select: { cellsOwned: true, totalInfluence: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => ({
      userId: row.targetUserId,
      nickname: row.target.nickname,
      cellsOwned: row.target.stats?.cellsOwned ?? 0,
      totalInfluence: row.target.stats?.totalInfluence ?? 0,
      followedAt: row.createdAt,
    }));
  }

  async follow(followerId: string, targetUserId: string) {
    if (followerId === targetUserId) {
      throw new ApiException(ErrorCodes.INVALID_FILE, 'Cannot follow yourself', HttpStatus.BAD_REQUEST);
    }

    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw new ApiException(ErrorCodes.NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }

    const count = await this.prisma.rivalFollow.count({ where: { followerId } });
    const existing = await this.prisma.rivalFollow.findUnique({
      where: { followerId_targetUserId: { followerId, targetUserId } },
    });
    if (existing) {
      return { followed: true, nickname: target.nickname };
    }

    if (count >= MAX_RIVAL_FOLLOWS) {
      throw new ApiException(
        ErrorCodes.INVALID_FILE,
        `Maximum ${MAX_RIVAL_FOLLOWS} rivals allowed`,
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.rivalFollow.create({
      data: { followerId, targetUserId },
    });

    return { followed: true, nickname: target.nickname };
  }

  async unfollow(followerId: string, targetUserId: string) {
    await this.prisma.rivalFollow.deleteMany({
      where: { followerId, targetUserId },
    });
    return { unfollowed: true };
  }
}
