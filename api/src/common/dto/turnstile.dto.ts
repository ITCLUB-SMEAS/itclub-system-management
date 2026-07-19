import { IsOptional, IsString } from 'class-validator';

export class TurnstileTokenDto {
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
