import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_TENANT_CHECK } from '../decorators/skip-tenant-check.decorator';

const NUMERIC_ID_PATTERN = /^\d+$/;

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

    if (!NUMERIC_ID_PATTERN.test(tenantId)) {
      throw new BadRequestException('X-Tenant-Id must be a valid numeric ID');
    }

    request.tenantId = tenantId;
    return true;
  }
}
