import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isAdmArthurSaboya } from 'src/agendamentos/constants/arthur-saboya-perfis';

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
    const permissaoReal = request.user?.permissaoReal as string | undefined;
    if (!permissao) return false;
    if (permissao === 'DEV') return true;
    if (permissaoReal === 'DEV') return true;
    if (permissaoReal === 'ADM') return true;
    // Administrador Arthur Saboya: endpoints da sala + painel admin
    // (sem herdar rotas de agendamentos gerais / importação só por ser ADM)
    if (isAdmArthurSaboya(permissao) || isAdmArthurSaboya(permissaoReal)) {
      return (
        permissoes.includes('ADM_ARTHUR_SABOYA') ||
        permissoes.includes('ARTHUR_SABOYA')
      );
    }
    return permissoes.includes(permissao);
  }
}
