import { IsOptional, IsString, MinLength } from 'class-validator';

export class DiscordNotifyDto {
  @IsString()
  @MinLength(1)
  message!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  channel?: string;
}
