import { IsInt, IsOptional, IsString, IsUrl, Min, MinLength } from 'class-validator';

export class CreateLearningResourceDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsString()
  type!: string;

  @IsUrl({ require_protocol: true })
  url!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  divisionId?: string;

  @IsOptional()
  @IsString()
  learningPathId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
