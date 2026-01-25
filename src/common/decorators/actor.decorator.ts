import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Actor = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return (
      request.headers['x-actor'] || request.headers['x-user-id'] || 'system'
    );
  },
);
