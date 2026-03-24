import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of items to return',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Pagination cursor from previous response',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    hasMore: boolean;
    nextCursor: string | null;
    prevCursor: string | null;
  };
}

export function encodeCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id })).toString('base64');
}

export function decodeCursor(cursor: string): { id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function buildPaginatedResult<T extends { id: string }>(
  items: T[],
  limit: number,
  opts?: { total?: number; hasPrev?: boolean; prevCursor?: string | null },
): PaginatedResult<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const nextCursor =
    hasMore && data.length > 0 ? encodeCursor(data[data.length - 1].id) : null;

  return {
    data,
    pagination: {
      total: opts?.total ?? data.length,
      hasMore,
      nextCursor,
      prevCursor: opts?.prevCursor ?? (opts?.hasPrev ? 'first' : null),
    },
  };
}
