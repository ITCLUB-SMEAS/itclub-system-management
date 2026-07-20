import { IsOptional, IsString } from 'class-validator';

export class RefreshDto {
  /** Optional when refresh token is sent via HttpOnly cookie */
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
