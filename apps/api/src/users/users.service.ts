import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiException } from '../common/api.exception';
import { ErrorCodes } from '../common/error-codes';
import { FREEZE_COOLDOWN_DAYS } from '../common/constants';

const profileSelect = {
  id: true,
  email: true,
  nickname: true,
  avatarUrl: true,
  homeLat: true,
  homeLng: true,
  freezeActive: true,
  freezeActivatedAt: true,
  freezeLastUsedAt: true,
  createdAt: true,
  stats: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByNickname(nickname: string) {
    return this.prisma.user.findUnique({ where: { nickname } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async getProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: profileSelect,
    });

    return user;
  }

  async updateProfile(id: string, data: { homeLat?: number; homeLng?: number }) {
    await this.prisma.user.update({
      where: { id },
      data,
    });

    if (data.homeLat != null && data.homeLng != null) {
      await this.prisma.userStats.upsert({
        where: { userId: id },
        update: {},
        create: { userId: id },
      });
    }

    return this.getProfile(id);
  }

  async markFirstCaptureShown(userId: string) {
    await this.prisma.userStats.upsert({
      where: { userId },
      update: { firstCaptureShownAt: new Date() },
      create: {
        userId,
        firstCaptureShownAt: new Date(),
      },
    });

    return { firstCaptureShownAt: new Date() };
  }

  async activateFreeze(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        freezeActive: true,
        freezeLastUsedAt: true,
      },
    });

    if (!user) {
      throw new ApiException(ErrorCodes.NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }

    if (user.freezeActive) {
      throw new ApiException(
        ErrorCodes.VALIDATION_ERROR,
        'Заморозка уже активна',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (user.freezeLastUsedAt) {
      const cooldownEnds = new Date(user.freezeLastUsedAt);
      cooldownEnds.setDate(cooldownEnds.getDate() + FREEZE_COOLDOWN_DAYS);
      if (new Date() < cooldownEnds) {
        throw new ApiException(
          ErrorCodes.VALIDATION_ERROR,
          'Заморозка доступна раз в 90 дней',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        freezeActive: true,
        freezeActivatedAt: new Date(),
        freezeLastUsedAt: new Date(),
      },
    });

    return this.getProfile(userId);
  }

  async cancelFreeze(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { freezeActive: true },
    });

    if (!user) {
      throw new ApiException(ErrorCodes.NOT_FOUND, 'User not found', HttpStatus.NOT_FOUND);
    }

    if (!user.freezeActive) {
      return this.getProfile(userId);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { freezeActive: false },
    });

    return this.getProfile(userId);
  }

  async create(email: string, nickname: string, passwordHash: string) {
    return this.prisma.user.create({
      data: {
        email,
        nickname,
        passwordHash,
        stats: {
          create: {},
        },
      },
    });
  }
}
