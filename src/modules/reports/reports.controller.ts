import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiHeader, ApiOperation } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { TenantId } from '../../common/decorators';

@ApiTags('Reports')
@ApiHeader({ name: 'X-Tenant-Id', required: true })
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('maintenance-status')
  @ApiOperation({ summary: 'Get maintenance status report (FR-MNT-015)' })
  async getMaintenanceStatusReport(
    @TenantId() tenantId: string,
    @Query() filters: ReportFiltersDto,
  ) {
    const data = await this.reportsService.getMaintenanceStatusReport(
      tenantId,
      filters,
    );
    return { data };
  }

  @Get('overdue-preventive')
  @ApiOperation({
    summary: 'Get overdue preventive maintenance report (FR-MNT-016)',
  })
  async getOverduePreventiveReport(
    @TenantId() tenantId: string,
    @Query() filters: ReportFiltersDto,
  ) {
    const data = await this.reportsService.getOverduePreventiveReport(
      tenantId,
      filters,
    );
    return { data };
  }

  @Get('cost-summary')
  @ApiOperation({ summary: 'Get maintenance cost summary report (FR-MNT-017)' })
  async getCostSummaryReport(
    @TenantId() tenantId: string,
    @Query() filters: ReportFiltersDto,
  ) {
    const data = await this.reportsService.getCostSummaryReport(
      tenantId,
      filters,
    );
    return { data };
  }

  @Get('corrective-vs-preventive')
  @ApiOperation({
    summary: 'Get corrective vs preventive maintenance report (FR-MNT-018)',
  })
  async getCorrectiveVsPreventiveReport(
    @TenantId() tenantId: string,
    @Query() filters: ReportFiltersDto,
  ) {
    const data = await this.reportsService.getCorrectiveVsPreventiveReport(
      tenantId,
      filters,
    );
    return { data };
  }
}
