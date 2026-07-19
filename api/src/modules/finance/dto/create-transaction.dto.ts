import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { TransactionType } from '@prisma/client';

export class CreateTransactionDto {
  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @MinLength(2)
  description!: string;

  @IsOptional()
  @IsString()
  periodId?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
