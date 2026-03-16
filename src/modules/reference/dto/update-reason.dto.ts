import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReferenceStatus } from '@prisma/client';

export class UpdateReasonDto {
  @ApiPropertyOptional({ description: 'Reason label' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive'], description: 'Reason status' })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: ReferenceStatus;
}
