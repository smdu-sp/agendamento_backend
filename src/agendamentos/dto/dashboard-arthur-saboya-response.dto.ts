export interface DashboardArthurSaboyaFaixaTempoDTO {
  faixa: string;
  quantidade: number;
  percentual: number;
}

export interface DashboardArthurSaboyaFunilDTO {
  etapa: string;
  quantidade: number;
  percentual: number;
}

export interface DashboardArthurSaboyaPorSemanaDTO {
  semana: number;
  label: string;
  abertos: number;
  resolvidos: number;
}

export interface DashboardArthurSaboyaPorNaturezaDTO {
  natureza: string;
  volume: number;
  resolvidosSala: number;
  encaminhados: number;
  tempoMedioResolucaoDias: number | null;
}

export interface DashboardArthurSaboyaPorCoordenadoriaDTO {
  coordenadoriaId: string;
  /** Sigla da coordenadoria (ex.: COPELU). */
  coordenadoriaSigla: string;
  encaminhados: number;
  concluidos: number;
  tempoEsperaMedioDias: number | null;
  taxaNoShow: number;
}

export interface DashboardArthurSaboyaAgingDTO {
  faixa: string;
  quantidade: number;
}

export interface DashboardArthurSaboyaAgingEtapaDTO {
  etapa: string;
  quantidade: number;
}

export interface DashboardArthurSaboyaChamadoAntigoDTO {
  protocolo: string;
  natureza: string;
  etapa: string;
  coordenadoria: string | null;
  idadeDias: number;
}

export interface DashboardArthurSaboyaTempoEtapaDTO {
  etapa: string;
  mediaDias: number;
  medianaDias: number;
}

export interface DashboardArthurSaboyaResponseDTO {
  chamadosRecebidos: number;
  encerradosSala: number;
  taxaResolucaoSala: number;
  encaminhados: number;
  taxaEncaminhamento: number;
  tempoMedioPrimeiraRespostaDias: number | null;
  tempoMedianoPrimeiraRespostaDias: number | null;
  tempoMedioResolucaoDias: number | null;
  chamadosEmAberto: number;
  chamadosForaPrazo: number;
  funil: DashboardArthurSaboyaFunilDTO[];
  taxaAgendamentoAposEncaminhamento: number;
  taxaComparecimento: number;
  taxaNoShow: number;
  taxaConclusaoAposAtendimento: number;
  distribuicaoPrimeiraResposta: DashboardArthurSaboyaFaixaTempoDTO[];
  temposPorEtapa: DashboardArthurSaboyaTempoEtapaDTO[];
  porSemana: DashboardArthurSaboyaPorSemanaDTO[];
  porNatureza: DashboardArthurSaboyaPorNaturezaDTO[];
  porCoordenadoria: DashboardArthurSaboyaPorCoordenadoriaDTO[];
  aging: DashboardArthurSaboyaAgingDTO[];
  agingPorEtapa: DashboardArthurSaboyaAgingEtapaDTO[];
  chamadosMaisAntigos: DashboardArthurSaboyaChamadoAntigoDTO[];
  satisfacaoMedia: number | null;
  percentualAvaliacoesPositivas: number | null;
}
