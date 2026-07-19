import { IsString } from 'class-validator';

export class BiometricLoginDto {
  @IsString()
  biometricKey!: string;
}
