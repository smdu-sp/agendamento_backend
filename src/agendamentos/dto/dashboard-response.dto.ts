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
  /** Quantidade com status ATENDIDO + CONCLUIDO */
  realizados: number;
  /** Quantidade com status NAO_REALIZADO + CANCELADO */
  naoRealizados: number;
  /** Apenas NAO_REALIZADO (para taxa de absenteísmo) */
  apenasNaoRealizado: number;
  /** Quantidade de dias distintos no período em que há pelo menos um agendamento */
  diasComAgendamentos: number;
  /** Agendamentos agrupados por mês (1-12) no ano filtrado */
  porMes: DashboardPorMesDTO[];
  /** Agendamentos agrupados por ano (últimos anos disponíveis) */
  porAno: DashboardPorAnoDTO[];
  /** Motivos de não realização com quantidade (quando status NAO_REALIZADO) */
  motivosNaoRealizacao: DashboardMotivoNaoRealizacaoDTO[];
}
