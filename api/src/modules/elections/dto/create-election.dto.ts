import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateElectionDto {
  @IsString()
  periodId!: string;

  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
