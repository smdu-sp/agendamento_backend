import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export type MunicipeJwtPayload = {
  id: string;
  email: string;
  nome?: string;
};

@Injectable()
export class MunicipeJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ headers?: { authorization?: string }; municipe?: MunicipeJwtPayload }>();
    const auth = req.headers?.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de munícipe ausente.');
    }
    const token = auth.slice(7).trim();
    if (!token) {
      throw new UnauthorizedException('Token de munícipe ausente.');
    }
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: string;
        email?: string;
        nome?: string;
        escopo?: string;
      }>(token, { secret: process.env.JWT_SECRET });
      if (payload?.escopo !== 'MUNICIPE' || !payload.sub || !payload.email) {
        throw new UnauthorizedException('Token de munícipe inválido.');
      }
      req.municipe = {
        id: payload.sub,
        email: String(payload.email).trim().toLowerCase(),
        nome: typeof payload.nome === 'string' ? payload.nome : undefined,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token de munícipe inválido ou expirado.');
    }
  }
}
