import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext) {
    const permissoes = this.reflector.get<string[]>(
      'permissoes',
      context.getHandler(),
    );
    if (!permissoes || permissoes.length === 0) return true;
    const request = context.switchToHttp().getRequest();
    const permissao = request.user?.permissao;
    if (!permissao) return false;
    if (permissao === 'DEV') return true;
    return permissoes.includes(permissao);
  }
}
