import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BasketModule } from './modules/basket/basket.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // reads .env
    BasketModule,
  ],
})
export class AppModule {}
