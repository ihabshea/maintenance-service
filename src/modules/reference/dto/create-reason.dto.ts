import { IsString, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ReasonTypeDto {
  cancellation = 'cancellation',
  rescheduling = 'rescheduling',
}

export class CreateReasonDto {
  @ApiProperty({ enum: ReasonTypeDto, description: 'Reason type' })
  @IsEnum(ReasonTypeDto)
  reasonType: ReasonTypeDto;

  @ApiProperty({ description: 'Reason label' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  label: string;
}
