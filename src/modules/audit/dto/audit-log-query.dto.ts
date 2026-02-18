import { IsEnum, IsNotEmpty, IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditEntityType } from '@prisma/client';
import { IntersectionType } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class AuditLogFilterDto {
  @ApiProperty({ enum: AuditEntityType })
  @IsEnum(AuditEntityType)
  @IsNotEmpty()
  entityType: AuditEntityType;

  @ApiProperty({ description: 'UUID of the entity to query' })
  @IsString()
  @IsNotEmpty()
  entityId: string;

  @ApiPropertyOptional({ description: 'Start of date range (ISO 8601)', example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'End of date range (ISO 8601)', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class AuditLogQueryDto extends IntersectionType(
  AuditLogFilterDto,
  PaginationQueryDto,
) {}
