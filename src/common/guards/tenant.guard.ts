import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { validate as isUuid } from 'uuid';
import { SKIP_TENANT_CHECK } from '../decorators/skip-tenant-check.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skipTenantCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_TENANT_CHECK,
      [context.getHandler(), context.getClass()],
    );

    if (skipTenantCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantId = request.headers['x-tenant-id'];

    if (!tenantId) {
      throw new BadRequestException('X-Tenant-Id header is required');
    }

    if (!isUuid(tenantId)) {
      throw new BadRequestException('X-Tenant-Id must be a valid UUID');
    }

    request.tenantId = tenantId;
    return true;
  }
}
