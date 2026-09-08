import { Injectable, Logger } from '@nestjs/common';

interface TurnstileSiteverifyResponse {
  success: boolean;
  'error-codes'?: string[];
}

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  async verificar(token: string, ip?: string): Promise<boolean> {
    if (!token) return false;

    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      this.logger.error('TURNSTILE_SECRET_KEY não configurada.');
      return false;
    }

    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set('remoteip', ip);

    try {
      const response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        },
      );
      const data = (await response.json()) as TurnstileSiteverifyResponse;
      return data.success === true;
    } catch (error) {
      this.logger.error('Falha ao verificar Turnstile:', error);
      return false;
    }
  }
}
