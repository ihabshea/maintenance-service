import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
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
}

export class AuditLogQueryDto extends IntersectionType(
  AuditLogFilterDto,
  PaginationQueryDto,
) {}
