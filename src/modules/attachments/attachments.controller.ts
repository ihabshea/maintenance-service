import { Controller, Get, Post, Body, Param } from '@nestjs/common';
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
  @ApiParam({ name: 'vehicleId', type: 'string' })
  async createAttachment(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @Param('taskId') taskId: string,
    @Param('vehicleId') vehicleId: string,
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
  @ApiParam({ name: 'vehicleId', type: 'string' })
  async getAttachments(
    @TenantId() tenantId: string,
    @Param('taskId') taskId: string,
    @Param('vehicleId') vehicleId: string,
  ) {
    const attachments = await this.attachmentsService.getAttachments(
      tenantId,
      taskId,
      vehicleId,
    );
    return { data: attachments };
  }
}
