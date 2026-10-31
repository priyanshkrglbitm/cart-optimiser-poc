import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class LocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pincode?: string;
}

export class OptimizeBasketDto {
  /** e.g. ["amul butter 500g", "doodh 1L"] */
  @IsArray()
  @ArrayNotEmpty({ message: 'Add at least one item to the basket.' })
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  items!: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}
