import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiHeader, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { UploadsService } from './uploads.service';
import { TenantId, Actor } from '../../common/decorators';
import { UploadResponseDto } from './dto/upload-response.dto';

@ApiTags('Uploads')
@ApiHeader({ name: 'X-Tenant-Id', required: true })
@Controller('uploads')
export class UploadsController {
  private readonly maxFileSizeBytes: number;

  constructor(
    private readonly uploadsService: UploadsService,
    private readonly configService: ConfigService,
  ) {
    const maxSizeMb = this.configService.get<number>(
      'UPLOAD_MAX_FILE_SIZE_MB',
      10,
    );
    this.maxFileSizeBytes = maxSizeMb * 1024 * 1024;
  }

  @Post()
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @TenantId() tenantId: string,
    @Actor() actor: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ): Promise<{ data: UploadResponseDto }> {
    if (file) {
      if (file.size > this.maxFileSizeBytes) {
        throw new BadRequestException(
          `File size exceeds maximum allowed (${this.maxFileSizeBytes / 1024 / 1024}MB)`,
        );
      }

      const upload = await this.uploadsService.uploadFile(tenantId, file, actor);

      return {
        data: {
          id: upload.id,
          tenantId: upload.tenantId,
          objectKey: upload.objectKey,
          fileUrl: upload.fileUrl,
          fileName: upload.fileName,
          contentType: upload.contentType,
          fileSize: Number(upload.fileSize),
          uploadedBy: upload.uploadedBy,
          createdAt: upload.createdAt,
        },
      };
    }

    // JSON body fallback
    const fileName = body?.fileName;
    const contentType = body?.contentType || 'application/octet-stream';
    const fileSize = body?.fileSize;

    if (!fileName) {
      throw new BadRequestException('fileName is required');
    }
    if (fileSize === undefined || fileSize === null) {
      throw new BadRequestException('fileSize is required');
    }

    const upload = await this.uploadsService.uploadFromJson(
      tenantId,
      fileName,
      contentType,
      fileSize,
      actor,
    );

    return {
      data: {
        id: upload.id,
        tenantId: upload.tenantId,
        objectKey: upload.objectKey,
        fileUrl: upload.fileUrl,
        fileName: upload.fileName,
        contentType: upload.contentType,
        fileSize: Number(upload.fileSize),
        uploadedBy: upload.uploadedBy,
        createdAt: upload.createdAt,
      },
    };
  }
}
