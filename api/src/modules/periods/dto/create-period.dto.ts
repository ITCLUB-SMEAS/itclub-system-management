import { IsBoolean, IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePeriodDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
