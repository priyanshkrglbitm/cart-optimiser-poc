import 'dotenv/config'; // first, so LOG_LEVEL from .env reaches the logger below
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WinstonModule } from 'nest-winston';
import { join } from 'path';
import { AppModule } from './app.module';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { winstonLogger } from './logger.config';

async function bootstrap() {
  // Every Nest Logger call (new Logger('X').log(...)) now goes to the console and logs/*.log via Winston
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger({ instance: winstonLogger }),
  });

  // Reject bad request bodies using the DTO rules (e.g. modules/basket/dto)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  // The dashboard (public/index.html, css/, js/) is served from the same server, so no CORS is needed
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.enableShutdownHooks();

  const port = Number(app.get(ConfigService).get('PORT')) || 3079;
  await app.listen(port, '127.0.0.1');

  const logger = new Logger('Bootstrap');
  logger.log(`Dashboard: http://127.0.0.1:${port}`);
  logger.log(`API:       POST http://127.0.0.1:${port}/api/optimize-basket`);
}

void bootstrap();
