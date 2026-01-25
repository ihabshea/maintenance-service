import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MaintenanceTypeDto } from './create-task.dto';

export enum TaskVehicleStatusDto {
  open = 'open',
  completed = 'completed',
  cancelled = 'cancelled',
  rescheduled = 'rescheduled',
}

export class VehicleMaintenanceQueryDto {
  @ApiPropertyOptional({ enum: MaintenanceTypeDto })
  @IsOptional()
  @IsEnum(MaintenanceTypeDto)
  maintenanceType?: MaintenanceTypeDto;

  @ApiPropertyOptional({ enum: TaskVehicleStatusDto })
  @IsOptional()
  @IsEnum(TaskVehicleStatusDto)
  status?: TaskVehicleStatusDto;
}
