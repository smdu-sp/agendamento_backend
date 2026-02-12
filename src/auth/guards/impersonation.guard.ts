import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Permissao } from '@prisma/client';

const PERMISSOES_VALIDAS: Permissao[] = [
  'DEV',
  'ADM',
  'TEC',
  'USR',
  'PONTO_FOCAL',
  'COORDENADOR',
  'PORTARIA',
];

/**
 * Guard que permite usuário DEV personificar outra permissão via header.
 * Deve rodar após JwtAuthGuard (request.user já preenchido).
 * Header: X-Impersonate-Permissao (ex: ADM, TEC, PONTO_FOCAL, etc.)
 */
@Injectable()
export class ImpersonationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || user.permissao !== 'DEV') return true;

    const header = request.headers['x-impersonate-permissao'] as
      | string
      | undefined;
    if (!header || !header.trim()) return true;

    const permissao = header.trim().toUpperCase();
    if (!PERMISSOES_VALIDAS.includes(permissao as Permissao)) return true;

    request.user = { ...user, permissao };
    return true;
  }
}
