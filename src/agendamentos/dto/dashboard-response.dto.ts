export interface DashboardPorMesDTO {
  mes: number;
  ano: number;
  total: number;
}

export interface DashboardPorAnoDTO {
  ano: number;
  total: number;
}

/** Por dia (usado na visualização por semana ou por mês) */
export interface DashboardPorDiaDTO {
  dia: number;
  label: string;
  total: number;
}

/** Por semana (número da semana no ano ou no mês) */
export interface DashboardPorSemanaDTO {
  semana: number;
  label: string;
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
  /** Agendamentos agrupados por mês (1-12) no ano filtrado (usado quando período = ano) */
  porMes: DashboardPorMesDTO[];
  /** Agendamentos agrupados por ano (últimos anos disponíveis) */
  porAno: DashboardPorAnoDTO[];
  /** Agendamentos por dia (usado quando período = semana ou mês). Semana: 1-7 (seg-dom), Mês: 1-31 */
  porDia?: DashboardPorDiaDTO[];
  /** Agendamentos por semana (ano: semana ISO 1-53; mês: semana 1-5 do mês) */
  porSemana?: DashboardPorSemanaDTO[];
  /** Motivos de não realização com quantidade (quando status NAO_REALIZADO) */
  motivosNaoRealizacao: DashboardMotivoNaoRealizacaoDTO[];
}
