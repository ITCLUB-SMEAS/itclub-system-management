import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateItemDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  condition?: string;
}
