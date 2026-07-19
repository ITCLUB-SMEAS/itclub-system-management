import { IsString, MinLength } from 'class-validator';

export class CreateElectionDto {
  @IsString()
  periodId!: string;

  @IsString()
  @MinLength(2)
  title!: string;
}
