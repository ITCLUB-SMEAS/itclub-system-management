import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLearningPathDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  level!: string;

  @IsOptional()
  @IsString()
  divisionId?: string;
}
