import { IsDateString, IsOptional, IsString } from 'class-validator';

export class LoanRequestDto {
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
