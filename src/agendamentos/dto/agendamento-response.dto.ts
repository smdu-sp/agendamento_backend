import { Agendamento } from '@prisma/client';

export type AgendamentoResponseDTO = Agendamento & {
  tipoAgendamento?: { id: string; texto: string } | null;
  motivoNaoAtendimento?: { id: string; texto: string } | null;
  coordenadoria?: {
    id: string;
    sigla: string;
    nome?: string | null;
    email?: string | null;
  } | null;
  tecnico?: { id: string; nome: string; login: string; email?: string } | null;
  /** Quando o agendamento está ligado a uma solicitação Arthur (ou casando por `processo` = protocolo). */
  solicitacaoPreProjetoArthurSaboya?: {
    protocolo?: string;
    tecnicoArthurId?: string | null;
    tecnicoArthur?: {
      id: string;
      nome: string;
      login: string;
      email: string;
    } | null;
  } | null;
};

export interface AgendamentoPaginadoResponseDTO {
  total: number;
  pagina: number;
  limite: number;
  data: AgendamentoResponseDTO[];
}
