import { IsEnum } from 'class-validator';
import { ElectionStatus } from '@prisma/client';

export class SetElectionStatusDto {
  @IsEnum(ElectionStatus)
  status!: ElectionStatus;
}
