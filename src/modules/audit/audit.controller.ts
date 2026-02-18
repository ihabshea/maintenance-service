import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiHeader } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { TenantId } from '../../common/decorators';

@ApiTags('Audit Logs')
@ApiHeader({ name: 'X-Tenant-Id', required: true })
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getAuditLogs(
    @TenantId() tenantId: string,
    @Query() query: AuditLogQueryDto,
  ) {
    return this.auditService.getAuditLogs(
      tenantId,
      query,
      query.entityType,
      query.entityId,
      query.fromDate,
      query.toDate,
    );
  }
}
