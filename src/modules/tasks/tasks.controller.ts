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
  ParseIntPipe,
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
import {
  VehicleMaintenanceQueryDto,
  TaskListQueryDto,
  BulkVehicleMaintenanceDto,
  BulkVehicleMaintenanceQueryDto,
} from './dto/query.dto';
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

  @Get('maintenance/tasks')
  async listTasks(
    @TenantId() tenantId: string,
    @Query() query: TaskListQueryDto,
  ) {
    return this.tasksService.listTasks(tenantId, query);
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
    const vehicles = await this.tasksService.addVehicles(tenantId, taskId, dto, actor);
    return { data: vehicles };
  }

  @Post('vehicles/maintenance-status')
  @HttpCode(HttpStatus.OK)
  async getBulkVehicleMaintenance(
    @TenantId() tenantId: string,
    @Body() dto: BulkVehicleMaintenanceDto,
    @Query() query: BulkVehicleMaintenanceQueryDto,
  ) {
    return this.tasksService.getBulkVehicleMaintenance(tenantId, dto, query);
  }

  @Get('vehicles/:vehicleId/maintenance')
  @ApiParam({ name: 'vehicleId', type: 'number' })
  async getVehicleMaintenance(
    @TenantId() tenantId: string,
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Query() query: VehicleMaintenanceQueryDto,
  ) {
    return this.tasksService.getVehicleMaintenance(tenantId, vehicleId, query);
  }

  @Patch('maintenance/tasks/:taskId/vehicles/:vehicleId/status/completed')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'taskId', type: 'string' })
  @ApiParam({ name: 'vehicleId', type: 'number' })
  async completeVehicle(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Param('taskId') taskId: string,
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body() dto: CompleteVehicleDto,
  ) {
    const vehicle = await this.tasksService.completeVehicle(
      tenantId,
      taskId,
      vehicleId,
      dto,
      actor,
    );
    return { data: vehicle };
  }

  @Patch('maintenance/tasks/:taskId/vehicles/:vehicleId/status/cancelled')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'taskId', type: 'string' })
  @ApiParam({ name: 'vehicleId', type: 'number' })
  async cancelVehicle(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Param('taskId') taskId: string,
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body() dto: CancelVehicleDto,
  ) {
    const vehicle = await this.tasksService.cancelVehicle(
      tenantId,
      taskId,
      vehicleId,
      dto,
      actor,
    );
    return { data: vehicle };
  }

  @Patch('maintenance/tasks/:taskId/vehicles/:vehicleId/status/rescheduled')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'taskId', type: 'string' })
  @ApiParam({ name: 'vehicleId', type: 'number' })
  async rescheduleVehicle(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Param('taskId') taskId: string,
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body() dto: RescheduleVehicleDto,
  ) {
    const vehicle = await this.tasksService.rescheduleVehicle(
      tenantId,
      taskId,
      vehicleId,
      dto,
      actor,
    );
    return { data: vehicle };
  }

  @Post('maintenance/tasks/:taskId/vehicles/:vehicleId/corrections')
  @ApiParam({ name: 'taskId', type: 'string' })
  @ApiParam({ name: 'vehicleId', type: 'number' })
  async applyCorrection(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Param('taskId') taskId: string,
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body() dto: CorrectionDto,
  ) {
    const result = await this.tasksService.applyCorrection(
      tenantId,
      taskId,
      vehicleId,
      dto,
      actor,
    );
    return { data: result };
  }
}
