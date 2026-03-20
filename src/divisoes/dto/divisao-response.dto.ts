import { Divisao } from '@prisma/client';

export type DivisaoResponseDTO = Divisao & {
  coordenadoria?: { id: string; sigla: string; nome?: string | null } | null;
};

export interface DivisaoPaginadoResponseDTO {
  total: number;
  pagina: number;
  limite: number;
  data: DivisaoResponseDTO[];
}
