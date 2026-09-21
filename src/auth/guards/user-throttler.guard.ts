import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limit por usuário autenticado, com fallback para o IP.
 *
 * O frontend (Next.js) chama a API pelo servidor, então todas as requisições
 * server-side chegam com o mesmo IP. Limitando só por IP, todos os usuários
 * dividiriam o mesmo balde e um pico de uso causaria 429 para quem não fez nada.
 *
 * Este guard roda depois do JwtAuthGuard (ver APP_GUARD em app.module.ts), então
 * `req.user` já está preenchido nas rotas autenticadas. Rotas públicas (login) e
 * rotas cujo guard próprio roda depois dos globais (refresh, munícipes) seguem
 * limitadas por IP, que é o que se quer contra força bruta.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id;
    return userId ? `user:${userId}` : req.ip;
  }
}
