import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateSubmissionDto {
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'repoUrl must be a valid URL' })
  repoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  fileUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'demoUrl must be a valid URL' })
  demoUrl?: string;
}
