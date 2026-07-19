import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class CreateBadgeDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  iconUrl?: string;
}
