import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class CreateLearningResourceDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  type!: string;

  @IsUrl()
  url!: string;

  @IsOptional()
  @IsString()
  divisionId?: string;

  @IsOptional()
  @IsString()
  learningPathId?: string;
}
