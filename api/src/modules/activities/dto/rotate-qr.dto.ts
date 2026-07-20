import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class RotateQrDto {
  /** minutes until QR expires (default 15) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  ttlMinutes?: number;
}
