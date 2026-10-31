import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { UniversalBasketResponse } from '../../common/types/commerce.types';
import { BasketService } from './basket.service';
import { OptimizeBasketDto } from './dto/optimize-basket.dto';

/** API entry point for baskets. Routes are under the global /api prefix set in main.ts. */
@Controller('basket')
export class BasketController {
  constructor(private readonly basketService: BasketService) {}

  /** POST /api/basket/optimize  { items: string[], location: { latitude, longitude, pincode, ... } } */
  @Post('optimize')
  @HttpCode(200)
  optimize(@Body() dto: OptimizeBasketDto): Promise<UniversalBasketResponse> {
    return this.basketService.optimizeBasketCached(dto.items, dto.location);
  }
}
