import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateSubmissionDto {
  @IsOptional()
  @IsUrl()
  repoUrl?: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;

  @IsOptional()
  @IsUrl()
  demoUrl?: string;
}
