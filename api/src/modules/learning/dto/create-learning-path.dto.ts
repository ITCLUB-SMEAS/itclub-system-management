import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateLearningPathDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  level!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  divisionId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
