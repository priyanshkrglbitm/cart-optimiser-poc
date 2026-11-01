import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsDefined, IsIn, IsNotEmpty, IsString, MaxLength, ValidateNested } from 'class-validator';
import { LocationDto } from '../../basket/dto/optimize-basket.dto';

export class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content!: string;
}

export class AgentChatDto {
  /** The conversation so far, oldest first; the last one is the user's new message. */
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];

  @IsDefined({ message: 'location with a pincode is required' })
  @ValidateNested()
  @Type(() => LocationDto)
  location!: LocationDto;
}
