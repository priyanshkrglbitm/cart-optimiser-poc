import { Module } from '@nestjs/common';
import { PlatformsService } from './platforms.service';

@Module({
  providers: [PlatformsService],
  exports: [PlatformsService],
})
export class PlatformsModule {}
