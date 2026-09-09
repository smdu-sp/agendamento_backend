import { Injectable, Logger } from '@nestjs/common';

export interface LdapExternoUsuario {
  nome: string;
  email: string;
  login: string;
  telefone: string;
}

interface LdapExternoAutenticarResponse {
  status: 'OK' | 'ERROR';
  message?: string;
}

@Injectable()
export class LdapExternoService {
  private readonly logger = new Logger(LdapExternoService.name);

  private baseUrl(): string | undefined {
    const url = process.env.LDAP_API_URL;
    return url ? url.replace(/\/$/, '') : undefined;
  }

  async autenticar(login: string, senha: string): Promise<boolean> {
    const baseUrl = this.baseUrl();
    if (!baseUrl) {
      this.logger.error('LDAP_API_URL não configurada.');
      return false;
    }

    try {
      const response = await fetch(`${baseUrl}/auth/ldap/autenticar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, senha }),
      });
      if (!response.ok) return false;
      const data = (await response.json()) as LdapExternoAutenticarResponse;
      return data.status === 'OK';
    } catch (error) {
      this.logger.error('Falha ao autenticar no serviço LDAP externo:', error);
      return false;
    }
  }

  async buscarPorLogin(login: string): Promise<LdapExternoUsuario | null> {
    const baseUrl = this.baseUrl();
    if (!baseUrl) {
      this.logger.error('LDAP_API_URL não configurada.');
      return null;
    }

    try {
      const response = await fetch(
        `${baseUrl}/auth/ldap/buscar-por-login/${encodeURIComponent(login)}`,
      );
      if (response.status === 404) return null;
      if (!response.ok) return null;
      return (await response.json()) as LdapExternoUsuario;
    } catch (error) {
      this.logger.error(
        'Falha ao buscar usuário no serviço LDAP externo:',
        error,
      );
      return null;
    }
  }
}
