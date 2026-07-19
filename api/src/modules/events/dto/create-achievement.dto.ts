import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAchievementDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  rank?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  memberId?: string;
}
