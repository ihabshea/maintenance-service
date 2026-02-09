import { IsString, IsNotEmpty, IsOptional, IsUrl, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAttachmentDto {
  @ApiProperty({ description: 'File URL' })
  @IsUrl()
  fileUrl: string;

  @ApiProperty({ description: 'File type (e.g., receipt, document)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  fileType: string;

  @ApiPropertyOptional({ description: 'File name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({ description: 'Content type (MIME type)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contentType?: string;
}
