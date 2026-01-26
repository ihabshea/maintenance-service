import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MaintenanceTypeDto } from './create-task.dto';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { IntersectionType } from '@nestjs/swagger';

export enum TaskVehicleStatusDto {
  open = 'open',
  completed = 'completed',
  cancelled = 'cancelled',
  rescheduled = 'rescheduled',
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
