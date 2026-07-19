import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePeerReviewDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsString()
  revieweeId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  comment?: string;
}
