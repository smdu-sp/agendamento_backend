import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface ProgressoImportacao {
  /** 0–100 */
  percentual: number;
  etapa: string;
}

export interface ResultadoImportacao {
  importados: number;
  erros: number;
  duplicados: number;
}

export type TipoImportacao = 'planilha' | 'outlook';

export interface JobImportacao {
  id: string;
  tipo: TipoImportacao;
  status: 'em_andamento' | 'concluido' | 'erro';
  percentual: number;
  etapa: string;
  resultado?: ResultadoImportacao;
  erro?: string;
}

interface JobInterno extends JobImportacao {
  usuarioId: string;
  atualizadoEm: number;
}

/**
 * Executa importações em segundo plano e guarda o andamento para a tela consultar.
 *
 * O estado fica em memória: serve enquanto o backend rodar em uma única instância
 * (PM2 em modo fork, como em ecosystem.config.js). Se passar a rodar em cluster
 * ou com várias réplicas, mover este estado para o banco/Redis. Se o processo
 * reiniciar no meio da importação, o job some e a consulta devolve 404.
 */
@Injectable()
export class ImportacaoJobsService {
  private readonly logger = new Logger(ImportacaoJobsService.name);
  private readonly jobs = new Map<string, JobInterno>();

  /** Jobs terminados ficam disponíveis por este tempo para a tela ler o resultado. */
  private static readonly RETENCAO_MS = 30 * 60 * 1000;
  /** Job sem nenhum progresso por este tempo é considerado travado. */
  private static readonly SEM_PROGRESSO_MS = 15 * 60 * 1000;

  iniciar(
    tipo: TipoImportacao,
    usuarioId: string,
    executar: (
      progresso: (p: ProgressoImportacao) => void,
    ) => Promise<ResultadoImportacao>,
  ): JobImportacao {
    this.limpar();

    // Duas importações simultâneas do mesmo tipo disputariam as mesmas duplicatas.
    const emAndamento = [...this.jobs.values()].find(
      (j) => j.tipo === tipo && j.status === 'em_andamento',
    );
    if (emAndamento) {
      throw new ConflictException(
        'Já existe uma importação deste tipo em andamento. Aguarde a conclusão.',
      );
    }

    const job: JobInterno = {
      id: randomUUID(),
      tipo,
      usuarioId,
      status: 'em_andamento',
      percentual: 0,
      etapa: 'Iniciando',
      atualizadoEm: Date.now(),
    };
    this.jobs.set(job.id, job);

    const progresso = (p: ProgressoImportacao) => {
      // Nunca volta atrás e só chega a 100 quando o job termina de fato.
      job.percentual = Math.max(
        job.percentual,
        Math.min(99, Math.round(p.percentual)),
      );
      job.etapa = p.etapa;
      job.atualizadoEm = Date.now();
    };

    // Fora da requisição HTTP: a resposta volta já com o id do job.
    Promise.resolve()
      .then(() => executar(progresso))
      .then((resultado) => {
        job.status = 'concluido';
        job.percentual = 100;
        job.etapa = 'Concluído';
        job.resultado = resultado;
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Importação ${tipo} (${job.id}) falhou: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
        job.status = 'erro';
        job.erro =
          error instanceof Error && error.message
            ? error.message
            : 'Erro inesperado ao importar a planilha.';
      })
      .finally(() => {
        job.atualizadoEm = Date.now();
      });

    return this.visao(job);
  }

  obter(id: string, usuarioId: string): JobImportacao {
    this.limpar();
    const job = this.jobs.get(id);
    if (!job) {
      throw new NotFoundException(
        'Importação não encontrada (o servidor pode ter sido reiniciado).',
      );
    }
    if (job.usuarioId !== usuarioId) {
      throw new ForbiddenException('Esta importação pertence a outro usuário.');
    }
    return this.visao(job);
  }

  private visao(job: JobInterno): JobImportacao {
    const { usuarioId: _usuarioId, atualizadoEm: _atualizadoEm, ...publico } = job;
    return { ...publico };
  }

  private limpar() {
    const agora = Date.now();
    for (const [id, job] of this.jobs) {
      const parado = agora - job.atualizadoEm;
      if (
        job.status === 'em_andamento' &&
        parado > ImportacaoJobsService.SEM_PROGRESSO_MS
      ) {
        job.status = 'erro';
        job.erro = 'A importação parou de responder e foi interrompida.';
        job.atualizadoEm = agora;
      } else if (
        job.status !== 'em_andamento' &&
        parado > ImportacaoJobsService.RETENCAO_MS
      ) {
        this.jobs.delete(id);
      }
    }
  }
}
