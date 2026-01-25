import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsUUID,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
  MaxLength,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MaintenanceTypeDto {
  preventive = 'preventive',
  corrective = 'corrective',
}

export enum TriggerModeDto {
  mileage = 'mileage',
  time = 'time',
  both = 'both',
}

export class VehicleInputDto {
  @ApiProperty({ description: 'Vehicle ID' })
  @IsUUID()
  vehicleId: string;

  @ApiPropertyOptional({ description: 'Due odometer in km' })
  @IsOptional()
  @IsInt()
  @Min(0)
  dueOdometerKm?: number;

  @ApiPropertyOptional({ description: 'Due date' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class ChecklistItemDto {
  @ApiProperty({ description: 'Job code' })
  @IsString()
  @MaxLength(50)
  jobCode: string;

  @ApiProperty({ description: 'Job label' })
  @IsString()
  @MaxLength(255)
  label: string;

  @ApiProperty({ description: 'Sort order' })
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class CreateTaskDto {
  @ApiProperty({ description: 'Task title' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ enum: MaintenanceTypeDto, description: 'Maintenance type' })
  @IsEnum(MaintenanceTypeDto)
  maintenanceType: MaintenanceTypeDto;

  @ApiPropertyOptional({ enum: TriggerModeDto, description: 'Trigger mode' })
  @IsOptional()
  @IsEnum(TriggerModeDto)
  triggerMode?: TriggerModeDto;

  @ApiPropertyOptional({ description: 'Trigger km threshold' })
  @IsOptional()
  @IsInt()
  @Min(0)
  triggerKm?: number;

  @ApiPropertyOptional({ description: 'Trigger date' })
  @IsOptional()
  @IsDateString()
  triggerDate?: string;

  @ApiPropertyOptional({ description: 'Remind before km' })
  @IsOptional()
  @IsInt()
  @Min(0)
  remindBeforeKm?: number;

  @ApiPropertyOptional({ description: 'Remind before days' })
  @IsOptional()
  @IsInt()
  @Min(0)
  remindBeforeDays?: number;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Source group ID' })
  @IsOptional()
  @IsUUID()
  sourceGroupId?: string;

  @ApiPropertyOptional({ description: 'Selection context' })
  @IsOptional()
  @IsObject()
  selectionContext?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [VehicleInputDto], description: 'Vehicles' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VehicleInputDto)
  vehicles?: VehicleInputDto[];

  @ApiPropertyOptional({ type: [ChecklistItemDto], description: 'Checklist' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklist?: ChecklistItemDto[];
}
