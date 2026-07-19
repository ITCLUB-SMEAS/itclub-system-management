import { ArrayMinSize, IsArray, IsString, MinLength } from 'class-validator';

export class CreatePollDto {
  @IsString()
  @MinLength(2)
  question!: string;

  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  options!: string[];
}
