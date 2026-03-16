import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReferenceStatus } from '@prisma/client';

export class UpdateWorkshopDto {
  @ApiPropertyOptional({ description: 'Workshop name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Workshop location' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;

  @ApiPropertyOptional({
    enum: ['active', 'inactive'],
    description: 'Workshop status',
  })
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: ReferenceStatus;
}
