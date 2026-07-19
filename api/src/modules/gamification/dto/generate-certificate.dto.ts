import { IsOptional, IsString, MinLength } from 'class-validator';

export class GenerateCertificateDto {
  @IsString()
  memberId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  fileUrl?: string;
}
