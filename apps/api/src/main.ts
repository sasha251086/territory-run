import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { initSentry } from './common/sentry.util';
import { ResponseInterceptor } from './common/response.interceptor';
import { PrismaService } from './prisma/prisma.service';
import { describeDatabaseTarget } from './prisma/create-pg-pool';

initSentry();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  // Samsung Health can send thousands of GPS points per workout (default Express limit is 100kb).
  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '10mb' });

  const productionWebOrigin = 'https://territory-run-cjoj.onrender.com';
  // Capacitor WebView origins (androidScheme: https → https://localhost)
  const capacitorOrigins = [
    'https://localhost',
    'capacitor://localhost',
    'http://localhost',
  ];
  const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const corsOrigins =
    configuredOrigins && configuredOrigins.length > 0
      ? [...configuredOrigins]
      : process.env.NODE_ENV === 'production'
        ? [productionWebOrigin, ...capacitorOrigins]
        : ['http://localhost:5173', ...capacitorOrigins];
  for (const origin of [productionWebOrigin, ...capacitorOrigins]) {
    if (!corsOrigins.includes(origin)) {
      corsOrigins.push(origin);
    }
  }
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.useGlobalInterceptors(new ResponseInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Territory Run API')
      .setDescription('Game backend for territory running')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
    Logger.log('Swagger: http://localhost:3000/docs', 'Bootstrap');
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  const dbTarget = describeDatabaseTarget();
  Logger.log(`Database host: ${dbTarget}`, 'Bootstrap');
  try {
    const prisma = app.get(PrismaService);
    await prisma.$queryRaw`SELECT 1`;
    Logger.log('Database connection: ok', 'Bootstrap');
  } catch (err) {
    Logger.error(
      `Database connection FAILED (${dbTarget}). ` +
        'For local dev: docker compose up -d postgres redis, then npx prisma migrate deploy. ' +
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      'Bootstrap',
    );
  }

  Logger.log(`API started on http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
