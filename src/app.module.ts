import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BasketModule } from './modules/basket/basket.module';
import { DatabaseModule } from './modules/database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // reads .env
    DatabaseModule, // global: the SQLite price database
    BasketModule,
  ],
})
export class AppModule {}
