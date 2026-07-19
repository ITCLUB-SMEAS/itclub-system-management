import { IsEnum, IsOptional, IsString } from 'class-validator';
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
}
