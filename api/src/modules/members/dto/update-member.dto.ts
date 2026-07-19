import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  className?: string;

  @IsOptional()
  @IsInt()
  batchYear?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];
}
