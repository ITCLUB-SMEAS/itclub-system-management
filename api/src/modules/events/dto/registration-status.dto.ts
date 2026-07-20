import { IsEnum } from 'class-validator';
import { ApprovalStatus } from '@prisma/client';

export class RegistrationStatusDto {
  @IsEnum(ApprovalStatus)
  status!: ApprovalStatus;
}
