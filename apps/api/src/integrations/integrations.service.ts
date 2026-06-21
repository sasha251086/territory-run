import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  async listForUser(userId: string) {
    const integrations = await this.prisma.integration.findMany({
      where: { userId },
      select: {
        provider: true,
        externalUserId: true,
        expiresAt: true,
      },
    });

    return integrations.map((integration) => ({
      provider: integration.provider,
      externalUserId: integration.externalUserId,
      expiresAt: integration.expiresAt,
      connected: true,
    }));
  }
}
