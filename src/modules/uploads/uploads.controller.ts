import {
  Controller,
  Post,
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
  @ApiConsumes('multipart/form-data')
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
  ): Promise<{ data: UploadResponseDto }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > this.maxFileSizeBytes) {
      throw new BadRequestException(
        `File size exceeds maximum allowed (${this.maxFileSizeBytes / 1024 / 1024}MB)`,
      );
    }

    const upload = await this.uploadsService.uploadFile(tenantId, file, actor);

    return {
      data: {
        id: upload.id,
        fileUrl: upload.fileUrl,
        fileName: upload.fileName,
        contentType: upload.contentType,
        fileSize: Number(upload.fileSize),
        createdAt: upload.createdAt,
      },
    };
  }
}
