/** Valores enviados pelo formulário em `Arthur Saboya/app/pre-projetos/page.tsx`. */
export const PRE_PROJETO_FORMACAO_VALORES = [
  'engenheiro-civil',
  'arquiteto',
  'tecnologo',
  'outra',
] as const;

export type PreProjetoFormacaoValor = (typeof PRE_PROJETO_FORMACAO_VALORES)[number];

export const PRE_PROJETO_FORMACAO_LABEL: Record<
  Exclude<PreProjetoFormacaoValor, 'outra'>,
  string
> = {
  'engenheiro-civil': 'Engenheiro Civil',
  arquiteto: 'Arquiteto',
  tecnologo: 'Tecnólogo',
};

export const PRE_PROJETO_NATUREZA_VALORES = [
  'his-hmp-parcelamento',
  'residencial-unifamiliar-certificado',
  'residencial-multifamiliar',
  'servicos-institucional',
  'comercio-industria',
  'regularizacao-imoveis',
  'acessibilidade-seguranca',
  'outra',
] as const;

export type PreProjetoNaturezaValor =
  (typeof PRE_PROJETO_NATUREZA_VALORES)[number];

export const PRE_PROJETO_NATUREZA_LABEL: Record<
  Exclude<PreProjetoNaturezaValor, 'outra'>,
  string
> = {
  'his-hmp-parcelamento': 'HIS / HMP ou Parcelamento do Solo',
  'residencial-unifamiliar-certificado':
    'Residencial Unifamiliar ou Certificado de Conclusão',
  'residencial-multifamiliar': 'Residencial Multifamiliar',
  'servicos-institucional': 'Serviços ou Institucional',
  'comercio-industria': 'Comércio ou Indústria',
  'regularizacao-imoveis': 'Regularização de Imóveis',
  'acessibilidade-seguranca':
    'Acessibilidade ou Segurança da Edificação',
};

/** Texto único em `tipos_agendamento` para este fluxo. */
export const PRE_PROJETO_TIPO_AGENDAMENTO_TEXTO =
  'Pré-projetos (Arthur Saboya)';
