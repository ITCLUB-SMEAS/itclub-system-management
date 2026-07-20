import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { AttendanceMethod } from '@prisma/client';

export class CheckInDto {
  @IsString()
  activityId!: string;

  @IsOptional()
  @IsString()
  qrToken?: string;

  @IsOptional()
  @IsEnum(AttendanceMethod)
  method?: AttendanceMethod;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
