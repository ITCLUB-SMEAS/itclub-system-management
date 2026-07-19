import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateEvaluationDto {
  @IsString()
  periodId!: string;

  @IsString()
  @MinLength(2)
  targetRole!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
