export interface DashboardPorMesDTO {
  mes: number;
  ano: number;
  total: number;
}

export interface DashboardPorAnoDTO {
  ano: number;
  total: number;
}

export interface DashboardMotivoNaoRealizacaoDTO {
  motivoId: string | null;
  motivoTexto: string;
  total: number;
}

export interface DashboardResponseDTO {
  /** Total de agendamentos no período (conforme filtro ano/coordenadoria) */
  totalGeral: number;
  /** Quantidade de agendamentos com status ATENDIDO */
  realizados: number;
  /** Quantidade de agendamentos com status NAO_REALIZADO */
  naoRealizados: number;
  /** Agendamentos agrupados por mês (1-12) no ano filtrado */
  porMes: DashboardPorMesDTO[];
  /** Agendamentos agrupados por ano (últimos anos disponíveis) */
  porAno: DashboardPorAnoDTO[];
  /** Motivos de não realização com quantidade (quando status NAO_REALIZADO) */
  motivosNaoRealizacao: DashboardMotivoNaoRealizacaoDTO[];
}
