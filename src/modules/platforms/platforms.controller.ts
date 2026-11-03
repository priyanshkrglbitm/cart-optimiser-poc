import { Controller, Get } from '@nestjs/common';
import { PlatformMetadata } from '../../common/types/commerce.types';
import { PlatformsService } from './platforms.service';

@Controller('platforms')
export class PlatformsController {
  constructor(private readonly platformsService: PlatformsService) {}

  /** GET /api/platforms  every store with its delivery time and fees (used by the dashboard's store list) */
  @Get()
  list(): PlatformMetadata[] {
    return this.platformsService.platforms;
  }
}
