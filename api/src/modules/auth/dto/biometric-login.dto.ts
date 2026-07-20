import { IsString, MinLength } from 'class-validator';

export class BiometricLoginDto {
  @IsString()
  @MinLength(32)
  biometricKey!: string;
}
