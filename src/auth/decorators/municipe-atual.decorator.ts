import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { MunicipeJwtPayload } from '../guards/municipe-jwt-auth.guard';

export const MunicipeAtual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MunicipeJwtPayload => {
    const req = ctx.switchToHttp().getRequest<{ municipe: MunicipeJwtPayload }>();
    return req.municipe;
  },
);
