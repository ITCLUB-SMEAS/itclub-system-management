import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class ApplyDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  className?: string;

  @IsOptional()
  @IsString()
  interestNotes?: string;

  @IsOptional()
  @IsString()
  divisionPreference?: string;

  @IsOptional()
  @IsString()
  turnstileToken?: string;
}
