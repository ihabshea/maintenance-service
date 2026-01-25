import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { VehicleInputDto } from './create-task.dto';

export class AddVehiclesDto {
  @ApiProperty({ type: [VehicleInputDto], description: 'Vehicles to add' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VehicleInputDto)
  vehicles: VehicleInputDto[];
}
