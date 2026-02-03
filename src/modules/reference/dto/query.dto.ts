import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IntersectionType } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { ReasonTypeDto } from './create-reason.dto';

export class ReasonsFilterDto {
  @ApiPropertyOptional({
    enum: ReasonTypeDto,
    description: 'Filter by reason type',
  })
  @IsOptional()
  @IsEnum(ReasonTypeDto)
  type?: ReasonTypeDto;
}

export class ReasonsQueryDto extends IntersectionType(
  ReasonsFilterDto,
  PaginationQueryDto,
) {}
