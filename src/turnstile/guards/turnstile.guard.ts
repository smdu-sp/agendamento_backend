import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { TurnstileService } from '../turnstile.service';

@Injectable()
export class TurnstileGuard implements CanActivate {
  constructor(private readonly turnstileService: TurnstileService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<{ body?: { turnstileToken?: string }; ip?: string }>();

    const token = req.body?.turnstileToken;
    if (!token) {
      throw new BadRequestException('Verificação de segurança ausente.');
    }

    const valido = await this.turnstileService.verificar(token, req.ip);
    if (!valido) {
      throw new BadRequestException('Verificação de segurança falhou.');
    }

    return true;
  }
}
