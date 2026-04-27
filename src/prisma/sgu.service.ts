import { Global, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Global()
@Injectable()
export class SguService extends PrismaClient implements OnModuleInit {
  constructor() {
    super(
      process.env.SGU_DATABASE_URL
        ? { datasources: { db: { url: process.env.SGU_DATABASE_URL } } }
        : undefined,
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async buscarSiglaUnidadePorUsuarioRede(
    usuarioRede: string,
  ): Promise<string | null> {
    const login = String(usuarioRede || '')
      .trim()
      .toLowerCase();
    if (!login) return null;

    /** `cpUsuarioRede` no SGU já segue o mesmo formato do login local (ex.: dXXXXXX). */
    try {
      const rows = await this.$queryRaw<Array<{ sigla: string | null }>>`
        SELECT un.sigla AS sigla
        FROM tblUsuarios u
        LEFT JOIN tblUnidades un ON un.cdUnid = u.cpUnid
        WHERE LOWER(TRIM(u.cpUsuarioRede)) = ${login}
        LIMIT 1
      `;
      const sigla = rows?.[0]?.sigla?.trim();
      return sigla || null;
    } catch {
      return null;
    }
  }
}