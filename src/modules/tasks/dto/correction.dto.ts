import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  IsDateString,
  IsUUID,
  ValidateNested,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CorrectionPatchDto {
  @ApiPropertyOptional({ description: 'Due odometer km' })
  @IsOptional()
  @IsInt()
  @Min(0)
  dueOdometerKm?: number;

  @ApiPropertyOptional({ description: 'Due date' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Actual odometer km' })
  @IsOptional()
  @IsInt()
  @Min(0)
  actualOdometerKm?: number;

  @ApiPropertyOptional({ description: 'Completion date' })
  @IsOptional()
  @IsDateString()
  completionDate?: string;

  @ApiPropertyOptional({ description: 'Workshop ID' })
  @IsOptional()
  @IsUUID()
  workshopId?: string;

  @ApiPropertyOptional({ description: 'Custom workshop name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  workshopCustom?: string;

  @ApiPropertyOptional({ description: 'Cost amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  costAmount?: number;

  @ApiPropertyOptional({ description: 'Cost currency' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  costCurrency?: string;

  @ApiPropertyOptional({ description: 'Cancellation date' })
  @IsOptional()
  @IsDateString()
  cancellationDate?: string;

  @ApiPropertyOptional({ description: 'Cancellation reason ID' })
  @IsOptional()
  @IsUUID()
  cancellationReasonId?: string;

  @ApiPropertyOptional({ description: 'Custom cancellation reason' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancellationReasonCustom?: string;

  @ApiPropertyOptional({ description: 'Reschedule original due date' })
  @IsOptional()
  @IsDateString()
  rescheduleOriginalDueDate?: string;

  @ApiPropertyOptional({ description: 'Reschedule new due date' })
  @IsOptional()
  @IsDateString()
  rescheduleNewDueDate?: string;

  @ApiPropertyOptional({ description: 'Reschedule reason ID' })
  @IsOptional()
  @IsUUID()
  rescheduleReasonId?: string;

  @ApiPropertyOptional({ description: 'Custom reschedule reason' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rescheduleReasonCustom?: string;

  @ApiPropertyOptional({ description: 'Reschedule odometer km' })
  @IsOptional()
  @IsInt()
  @Min(0)
  rescheduleOdometerKm?: number;
}

export class CorrectionDto {
  @ApiProperty({ description: 'Reason for correction' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  correctionReason: string;

  @ApiProperty({ type: CorrectionPatchDto, description: 'Fields to update' })
  @ValidateNested()
  @Type(() => CorrectionPatchDto)
  patch: CorrectionPatchDto;
}
