import { IsEnum, IsOptional, IsString } from 'class-validator';
import { RecruitmentStage } from '@prisma/client';

export class SetStageDto {
  @IsEnum(RecruitmentStage)
  stage!: RecruitmentStage;

  @IsOptional()
  @IsString()
  notes?: string;
}
