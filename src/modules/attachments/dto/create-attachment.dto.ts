import {
  IsString,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAttachmentDto {
  @ApiProperty({ description: 'File URL' })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @ApiProperty({ description: 'File type (e.g., receipt, document)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  fileType: string;

  @ApiProperty({ description: 'File name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ description: 'Content type (MIME type)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contentType: string;
}
