import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { UniversalBasketResponse } from '../../common/types/commerce.types';
import { BasketService } from './basket.service';
import { OptimizeBasketDto } from './dto/optimize-basket.dto';

@Controller('api')
export class BasketController {
  constructor(private readonly basketService: BasketService) {}

  /** POST /api/optimize-basket  { items: string[], location?: {...} } */
  @Post('optimize-basket')
  @HttpCode(200)
  optimizeBasket(@Body() dto: OptimizeBasketDto): Promise<UniversalBasketResponse> {
    return this.basketService.optimizeBasketCached(dto.items, dto.location);
  }
}
