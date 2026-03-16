import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsArray,
  ValidateNested,
  IsDateString,
  IsNumber,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WorkshopModeDto {
  master = 'master',
  custom = 'custom',
}

export enum CancellationReasonModeDto {
  master = 'master',
  custom = 'custom',
}

export enum JobStatusDto {
  pending = 'pending',
  done = 'done',
  skipped = 'skipped',
}

export class JobStatusUpdateDto {
  @ApiProperty({ description: 'Job code' })
  @IsString()
  @IsNotEmpty()
  jobCode: string;

  @ApiProperty({ enum: JobStatusDto, description: 'Job status' })
  @IsEnum(JobStatusDto)
  status: JobStatusDto;
}

export class WorkshopDto {
  @ApiProperty({ enum: WorkshopModeDto, description: 'Workshop mode' })
  @IsEnum(WorkshopModeDto)
  mode: WorkshopModeDto;

  @ApiPropertyOptional({ description: 'Workshop ID (for master mode)' })
  @IsOptional()
  @IsString()
  workshopId?: string;

  @ApiPropertyOptional({ description: 'Custom workshop name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customName?: string;
}

export class CostDto {
  @ApiProperty({ description: 'Cost amount' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: 'Currency code', default: 'EGP' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}

export class CompleteVehicleDto {
  @ApiProperty({ description: 'Completion date' })
  @IsDateString()
  completionDate: string;

  @ApiProperty({ description: 'Actual odometer reading in km' })
  @IsInt()
  @Min(0)
  actualOdometerKm: number;

  @ApiProperty({ type: WorkshopDto, description: 'Workshop information' })
  @ValidateNested()
  @Type(() => WorkshopDto)
  workshop: WorkshopDto;

  @ApiPropertyOptional({ description: 'Workshop location' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @ApiProperty({ type: CostDto, description: 'Cost information' })
  @ValidateNested()
  @Type(() => CostDto)
  cost: CostDto;

  @ApiPropertyOptional({
    type: [JobStatusUpdateDto],
    description: 'Job status updates',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JobStatusUpdateDto)
  jobs?: JobStatusUpdateDto[];
}

export class CancellationReasonDto {
  @ApiProperty({
    enum: CancellationReasonModeDto,
    description: 'Cancellation reason mode',
  })
  @IsEnum(CancellationReasonModeDto)
  mode: CancellationReasonModeDto;

  @ApiPropertyOptional({ description: 'Reason ID (for master mode)' })
  @IsOptional()
  @IsString()
  reasonId?: string;

  @ApiPropertyOptional({ description: 'Custom reason text' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customReason?: string;
}

export class CancelVehicleDto {
  @ApiProperty({ description: 'Cancellation date' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Odometer reading at cancellation' })
  @IsInt()
  @Min(0)
  actualOdometerKm: number;

  @ApiProperty({
    type: CancellationReasonDto,
    description: 'Cancellation reason',
  })
  @ValidateNested()
  @Type(() => CancellationReasonDto)
  cancellationReason: CancellationReasonDto;
}

export enum RescheduleReasonModeDto {
  master = 'master',
  custom = 'custom',
}

export class RescheduleReasonDto {
  @ApiProperty({
    enum: RescheduleReasonModeDto,
    description: 'Reschedule reason mode',
  })
  @IsEnum(RescheduleReasonModeDto)
  mode: RescheduleReasonModeDto;

  @ApiPropertyOptional({ description: 'Reason ID (for master mode)' })
  @IsOptional()
  @IsString()
  reasonId?: string;

  @ApiPropertyOptional({ description: 'Custom reason text' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customReason?: string;
}

export class RescheduleVehicleDto {
  @ApiProperty({ description: 'Original due date' })
  @IsDateString()
  originalDate: string;

  @ApiProperty({ description: 'New scheduled date' })
  @IsDateString()
  newScheduledDate: string;

  @ApiProperty({ description: 'Odometer at reschedule' })
  @IsInt()
  @Min(0)
  rescheduleOdometerKm: number;

  @ApiProperty({
    type: RescheduleReasonDto,
    description: 'Reschedule reason',
  })
  @ValidateNested()
  @Type(() => RescheduleReasonDto)
  rescheduleReason: RescheduleReasonDto;
}
