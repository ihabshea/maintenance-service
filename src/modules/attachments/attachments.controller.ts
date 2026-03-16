import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiHeader, ApiParam } from '@nestjs/swagger';
import { AttachmentsService } from './attachments.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { TenantId, Actor } from '../../common/decorators';

@ApiTags('Attachments')
@ApiHeader({ name: 'X-Tenant-Id', required: true })
@Controller('maintenance/tasks/:taskId/vehicles/:vehicleId/attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @ApiParam({ name: 'taskId', type: 'string' })
  @ApiParam({ name: 'vehicleId', type: 'number' })
  async createAttachment(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Param('taskId') taskId: string,
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Body() dto: CreateAttachmentDto,
  ) {
    const attachment = await this.attachmentsService.createAttachment(
      tenantId,
      taskId,
      vehicleId,
      dto,
      actor,
    );
    return { data: attachment };
  }

  @Get()
  @ApiParam({ name: 'taskId', type: 'string' })
  @ApiParam({ name: 'vehicleId', type: 'number' })
  async getAttachments(
    @TenantId() tenantId: string,
    @Param('taskId') taskId: string,
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
  ) {
    return this.attachmentsService.getAttachments(
      tenantId,
      taskId,
      vehicleId,
    );
  }
}
