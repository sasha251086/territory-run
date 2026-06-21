import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { initSentry } from './common/sentry.util';
import { ResponseInterceptor } from './common/response.interceptor';

initSentry();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  app.enableCors();
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
  Logger.log(`API started on http://localhost:${port}`, 'Bootstrap');
}
bootstrap();
