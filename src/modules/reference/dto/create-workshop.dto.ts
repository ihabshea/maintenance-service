import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WorkshopScopeDto {
  system = 'system',
  tenant = 'tenant',
}

export class CreateWorkshopDto {
  @ApiProperty({ description: 'Workshop name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Workshop location' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  location?: string;
}

export class CreateSystemWorkshopDto extends CreateWorkshopDto {
  @ApiProperty({ enum: WorkshopScopeDto, description: 'Workshop scope' })
  @IsEnum(WorkshopScopeDto)
  scope: WorkshopScopeDto;
}
