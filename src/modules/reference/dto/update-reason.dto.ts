import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReferenceStatus } from '@prisma/client';

export class UpdateReasonDto {
  @ApiPropertyOptional({ description: 'Reason label' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;

  @ApiPropertyOptional({ enum: ReferenceStatus, description: 'Reason status' })
  @IsOptional()
  @IsEnum(ReferenceStatus)
  status?: ReferenceStatus;
}
