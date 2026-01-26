import { IsOptional, IsDateString, IsUUID, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MaintenanceTypeDto } from '../../tasks/dto/create-task.dto';
import { TaskVehicleStatusDto } from '../../tasks/dto/query.dto';

export class ReportFiltersDto {
  @ApiPropertyOptional({ description: 'Filter from date (inclusive)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Filter to date (inclusive)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Filter by vehicle ID' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ enum: MaintenanceTypeDto })
  @IsOptional()
  @IsEnum(MaintenanceTypeDto)
  maintenanceType?: MaintenanceTypeDto;

  @ApiPropertyOptional({ enum: TaskVehicleStatusDto })
  @IsOptional()
  @IsEnum(TaskVehicleStatusDto)
  status?: TaskVehicleStatusDto;
}
