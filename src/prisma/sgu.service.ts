import { Global, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Timeout de conexão com o SGU. Sem isso, uma falha de rede (host inalcançável,
 * ex.: produção sem rota até o banco) fica pendurada no timeout padrão do driver
 * em vez de falhar rápido — e essa demora se paga a cada técnico não cacheado
 * numa importação, multiplicando um problema de rede num problema de desempenho.
 */
const SGU_CONNECT_TIMEOUT_S = 3;
const SGU_SOCKET_TIMEOUT_S = 3;

/** Depois de uma falha, pula novas tentativas por este tempo em vez de pagar o timeout de novo a cada chamada. */
const CIRCUITO_ABERTO_MS = 5 * 60 * 1000;

function urlComTimeouts(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('connect_timeout')) {
      parsed.searchParams.set('connect_timeout', String(SGU_CONNECT_TIMEOUT_S));
    }
    if (!parsed.searchParams.has('socket_timeout')) {
      parsed.searchParams.set('socket_timeout', String(SGU_SOCKET_TIMEOUT_S));
    }
    return parsed.toString();
  } catch {
    // URL não parseável (não deveria acontecer): usa como veio, sem timeout customizado.
    return url;
  }
}

@Global()
@Injectable()
export class SguService extends PrismaClient implements OnModuleInit {
  private circuitoAbertoAte = 0;

  constructor() {
    super(
      process.env.SGU_DATABASE_URL
        ? { datasources: { db: { url: urlComTimeouts(process.env.SGU_DATABASE_URL) } } }
        : undefined,
    );
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      // Já sabemos que está inacessível: evita pagar o timeout de novo na primeira consulta real.
      this.registrarFalha('conexão na inicialização', err);
    }
  }

  private registrarFalha(contexto: string, err: unknown) {
    this.circuitoAbertoAte = Date.now() + CIRCUITO_ABERTO_MS;
    console.warn(
      `[SguService] ${contexto} falhou; pausando novas tentativas ao SGU por ${CIRCUITO_ABERTO_MS / 1000}s:`,
      (err as Error)?.message,
    );
  }

  async buscarSiglaUnidadePorUsuarioRede(
    usuarioRede: string,
  ): Promise<string | null> {
    const login = String(usuarioRede || '')
      .trim()
      .toLowerCase();
    if (!login) return null;
    if (Date.now() < this.circuitoAbertoAte) return null;

    /** `cpUsuarioRede` no SGU já segue o mesmo formato do login local (ex.: dXXXXXX). */
    try {
      const rows = await this.$queryRaw<Array<{ sigla: string | null }>>`
        SELECT un.sigla AS sigla
        FROM tblUsuarios u
        LEFT JOIN tblUnidades un ON un.uid = u.cpUnid
        WHERE LOWER(TRIM(u.cpUsuarioRede)) = ${login}
        LIMIT 1
      `;
      // Alguns valores vêm com \r/\n residual (linha do Excel/import original do SGU).
      const sigla = rows?.[0]?.sigla?.trim();
      return sigla || null;
    } catch (err) {
      this.registrarFalha('buscarSiglaUnidadePorUsuarioRede', err);
      return null;
    }
  }
}
