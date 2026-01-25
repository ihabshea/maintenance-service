import { IsString, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ReasonTypeDto {
  cancellation = 'cancellation',
}

export class CreateReasonDto {
  @ApiProperty({ enum: ReasonTypeDto, description: 'Reason type' })
  @IsEnum(ReasonTypeDto)
  reasonType: ReasonTypeDto;

  @ApiProperty({ description: 'Reason label' })
  @IsString()
  @MaxLength(255)
  label: string;
}
