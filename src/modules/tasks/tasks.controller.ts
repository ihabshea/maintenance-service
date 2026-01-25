import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiHeader, ApiParam } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { AddVehiclesDto } from './dto/add-vehicles.dto';
import {
  CompleteVehicleDto,
  CancelVehicleDto,
  RescheduleVehicleDto,
} from './dto/status-transitions.dto';
import { CorrectionDto } from './dto/correction.dto';
import { VehicleMaintenanceQueryDto } from './dto/query.dto';
import { TenantId, Actor } from '../../common/decorators';

@ApiTags('Maintenance Tasks')
@ApiHeader({ name: 'X-Tenant-Id', required: true })
@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('maintenance/tasks')
  async createTask(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Body() dto: CreateTaskDto,
  ) {
    const task = await this.tasksService.createTask(tenantId, dto, actor);
    return { data: task };
  }

  @Get('maintenance/tasks/:taskId')
  @ApiParam({ name: 'taskId', type: 'string' })
  async getTask(@TenantId() tenantId: string, @Param('taskId') taskId: string) {
    const task = await this.tasksService.getTaskById(tenantId, taskId);
    return { data: task };
  }

  @Post('maintenance/tasks/:taskId/vehicles')
  @ApiParam({ name: 'taskId', type: 'string' })
  async addVehicles(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Param('taskId') taskId: string,
    @Body() dto: AddVehiclesDto,
  ) {
    await this.tasksService.addVehicles(tenantId, taskId, dto, actor);
    return { data: { success: true } };
  }

  @Get('vehicles/:vehicleId/maintenance')
  @ApiParam({ name: 'vehicleId', type: 'string' })
  async getVehicleMaintenance(
    @TenantId() tenantId: string,
    @Param('vehicleId') vehicleId: string,
    @Query() query: VehicleMaintenanceQueryDto,
  ) {
    const tasks = await this.tasksService.getVehicleMaintenance(
      tenantId,
      vehicleId,
      query,
    );
    return { data: tasks };
  }

  @Patch('maintenance/tasks/:taskId/vehicles/:vehicleId/status/completed')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'taskId', type: 'string' })
  @ApiParam({ name: 'vehicleId', type: 'string' })
  async completeVehicle(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Param('taskId') taskId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: CompleteVehicleDto,
  ) {
    await this.tasksService.completeVehicle(
      tenantId,
      taskId,
      vehicleId,
      dto,
      actor,
    );
    return { data: { success: true } };
  }

  @Patch('maintenance/tasks/:taskId/vehicles/:vehicleId/status/cancelled')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'taskId', type: 'string' })
  @ApiParam({ name: 'vehicleId', type: 'string' })
  async cancelVehicle(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Param('taskId') taskId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: CancelVehicleDto,
  ) {
    await this.tasksService.cancelVehicle(
      tenantId,
      taskId,
      vehicleId,
      dto,
      actor,
    );
    return { data: { success: true } };
  }

  @Patch('maintenance/tasks/:taskId/vehicles/:vehicleId/status/rescheduled')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'taskId', type: 'string' })
  @ApiParam({ name: 'vehicleId', type: 'string' })
  async rescheduleVehicle(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Param('taskId') taskId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: RescheduleVehicleDto,
  ) {
    await this.tasksService.rescheduleVehicle(
      tenantId,
      taskId,
      vehicleId,
      dto,
      actor,
    );
    return { data: { success: true } };
  }

  @Post('maintenance/tasks/:taskId/vehicles/:vehicleId/corrections')
  @ApiParam({ name: 'taskId', type: 'string' })
  @ApiParam({ name: 'vehicleId', type: 'string' })
  async applyCorrection(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Param('taskId') taskId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() dto: CorrectionDto,
  ) {
    await this.tasksService.applyCorrection(
      tenantId,
      taskId,
      vehicleId,
      dto,
      actor,
    );
    return { data: { success: true } };
  }
}
