import { ApiProperty } from '@nestjs/swagger';

export class UploadResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the upload',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({ description: 'Tenant identifier' })
  tenantId: string;

  @ApiProperty({ description: 'Object storage key' })
  objectKey: string;

  @ApiProperty({
    description: 'URL to access the uploaded file',
    example:
      'http://localhost:9000/maintenance-uploads/tenant-id/upload-id-filename.pdf',
  })
  fileUrl: string;

  @ApiProperty({
    description: 'Original filename',
    example: 'document.pdf',
  })
  fileName: string;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'application/pdf',
  })
  contentType: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1024,
  })
  fileSize: number;

  @ApiProperty({ description: 'User who uploaded the file' })
  uploadedBy: string;

  @ApiProperty({
    description: 'When the file was uploaded',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: Date;
}
