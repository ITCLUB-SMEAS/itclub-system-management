import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateGalleryDto {
  @IsUrl()
  imageUrl!: string;

  @IsOptional()
  @IsString()
  caption?: string;
}
