import { Agendamento } from '@prisma/client';

export type AgendamentoResponseDTO = Agendamento & {
  tipoAgendamento?: { id: string; texto: string } | null;
  motivoNaoAtendimento?: { id: string; texto: string } | null;
  coordenadoria?: { id: string; sigla: string; nome?: string | null } | null;
  tecnico?: { id: string; nome: string; login: string } | null;
};

export interface AgendamentoPaginadoResponseDTO {
  total: number;
  pagina: number;
  limite: number;
  data: AgendamentoResponseDTO[];
}
