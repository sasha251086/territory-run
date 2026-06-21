import {
  Injectable,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Integration } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ActivitiesService } from '../../../activities/activities.service';
import { ApiException } from '../../../common/api.exception';
import { ErrorCodes } from '../../../common/error-codes';
import {
  ActivityProvider,
  ExternalActivity,
} from '../../activity-provider.interface';

interface StravaActivitySummary {
  id: number;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  start_date: string;
}

interface StravaStream {
  type: string;
  data: unknown;
}

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete: { id: number };
}

@Injectable()
export class StravaService implements ActivityProvider {
  private readonly logger = new Logger(StravaService.name);
  private readonly provider = 'strava';

  constructor(
    private prisma: PrismaService,
    private activitiesService: ActivitiesService,
  ) {}

  getConnectUrl(userId: string): string {
    this.assertStravaConfigured();

    const params = new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID!,
      response_type: 'code',
      redirect_uri: process.env.STRAVA_REDIRECT_URI!,
      approval_prompt: 'auto',
      scope: 'activity:read_all',
      state: userId,
    });

    return `https://www.strava.com/oauth/authorize?${params.toString()}`;
  }

  async handleCallback(userId: string, code: string): Promise<void> {
    this.assertStravaConfigured();

    const body = new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      code,
      grant_type: 'authorization_code',
    });

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error({
        msg: 'Strava OAuth token exchange failed',
        userId,
        status: response.status,
        error: errorText,
      });
      throw new ApiException(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to connect Strava account',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const tokenData = (await response.json()) as StravaTokenResponse;

    await this.prisma.integration.upsert({
      where: {
        userId_provider: { userId, provider: this.provider },
      },
      update: {
        externalUserId: String(tokenData.athlete.id),
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(tokenData.expires_at * 1000),
      },
      create: {
        userId,
        provider: this.provider,
        externalUserId: String(tokenData.athlete.id),
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(tokenData.expires_at * 1000),
      },
    });

    this.logger.log({ msg: 'Strava account connected', userId });
  }

  async sync(userId: string): Promise<{ imported: number; skipped: number }> {
    const integration = await this.getIntegration(userId);
    if (!integration) {
      throw new ApiException(
        ErrorCodes.NOT_FOUND,
        'Strava is not connected',
        HttpStatus.NOT_FOUND,
      );
    }

    const validIntegration = await this.ensureValidToken(integration);
    const activities = await this.getActivities(validIntegration.accessToken);

    let imported = 0;
    let skipped = 0;

    for (const activity of activities) {
      const externalActivityId = activity.id;
      const alreadyProcessed = await this.prisma.processedActivity.findUnique({
        where: {
          provider_externalActivityId: {
            provider: this.provider,
            externalActivityId,
          },
        },
      });

      if (alreadyProcessed) {
        skipped++;
        continue;
      }

      if (activity.track.length === 0) {
        this.logger.warn({
          msg: 'Skipping Strava activity without GPS track',
          userId,
          externalActivityId,
        });
        skipped++;
        continue;
      }

      const createdActivity = await this.prisma.$transaction(async (tx) => {
        await tx.processedActivity.create({
          data: {
            provider: this.provider,
            externalActivityId,
          },
        });

        return this.activitiesService.createFromExternal(
          userId,
          {
            source: this.provider,
            distanceMeters: activity.distanceMeters,
            durationSeconds: activity.durationSeconds,
            startedAt: activity.startedAt,
            finishedAt: activity.finishedAt,
            track: activity.track,
          },
          tx,
        );
      });

      await this.activitiesService.enqueueActivity(createdActivity.id);

      imported++;
    }

    this.logger.log({
      msg: 'Strava sync completed',
      userId,
      imported,
      skipped,
    });

    return { imported, skipped };
  }

  async getActivities(accessToken: string): Promise<ExternalActivity[]> {
    const response = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?per_page=30',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      throw new Error(`Strava activities request failed: ${response.status}`);
    }

    const summaries = (await response.json()) as StravaActivitySummary[];
    const activities: ExternalActivity[] = [];

    for (const summary of summaries) {
      activities.push(await this.getActivity(accessToken, String(summary.id)));
    }

    return activities;
  }

  async getActivity(accessToken: string, id: string): Promise<ExternalActivity> {
    const [activityResponse, streamsResponse] = await Promise.all([
      fetch(`https://www.strava.com/api/v3/activities/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      fetch(`https://www.strava.com/api/v3/activities/${id}/streams?keys=latlng,time`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    if (!activityResponse.ok) {
      throw new Error(`Strava activity request failed: ${activityResponse.status}`);
    }

    const activity = (await activityResponse.json()) as StravaActivitySummary;
    const track = streamsResponse.ok
      ? this.buildTrackFromStreams(
          (await streamsResponse.json()) as StravaStream[],
          activity.start_date,
        )
      : [];

    const startedAt = new Date(activity.start_date);
    const finishedAt = new Date(
      startedAt.getTime() + activity.elapsed_time * 1000,
    );

    return {
      id: String(activity.id),
      distanceMeters: Math.round(activity.distance),
      durationSeconds: activity.moving_time,
      startedAt,
      finishedAt,
      track,
    };
  }

  private buildTrackFromStreams(
    streams: StravaStream[],
    startDate: string,
  ): { lat: number; lng: number; timestamp?: string }[] {
    const latlngStream = streams.find((stream) => stream.type === 'latlng');
    const timeStream = streams.find((stream) => stream.type === 'time');

    if (!latlngStream || !Array.isArray(latlngStream.data)) {
      return [];
    }

    const points = latlngStream.data as [number, number][];
    const times = Array.isArray(timeStream?.data)
      ? (timeStream.data as number[])
      : [];
    const startMs = new Date(startDate).getTime();

    return points.map((point, index) => ({
      lat: point[0],
      lng: point[1],
      timestamp: new Date(startMs + (times[index] ?? index) * 1000).toISOString(),
    }));
  }

  private async getIntegration(userId: string): Promise<Integration | null> {
    return this.prisma.integration.findUnique({
      where: {
        userId_provider: { userId, provider: this.provider },
      },
    });
  }

  private async ensureValidToken(integration: Integration): Promise<Integration> {
    const expiresSoon =
      integration.expiresAt.getTime() - Date.now() < 60_000;

    if (!expiresSoon) {
      return integration;
    }

    return this.refreshToken(integration);
  }

  private async refreshToken(integration: Integration): Promise<Integration> {
    this.assertStravaConfigured();

    const body = new URLSearchParams({
      client_id: process.env.STRAVA_CLIENT_ID!,
      client_secret: process.env.STRAVA_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: integration.refreshToken,
    });

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error({
        msg: 'Strava token refresh failed',
        userId: integration.userId,
        status: response.status,
        error: errorText,
      });
      throw new ApiException(
        ErrorCodes.AUTH_REQUIRED,
        'Strava token expired, reconnect required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const tokenData = (await response.json()) as StravaTokenResponse;

    return this.prisma.integration.update({
      where: { id: integration.id },
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(tokenData.expires_at * 1000),
      },
    });
  }

  private assertStravaConfigured(): void {
    if (
      !process.env.STRAVA_CLIENT_ID ||
      !process.env.STRAVA_CLIENT_SECRET ||
      !process.env.STRAVA_REDIRECT_URI
    ) {
      throw new ApiException(
        ErrorCodes.INTERNAL_ERROR,
        'Strava integration is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
