import { TipoAgendamento } from '@prisma/client';

export type TipoAgendamentoResponseDTO = TipoAgendamento;

export interface TipoAgendamentoPaginadoResponseDTO {
  total: number;
  pagina: number;
  limite: number;
  data: TipoAgendamentoResponseDTO[];
}
