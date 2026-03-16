import { IsOptional, IsEnum, IsArray, IsInt, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { MaintenanceTypeDto } from './create-task.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { IntersectionType } from '@nestjs/swagger';

export enum TaskVehicleStatusDto {
  open = 'open',
  completed = 'completed',
  cancelled = 'cancelled',
  rescheduled = 'rescheduled',
}

export enum TaskCompletionFilterDto {
  completed = 'completed',
  incompleted = 'incompleted',
}

export class VehicleMaintenanceFilterDto {
  @ApiPropertyOptional({ enum: MaintenanceTypeDto })
  @IsOptional()
  @IsEnum(MaintenanceTypeDto)
  maintenanceType?: MaintenanceTypeDto;

  @ApiPropertyOptional({ enum: TaskVehicleStatusDto })
  @IsOptional()
  @IsEnum(TaskVehicleStatusDto)
  status?: TaskVehicleStatusDto;
}

export class VehicleMaintenanceQueryDto extends IntersectionType(
  VehicleMaintenanceFilterDto,
  PaginationQueryDto,
) {}

export class TaskListFilterDto {
  @ApiPropertyOptional({ enum: MaintenanceTypeDto })
  @IsOptional()
  @IsEnum(MaintenanceTypeDto)
  maintenanceType?: MaintenanceTypeDto;

  @ApiPropertyOptional({ enum: TaskVehicleStatusDto, description: 'Filter tasks that have at least one vehicle with this status' })
  @IsOptional()
  @IsEnum(TaskVehicleStatusDto)
  status?: TaskVehicleStatusDto;

  @ApiPropertyOptional({
    enum: TaskCompletionFilterDto,
    description:
      'Filter by task completion: completed = all vehicles are non-open, incompleted = at least one vehicle is open',
  })
  @IsOptional()
  @IsEnum(TaskCompletionFilterDto)
  completion?: TaskCompletionFilterDto;
}

export class TaskListQueryDto extends IntersectionType(
  TaskListFilterDto,
  PaginationQueryDto,
) {}

export enum VehicleActivityFilterDto {
  active = 'active',
  inactive = 'inactive',
}

export class BulkVehicleMaintenanceDto {
  @ApiProperty({
    description: 'Array of vehicle IDs to look up',
    type: [Number],
    example: [101, 102, 103],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  vehicleIds: number[];
}

export class BulkVehicleMaintenanceQueryDto {
  @ApiPropertyOptional({
    enum: VehicleActivityFilterDto,
    description:
      'Filter vehicles: active = has at least one open task, inactive = no open tasks',
  })
  @IsOptional()
  @IsEnum(VehicleActivityFilterDto)
  status?: VehicleActivityFilterDto;
}
