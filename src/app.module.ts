import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AgentModule } from './modules/agent/agent.module';
import { BasketModule } from './modules/basket/basket.module';
import { DatabaseModule } from './modules/database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // reads .env
    DatabaseModule, // global: the SQLite price database
    // The dashboard (public/index.html, css/, js/) from the same server, so no CORS is needed
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api/{*path}'],
    }),
    BasketModule,
    AgentModule,
  ],
})
export class AppModule {}
