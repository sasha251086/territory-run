import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        homeLat: true,
        homeLng: true,
        createdAt: true,
        stats: true,
      },
    });

    return user;
  }

  async updateProfile(id: string, data: { homeLat?: number; homeLng?: number }) {
    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        nickname: true,
        avatarUrl: true,
        homeLat: true,
        homeLng: true,
        createdAt: true,
        stats: true,
      },
    });

    if (data.homeLat != null && data.homeLng != null) {
      await this.prisma.userStats.upsert({
        where: { userId: id },
        update: {},
        create: { userId: id },
      });
    }

    return user;
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
