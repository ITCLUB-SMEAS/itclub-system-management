import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateActivityDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  /** meters; default 100 when lat/lng set */
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(5000)
  geofenceRadiusM?: number;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;
}
