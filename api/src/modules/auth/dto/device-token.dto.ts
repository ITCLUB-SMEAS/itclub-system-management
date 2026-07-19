import { IsOptional, IsString } from 'class-validator';

export class DeviceTokenDto {
  @IsString()
  token!: string;

  @IsString()
  platform!: string;

  @IsOptional()
  @IsString()
  biometricKey?: string;
}
