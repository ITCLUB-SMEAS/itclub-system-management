import { IsEnum, IsOptional, IsString } from 'class-validator';
import { RoleName } from '@prisma/client';

export class AssignDivisionDto {
  @IsString()
  periodId!: string;

  @IsOptional()
  @IsString()
  divisionId?: string;

  @IsEnum(RoleName)
  role!: RoleName;
}
